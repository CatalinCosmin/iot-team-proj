# ESP32 Temp/Humidity → Cloud → React Native

End-to-end IoT demo: an ESP32 reads a DHT22 sensor, uploads readings to **Firebase Realtime Database**, and a **React Native (Expo)** app displays live metrics from the cloud.

## Architecture

```
[DHT22] ──GPIO──► [ESP32 WiFi] ──HTTPS PUT──► [Firebase Realtime DB]
                                                      ▲
                                                      │ HTTPS GET (poll)
                                               [React Native App]
```

Bluetooth on the ESP32 is not used for the app link; WiFi + cloud keeps the phone and device independent (works on any network).

## Hardware

| Part | Notes |
|------|--------|
| ESP32 dev board | Any ESP32 with WiFi |
| DHT22 (or DHT11) | Data pin → **GPIO 4** (default in sketch), VCC 3.3V, GND |

## 1. Firebase setup (cloud)

1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Realtime Database** (not Firestore). Choose a region and start in **test mode** for development.
3. Copy your database URL, e.g. `https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com`.
4. In **Realtime Database → Rules**, paste the rules from `cloud/firebase-database-rules.json` (open read/write for class demos only; lock down for production).
5. Optional: add a 10–15 cm pull-up resistor (4.7kΩ) on the DHT data line if reads are unstable.

## 2. ESP32 firmware (Arduino IDE)

### Install board support

1. **File → Preferences → Additional Board Manager URLs**  
   Add: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
2. **Tools → Board → Boards Manager** → install **esp32** by Espressif.
3. Select your board: **Tools → Board → ESP32 Dev Module** (or your exact module).

### Install libraries (Sketch → Include Library → Manage Libraries)

- **DHT sensor library** (Adafruit)
- **Adafruit Unified Sensor**
- **ArduinoJson** by Benoit Blanchon (6.x)

### Configure and upload

1. Open `firmware/esp32_temp_humidity/esp32_temp_humidity.ino` in Arduino IDE (one file only).
2. Edit the **EDIT THESE VALUES** section at the top (WiFi, Firebase URL, DHT type).
3. Upload to the ESP32.
4. Open **Serial Monitor** at **115200** baud. You should see WiFi connect and `Firebase PUT 200`.

## 3. Mobile app (React Native / Expo)

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Expo Go](https://expo.dev/go) on your phone (easiest), or Android Studio / Xcode for emulators

### Run

```bash
cd mobile
npm install
```

Edit `mobile/src/config.ts` — use the **same** `FIREBASE_HOST` and `SENSOR_PATH` as in the `.ino` file.

```bash
npm start
```

Scan the QR code with Expo Go. Pull down to refresh; the app polls Firebase every 3 seconds.

## JSON payload shape

The ESP32 writes one object at `sensors/esp32-01`:

```json
{
  "deviceId": "esp32-01",
  "temperature": 23.4,
  "humidity": 51.2,
  "timestamp": 120
}
```

`timestamp` is seconds since the ESP32 booted (not wall-clock time). The app shows “Last sync” as when data was fetched from Firebase.

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| DHT read failed | Wiring, 3.3V, GPIO pin in `config.h`, DHT11 vs DHT22 |
| WiFi failed | 2.4 GHz network (ESP32 often cannot use 5 GHz-only SSIDs) |
| Firebase PUT 401/403 | Database rules; auth token if you enabled auth |
| App shows no data | Same `FIREBASE_HOST` and path in firmware and app; ESP32 Serial shows 200 |
| HTTPS errors on ESP32 | `client.setInsecure()` is used for demo TLS; for production, add root CA |
| DHT read failed | Set `DHT_TYPE` to `DHT11` or `DHT22` to match your sensor |

## Security (production)

- Do not leave Firebase rules open to the world.
- Use Firebase Authentication or signed tokens for writes.
- Prefer device-specific paths and rate limits.

## Project layout

```
firmware/esp32_temp_humidity/esp32_temp_humidity.ino   Single Arduino sketch
mobile/                         Expo React Native app
cloud/firebase-database-rules.json
```
