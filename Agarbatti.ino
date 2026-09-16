#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>

#define DHT_HEATER_PIN 4
#define DHT_CHAMBER_PIN 5
#define DHTTYPE DHT11

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDRESS 0x3C

DHT dhtHeater(DHT_HEATER_PIN, DHTTYPE);
DHT dhtChamber(DHT_CHAMBER_PIN, DHTTYPE);

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

WebServer server(80);

const char* ssid = "DHUP";
const char* password = "PIKAI2345";

float heaterTemp = 0;
float chamberTemp = 0;
float humidity = 0;

bool heaterOnline = false;
bool chamberOnline = false;

unsigned long lastSensorRead = 0;
const unsigned long sensorInterval = 2000;

unsigned long lastGraphUpdate = 0;
const unsigned long graphInterval = 120000;

const int MAX_GRAPH_POINTS = 30;

float heaterHistory[MAX_GRAPH_POINTS];
float chamberHistory[MAX_GRAPH_POINTS];
unsigned long timeHistory[MAX_GRAPH_POINTS];

int graphCount = 0;

void readSensors()
{
    float hTemp = dhtHeater.readTemperature();

    if (!isnan(hTemp))
    {
        heaterTemp = hTemp;
        heaterOnline = true;
    }
    else
    {
        heaterOnline = false;
    }

    float cTemp = dhtChamber.readTemperature();
    float h = dhtChamber.readHumidity();

    if (!isnan(cTemp) && !isnan(h))
    {
        chamberTemp = cTemp;
        humidity = h;
        chamberOnline = true;
    }
    else
    {
        chamberOnline = false;
    }
}

void updateGraphData()
{
    if (graphCount < MAX_GRAPH_POINTS)
    {
        heaterHistory[graphCount] = heaterOnline ? heaterTemp : NAN;
        chamberHistory[graphCount] = chamberOnline ? chamberTemp : NAN;
        timeHistory[graphCount] = millis();

        graphCount++;
    }
    else
    {
        for (int i = 0; i < MAX_GRAPH_POINTS - 1; i++)
        {
            heaterHistory[i] = heaterHistory[i + 1];
            chamberHistory[i] = chamberHistory[i + 1];
            timeHistory[i] = timeHistory[i + 1];
        }

        heaterHistory[MAX_GRAPH_POINTS - 1] = heaterOnline ? heaterTemp : NAN;
        chamberHistory[MAX_GRAPH_POINTS - 1] = chamberOnline ? chamberTemp : NAN;
        timeHistory[MAX_GRAPH_POINTS - 1] = millis();
    }
}

void updateOLED()
{
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);

    display.setCursor(29, 0);
    display.println("TEAM VOLTWISE");

    display.setCursor(10, 10);
    display.println("  Solar Agarbatti");

    display.setCursor(38, 20);
    display.println("  Heater");

    display.drawLine(0, 30, 127, 30, SSD1306_WHITE);

    display.setCursor(0, 36);

    if (heaterOnline)
    {
        display.print("Heater OUT: ");
        display.print(heaterTemp, 1);
        display.println(" C");
    }
    else
    {
        display.println("Heater OUT: OFFLINE");
    }

    display.setCursor(0, 46);

    if (chamberOnline)
    {
        display.print("Chamber Temp: ");
        display.print(chamberTemp, 1);
        display.println(" C");
    }
    else
    {
        display.println("Chamber Temp: OFFLINE");
    }

    display.setCursor(0, 56);

    if (chamberOnline)
    {
        display.print("Humidity: ");
        display.print(humidity, 1);
        display.println(" %");
    }
    else
    {
        display.println("Humidity: OFFLINE");
    }

    display.display();
}

String getSensorData()
{
    String json = "{";

    json += "\"heater\":";
    if (heaterOnline)
        json += String(heaterTemp, 1);
    else
        json += "null";

    json += ",";

    json += "\"chamber\":";
    if (chamberOnline)
        json += String(chamberTemp, 1);
    else
        json += "null";

    json += ",";

    json += "\"humidity\":";
    if (chamberOnline)
        json += String(humidity, 1);
    else
        json += "null";

    json += ",";

    json += "\"heaterOnline\":";
    json += heaterOnline ? "true" : "false";

    json += ",";

    json += "\"chamberOnline\":";
    json += chamberOnline ? "true" : "false";

    json += "}";

    return json;
}

