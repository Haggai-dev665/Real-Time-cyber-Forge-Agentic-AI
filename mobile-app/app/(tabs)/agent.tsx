/**
 * Agent screen — mirrors the orchestrator. Real data:
 *  - agent roster + verdict stats from /api/orchestrator/stats & /agents
 *  - live reasoning console from `agent:activity` SSE events
 *  - CPU / throughput rings from the `metrics:update` SSE snapshot when present
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { colors, fonts, tint } from '../../src/theme';
import { Screen } from '../../src/components/Screen';
import { Card, SecLabel, TopBar, StatTiles, Loading, EmptyState } from '../../src/components/ui';
import { Ring } from '../../src/components/Ring';
import { Icon } from '../../src/components/Icon';
import { LiveDot } from '../../src/components/LiveDot';
import { useApi } from '../../src/hooks/useApi';
import { endpoints } from '../../src/api/endpoints';
import { useLiveFeed } from '../../src/context/LiveFeedContext';
import { timeAgo } from '../../src/utils/format';

const TAG_COLORS: Record<string, string> = {
  think: colors.cyan,
  act: colors.amber2,
  obs: colors.green,
  warn: colors.red,
  alert: colors.red,
};

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export default function Agent() {
  const stats = useApi(() => endpoints.orchestratorStats(), []);
  const { events, metrics, connected } = useLiveFeed();

  const s = stats.data?.stats;
  const agentCount = s?.agents.length ?? 0;
  const verdicts = s?.verdictBreakdown ?? {};

  const reasoning = useMemo(
    () => events.filter((e) => e.type === 'agent:activity' || e.type === 'scan:update').slice(0, 12),
    [events]
  );

  const cpu = metrics ? num((metrics as Record<string, unknown>).cpu, num((metrics as Record<string, unknown>).cpuPercent)) : 0;
  const throughput = metrics
    ? num((metrics as Record<string, unknown>).throughput, num((metrics as Record<string, unknown>).eventsPerSec))
    : 0;

  return (
    <Screen refreshing={stats.loading} onRefresh={stats.refresh}>
      <TopBar title="Agent" sub="agentic mode · live" live />

      <View style={styles.pad}>
        {/* agent identity */}
        <Card style={styles.idCard}>
          <View style={styles.botIcon}>
            <Icon name="bot" size={24} color={colors.amber2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.idTitle}>CyberForge Agent</Text>
            <Text style={styles.idSub}>
              {stats.loading ? 'syncing…' : `${agentCount} agent${agentCount === 1 ? '' : 's'} online`}
            </Text>
          </View>
          <View style={[styles.activeBadge, { opacity: connected ? 1 : 0.5 }]}>
            <LiveDot color={colors.green} />
            <Text style={styles.activeText}>{connected ? 'ACTIVE' : 'IDLE'}</Text>
          </View>
        </Card>

        {/* live gauges */}
        <View style={styles.gauges}>
          {[
            ['CPU', cpu, colors.amber] as const,
            ['Throughput', throughput, colors.cyan] as const,
          ].map(([label, value, color]) => (
            <Card key={label} style={styles.gauge}>
              <Ring value={Math.min(value, 100)} size={46} stroke={5} color={color} glow={false}>
                <Text style={styles.gaugeNum}>{Math.round(value)}{label === 'CPU' ? '%' : ''}</Text>
              </Ring>
              <View>
                <Text style={styles.gaugeLabel}>{label}</Text>
                <Text style={styles.gaugeMeta}>{metrics ? 'live' : 'idle'}</Text>
              </View>
            </Card>
          ))}
        </View>

        {/* verdict breakdown (real orchestrator output) */}
        {s && Object.keys(verdicts).length > 0 ? (
          <>
            <SecLabel>Recent verdicts</SecLabel>
            <StatTiles
              items={Object.entries(verdicts)
                .slice(0, 3)
                .map(([k, v]) => ({
                  value: String(v),
                  label: k,
                  color: k === 'malicious' ? colors.red : k === 'benign' ? colors.green : colors.amber2,
                }))}
            />
          </>
        ) : null}

        {/* live reasoning */}
        <SecLabel>Live reasoning</SecLabel>
        <Card style={styles.console}>
          {reasoning.length === 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
              <LiveDot color={colors.cyan} />
              <Text style={styles.idle}>
                {connected ? 'Awaiting agent activity…' : 'Stream offline — reconnecting…'}
              </Text>
            </View>
          ) : (
            reasoning.map((e, i) => {
              const d = e.data as Record<string, unknown>;
              const tag = ((d.phase as string) || (d.tag as string) || (e.type === 'scan:update' ? 'act' : 'obs')).toLowerCase();
              const msg = (d.message as string) || (d.summary as string) || (d.url as string) || e.type;
              return (
                <View key={`${e.ts}-${i}`} style={styles.cl}>
                  <Text style={styles.ts}>{timeAgo(e.ts)}</Text>
                  <Text style={[styles.tg, { color: TAG_COLORS[tag] ?? colors.cyan }]}>
                    {(tag.slice(0, 4)).toUpperCase()}
                  </Text>
                  <Text style={styles.mg} numberOfLines={2}>
                    {msg}
                  </Text>
                </View>
              );
            })
          )}
        </Card>

        {stats.error && !s ? (
          <EmptyState icon="bot" title="Orchestrator unavailable" hint={stats.error} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 18 },
  idCard: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  botIcon: {
    width: 52,
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#140d04',
    borderWidth: 1,
    borderColor: tint(colors.amber, 0.4),
  },
  idTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.text },
  idSub: { fontFamily: fonts.mono, fontSize: 10, color: colors.amber2, marginTop: 2 },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: tint(colors.green, 0.12),
    borderWidth: 1,
    borderColor: tint(colors.green, 0.3),
  },
  activeText: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.green },
  gauges: { flexDirection: 'row', gap: 10, marginTop: 12 },
  gauge: { flex: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  gaugeNum: { fontFamily: fonts.monoSemiBold, fontSize: 9 },
  gaugeLabel: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: colors.text },
  gaugeMeta: { fontFamily: fonts.mono, fontSize: 9, color: colors.faint },
  console: { paddingHorizontal: 14, paddingVertical: 8, minHeight: 200 },
  idle: { fontFamily: fonts.mono, fontSize: 11, color: colors.faint },
  cl: { flexDirection: 'row', gap: 9, paddingVertical: 5 },
  ts: { fontFamily: fonts.mono, fontSize: 10, color: colors.faint, width: 34 },
  tg: { fontFamily: fonts.monoSemiBold, fontSize: 10, width: 38 },
  mg: { flex: 1, fontFamily: fonts.mono, fontSize: 10.5, color: colors.dim, lineHeight: 15 },
});
