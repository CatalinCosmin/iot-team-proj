import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import type { HistoryPoint } from '../types';

type Props = {
  title: string;
  subtitle?: string;
  data: HistoryPoint[];
  valueKey: 'temperature' | 'humidity';
  /** Hex color for lowest values, e.g. "#3b82f6" */
  colorFrom: string;
  /** Hex color for highest values, e.g. "#ef4444" */
  colorTo: string;
  unit: string;
};

/** Linearly interpolate between two 6-digit hex colors. */
function lerpColor(from: string, to: string, t: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const fr = parseInt(from.slice(1, 3), 16);
  const fg = parseInt(from.slice(3, 5), 16);
  const fb = parseInt(from.slice(5, 7), 16);
  const tr = parseInt(to.slice(1, 3), 16);
  const tg = parseInt(to.slice(3, 5), 16);
  const tb = parseInt(to.slice(5, 7), 16);
  return `rgb(${clamp(fr + (tr - fr) * t)},${clamp(fg + (tg - fg) * t)},${clamp(fb + (tb - fb) * t)})`;
}

const HOURS = 24;
/** Hours at which to render an x-axis label */
const LABEL_HOURS = [0, 6, 12, 18, 23];

export function HeatmapChart({ title, subtitle, data, valueKey, colorFrom, colorTo, unit }: Props) {
  // Accumulate sums per hour-of-day bucket
  const buckets: { sum: number; count: number }[] = Array.from({ length: HOURS }, () => ({
    sum: 0,
    count: 0,
  }));

  data.forEach((point) => {
    if (point.timestamp > 1_700_000_000) {
      const hour = new Date(point.timestamp * 1000).getHours();
      buckets[hour].sum += point[valueKey];
      buckets[hour].count += 1;
    }
  });

  const avgs: (number | null)[] = buckets.map((b) =>
    b.count > 0 ? b.sum / b.count : null
  );

  const validValues = avgs.filter((v): v is number => v !== null);
  const minVal = validValues.length > 0 ? Math.min(...validValues) : 0;
  const maxVal = validValues.length > 0 ? Math.max(...validValues) : 1;
  const range = maxVal - minVal || 1;

  const hasData = validValues.length > 0;

  const totalWidth = Dimensions.get('window').width - 48;
  const H_PAD = 8;
  const cellsWidth = totalWidth - H_PAD * 2;
  const CELL_W = cellsWidth / HOURS;
  const CELL_H = 44;
  const LABEL_H = 18;
  const SVG_H = CELL_H + LABEL_H;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {hasData && (
          <View style={styles.rangeTag}>
            <Text style={styles.rangeText}>
              {minVal.toFixed(1)} – {maxVal.toFixed(1)}{unit}
            </Text>
          </View>
        )}
      </View>

      {!hasData ? (
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>No timestamped readings yet.</Text>
          <Text style={styles.emptyHint}>Data will appear once the sensor syncs via NTP.</Text>
        </View>
      ) : (
        <>
          <Svg width={totalWidth} height={SVG_H} style={styles.svg}>
            {avgs.map((avg, hour) => {
              const x = H_PAD + hour * CELL_W;
              const t = avg !== null ? (avg - minVal) / range : -1;
              const fill = avg !== null ? lerpColor(colorFrom, colorTo, t) : '#0f172a';

              return (
                <Rect
                  key={hour}
                  x={x + 0.75}
                  y={0}
                  width={CELL_W - 1.5}
                  height={CELL_H}
                  fill={fill}
                  opacity={avg !== null ? 1 : 0.4}
                  rx={4}
                />
              );
            })}

            {/* X-axis hour labels */}
            {LABEL_HOURS.map((h) => (
              <SvgText
                key={`lbl-${h}`}
                x={H_PAD + h * CELL_W + CELL_W / 2}
                y={CELL_H + 14}
                fill="#64748b"
                fontSize={10}
                textAnchor="middle"
              >
                {h < 10 ? `0${h}` : `${h}`}
              </SvgText>
            ))}
          </Svg>

          {/* Color scale legend */}
          <View style={styles.legend}>
            <Text style={styles.legendLabel}>{minVal.toFixed(1)}{unit}</Text>
            <View style={styles.legendBar}>
              {Array.from({ length: 20 }, (_, i) => i / 19).map((t, i) => (
                <View
                  key={i}
                  style={[styles.legendSwatch, { backgroundColor: lerpColor(colorFrom, colorTo, t) }]}
                />
              ))}
            </View>
            <Text style={styles.legendLabel}>{maxVal.toFixed(1)}{unit}</Text>
          </View>

          <Text style={styles.axisNote}>Hour of day (local time)</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 12,
  },
  rangeTag: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rangeText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  svg: {
    alignSelf: 'center',
  },
  emptyBox: {
    paddingVertical: 16,
    gap: 4,
  },
  empty: {
    color: '#94a3b8',
    fontSize: 14,
  },
  emptyHint: {
    color: '#475569',
    fontSize: 12,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -4,
  },
  legendBar: {
    flex: 1,
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  legendSwatch: {
    flex: 1,
  },
  legendLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
    minWidth: 36,
  },
  axisNote: {
    color: '#475569',
    fontSize: 10,
    textAlign: 'center',
    marginTop: -6,
  },
});
