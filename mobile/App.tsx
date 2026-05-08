import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { HistoryChart } from './src/components/HistoryChart';
import { MetricCard } from './src/components/MetricCard';
import { useSensorData } from './src/hooks/useSensorData';

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
          <Text style={styles.title}>IoT Sensor Monitor</Text>
          <Text style={styles.subtitle}>Current status + history (30s updates)</Text>

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
                  accent="#f97316"
                />
                <MetricCard
                  label="Humidity"
                  value={current.humidity.toFixed(1)}
                  unit="%"
                  accent="#38bdf8"
                />
              </View>

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
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 13,
    marginTop: -8,
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
