import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FIREBASE_HOST,
  HISTORY_LIMIT,
  POLL_INTERVAL_MS,
  SENSOR_PATH,
} from '../config';
import type { HistoryPoint, SensorReading } from '../types';

type State = {
  current: SensorReading | null;
  history: HistoryPoint[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: Date | null;
};

function parseHistory(raw: unknown): HistoryPoint[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }

  return Object.entries(raw as Record<string, SensorReading>)
    .map(([id, entry]) => ({ id, ...entry }))
    .filter(
      (p) =>
        typeof p.temperature === 'number' && typeof p.humidity === 'number'
    )
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-HISTORY_LIMIT);
}

function formatChartLabel(timestamp: number, index: number, total: number) {
  const show = total <= 8 || index === 0 || index === total - 1 || index % Math.ceil(total / 6) === 0;
  if (!show) return '';

  if (timestamp > 1_700_000_000) {
    return new Date(timestamp * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return `${timestamp}s`;
}

export function useSensorData() {
  const [state, setState] = useState<State>({
    current: null,
    history: [],
    loading: true,
    error: null,
    lastFetchedAt: null,
  });
  const mounted = useRef(true);

  const fetchData = useCallback(async () => {
    const currentUrl = `${FIREBASE_HOST}/${SENSOR_PATH}/current.json`;
    const historyUrl = `${FIREBASE_HOST}/${SENSOR_PATH}/history.json?orderBy=%22$key%22&limitToLast=${HISTORY_LIMIT}`;

    try {
      const [currentRes, historyRes] = await Promise.all([
        fetch(currentUrl),
        fetch(historyUrl),
      ]);

      if (!currentRes.ok) {
        throw new Error(`Current status HTTP ${currentRes.status}`);
      }

      const current = (await currentRes.json()) as SensorReading | null;
      let history: HistoryPoint[] = [];

      if (historyRes.ok) {
        const historyRaw = await historyRes.json();
        history = parseHistory(historyRaw);
      }

      if (!current || typeof current.temperature !== 'number') {
        if (history.length > 0) {
          const latest = history[history.length - 1];
          if (!mounted.current) return;
          setState({
            current: latest,
            history,
            loading: false,
            error: null,
            lastFetchedAt: new Date(),
          });
          return;
        }
        throw new Error('No sensor data yet. Upload the new ESP32 sketch and wait ~30s.');
      }

      if (!mounted.current) return;

      setState({
        current,
        history,
        loading: false,
        error: null,
        lastFetchedAt: new Date(),
      });
    } catch (err) {
      if (!mounted.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
    }
  }, []);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    mounted.current = true;
    fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [fetchData]);

  return { ...state, refresh, formatChartLabel };
}
