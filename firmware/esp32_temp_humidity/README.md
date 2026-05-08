# ESP32 firmware (single file)

Upload every **30 seconds**:
- **POST** → `sensors/esp32-01/history` (append reading)
- **PUT** → `sensors/esp32-01/current` (latest status)

1. Edit settings at the top of `esp32_temp_humidity.ino`.
2. Upload and open Serial Monitor @ **115200** baud.
3. You should see `Firebase POST /history -> 200` and `Firebase PUT /current -> 200`.

## Wiring (DHT22 / DHT11)

| Sensor | ESP32 |
|--------|--------|
| VCC | 3.3V |
| GND | GND |
| DATA | GPIO 4 |
