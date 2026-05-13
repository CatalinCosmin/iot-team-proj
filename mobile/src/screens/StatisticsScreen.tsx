import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { HeatmapChart } from '../components/HeatmapChart';
import { HistoryChart } from '../components/HistoryChart';
import type { HistoryPoint } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeWindowKey = '1H' | '24H' | '7D' | 'ALL';

interface TimeWindow {
  key: TimeWindowKey;
  label: string;
  seconds: number | null; // null = no filter
}

interface StatsResult {
  min: number;
  max: number;
  avg: number;
  count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_WINDOWS: TimeWindow[] = [
  { key: '1H', label: '1 Hour', seconds: 3_600 },
  { key: '24H', label: '24 Hours', seconds: 86_400 },
  { key: '7D', label: '7 Days', seconds: 604_800 },
  { key: 'ALL', label: 'All data', seconds: null },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStats(data: HistoryPoint[], key: 'temperature' | 'humidity'): StatsResult {
  if (data.length === 0) return { min: 0, max: 0, avg: 0, count: 0 };
  const values = data.map((p) => p[key]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return { min, max, avg, count: values.length };
}

function formatChartLabel(timestamp: number, index: number, total: number): string {
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accentColor,
  icon,
}: {
  label: string;
  value: string;
  accentColor: string;
  icon: string;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: accentColor }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: accentColor }]}>{value}</Text>
    </View>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count !== undefined && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count} pts</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  history: HistoryPoint[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

export function StatisticsScreen({ history, loading, onRefresh }: Props) {
  const [activeWindow, setActiveWindow] = useState<TimeWindowKey>('24H');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  // Use the string key (primitive) as the memo dependency — avoids object-reference
  // stability surprises that can silently prevent the memo from re-running.
  const filtered = useMemo(() => {
    const windowSec = TIME_WINDOWS.find((w) => w.key === activeWindow)?.seconds ?? null;
    if (!windowSec) return history;
    const cutoffSec = Date.now() / 1000 - windowSec;
    return history.filter((p) => {
      // Only filter points that carry a real wall-clock timestamp
      if (p.timestamp > 1_700_000_000) {
        return p.timestamp >= cutoffSec;
      }
      // Uptime-based timestamps (NTP not synced): always include
      return true;
    });
  }, [history, activeWindow]);

  const tempStats = useMemo(() => computeStats(filtered, 'temperature'), [filtered]);
  const humidStats = useMemo(() => computeStats(filtered, 'humidity'), [filtered]);

  // Pre-compute point counts for every window so we can show them on the pills
  const windowCounts = useMemo(() => {
    const nowSec = Date.now() / 1000;
    const result: Record<TimeWindowKey, number> = { '1H': 0, '24H': 0, '7D': 0, ALL: 0 };
    for (const w of TIME_WINDOWS) {
      if (!w.seconds) {
        result[w.key] = history.length;
      } else {
        const cutoff = nowSec - w.seconds;
        result[w.key] = history.filter(
          (p) => p.timestamp <= 1_700_000_000 || p.timestamp >= cutoff
        ).length;
      }
    }
    return result;
  }, [history]);

  // Date-range label for the filtered slice
  const rangeLabel = useMemo(() => {
    const real = filtered.filter((p) => p.timestamp > 1_700_000_000);
    if (real.length === 0) return null;
    const earliest = new Date(Math.min(...real.map((p) => p.timestamp)) * 1000);
    const latest = new Date(Math.max(...real.map((p) => p.timestamp)) * 1000);
    const fmt = (d: Date) =>
      d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `${fmt(earliest)} → ${fmt(latest)}`;
  }, [filtered]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing || loading}
          onRefresh={handleRefresh}
          tintColor="#38bdf8"
        />
      }
    >
      {/* ── Time window selector ── */}
      <SectionHeader title="Time Window" />
      <View style={styles.pillRow}>
        {TIME_WINDOWS.map((w) => {
          const count = windowCounts[w.key];
          const isActive = activeWindow === w.key;
          return (
            <Pressable
              key={w.key}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => setActiveWindow(w.key)}
            >
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                {w.label}
              </Text>
              <View style={[styles.pillBadge, isActive && styles.pillBadgeActive]}>
                <Text style={[styles.pillBadgeText, isActive && styles.pillBadgeTextActive]}>
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* ── Filtered range info ── */}
      {rangeLabel && (
        <View style={styles.rangeRow}>
          <Text style={styles.rangeIcon}>🕐</Text>
          <Text style={styles.rangeLabel} numberOfLines={1}>{rangeLabel}</Text>
          <Text style={styles.rangeCount}>{filtered.length} readings</Text>
        </View>
      )}

      {filtered.length === 0 ? (
        <View style={styles.noData}>
          <Text style={styles.noDataEmoji}>📭</Text>
          <Text style={styles.noDataTitle}>No data in this window</Text>
          <Text style={styles.noDataHint}>
            Try a wider time window, or pull down to refresh.
          </Text>
        </View>
      ) : (
        <>
          {/* ── Temperature stats ── */}
          <SectionHeader title="Temperature" count={filtered.length} />
          <View style={styles.statsRow}>
            <StatCard label="Min" value={`${tempStats.min.toFixed(1)}°C`} accentColor="#38bdf8" icon="🔵" />
            <StatCard label="Avg" value={`${tempStats.avg.toFixed(1)}°C`} accentColor="#f97316" icon="🟠" />
            <StatCard label="Max" value={`${tempStats.max.toFixed(1)}°C`} accentColor="#ef4444" icon="🔴" />
          </View>

          {/* ── Humidity stats ── */}
          <SectionHeader title="Humidity" />
          <View style={styles.statsRow}>
            <StatCard label="Min" value={`${humidStats.min.toFixed(1)}%`} accentColor="#38bdf8" icon="💧" />
            <StatCard label="Avg" value={`${humidStats.avg.toFixed(1)}%`} accentColor="#0ea5e9" icon="🌊" />
            <StatCard label="Max" value={`${humidStats.max.toFixed(1)}%`} accentColor="#6366f1" icon="🫧" />
          </View>

          {/* ── Trend charts ── */}
          <SectionHeader title="Trends" />
          <HistoryChart
            title="Temperature over time"
            data={filtered}
            valueKey="temperature"
            color="#f97316"
            unit="°C"
            formatLabel={formatChartLabel}
            maxPoints={60}
          />
          <HistoryChart
            title="Humidity over time"
            data={filtered}
            valueKey="humidity"
            color="#38bdf8"
            unit="%"
            formatLabel={formatChartLabel}
            maxPoints={60}
          />
        </>
      )}

      {/* ── Time-of-day heatmaps — always use full history ── */}
      <SectionHeader title="Time-of-Day Patterns" />
      <Text style={styles.heatmapNote}>
        Average values by hour across all {history.length} stored readings.
        Pull to refresh for latest data.
      </Text>

      <HeatmapChart
        title="Temperature by hour"
        subtitle="Blue = cool · Red = warm"
        data={history}
        valueKey="temperature"
        colorFrom="#3b82f6"
        colorTo="#ef4444"
        unit="°C"
      />
      <HeatmapChart
        title="Humidity by hour"
        subtitle="Light = dry · Dark = humid"
        data={history}
        valueKey="humidity"
        colorFrom="#bae6fd"
        colorTo="#0369a1"
        unit="%"
      />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
    flexGrow: 1,
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  badge: {
    backgroundColor: '#1e3a5f',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '600',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pillActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  pillText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
  },
  pillBadge: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: 'center',
  },
  pillBadgeActive: {
    backgroundColor: '#1d4ed8',
  },
  pillBadgeText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
  },
  pillBadgeTextActive: {
    color: '#bfdbfe',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rangeIcon: {
    fontSize: 12,
  },
  rangeLabel: {
    color: '#94a3b8',
    fontSize: 11,
    flex: 1,
  },
  rangeCount: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    borderTopWidth: 3,
    gap: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statIcon: {
    fontSize: 16,
  },
  statLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  heatmapNote: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 17,
    marginTop: -4,
  },
  noData: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 8,
  },
  noDataEmoji: {
    fontSize: 36,
  },
  noDataTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  noDataHint: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
});
