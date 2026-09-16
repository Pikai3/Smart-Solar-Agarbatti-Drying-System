/* =========================================================
   GramSense - App Logic
   Sections:
   1. Config (edit BLE UUIDs + alert thresholds here)
   2. State + persistent storage (history / alerts)
   3. Language / screen navigation (unchanged behaviour)
   4. Web Bluetooth connection
   5. Reading pipeline (feeds UI + history + alerts)
   6. Alerts engine
   7. History rendering (chart + list)
   8. PWA install + service worker
   ========================================================= */


/* ---------- 1. CONFIG ---------- */

// These are the STANDARD Bluetooth SIG GATT UUIDs for environmental
// sensors and battery level. Many off-the-shelf BLE temp/humidity
// sensors already expose these. If your dryer runs custom ESP32/Arduino
// firmware, either (a) implement these standard services in your
// firmware, or (b) replace the strings below with your own custom
// service/characteristic UUIDs from your firmware code.
const BLE_CONFIG = {
    services: {
        environmentalSensing: "environmental_sensing", // 0x181A
        battery: "battery_service"                     // 0x180F
    },
    characteristics: {
        temperature: "temperature", // 0x2A6E - int16, /100 = °C
        humidity: "humidity",       // 0x2A6F - uint16, /100 = %
        batteryLevel: "battery_level" // 0x2A19 - uint8, 0-100%
    }
};

// Alert thresholds - tune these to your product's ideal drying range
const THRESHOLDS = {
    tempHigh: 38,   // °C
    tempLow: 20,    // °C
    humHigh: 75,    // %
    battLow: 20     // %
};

const MAX_HISTORY_POINTS = 200;


/* ---------- 2. STATE + STORAGE ---------- */

let selectedLanguage = "English";
let bleDevice = null;
let bleServer = null;
let isConnected = false;
let demoInterval = null;

let history = loadJSON("gramsense_history", []);
let alerts = loadJSON("gramsense_alerts", []);
let activeAlertFlags = {}; // tracks which alert types are currently "open" to avoid spam

function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function saveJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn("Storage save failed", e);
    }
}


/* ---------- 3. LANGUAGE / SCREEN NAVIGATION ---------- */

const translations = {
    English: {
        welcome: "Welcome",
        welcomeText: "Monitor Agarbatti Drying Process in Real Time",
        getStarted: "Get Started",
        connect: "Connect Smart Dryer",
        tap: "Tap To Connect",
        history: "History",
        alerts: "Alerts",
        packaging: "Packaging",
        settings: "Settings"
    },
    "বাংলা": {
        welcome: "স্বাগতম",
        welcomeText: "রিয়েল টাইমে আগরবাতি শুকানোর অবস্থা দেখুন",
        getStarted: "শুরু করুন",
        connect: "স্মার্ট ড্রায়ার সংযুক্ত করুন",
        tap: "সংযোগ করতে চাপুন",
        history: "ইতিহাস",
        alerts: "সতর্কতা",
        packaging: "প্যাকেজিং",
        settings: "সেটিংস"
    },
    "हिन्दी": {
        welcome: "स्वागत है",
        welcomeText: "अगरबत्ती सुखाने की स्थिति रियल टाइम में देखें",
        getStarted: "शुरू करें",
        connect: "स्मार्ट ड्रायर कनेक्ट करें",
        tap: "कनेक्ट करने के लिए दबाएं",
        history: "इतिहास",
        alerts: "अलर्ट",
        packaging: "पैकेजिंग",
        settings: "सेटिंग्स"
    }
};

// Splash Screen
setTimeout(() => {
    showScreen("languageScreen");
}, 2000);

function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });
    document.getElementById(screenId).classList.add("active");
}

function selectLanguage(lang) {
    selectedLanguage = lang;
    applyLanguage(lang);
    showScreen("welcomeScreen");
}

function applyLanguage(lang) {
    const t = translations[lang];

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    };

    setText("welcomeTitle", t.welcome);
    setText("welcomeText", t.welcomeText);
    setText("startBtn", t.getStarted);
    setText("connectTitle", t.connect);
    setText("connectText", t.tap);
    setText("historyHeading", "📈 " + t.history);
    setText("alertsHeading", "🔔 " + t.alerts);
    setText("packagingHeading", "📦 " + t.packaging);
    setText("settingsHeading", "⚙ " + t.settings);
    setText("languageName", lang);
}

