import { StyleSheet, Text, View } from 'react-native';

type Props = {
  label: string;
  value: string;
  unit: string;
  accent: string;
};

export function MetricCard({ label, value, unit, accent }: Props) {
  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    minWidth: 140,
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  value: {
    color: '#f8fafc',
    fontSize: 36,
    fontWeight: '700',
  },
  unit: {
    color: '#64748b',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 6,
  },
});
