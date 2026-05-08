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
};

export function HistoryChart({
  title,
  data,
  valueKey,
  color,
  unit,
  formatLabel,
}: Props) {
  if (data.length < 2) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.empty}>Need at least 2 readings for a chart.</Text>
      </View>
    );
  }

  const values = data.map((p) => p[valueKey]);
  const labels = data.map((p, i) => formatLabel(p.timestamp, i, data.length));
  const width = Dimensions.get('window').width - 48;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <LineChart
        data={{
          labels,
          datasets: [{ data: values, color: () => color, strokeWidth: 2 }],
        }}
        width={width}
        height={200}
        chartConfig={{
          backgroundColor: '#1e293b',
          backgroundGradientFrom: '#1e293b',
          backgroundGradientTo: '#334155',
          decimalPlaces: 1,
          color: () => color,
          labelColor: () => '#94a3b8',
          propsForDots: { r: '3', strokeWidth: '1', stroke: color },
        }}
        bezier
        style={styles.chart}
        yAxisSuffix={unit === '%' ? '%' : ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  empty: {
    color: '#94a3b8',
    fontSize: 14,
    paddingVertical: 24,
  },
  chart: {
    borderRadius: 12,
    marginLeft: -8,
  },
});
