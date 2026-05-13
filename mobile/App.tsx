import React, { useCallback, useEffect, useRef, useState } from 'react';
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
LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);

import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { HistoryChart } from './src/components/HistoryChart';
import { MetricCard } from './src/components/MetricCard';
import { SettingsModal } from './src/components/SettingsModal';
import { StatisticsScreen } from './src/screens/StatisticsScreen';
import { useSensorData } from './src/hooks/useSensorData';
import { useThresholds } from './src/hooks/useThresholds';
import { useNotifications } from './src/hooks/useNotifications';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(date: Date | null) {
  if (!date) return '—';
  return date.toLocaleTimeString();
}

function formatReadingTime(timestamp: number) {
  if (timestamp > 1_700_000_000) {
    return new Date(timestamp * 1000).toLocaleString();
  }
  return `Uptime ${timestamp}s (NTP not synced)`;
}

function formatChartLabel(timestamp: number, index: number, total: number) {
  const step = Math.ceil(total / 6);
  const show = total <= 8 || index === 0 || index === total - 1 || index % step === 0;
  if (!show) return '';
  if (timestamp > 1_700_000_000) {
    return new Date(timestamp * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return `${timestamp}s`;
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'statistics';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📡' },
  { key: 'statistics', label: 'Statistics', icon: '📊' },
];

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { current, history, loading, error, lastFetchedAt, refresh, formatChartLabel: fmtLabel } =
    useSensorData();

  const [refreshing, setRefreshing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const { thresholds, saveThresholds, loaded: thresholdsLoaded } = useThresholds();
  const { checkThresholds } = useNotifications();

  const lastCheckedTimestamp = useRef<number | null>(null);

  useEffect(() => {
    if (!thresholdsLoaded || !current) return;
    if (lastCheckedTimestamp.current === current.timestamp) return;
    lastCheckedTimestamp.current = current.timestamp;
    checkThresholds(current, thresholds);
  }, [current, thresholds, thresholdsLoaded, checkThresholds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // ── Derived alert state ──────────────────────────────────────────────────
  const tempAlert =
    current &&
    thresholds.enabled &&
    (current.temperature > thresholds.tempMax || current.temperature < thresholds.tempMin);
  const humidAlert =
    current &&
    thresholds.enabled &&
    (current.humidity > thresholds.humidMax || current.humidity < thresholds.humidMin);
  const hasAlert = !!(tempAlert || humidAlert);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />

        {/* ── Fixed header ── */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.appTitle}>IoT Sensor Monitor</Text>
            <Text style={styles.appSubtitle}>
              {loading && !current ? 'Connecting…' : lastFetchedAt ? `Synced ${formatTime(lastFetchedAt)}` : '30s auto-refresh'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {loading && current ? (
              <ActivityIndicator size="small" color="#38bdf8" style={styles.miniSpinner} />
            ) : null}
            <Pressable
              style={[styles.iconBtn, thresholds.enabled && styles.iconBtnActive]}
              onPress={() => setSettingsVisible(true)}
              hitSlop={8}
            >
              <Text style={styles.iconBtnText}>⚙️</Text>
              {thresholds.enabled && <View style={styles.activeDot} />}
            </Pressable>
          </View>
        </View>

        {/* ── Tab bar ── */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {tab.key === 'dashboard' && hasAlert && <View style={styles.alertDot} />}
            </Pressable>
          ))}
        </View>

        {/* ── Content ── */}
        {activeTab === 'statistics' ? (
          <StatisticsScreen history={history} loading={loading} onRefresh={onRefresh} />
        ) : (
          <DashboardTab
            current={current}
            history={history}
            loading={loading}
            error={error}
            lastFetchedAt={lastFetchedAt}
            thresholds={thresholds}
            refreshing={refreshing}
            onRefresh={onRefresh}
            formatChartLabel={fmtLabel ?? formatChartLabel}
          />
        )}

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

// ─── Dashboard tab ────────────────────────────────────────────────────────────

interface DashboardProps {
  current: ReturnType<typeof useSensorData>['current'];
  history: ReturnType<typeof useSensorData>['history'];
  loading: boolean;
  error: string | null;
  lastFetchedAt: Date | null;
  thresholds: ReturnType<typeof useThresholds>['thresholds'];
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  formatChartLabel: (ts: number, i: number, total: number) => string;
}

function DashboardTab({
  current,
  history,
  loading,
  error,
  lastFetchedAt,
  thresholds,
  refreshing,
  onRefresh,
  formatChartLabel: fmtLabel,
}: DashboardProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.dashContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" />
      }
    >
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
          <Text style={styles.sectionTitle}>Current readings</Text>
          <View style={styles.metricsRow}>
            <MetricCard
              label="Temperature"
              value={current.temperature.toFixed(1)}
              unit="°C"
              accent={
                current.temperature > thresholds.tempMax || current.temperature < thresholds.tempMin
                  ? '#ef4444'
                  : '#f97316'
              }
            />
            <MetricCard
              label="Humidity"
              value={current.humidity.toFixed(1)}
              unit="%"
              accent={
                current.humidity > thresholds.humidMax || current.humidity < thresholds.humidMin
                  ? '#ef4444'
                  : '#38bdf8'
              }
            />
          </View>

          {thresholds.enabled &&
            (current.temperature > thresholds.tempMax ||
              current.temperature < thresholds.tempMin ||
              current.humidity > thresholds.humidMax ||
              current.humidity < thresholds.humidMin) && (
              <View style={styles.alertBanner}>
                <Text style={styles.alertIcon}>⚠️</Text>
                <View style={styles.alertBody}>
                  <Text style={styles.alertTitle}>Threshold Alert</Text>
                  <Text style={styles.alertText}>
                    {[
                      current.temperature > thresholds.tempMax &&
                        `Temp ${current.temperature.toFixed(1)}°C > ${thresholds.tempMax}°C max`,
                      current.temperature < thresholds.tempMin &&
                        `Temp ${current.temperature.toFixed(1)}°C < ${thresholds.tempMin}°C min`,
                      current.humidity > thresholds.humidMax &&
                        `Humidity ${current.humidity.toFixed(1)}% > ${thresholds.humidMax}% max`,
                      current.humidity < thresholds.humidMin &&
                        `Humidity ${current.humidity.toFixed(1)}% < ${thresholds.humidMin}% min`,
                    ]
                      .filter(Boolean)
                      .join('\n')}
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
            formatLabel={fmtLabel}
          />
          <HistoryChart
            title="Humidity history"
            data={history}
            valueKey="humidity"
            color="#38bdf8"
            unit="%"
            formatLabel={fmtLabel}
          />

          {history.length > 0 && (
            <View style={styles.infoCard}>
              <Text style={styles.recentTitle}>Recent readings</Text>
              {[...history]
                .reverse()
                .slice(0, 6)
                .map((point) => (
                  <View key={point.id} style={styles.recentRow}>
                    <Text style={styles.recentTime}>{formatReadingTime(point.timestamp)}</Text>
                    <Text style={styles.recentValues}>
                      {point.temperature.toFixed(1)}°C · {point.humidity.toFixed(1)}%
                    </Text>
                  </View>
                ))}
            </View>
          )}

          {error ? <Text style={styles.warn}>{error}</Text> : null}
        </>
      ) : null}

      <Pressable style={[styles.button, styles.refreshBtn]} onPress={onRefresh}>
        <Text style={styles.buttonText}>Refresh now</Text>
      </Pressable>
    </ScrollView>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  appTitle: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    color: '#475569',
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniSpinner: {
    marginRight: 4,
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

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 4,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#0f172a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  tabIcon: {
    fontSize: 15,
  },
  tabLabel: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#f8fafc',
  },
  alertDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
    marginLeft: -2,
    borderWidth: 1,
    borderColor: '#0f172a',
  },

  // Dashboard content
  dashContent: {
    padding: 20,
    gap: 14,
    flexGrow: 1,
    paddingBottom: 32,
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },

  // Alert banner
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

  // Info card
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    color: '#64748b',
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

  // Recent readings
  recentTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  recentTime: {
    color: '#64748b',
    fontSize: 12,
    flex: 1,
  },
  recentValues: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },

  // States
  center: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  hint: {
    color: '#64748b',
  },
  errorBox: {
    backgroundColor: '#450a0a',
    borderRadius: 16,
    padding: 20,
    gap: 10,
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

  // Buttons
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  refreshBtn: {
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
