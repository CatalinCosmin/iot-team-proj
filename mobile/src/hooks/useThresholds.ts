import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { ThresholdSettings } from '../types';

const STORAGE_KEY = '@iot_thresholds';

export const DEFAULT_THRESHOLDS: ThresholdSettings = {
  enabled: true,
  tempMin: 10,
  tempMax: 35,
  humidMin: 20,
  humidMax: 80,
  cooldownMinutes: 5,
};

export function useThresholds() {
  const [thresholds, setThresholds] = useState<ThresholdSettings>(DEFAULT_THRESHOLDS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<ThresholdSettings>;
          setThresholds({ ...DEFAULT_THRESHOLDS, ...parsed });
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const saveThresholds = useCallback(async (next: ThresholdSettings) => {
    setThresholds(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Persist failure is non-fatal; in-memory state is still updated
    }
  }, []);

  return { thresholds, saveThresholds, loaded };
}
