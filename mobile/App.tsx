import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  LogBox,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// expo-notifications triggers a console.error in Expo Go (SDK 53+) about remote
// push tokens being unavailable. We only use local notifications so this is
// harmless — suppress the overlay before the module auto-registers.
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
]);
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { HistoryChart } from './src/components/HistoryChart';
import { MetricCard } from './src/components/MetricCard';
import { SettingsModal } from './src/components/SettingsModal';
import { useSensorData } from './src/hooks/useSensorData';
import { useThresholds } from './src/hooks/useThresholds';
import { useNotifications } from './src/hooks/useNotifications';

function formatTime(date: Date | null) {
  if (!date) return '—';
  return date.toLocaleTimeString();
}

function formatReadingTime(timestamp: number) {
  if (timestamp > 1_700_000_000) {
    return new Date(timestamp * 1000).toLocaleString();
  }
  return `Uptime ${timestamp}s (NTP not synced yet)`;
}

export default function App() {
  const { current, history, loading, error, lastFetchedAt, refresh, formatChartLabel } =
    useSensorData();
  const [refreshing, setRefreshing] = React.useState(false);
  const [settingsVisible, setSettingsVisible] = React.useState(false);

  const { thresholds, saveThresholds, loaded: thresholdsLoaded } = useThresholds();
  const { checkThresholds } = useNotifications();

  const lastCheckedTimestamp = useRef<number | null>(null);

  useEffect(() => {
    if (!thresholdsLoaded || !current) return;
    if (lastCheckedTimestamp.current === current.timestamp) return;
    lastCheckedTimestamp.current = current.timestamp;
    checkThresholds(current, thresholds);
  }, [current, thresholds, thresholdsLoaded, checkThresholds]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#38bdf8"
            />
          }
        >
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.title}>IoT Sensor Monitor</Text>
              <Text style={styles.subtitle}>Current status + history (30s updates)</Text>
            </View>
            <Pressable
              style={[styles.iconBtn, thresholds.enabled && styles.iconBtnActive]}
              onPress={() => setSettingsVisible(true)}
              hitSlop={8}
            >
              <Text style={styles.iconBtnText}>⚙️</Text>
              {thresholds.enabled && <View style={styles.activeDot} />}
            </Pressable>
          </View>

          {loading && !current ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#38bdf8" />
              <Text style={styles.hint}>Loading from cloud…</Text>
            </View>
          ) : error && !current ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Connection issue</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.button} onPress={onRefresh}>
                <Text style={styles.buttonText}>Retry</Text>
              </Pressable>
            </View>
          ) : current ? (
            <>
              <Text style={styles.sectionTitle}>Current</Text>
              <View style={styles.metricsRow}>
                <MetricCard
                  label="Temperature"
                  value={current.temperature.toFixed(1)}
                  unit="°C"
                  accent={current.temperature > thresholds.tempMax || current.temperature < thresholds.tempMin ? '#ef4444' : '#f97316'}
                />
                <MetricCard
                  label="Humidity"
                  value={current.humidity.toFixed(1)}
                  unit="%"
                  accent={current.humidity > thresholds.humidMax || current.humidity < thresholds.humidMin ? '#ef4444' : '#38bdf8'}
                />
              </View>

              {thresholds.enabled && (current.temperature > thresholds.tempMax || current.temperature < thresholds.tempMin || current.humidity > thresholds.humidMax || current.humidity < thresholds.humidMin) && (
                <View style={styles.alertBanner}>
                  <Text style={styles.alertIcon}>⚠️</Text>
                  <View style={styles.alertBody}>
                    <Text style={styles.alertTitle}>Threshold Alert</Text>
                    <Text style={styles.alertText}>
                      {[
                        current.temperature > thresholds.tempMax && `Temp ${current.temperature.toFixed(1)}°C > ${thresholds.tempMax}°C max`,
                        current.temperature < thresholds.tempMin && `Temp ${current.temperature.toFixed(1)}°C < ${thresholds.tempMin}°C min`,
                        current.humidity > thresholds.humidMax && `Humidity ${current.humidity.toFixed(1)}% > ${thresholds.humidMax}% max`,
                        current.humidity < thresholds.humidMin && `Humidity ${current.humidity.toFixed(1)}% < ${thresholds.humidMin}% min`,
                      ].filter(Boolean).join('\n')}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.infoCard}>
                <InfoRow label="Device" value={current.deviceId} />
                <InfoRow label="Reading time" value={formatReadingTime(current.timestamp)} />
                <InfoRow label="Last app sync" value={formatTime(lastFetchedAt)} />
                <InfoRow label="History points" value={String(history.length)} />
              </View>

              <Text style={styles.sectionTitle}>Over time</Text>
              <HistoryChart
                title="Temperature history"
                data={history}
                valueKey="temperature"
                color="#f97316"
                unit="°C"
                formatLabel={formatChartLabel}
              />
              <HistoryChart
                title="Humidity history"
                data={history}
                valueKey="humidity"
                color="#38bdf8"
                unit="%"
                formatLabel={formatChartLabel}
              />

              {history.length > 0 ? (
                <View style={styles.infoCard}>
                  <Text style={styles.recentTitle}>Recent readings</Text>
                  {[...history].reverse().slice(0, 6).map((point) => (
                    <View key={point.id} style={styles.recentRow}>
                      <Text style={styles.recentTime}>
                        {formatReadingTime(point.timestamp)}
                      </Text>
                      <Text style={styles.recentValues}>
                        {point.temperature.toFixed(1)}°C · {point.humidity.toFixed(1)}%
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {error ? <Text style={styles.warn}>{error}</Text> : null}
            </>
          ) : null}

          <Pressable style={[styles.button, styles.secondary]} onPress={onRefresh}>
            <Text style={styles.buttonText}>Refresh now</Text>
          </Pressable>
        </ScrollView>

        <SettingsModal
          visible={settingsVisible}
          thresholds={thresholds}
          onSave={saveThresholds}
          onClose={() => setSettingsVisible(false)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    padding: 24,
    gap: 16,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 13,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    backgroundColor: '#1e3a5f',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  iconBtnText: {
    fontSize: 20,
  },
  activeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    borderWidth: 1.5,
    borderColor: '#0f172a',
  },
  alertBanner: {
    backgroundColor: '#450a0a',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  alertIcon: {
    fontSize: 20,
    marginTop: 1,
  },
  alertBody: {
    flex: 1,
    gap: 4,
  },
  alertTitle: {
    color: '#fecaca',
    fontSize: 14,
    fontWeight: '700',
  },
  alertText: {
    color: '#fca5a5',
    fontSize: 13,
    lineHeight: 20,
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: 14,
    flex: 1,
  },
  infoValue: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  recentTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  recentTime: {
    color: '#94a3b8',
    fontSize: 12,
    flex: 1,
  },
  recentValues: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  center: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  hint: {
    color: '#94a3b8',
  },
  errorBox: {
    backgroundColor: '#450a0a',
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  errorTitle: {
    color: '#fecaca',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
  },
  warn: {
    color: '#fbbf24',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondary: {
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
