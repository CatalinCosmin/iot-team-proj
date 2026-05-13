import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import type { HistoryPoint } from '../types';

type Props = {
  title: string;
  data: HistoryPoint[];
  valueKey: 'temperature' | 'humidity';
  color: string;
  unit: string;
  formatLabel: (timestamp: number, index: number, total: number) => string;
  /** Cap the number of rendered data points (downsamples if exceeded). Default 48. */
  maxPoints?: number;
};

/** Thin out data to at most maxPoints entries while always keeping the last point. */
function downsample(data: HistoryPoint[], maxPoints: number): HistoryPoint[] {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0 || i === data.length - 1);
}

export function HistoryChart({
  title,
  data,
  valueKey,
  color,
  unit,
  formatLabel,
  maxPoints = 48,
}: Props) {
  const displayed = downsample(data, maxPoints);

  if (displayed.length < 2) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.empty}>Need at least 2 readings for a chart.</Text>
      </View>
    );
  }

  const values = displayed.map((p) => p[valueKey]);
  const labels = displayed.map((p, i) => formatLabel(p.timestamp, i, displayed.length));
  const width = Dimensions.get('window').width - 48;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.accent, { backgroundColor: color }]} />
      </View>
      <LineChart
        data={{
          labels,
          datasets: [
            {
              data: values,
              // solid accent color — ignore the opacity argument react-native-chart-kit passes
              color: () => color,
              strokeWidth: 4,
            },
          ],
        }}
        width={width}
        height={220}
        chartConfig={{
          backgroundColor: '#0f172a',
          backgroundGradientFrom: '#0f172a',
          backgroundGradientFromOpacity: 1,
          backgroundGradientTo: '#1e293b',
          backgroundGradientToOpacity: 1,
          decimalPlaces: 1,
          // Used for grid lines — keep them very subtle
          color: (opacity = 1) => `rgba(148, 163, 184, ${opacity * 0.12})`,
          labelColor: () => '#94a3b8',
          propsForDots: {
            r: '5',
            strokeWidth: '2.5',
            stroke: color,
            fill: '#0f172a',
          },
          propsForBackgroundLines: {
            stroke: '#1e3a5f',
            strokeWidth: 1,
          },
          propsForLabels: {
            fontSize: 11,
          },
        }}
        bezier
        withShadow={false}
        style={styles.chart}
        yAxisSuffix={unit === '%' ? '%' : ''}
        withVerticalLines={false}
        withHorizontalLines
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  accent: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  empty: {
    color: '#94a3b8',
    fontSize: 14,
    paddingVertical: 24,
  },
  chart: {
    borderRadius: 12,
    marginLeft: -16,
    marginBottom: -8,
  },
});
