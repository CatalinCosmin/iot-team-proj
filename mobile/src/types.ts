export type SensorReading = {
  deviceId: string;
  temperature: number;
  humidity: number;
  /** Unix seconds (UTC) when NTP synced, else seconds since ESP32 boot */
  timestamp: number;
};

export type HistoryPoint = SensorReading & {
  id: string;
};
