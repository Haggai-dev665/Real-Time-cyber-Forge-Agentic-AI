/**
 * Threat Globe — two different things, labelled apart (DET-04):
 *   - "On your account": threat events for the signed-in account, live from
 *     the event stream;
 *   - "Public intelligence": recent AlienVault OTX items
 *     (GET /api/otx/threats/recent), with their own publication time. These
 *     are published by the OTX community and are not activity on your devices.
 * Only values the sources give are shown: no severity or time is filled in.
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
  /** Only when the source gives one. */
  severity: string | null;
  /** Only when the source gives one. */
  ts: number | null;
}

function asArray(x: unknown): unknown[] {
  if (Array.isArray(x)) return x;
  return [];
}

export default function Globe() {
  const recent = useApi(() => endpoints.otxRecent(), []);
  const { events, connected } = useLiveFeed();

  const own: StreamRow[] = useMemo(
    () =>
      events
        .filter((e) => e.type === 'threat:new')
        .map((e) => {
          const d = e.data as Record<string, unknown>;
          return {
            id: (d.id as string) || `live-${e.ts}`,
            title: (d.title as string) || (d.type as string) || 'Threat event',
            meta: (d.source as string) || (d.host as string) || (d.indicator as string) || 'your account',
            severity: (d.severity as string) || null,
            ts: e.ts,
          };
        })
        .slice(0, 8),
    [events]
  );

  const intel: StreamRow[] = useMemo(() => {
    const payload = recent.data as (Record<string, unknown> & { threats?: unknown[]; data?: unknown }) | null;
    return asArray(payload?.threats ?? payload?.data)
      .slice(0, 12)
      .map((it, i) => {
        const d = it as Record<string, unknown>;
        const when = Date.parse(String(d.modified || d.created || ''));
        return {
          id: (d.id as string) || `otx-${i}`,
          title: (d.name as string) || (d.title as string) || (d.indicator as string) || 'Threat indicator',
          meta: (d.type as string) || (d.adversary as string) || (d.country as string) || 'OTX',
          severity: (d.severity as string) || null,
          ts: Number.isNaN(when) ? null : when,
        };
      });
  }, [recent.data]);

  return (
    <Screen refreshing={recent.loading} onRefresh={recent.refresh}>
      <TopBar title="Threat Globe" sub="your events · public intelligence" live={connected} />

      <View style={styles.pad}>
        <Card style={styles.stage}>
          <LinearGradient colors={['rgba(43,212,238,0.06)', colors.bg]} style={StyleSheet.absoluteFill} />
          <GlobeViz size={240} />
          <View style={styles.counters}>
            <View>
              <Text style={[styles.cNum, { color: colors.red }]}>{own.length}</Text>
              <Text style={styles.cLbl}>YOUR EVENTS</Text>
            </View>
            <View>
              <Text style={[styles.cNum, { color: colors.cyan }]}>{intel.length}</Text>
              <Text style={styles.cLbl}>PUBLIC ITEMS</Text>
            </View>
          </View>
        </Card>
        <Text style={styles.note}>The globe is an illustration; it does not plot these items.</Text>

        <SecLabel>On your account · live</SecLabel>
        <Card style={{ overflow: 'hidden' }}>
          {own.length === 0 ? (
            <View style={{ padding: 18, alignItems: 'center' }}>
              <Text style={styles.idle}>
                {connected ? 'No threat events for your account in this session.' : 'Connecting to your event stream…'}
              </Text>
            </View>
          ) : (
            own.map((r, i) => <Row key={r.id} row={r} first={i === 0} />)
          )}
        </Card>

        <SecLabel>Public intelligence · AlienVault OTX</SecLabel>
        <Card style={{ overflow: 'hidden' }}>
          {recent.loading && intel.length === 0 ? (
            <Loading label="Loading public intelligence…" />
          ) : intel.length === 0 ? (
            <View style={{ padding: 18, alignItems: 'center' }}>
              <Text style={styles.idle}>No public intelligence returned.</Text>
            </View>
          ) : (
            intel.map((r, i) => <Row key={r.id} row={r} first={i === 0} />)
          )}
        </Card>
        <Text style={styles.note}>
          Published by the OTX community. These are not activity seen on your devices.
        </Text>

        {recent.error && intel.length === 0 ? (
          <EmptyState icon="globe" title="Public intelligence unavailable" hint={recent.error} />
        ) : null}
      </View>
    </Screen>
  );
}

function Row({ row, first }: { row: StreamRow; first: boolean }) {
  return (
    <View style={[styles.row, !first && styles.rowBorder]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {row.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {row.meta} · {row.ts != null ? timeAgo(row.ts) : 'date unknown'}
        </Text>
      </View>
      {row.severity ? <Pill label={row.severity} color={severityColor[row.severity] ?? colors.cyan} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 18 },
  stage: { height: 300, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  counters: { position: 'absolute', left: 18, bottom: 14, flexDirection: 'row', gap: 22 },
  cNum: { fontFamily: fonts.monoSemiBold, fontSize: 20 },
  cLbl: { fontFamily: fonts.mono, fontSize: 8, color: colors.faint, letterSpacing: 1 },
  idle: { fontFamily: fonts.mono, fontSize: 11, color: colors.faint },
  note: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint, marginTop: 8, marginLeft: 4, lineHeight: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: colors.text },
  rowMeta: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint, marginTop: 2 },
});
