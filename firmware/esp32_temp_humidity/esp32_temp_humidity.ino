/**
 * ESP32 temperature & humidity -> Firebase (current + history)
 * SINGLE FILE — open only this .ino in Arduino IDE and upload.
 *
 * Each reading (every 30s):
 *   POST  -> sensors/esp32-01/history  (append, keeps history)
 *   PUT   -> sensors/esp32-01/current  (latest status for the app)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <time.h>

// ============ EDIT THESE VALUES ============

#define WIFI_SSID "Duba 9 Filaj DIICOT"
#define WIFI_PASSWORD "parolaparola123"

#define DHT_PIN 4
#define DHT_TYPE DHT11

#define READ_INTERVAL_MS 30000   // upload every 30 seconds

#define FIREBASE_HOST "https://team-proj-iot-default-rtdb.europe-west1.firebasedatabase.app"
#define FIREBASE_PATH "sensors/esp32-01"
#define FIREBASE_AUTH ""
#define DEVICE_ID "esp32-01"

// ===========================================

DHT dht(DHT_PIN, DHT_TYPE);

unsigned long lastReadMs = 0;
unsigned long wifiConnectStartMs = 0;
unsigned long lastWifiRetryMs = 0;
bool wifiConnectInProgress = false;
bool ntpSynced = false;

const unsigned long WIFI_CONNECT_TIMEOUT_MS = 25000;
const unsigned long WIFI_RETRY_DELAY_MS = 10000;

void syncNtpTime() {
  if (ntpSynced || WiFi.status() != WL_CONNECTED) {
    return;
  }

  configTime(0, 0, "pool.ntp.org", "time.google.com");

  struct tm timeinfo;
  for (int i = 0; i < 20; i++) {
    if (getLocalTime(&timeinfo, 5000)) {
      ntpSynced = true;
      Serial.println("NTP time synced (UTC)");
      return;
    }
    delay(500);
  }

  Serial.println("NTP sync failed; timestamps use device uptime (seconds).");
}

unsigned long readingTimestamp() {
  time_t now = time(nullptr);
  if (now > 1700000000) {
    return (unsigned long)now;
  }
  return millis() / 1000UL;
}

void serviceWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (wifiConnectInProgress) {
      Serial.println();
      Serial.print("WiFi connected. IP: ");
      Serial.println(WiFi.localIP());
      wifiConnectInProgress = false;
      syncNtpTime();
    }
    return;
  }

  ntpSynced = false;
  unsigned long now = millis();

  if (wifiConnectInProgress) {
    if (now - wifiConnectStartMs > WIFI_CONNECT_TIMEOUT_MS) {
      Serial.println();
      Serial.println("WiFi timed out. Retrying in 10s...");
      WiFi.disconnect(true);
      delay(250);
      wifiConnectInProgress = false;
      lastWifiRetryMs = now;
    }
    return;
  }

  if (now - lastWifiRetryMs < WIFI_RETRY_DELAY_MS) {
    return;
  }

  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.disconnect(true);
  delay(250);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  wifiConnectInProgress = true;
  wifiConnectStartMs = now;
  lastWifiRetryMs = now;
}

String buildPayload(float temperature, float humidity) {
  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["temperature"] = round(temperature * 10.0f) / 10.0f;
  doc["humidity"] = round(humidity * 10.0f) / 10.0f;
  doc["timestamp"] = readingTimestamp();

  String payload;
  serializeJson(doc, payload);
  return payload;
}

String firebaseUrl(const char* subPath) {
  String url = String(FIREBASE_HOST) + "/" + String(FIREBASE_PATH) + subPath + ".json";
  if (strlen(FIREBASE_AUTH) > 0) {
    url += "?auth=";
    url += FIREBASE_AUTH;
  }
  return url;
}

bool firebaseRequest(const char* method, const char* subPath, const String& payload) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = firebaseUrl(subPath);
  if (!http.begin(client, url)) {
    Serial.println("HTTP begin failed");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  int code = -1;

  if (strcmp(method, "POST") == 0) {
    code = http.POST(payload);
  } else if (strcmp(method, "PUT") == 0) {
    code = http.PUT(payload);
  }

  Serial.print("Firebase ");
  Serial.print(method);
  Serial.print(" ");
  Serial.print(subPath);
  Serial.print(" -> ");
  Serial.print(code);
  Serial.print(" | ");
  Serial.println(payload);

  http.end();
  return code >= 200 && code < 300;
}

bool uploadReading(float temperature, float humidity) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  syncNtpTime();
  String payload = buildPayload(temperature, humidity);

  bool historyOk = firebaseRequest("POST", "/history", payload);
  bool currentOk = firebaseRequest("PUT", "/current", payload);

  return historyOk && currentOk;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("ESP32 Temp/Humidity -> Firebase (30s, POST history)");

  dht.begin();

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  lastWifiRetryMs = 0;
  serviceWiFi();
}

void loop() {
  serviceWiFi();

  if (WiFi.status() != WL_CONNECTED) {
    delay(200);
    return;
  }

  unsigned long now = millis();
  if (now - lastReadMs < READ_INTERVAL_MS) {
    delay(100);
    return;
  }
  lastReadMs = now;

  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT read failed. Check wiring and DHT11 vs DHT22.");
    return;
  }

  Serial.printf("Sensor: %.1f C, %.1f %%\n", temperature, humidity);
  uploadReading(temperature, humidity);
}