void handleData()
{
    server.send(200, "application/json", getSensorData());
}

void handleRoot()
{
    String html = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>VOLTWISE Solar Agarbatti Heater</title>

<style>

body {
    font-family: Arial, sans-serif;
    background: #f2f2f2;
    margin: 0;
    padding: 20px;
    text-align: center;
}

h1 {
    margin-bottom: 5px;
}

h2 {
    margin-top: 0;
    color: #555;
}

.container {
    max-width: 900px;
    margin: auto;
}

.cards {
    display: flex;
    justify-content: center;
    gap: 20px;
    flex-wrap: wrap;
    margin: 20px 0;
}

.card {
    background: white;
    padding: 20px;
    border-radius: 12px;
    width: 220px;
    box-shadow: 0 3px 10px rgba(0,0,0,0.15);
}

.card h3 {
    margin-top: 0;
}

.value {
    font-size: 25px;
    font-weight: bold;
    margin: 10px 0;
}

.offline {
    color: red;
}

.online {
    color: green;
}

.graph-container {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 3px 10px rgba(0,0,0,0.15);
    margin-top: 20px;
}

.graph-scroll {
    overflow-x: auto;
    padding-bottom: 8px;
}

canvas {
    display: block;
    height: 400px;
}

</style>
</head>

<body>

<div class="container">

<h1>TEAM VOLTWISE</h1>
<h2>Solar Agarbatti Heater</h2>

<div class="cards">

<div class="card">
<h3>Heater Output</h3>
<div class="value" id="heaterTemp">-- &deg;C</div>
<div id="heaterStatus">Connecting...</div>
</div>

<div class="card">
<h3>Chamber Temperature</h3>
<div class="value" id="chamberTemp">-- &deg;C</div>
<div id="chamberStatus">Connecting...</div>
</div>

<div class="card">
<h3>Humidity</h3>
<div class="value" id="humidity">-- %</div>
</div>

</div>

<div class="graph-container">

<h3>Temperature-Time Data Graph</h3>

<div class="graph-scroll" id="graphScroll">
<canvas id="tempGraph" width="850" height="400"></canvas>
</div>

</div>

</div>

<script>

const canvas = document.getElementById("tempGraph");
const ctx = canvas.getContext("2d");

let graphData = [];

const MIN_GRAPH_WIDTH = 850;
const POINT_SPACING = 55;
const GRAPH_INTERVAL = 60000;
const FIVE_MINUTES = 5 * 60 * 1000;
const PIXELS_PER_MILLISECOND = POINT_SPACING / GRAPH_INTERVAL;

let lastGraphTime = 0;
let selectedDataIndex = -1;

function updateDisplay(data)
{
    const heaterTempElement = document.getElementById("heaterTemp");
    const chamberTempElement = document.getElementById("chamberTemp");
    const humidityElement = document.getElementById("humidity");

    const heaterStatus = document.getElementById("heaterStatus");
    const chamberStatus = document.getElementById("chamberStatus");

    if (data.heaterOnline)
    {
        heaterTempElement.innerHTML = data.heater.toFixed(1) + " &deg;C";
        heaterStatus.innerHTML = "ONLINE";
        heaterStatus.className = "online";
    }
    else
    {
        heaterTempElement.innerHTML = "OFFLINE";
        heaterStatus.innerHTML = "OFFLINE";
        heaterStatus.className = "offline";
    }

    if (data.chamberOnline)
    {
        chamberTempElement.innerHTML = data.chamber.toFixed(1) + " &deg;C";
        humidityElement.innerHTML = data.humidity.toFixed(1) + " %";

        chamberStatus.innerHTML = "ONLINE";
        chamberStatus.className = "online";
    }
    else
    {
        chamberTempElement.innerHTML = "OFFLINE";
        humidityElement.innerHTML = "OFFLINE";

        chamberStatus.innerHTML = "OFFLINE";
        chamberStatus.className = "offline";
    }
}

function updateGraph(data)
{
    const now = Date.now();

    if (lastGraphTime === 0 || now - lastGraphTime >= GRAPH_INTERVAL)
    {
        graphData.push({
            time: new Date(now),
            heater: data.heaterOnline ? data.heater : null,
            chamber: data.chamberOnline ? data.chamber : null
        });

        lastGraphTime = now;

        drawGraph();
    }
}

function drawGraph()
{
    const left = 60;
    const right = 20;
    // Reserve a separate row above the plot for the series legend.
    const top = 55;
    const bottom = 50;

    const firstTime = graphData.length > 0 ? graphData[0].time.getTime() : Date.now();
    const lastTime = graphData.length > 0
        ? graphData[graphData.length - 1].time.getTime()
        : firstTime;

    // Keep readings close together while placing them according to their time.
    canvas.width = Math.max(
        MIN_GRAPH_WIDTH,
        left + right + (lastTime - firstTime) * PIXELS_PER_MILLISECOND
    );
    canvas.height = 400;

    const graphWidth = canvas.width - left - right;
    const graphHeight = canvas.height - top - bottom;

    const minTemp = 20;
    const maxTemp = 45;
    const xForTime = time => left + (time - firstTime) * PIXELS_PER_MILLISECOND;

    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 1;

    ctx.font = "12px Arial";
    ctx.fillStyle = "#333333";
    ctx.textAlign = "right";

    for (let temp = 20; temp <= 45; temp += 5)
    {
        const y = top + graphHeight - ((temp - minTemp) / (maxTemp - minTemp)) * graphHeight;

        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(left + graphWidth, y);
        ctx.stroke();

        ctx.fillText(temp + " °C", left - 8, y + 4);
    }

    // Clock-aligned five-minute markers: 09:57 starts with a 10:00 marker.
    if (graphData.length > 0)
    {
        const nextMark = new Date(firstTime);
        nextMark.setSeconds(0, 0);
        nextMark.setMinutes(Math.floor(nextMark.getMinutes() / 5) * 5 + 5);

        ctx.textAlign = "center";
        for (let markTime = nextMark.getTime(); xForTime(markTime) <= left + graphWidth; markTime += FIVE_MINUTES)
        {
            const x = xForTime(markTime);

            ctx.strokeStyle = "#e0e0e0";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, top + graphHeight);
            ctx.stroke();

            ctx.fillStyle = "#333333";
            ctx.fillText(new Date(markTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            }), x, top + graphHeight + 25);
        }
    }

    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, top + graphHeight);
    ctx.lineTo(left + graphWidth, top + graphHeight);
    ctx.stroke();

    function drawLine(key, lineColor)
    {
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;

        let drawing = false;

        ctx.beginPath();

        for (let i = 0; i < graphData.length; i++)
        {
            const value = graphData[i][key];

            if (value === null)
            {
                drawing = false;
                continue;
            }

            const x = xForTime(graphData[i].time.getTime());

            const clampedValue = Math.max(
                minTemp,
                Math.min(maxTemp, value)
            );

            const y = top +
                graphHeight -
                ((clampedValue - minTemp) /
                (maxTemp - minTemp)) * graphHeight;

            if (!drawing)
            {
                ctx.moveTo(x, y);
                drawing = true;
            }
            else
            {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
    }

    drawLine("heater", "red");
    drawLine("chamber", "blue");

    function drawPoints(key, pointColor)
    {
        ctx.fillStyle = pointColor;

        for (let i = 0; i < graphData.length; i++)
        {
            const value = graphData[i][key];
            if (value === null) continue;

            const x = xForTime(graphData[i].time.getTime());
            const y = top + graphHeight -
                ((Math.max(minTemp, Math.min(maxTemp, value)) - minTemp) /
                (maxTemp - minTemp)) * graphHeight;

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawPoints("heater", "red");
    drawPoints("chamber", "blue");

    // The legend sits above the graph instead of covering the plotted data.
    ctx.font = "14px Arial";
    ctx.textAlign = "left";

    ctx.fillStyle = "red";
    ctx.fillText("Heater Temperature", left + 10, 28);

    ctx.fillStyle = "blue";
    ctx.fillText("Chamber Temperature", left + 175, 28);

    ctx.fillStyle = "#333333";
    ctx.textAlign = "center";
    ctx.fillText(
        "Time",
        left + graphWidth / 2,
        canvas.height - 5
    );

    if (selectedDataIndex >= 0 && selectedDataIndex < graphData.length)
    {
        const point = graphData[selectedDataIndex];
        const details = [
            point.time.toLocaleString(),
            "Heater: " + (point.heater === null ? "Offline" : point.heater.toFixed(1) + " °C"),
            "Chamber: " + (point.chamber === null ? "Offline" : point.chamber.toFixed(1) + " °C")
        ];
        const pointX = xForTime(point.time.getTime());
        const boxWidth = 190;
        const boxX = Math.max(left, Math.min(pointX + 10, canvas.width - right - boxWidth));
        const boxY = top + 10;

        ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
        ctx.strokeStyle = "#555555";
        ctx.lineWidth = 1;
        ctx.fillRect(boxX, boxY, boxWidth, 60);
        ctx.strokeRect(boxX, boxY, boxWidth, 60);
        ctx.fillStyle = "#222222";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        details.forEach((detail, index) => ctx.fillText(detail, boxX + 8, boxY + 16 + index * 18));
    }
}

canvas.addEventListener("click", event =>
{
    if (graphData.length === 0) return;

    const left = 60;
    const rect = canvas.getBoundingClientRect();
    const clickX = (event.clientX - rect.left) * canvas.width / rect.width;
    const firstTime = graphData[0].time.getTime();
    const clickedTime = firstTime + (clickX - left) / PIXELS_PER_MILLISECOND;
    let closestIndex = 0;

    for (let i = 1; i < graphData.length; i++)
    {
        if (Math.abs(graphData[i].time.getTime() - clickedTime) <
            Math.abs(graphData[closestIndex].time.getTime() - clickedTime))
        {
            closestIndex = i;
        }
    }

    const closestX = left + (graphData[closestIndex].time.getTime() - firstTime) * PIXELS_PER_MILLISECOND;
    selectedDataIndex = Math.abs(closestX - clickX) <= 18 ? closestIndex : -1;
    drawGraph();
});

function fetchData()
{
    fetch("/data")
        .then(response => response.json())
        .then(data =>
        {
            updateDisplay(data);
            updateGraph(data);
        })
        .catch(error =>
        {
            console.log(error);
        });
}

setInterval(fetchData, 2000);

fetchData();

</script>

</body>
</html>
)rawliteral";

    server.send(200, "text/html", html);
}

void setup()
{
    Serial.begin(115200);

    dhtHeater.begin();
    dhtChamber.begin();

    Wire.begin(21, 22);

    if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS))
    {
        Serial.println("OLED initialization failed");
        while (true);
    }

    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);

    display.setCursor(29, 0);
    display.println("TEAM VOLTWISE");

    display.setCursor(10, 10);
    display.println("  Solar Agarbatti");

    display.setCursor(38, 20);
    display.println("  Heater");

    display.display();

    WiFi.softAP(ssid, password);

    Serial.println();
    Serial.println("WiFi AP Started");
    Serial.print("SSID: ");
    Serial.println(ssid);

    Serial.print("IP Address: ");
    Serial.println(WiFi.softAPIP());

    server.on("/", handleRoot);
    server.on("/data", handleData);

    server.begin();

    delay(2000);

    readSensors();
    updateOLED();

    lastSensorRead = millis();
    lastGraphUpdate = millis();
}

void loop()
{
    server.handleClient();

    unsigned long currentMillis = millis();

    if (currentMillis - lastSensorRead >= sensorInterval)
    {
        lastSensorRead = currentMillis;

        readSensors();
        updateOLED();
    }
}