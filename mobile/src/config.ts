export const FIREBASE_HOST =
  'https://team-proj-iot-default-rtdb.europe-west1.firebasedatabase.app';

export const SENSOR_PATH = 'sensors/esp32-01';

/**
 * How many history points to fetch from Firebase.
 * At 30-second ESP32 intervals this covers ~2.5 hours of readings.
 * Increase further if you want to cover full-day / week windows in Statistics.
 */
export const HISTORY_LIMIT = 300;

/** Poll interval when the app is in the foreground (ms) */
export const POLL_INTERVAL_MS = 5000;
