/**
 * Shared UI primitives ported from the design's CSS classes
 * (.card, .pill, .seclabel, .stat, .feedrow, .toggle, .spark, .topbar …).
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Pressable,
  ActivityIndicator,
  StyleProp,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { colors, fonts, radius, tint } from '../theme';
import { Icon, IconName } from './Icon';
import { LiveDot } from './LiveDot';

/* ---------- Card ---------- */
export function Card({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/* ---------- Section label ---------- */
export function SecLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.seclabel, style]}>{children}</Text>;
}

/* ---------- Severity / status pill ---------- */
export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={{
        backgroundColor: tint(color, 0.13),
        borderColor: tint(color, 0.4),
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ fontFamily: fonts.monoSemiBold, fontSize: 8.5, letterSpacing: 0.5, color, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  );
}

/* ---------- 3-up stat tile row ---------- */
export interface StatTileData {
  value: string;
  label: string;
  color: string;
  icon?: IconName;
}
export function StatTiles({ items }: { items: StatTileData[] }) {
  return (
    <View style={styles.stats3}>
      {items.map((s, i) => (
        <Card key={i} style={styles.stat}>
          {s.icon ? <Icon name={s.icon} size={16} color={s.color} /> : null}
          <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </Card>
      ))}
    </View>
  );
}

/* ---------- Feed row ---------- */
export function FeedRow({
  dotColor,
  text,
  meta,
  first,
}: {
  dotColor: string;
  text: string;
  meta: string;
  first?: boolean;
}) {
  return (
    <View style={[styles.feedrow, !first && styles.feedrowBorder]}>
      <View style={[styles.fdot, { backgroundColor: dotColor }]} />
      <Text style={styles.ft} numberOfLines={1}>
        {text}
      </Text>
      <Text style={styles.fm}>{meta}</Text>
    </View>
  );
}

/* ---------- Toggle ---------- */
export function Toggle({ on, onToggle }: { on: boolean; onToggle?: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      style={{
        width: 42,
        height: 24,
        borderRadius: 13,
        backgroundColor: on ? tint(colors.green, 0.25) : 'rgba(130,160,200,0.2)',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: on ? colors.green : colors.faint,
          marginLeft: on ? 21 : 3,
        }}
      />
    </Pressable>
  );
}

/* ---------- Sparkline ---------- */
export function Sparkline({ color, points = 18 }: { color: string; points?: number }) {
  const pts = Array.from({ length: points }, (_, i) => {
    const x = (i * (100 / (points - 1))).toFixed(1);
    const y = (36 - Math.random() * 30).toFixed(1);
    return `${x},${y}`;
  }).join(' ');
  return (
    <Svg width="100%" height={40} viewBox="0 0 100 40" preserveAspectRatio="none">
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={1.4} opacity={0.75} />
    </Svg>
  );
}

/* ---------- Horizontal bar list ---------- */
export function BarRows({ rows }: { rows: Array<[string, number, string]> }) {
  return (
    <>
      {rows.map(([label, pct, color], i) => (
        <View key={i} style={{ paddingVertical: 9, paddingHorizontal: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontFamily: fonts.sans, fontSize: 12.5 }}>{label}</Text>
            <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, color }}>{pct}%</Text>
          </View>
          <View style={styles.barline}>
            <View style={{ height: '100%', borderRadius: 4, width: `${pct}%`, backgroundColor: color }} />
          </View>
        </View>
      ))}
    </>
  );
}

/* ---------- Timeline card ---------- */
export function Timeline({ rows }: { rows: Array<[string, string, string]> }) {
  return (
    <Card style={{ paddingVertical: 6, paddingHorizontal: 14 }}>
      {rows.map(([time, text, color], i) => {
        const last = i === rows.length - 1;
        return (
          <View key={i} style={[styles.te, i > 0 && styles.teBorder]}>
            <Text style={[styles.tt, { color }]}>{time}</Text>
            <View style={styles.tk}>
              <View style={[styles.tkDot, { backgroundColor: last ? color : colors.faint }]} />
              {!last && <View style={styles.tkLine} />}
            </View>
            <Text style={styles.tx}>{text}</Text>
          </View>
        );
      })}
    </Card>
  );
}

/* ---------- Top bar ---------- */
export function TopBar({
  title,
  sub,
  live,
  right,
}: {
  title: string;
  sub?: string;
  live?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.topbar}>
      <View style={{ flex: 1 }}>
        <Text style={styles.topTitle}>{title}</Text>
        {sub ? (
          <View style={styles.tsub}>
            {live ? <LiveDot color={colors.cyan} /> : null}
            <Text style={styles.tsubText}>{sub}</Text>
          </View>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/* ---------- Loading / empty / error states (honest, no mock data) ---------- */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.amber2} />
      <Text style={styles.centerText}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon = 'box',
  title,
  hint,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.emptyGlyph}>
        <Icon name={icon} size={26} color={colors.faint} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.centerText}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
  },
  seclabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.faint,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 9,
    marginHorizontal: 4,
  },
  stats3: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, paddingVertical: 13, paddingHorizontal: 10, alignItems: 'center' },
  statValue: { fontFamily: fonts.monoSemiBold, fontSize: 22, marginTop: 6 },
  statLabel: { fontFamily: fonts.mono, fontSize: 8.5, color: colors.faint, marginTop: 2, textAlign: 'center' },
  feedrow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, paddingHorizontal: 14 },
  feedrowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  fdot: { width: 7, height: 7, borderRadius: 4 },
  ft: { flex: 1, fontSize: 12.5, color: colors.text, fontFamily: fonts.sans },
  fm: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint },
  barline: { height: 6, borderRadius: 4, backgroundColor: 'rgba(130,160,200,0.12)', overflow: 'hidden', marginTop: 8 },
  te: { flexDirection: 'row', gap: 12, paddingVertical: 9 },
  teBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  tt: { fontFamily: fonts.mono, fontSize: 9.5, width: 44 },
  tk: { width: 9, alignItems: 'center' },
  tkDot: { width: 7, height: 7, borderRadius: 4, marginTop: 3 },
  tkLine: { position: 'absolute', top: 12, bottom: -10, width: 1, backgroundColor: colors.line },
  tx: { flex: 1, fontSize: 12.5, color: colors.text, fontFamily: fonts.sans },
  topbar: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  topTitle: { fontFamily: fonts.sansBold, fontSize: 27, color: colors.text, letterSpacing: -0.5 },
  tsub: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  tsubText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.dim },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  centerText: { fontFamily: fonts.mono, fontSize: 11, color: colors.faint, textAlign: 'center', maxWidth: 260 },
  emptyGlyph: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.text },
});

export { styles as uiStyles };
