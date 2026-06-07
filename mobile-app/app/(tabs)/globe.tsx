/**
 * Threat Globe — animated visual plus a real live attack stream sourced from
 * OTX recent threats (GET /api/otx/threats/recent) merged with live SSE threat
 * events. Counters come from real data; no fabricated numbers.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, fonts, severityColor } from '../../src/theme';
import { Screen } from '../../src/components/Screen';
import { Card, SecLabel, TopBar, Pill, Loading, EmptyState } from '../../src/components/ui';
import { GlobeViz } from '../../src/components/GlobeViz';
import { useApi } from '../../src/hooks/useApi';
import { endpoints } from '../../src/api/endpoints';
import { useLiveFeed } from '../../src/context/LiveFeedContext';
import { timeAgo } from '../../src/utils/format';

interface StreamRow {
  id: string;
  title: string;
  meta: string;
  severity: string;
  ts: number;
}

function asArray(x: unknown): unknown[] {
  if (Array.isArray(x)) return x;
  return [];
}

export default function Globe() {
  const recent = useApi(() => endpoints.otxRecent(), []);
  const { events, connected } = useLiveFeed();

  const rows: StreamRow[] = useMemo(() => {
    const fromLive: StreamRow[] = events
      .filter((e) => e.type === 'threat:new')
      .map((e) => {
        const d = e.data as Record<string, unknown>;
        return {
          id: (d.id as string) || `live-${e.ts}`,
          title: (d.title as string) || (d.type as string) || 'Threat event',
          meta: (d.source as string) || (d.host as string) || (d.indicator as string) || 'live',
          severity: (d.severity as string) || 'medium',
          ts: e.ts,
        };
      });

    const payload = recent.data as (Record<string, unknown> & { threats?: unknown[]; data?: unknown }) | null;
    const otxItems = asArray(payload?.threats ?? payload?.data);
    const fromOtx: StreamRow[] = otxItems.slice(0, 12).map((it, i) => {
      const d = it as Record<string, unknown>;
      return {
        id: (d.id as string) || `otx-${i}`,
        title: (d.name as string) || (d.title as string) || (d.indicator as string) || 'Threat indicator',
        meta: (d.type as string) || (d.adversary as string) || (d.country as string) || 'OTX',
        severity: (d.severity as string) || 'high',
        ts: d.modified ? Date.parse(d.modified as string) : Date.now() - i * 60000,
      };
    });

    return [...fromLive, ...fromOtx].slice(0, 14);
  }, [events, recent.data]);

  const active = events.filter((e) => e.type === 'threat:new').length;

  return (
    <Screen refreshing={recent.loading} onRefresh={recent.refresh}>
      <TopBar title="Threat Globe" sub="live attack map" live />

      <View style={styles.pad}>
        <Card style={styles.stage}>
          <LinearGradient colors={['rgba(43,212,238,0.06)', colors.bg]} style={StyleSheet.absoluteFill} />
          <GlobeViz size={240} />
          <View style={styles.counters}>
            <View>
              <Text style={[styles.cNum, { color: colors.red }]}>{active}</Text>
              <Text style={styles.cLbl}>LIVE EVENTS</Text>
            </View>
            <View>
              <Text style={[styles.cNum, { color: colors.green }]}>{rows.length}</Text>
              <Text style={styles.cLbl}>TRACKED</Text>
            </View>
          </View>
        </Card>

        <SecLabel>Live attack stream</SecLabel>
        <Card style={{ overflow: 'hidden' }}>
          {recent.loading && rows.length === 0 ? (
            <Loading label="Loading threat feed…" />
          ) : rows.length === 0 ? (
            <View style={{ padding: 18, alignItems: 'center' }}>
              <Text style={styles.idle}>
                {connected ? 'No threats in the live window yet.' : 'Connecting to feed…'}
              </Text>
            </View>
          ) : (
            rows.map((r, i) => (
              <View key={r.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {r.meta} · {timeAgo(r.ts)}
                  </Text>
                </View>
                <Pill label={r.severity} color={severityColor[r.severity] ?? colors.cyan} />
              </View>
            ))
          )}
        </Card>

        {recent.error && rows.length === 0 ? (
          <EmptyState icon="globe" title="Feed unavailable" hint={recent.error} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 18 },
  stage: { height: 300, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  counters: { position: 'absolute', left: 18, bottom: 14, flexDirection: 'row', gap: 22 },
  cNum: { fontFamily: fonts.monoSemiBold, fontSize: 20 },
  cLbl: { fontFamily: fonts.mono, fontSize: 8, color: colors.faint, letterSpacing: 1 },
  idle: { fontFamily: fonts.mono, fontSize: 11, color: colors.faint },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: colors.text },
  rowMeta: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint, marginTop: 2 },
});