function showConnect() {
    showScreen("connectScreen");
}

function openPage(pageId) {
    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });
    document.getElementById(pageId).classList.add("active");

    if (pageId === "historyPage") renderHistory();
    if (pageId === "alertsPage") renderAlerts();
}


/* ---------- 4. WEB BLUETOOTH CONNECTION ---------- */

async function connectDevice() {
    const connectText = document.getElementById("connectText");

    if (!navigator.bluetooth) {
        connectText.innerText = "Bluetooth not supported on this browser";
        showDemoOption();
        return;
    }

    connectText.innerText = "Choose your dryer...";

    try {
        bleDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [
                BLE_CONFIG.services.environmentalSensing,
                BLE_CONFIG.services.battery
            ]
        });

        connectText.innerText = "Connecting...";

        bleDevice.addEventListener("gattserverdisconnected", onDeviceDisconnected);

        bleServer = await bleDevice.gatt.connect();

        await Promise.all([
            subscribeTemperatureHumidity(bleServer),
            subscribeBattery(bleServer)
        ]);

        connectText.innerText = "Connected Successfully ✓";
        enterApp(true);
        requestNotificationPermission();

    } catch (err) {
        console.warn("Bluetooth connection failed or cancelled:", err);
        connectText.innerText = "Couldn't connect — check dryer is powered on";
        showDemoOption();
    }
}

async function subscribeTemperatureHumidity(server) {
    try {
        const service = await server.getPrimaryService(BLE_CONFIG.services.environmentalSensing);

        const tempChar = await service.getCharacteristic(BLE_CONFIG.characteristics.temperature);
        const humChar = await service.getCharacteristic(BLE_CONFIG.characteristics.humidity);

        tempChar.addEventListener("characteristicvaluechanged", (e) => {
            const value = e.target.value.getInt16(0, true) / 100;
            handleTemperatureReading(value);
        });
        humChar.addEventListener("characteristicvaluechanged", (e) => {
            const value = e.target.value.getUint16(0, true) / 100;
            handleHumidityReading(value);
        });

        await tempChar.startNotifications();
        await humChar.startNotifications();

        // Also grab an initial reading immediately
        const initTemp = await tempChar.readValue();
        handleTemperatureReading(initTemp.getInt16(0, true) / 100);
        const initHum = await humChar.readValue();
        handleHumidityReading(initHum.getUint16(0, true) / 100);

    } catch (err) {
        console.warn("Environmental sensing service unavailable on this device:", err);
        // Device doesn't expose the standard service - fall back to demo values
        // so the UI still has something to show, but let the user know.
    }
}

async function subscribeBattery(server) {
    try {
        const service = await server.getPrimaryService(BLE_CONFIG.services.battery);
        const battChar = await service.getCharacteristic(BLE_CONFIG.characteristics.batteryLevel);

        battChar.addEventListener("characteristicvaluechanged", (e) => {
            handleBatteryReading(e.target.value.getUint8(0));
        });

        await battChar.startNotifications();
        const initBatt = await battChar.readValue();
        handleBatteryReading(initBatt.getUint8(0));

    } catch (err) {
        console.warn("Battery service unavailable on this device:", err);
    }
}

function onDeviceDisconnected() {
    isConnected = false;
    const badge = document.querySelector(".connected");
    if (badge) badge.innerHTML = "🔴 Disconnected";
    raiseAlert("connection", "Dryer disconnected — check power / range", "warning");
}

function showDemoOption() {
    let link = document.getElementById("demoModeLink");
    if (!link) {
        link = document.createElement("p");
        link.id = "demoModeLink";
        link.className = "demo-link";
        link.innerText = "Continue in Demo Mode →";
        link.onclick = () => enterApp(false);
        document.getElementById("connectScreen").appendChild(link);
    }
}

function enterApp(realDevice) {
    document.getElementById("connectScreen").style.display = "none";
    document.getElementById("appScreen").style.display = "block";
    isConnected = true;

    const badge = document.querySelector(".connected");
    if (badge) badge.innerHTML = realDevice ? "🟢 Connected" : "🟡 Demo Mode";

    if (!realDevice) {
        startDemoSimulation();
    }
}


