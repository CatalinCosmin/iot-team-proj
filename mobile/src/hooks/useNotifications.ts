import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import type { SensorReading, ThresholdSettings } from '../types';

// expo-notifications prints a loud console error in Expo Go (SDK 53+) when the
// module tries to auto-register a remote push token, even when we only use
// local notifications. Opt out of that registration path entirely.
const isExpoGo = Constants.executionEnvironment === 'storeClient';


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type AlertKey = 'tempHigh' | 'tempLow' | 'humidHigh' | 'humidLow';

export function useNotifications() {
  const permissionGranted = useRef(false);
  const lastAlertAt = useRef<Partial<Record<AlertKey, number>>>({});

  useEffect(() => {
    // Remote push tokens are unavailable in Expo Go since SDK 53; skip the
    // permission request that triggers the warning, but still allow local
    // notifications (scheduleNotificationAsync works without a push token).
    if (isExpoGo) {
      permissionGranted.current = true;
      return;
    }
    Notifications.requestPermissionsAsync().then(({ status }) => {
      permissionGranted.current = status === 'granted';
    });
  }, []);

  const checkThresholds = useCallback(
    async (reading: SensorReading, settings: ThresholdSettings) => {
      if (!settings.enabled || !permissionGranted.current) return;

      const now = Date.now();
      const cooldownMs = settings.cooldownMinutes * 60 * 1000;

      const alerts: { key: AlertKey; title: string; body: string }[] = [];

      if (reading.temperature > settings.tempMax) {
        alerts.push({
          key: 'tempHigh',
          title: 'High Temperature Alert',
          body: `Temperature is ${reading.temperature.toFixed(1)}°C — above the ${settings.tempMax}°C limit.`,
        });
      } else if (reading.temperature < settings.tempMin) {
        alerts.push({
          key: 'tempLow',
          title: 'Low Temperature Alert',
          body: `Temperature is ${reading.temperature.toFixed(1)}°C — below the ${settings.tempMin}°C minimum.`,
        });
      }

      if (reading.humidity > settings.humidMax) {
        alerts.push({
          key: 'humidHigh',
          title: 'High Humidity Alert',
          body: `Humidity is ${reading.humidity.toFixed(1)}% — above the ${settings.humidMax}% limit.`,
        });
      } else if (reading.humidity < settings.humidMin) {
        alerts.push({
          key: 'humidLow',
          title: 'Low Humidity Alert',
          body: `Humidity is ${reading.humidity.toFixed(1)}% — below the ${settings.humidMin}% minimum.`,
        });
      }

      for (const alert of alerts) {
        const last = lastAlertAt.current[alert.key] ?? 0;
        if (now - last < cooldownMs) continue;
        lastAlertAt.current[alert.key] = now;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: alert.title,
            body: alert.body,
            sound: true,
            data: { key: alert.key, value: reading },
          },
          trigger: null,
        });
      }
    },
    []
  );

  return { checkThresholds };
}
