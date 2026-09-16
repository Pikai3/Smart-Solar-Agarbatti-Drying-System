🌞 Smart Solar-Powered Agarbatti Drying System

📌 Problem Statement

Traditional agarbatti (incense stick) drying methods used by rural artisans depend heavily on sunlight and weather conditions. This leads to:

- Inconsistent drying quality
- Long drying times during humid or rainy seasons
- Reduced productivity and income

Our solution addresses these challenges by providing a controlled, efficient, and eco-friendly drying system.

---

💡 Solution Overview

We developed a smart, solar-powered agarbatti drying system that ensures consistent drying conditions regardless of weather. The system combines renewable energy, IoT monitoring, controlled heating, and sustainable packaging to improve efficiency and reliability.

---

⚙️ Key Features

☀️ Solar Air Heater (Primary Source)

- Uses a solar air heater as the primary drying mechanism
- Designed based on the transpired solar air heating method
-A metal roofing sheet with uniformly spaced micro-perforations (holes) is used
-These perforations allow ambient air to be drawn in and heated as it passes through the sun-heated surface
-The heated air is then directed into the drying chamber for efficient moisture removal
-This design improves heat absorption efficiency and airflow distribution
-Reduces energy loss and ensures uniform drying conditions

🔋 Solar Panel Backup System

- A solar panel with charge controller and battery is used as a backup
- Supplies power when sunlight is insufficient
- Ensures uninterrupted operation

🌡️ Controlled Drying Environment

- Insulated drying chamber with multiple trays
- Maintains optimal temperature and humidity for uniform drying
- Improves product quality and reduces drying time

🔥 Backup Heating System

- Integrated 12V 30W PTC heater
- Powered via battery when required
- Supports drying during low sunlight or high humidity conditions

📡 Smart Monitoring via Dhup (App) and offline Wi-Fi

- Uses ESP32 microcontroller
- Equipped with temperature and humidity sensors (SHT31)
- Accessible via both Bluetooth and WiFi for monitoring purposes
- Real-time data is monitored through our custom-built mobile app “Dhup” and Asynchronous offline Web server of the same name
- Enables users to track temperature and system status easily

📦 Integrated Biodegradable Packaging System 

- Uses biodegradable plus packets for eco-friendly packaging
- Includes a heat sealing unit for secure and hygienic packing
- Ensures immediate packaging after drying
- Enhances product shelf life while reducing environmental impact
- Eliminates the need for separate manual packaging

---

🛠️ Technologies Used

- Hardware:
  
  - Solar Air Heater
  - Solar Panel
  - Solar Charge Controller
  - 12V Battery
  - PTC Heater
  - ESP32 Microcontroller
  - SHT31 Temperature & Humidity Sensor
  - Heat Sealing Unit

- Software:
  
  - Embedded C / Arduino IDE
  - Mobile Application (Dhup App, Offline Wi-Fi Dhup)
  - IoT Communication (WiFi & Bluetooth)

---

🔄 Working Principle

1. Solar air heater captures sunlight and generates heat.
2. Hot air is circulated inside the drying chamber.
3. Sensors continuously monitor temperature and humidity.
4. Data is sent to the Dhup app via Bluetooth also to the offline Web server via Wi-Fi.
5. ESP32 maintains optimal drying conditions.
6. When sunlight is low, the solar panel + battery system provides backup power.
7. The PTC heater activates when additional heating is required.
8. After drying, agarbatti is packed using biodegradable plus packets and sealed instantly.

---

📈 Advantages

- Eco-friendly and energy-efficient
- Reduced dependency on weather conditions
- Faster and uniform drying
- Real-time monitoring via Dhup app and Wi-Fi
- Sustainable packaging using biodegradable materials
- Improved hygiene and product quality
- Low operational cost
- Suitable for rural and small-scale industries

---

🎯 Target Users

- Rural women artisans
- Small-scale agarbatti manufacturers
- Self-help groups (SHGs)

---

🚀 Future Enhancements

- Automated drying completion alerts in Dhup app
- AI-based drying time prediction
- Advanced analytics dashboard
- Scalable packaging automation

---

🏆 Project Context

This project was developed as part of the Smart India Hackathon (SIH) under the team name Voltwise, focusing on empowering rural artisans through sustainable technology.

---

👨‍💻 Team

Team Voltwise

- Hardware & IoT based solution development
- Focus on sustainability and rural impact

---

📌 Conclusion

This system provides a complete end-to-end solution (drying + smart monitoring via Dhup + biodegradable packaging), ensuring higher productivity, better quality, and increased income for agarbatti artisans while promoting sustainability.

---