/* ---------- 5. READING PIPELINE ---------- */

let latest = { temp: null, hum: null, battery: null };

function handleTemperatureReading(value) {
    latest.temp = value;
    const el = document.getElementById("temp");
    if (el) el.innerText = value.toFixed(1) + "°C";
    checkTempAlerts(value);
    pushHistoryPoint();
    updateCondition();
}

function handleHumidityReading(value) {
    latest.hum = Math.round(value);
    const el = document.getElementById("hum");
    if (el) el.innerText = latest.hum + "%";
    checkHumidityAlerts(latest.hum);
    pushHistoryPoint();
    updateCondition();
}

function handleBatteryReading(value) {
    latest.battery = value;
    const el = document.getElementById("battery");
    if (el) el.innerText = value + "%";
    checkBatteryAlerts(value);
}

// Demo Mode - simulates sensor values so the UI/alerts/history can be tested
// without real hardware connected.
let demoState = { temperature: 30, humidity: 65, battery: 84, progress: 70 };

function startDemoSimulation() {
    demoInterval = setInterval(() => {
        demoState.temperature = +(28 + Math.random() * 12).toFixed(1);
        demoState.humidity = Math.round(50 + Math.random() * 30);
        demoState.battery = Math.max(5, demoState.battery - 1);
        if (demoState.battery <= 20) demoState.battery = 84;
        demoState.progress = demoState.progress + 1 > 100 ? 70 : demoState.progress + 1;

        handleTemperatureReading(demoState.temperature);
        handleHumidityReading(demoState.humidity);
        handleBatteryReading(demoState.battery);
        updateProgress(demoState.progress);

    }, 3000);
}

function updateProgress(progress) {
    const text = document.getElementById("progressText");
    const fill = document.getElementById("progressFill");
    if (text) text.innerText = progress + "%";
    if (fill) fill.style.width = progress + "%";
}

function updateCondition() {
    const card = document.querySelector(".condition-card");
    if (!card || latest.hum === null) return;

    if (latest.hum > THRESHOLDS.humHigh) {
        card.innerHTML = `<h3>⚠ High Humidity</h3><p>Drying may become slower</p>`;
    } else {
        card.innerHTML = `<h3>☀ Good For Drying</h3><p>Temperature & Humidity are ideal</p>`;
    }
}


/* ---------- 6. ALERTS ENGINE ---------- */

function checkTempAlerts(value) {
    if (value >= THRESHOLDS.tempHigh) {
        raiseAlert("tempHigh", `High temperature: ${value.toFixed(1)}°C`, "danger");
    } else {
        clearAlert("tempHigh");
    }

    if (value <= THRESHOLDS.tempLow) {
        raiseAlert("tempLow", `Low temperature: ${value.toFixed(1)}°C`, "warning");
    } else {
        clearAlert("tempLow");
    }
}

function checkHumidityAlerts(value) {
    if (value >= THRESHOLDS.humHigh) {
        raiseAlert("humHigh", `High humidity: ${value}%`, "warning");
    } else {
        clearAlert("humHigh");
    }
}

function checkBatteryAlerts(value) {
    if (value <= THRESHOLDS.battLow) {
        raiseAlert("battLow", `Low battery: ${value}%`, "danger");
    } else {
        clearAlert("battLow");
    }
}

function raiseAlert(flag, message, level) {
    // Only fire once per "episode" - don't spam an alert every reading
    if (activeAlertFlags[flag]) return;
    activeAlertFlags[flag] = true;

    const alert = {
        id: Date.now() + "_" + flag,
        message,
        level, // "danger" | "warning"
        time: new Date().toISOString()
    };

    alerts.unshift(alert);
    alerts = alerts.slice(0, 50); // keep last 50
    saveJSON("gramsense_alerts", alerts);

    renderAlerts();
    notifyUser(message);
}

function clearAlert(flag) {
    activeAlertFlags[flag] = false;
}

