/**
 * Devices — shows this device and its real connection state to the backend
 * (live SSE link). No fabricated paired-device list; what we can truthfully
 * report is this phone + the live bridge.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Platform } from 'react-native';

import { colors, fonts, tint } from '../theme';
import { Card, SecLabel } from '../components/ui';
import { Icon } from '../components/Icon';
import { LiveDot } from '../components/LiveDot';
import { useLiveFeed } from '../context/LiveFeedContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api/config';

export function DevicesSection() {
  const { connected } = useLiveFeed();
  const { isGuest, user } = useAuth();

  return (
    <>
      <Card style={styles.bridgeCard}>
        <View style={styles.bridge}>
          <Node icon="phone" color={colors.cyan} />
          <Connector active={connected} />
          <Node icon="globe" color={connected ? colors.amber2 : colors.faint} pulse={connected} />
          <Connector active={connected} />
          <Node icon="desktop" color={connected ? colors.green : colors.faint} />
        </View>
        <Text style={styles.bridgeText}>
          Phone ↔ Secure relay ↔ Backend ·{' '}
          <Text style={{ color: connected ? colors.green : colors.faint }}>
            {connected ? 'live bridge' : 'offline'}
          </Text>
        </Text>
      </Card>

      <SecLabel>This device</SecLabel>
      <Card style={{ overflow: 'hidden' }}>
        <Row icon="phone" title={`${Platform.OS === 'ios' ? 'iPhone' : 'Android device'}`} sub="this device" color={colors.cyan} online />
        <Row
          icon="desktop"
          title="CyberForge backend"
          sub={API_BASE_URL.replace(/^https?:\/\//, '')}
          color={connected ? colors.green : colors.faint}
          online={connected}
          border
        />
        <Row
          icon="lock"
          title={isGuest ? 'Guest session' : 'Authenticated session'}
          sub={isGuest ? 'public access' : user?.email ?? 'signed in'}
          color={colors.amber2}
          online
          border
        />
      </Card>
    </>
  );
}

function Node({ icon, color, pulse }: { icon: 'phone' | 'globe' | 'desktop'; color: string; pulse?: boolean }) {
  return (
    <View style={[styles.node, { borderColor: color, backgroundColor: tint(color, 0.13) }]}>
      {pulse ? <LiveDot color={color} size={10} /> : null}
      <Icon name={icon} size={22} color={color} />
    </View>
  );
}

function Connector({ active }: { active: boolean }) {
  return <View style={[styles.connector, active && { backgroundColor: tint(colors.cyan, 0.6) }]} />;
}

function Row({
  icon,
  title,
  sub,
  color,
  online,
  border,
}: {
  icon: 'phone' | 'desktop' | 'lock';
  title: string;
  sub: string;
  color: string;
  online?: boolean;
  border?: boolean;
}) {
  return (
    <View style={[styles.row, border && styles.rowBorder]}>
      <View style={[styles.rowIcon, { borderColor: color }]}>
        <Icon name={icon} size={15} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>
      </View>
      {online ? <LiveDot color={color} /> : <Text style={styles.offline}>offline</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  bridgeCard: { padding: 16, alignItems: 'center' },
  bridge: { flexDirection: 'row', alignItems: 'center' },
  node: { width: 54, height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  connector: { width: 26, height: 2, backgroundColor: colors.line, marginHorizontal: 2 },
  bridgeText: { fontFamily: fonts.mono, fontSize: 10, color: colors.dim, marginTop: 12, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rowIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tile, borderWidth: 1 },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.text },
  rowSub: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint, marginTop: 2 },
  offline: { fontFamily: fonts.mono, fontSize: 9, color: colors.faint },
});