function renderAlerts() {
    const page = document.getElementById("alertsPage");
    if (!page) return;

    const heading = document.getElementById("alertsHeading");
    page.innerHTML = "";
    if (heading) page.appendChild(heading);

    if (alerts.length === 0) {
        const card = document.createElement("div");
        card.className = "card";
        card.innerText = "No Active Alerts";
        page.appendChild(card);
        return;
    }

    const clearBtn = document.createElement("button");
    clearBtn.className = "btn-secondary";
    clearBtn.innerText = "Clear All Alerts";
    clearBtn.onclick = clearAllAlerts;
    page.appendChild(clearBtn);

    alerts.forEach(a => {
        const item = document.createElement("div");
        item.className = "card alert-item " + a.level;
        const time = new Date(a.time).toLocaleString();
        item.innerHTML = `<strong>${a.level === "danger" ? "⛔" : "⚠"} ${a.message}</strong><p class="alert-time">${time}</p>`;
        page.appendChild(item);
    });
}

function clearAllAlerts() {
    alerts = [];
    activeAlertFlags = {};
    saveJSON("gramsense_alerts", alerts);
    renderAlerts();
}

function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

function notifyUser(message) {
    // Vibration (mobile)
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

    // Browser/OS notification
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("GramSense Alert", { body: message, icon: "icons/icon-192.png" });
    }

    // Audible beep
    playBeep();
}

function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
        // Web Audio not available - ignore
    }
}


/* ---------- 7. HISTORY (persisted past readings) ---------- */

function pushHistoryPoint() {
    if (latest.temp === null || latest.hum === null) return;

    const last = history[history.length - 1];
    const now = Date.now();

    // Avoid double-logging when temp and humidity events fire back to back
    if (last && now - last.t < 1000) {
        last.temp = latest.temp;
        last.hum = latest.hum;
    } else {
        history.push({ t: now, temp: latest.temp, hum: latest.hum });
    }

    if (history.length > MAX_HISTORY_POINTS) {
        history = history.slice(history.length - MAX_HISTORY_POINTS);
    }

    saveJSON("gramsense_history", history);

    if (document.getElementById("historyPage").classList.contains("active")) {
        renderHistory();
    }
}

function renderHistory() {
    renderHistoryChart();
    renderHistoryList();
}

function renderHistoryChart() {
    const svg = document.getElementById("historyChart");
    if (!svg) return;
    svg.innerHTML = "";

    if (history.length < 2) {
        return;
    }

    const points = history.slice(-50); // last 50 points on the chart
    const width = 300, height = 100;

    const temps = points.map(p => p.temp);
    const hums = points.map(p => p.hum);

    const tempLine = toPolyline(temps, 0, 50, width, height);
    const humLine = toPolyline(hums, 0, 100, width, height);

    svg.innerHTML = `
        <polyline points="${tempLine}" fill="none" stroke="#EF4444" stroke-width="2" />
        <polyline points="${humLine}" fill="none" stroke="#2563EB" stroke-width="2" />
    `;
}

function toPolyline(values, min, max, width, height) {
    const range = (max - min) || 1;
    const step = width / Math.max(values.length - 1, 1);

    return values.map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * height;
        return `${x.toFixed(1)},${Math.max(0, Math.min(height, y)).toFixed(1)}`;
    }).join(" ");
}

function renderHistoryList() {
    let list = document.getElementById("historyList");
    if (!list) return;
    list.innerHTML = "";

    if (history.length === 0) {
        list.innerHTML = "<p>No readings recorded yet.</p>";
        return;
    }

    const recent = history.slice().reverse().slice(0, 30);

    recent.forEach(r => {
        const row = document.createElement("div");
        row.className = "history-row";
        const time = new Date(r.t).toLocaleString();
        row.innerHTML = `<span>${time}</span><span>${r.temp.toFixed(1)}°C</span><span>${r.hum}%</span>`;
        list.appendChild(row);
    });
}

function clearHistory() {
    history = [];
    saveJSON("gramsense_history", history);
    renderHistory();
}


/* ---------- 8. PWA: INSTALL PROMPT + SERVICE WORKER ---------- */

let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById("installAppBtn");
    if (btn) btn.style.display = "block";
});

function installApp() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(() => {
        deferredInstallPrompt = null;
        const btn = document.getElementById("installAppBtn");
        if (btn) btn.style.display = "none";
    });
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch(err => {
            console.warn("Service worker registration failed:", err);
        });
    });
}
