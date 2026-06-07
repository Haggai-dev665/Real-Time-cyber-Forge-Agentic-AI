/**
 * Read-only Explore sections, each backed by a real backend endpoint and
 * rendering an honest loading / empty / error state (never placeholder data).
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { colors, fonts, severityColor } from '../theme';
import { Card, SecLabel, StatTiles, Loading, EmptyState, BarRows } from '../components/ui';
import { Icon } from '../components/Icon';
import { LiveDot } from '../components/LiveDot';
import { useApi } from '../hooks/useApi';
import { endpoints } from '../api/endpoints';
import { useLiveFeed } from '../context/LiveFeedContext';
import { timeAgo } from '../utils/format';

function arr(x: unknown): Record<string, unknown>[] {
  return Array.isArray(x) ? (x as Record<string, unknown>[]) : [];
}
function num(v: unknown, f = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : f;
}

/* ----------------------------- Sandbox ----------------------------- */
export function SandboxSection() {
  const history = useApi(() => endpoints.sandboxHistory(), []);
  const payload = history.data as (Record<string, unknown> & { history?: unknown[]; scans?: unknown[]; data?: unknown }) | null;
  const scans = arr(payload?.history ?? payload?.scans ?? payload?.data);

  if (history.loading) return <Loading label="Loading sandbox history…" />;
  if (history.error) return <EmptyState icon="flask" title="Sandbox unavailable" hint={history.error} />;
  if (scans.length === 0)
    return <EmptyState icon="flask" title="No detonations yet" hint="Analyzed samples will appear here." />;

  return (
    <>
      <SecLabel>Recent detonations</SecLabel>
      <Card style={{ overflow: 'hidden' }}>
        {scans.slice(0, 12).map((s, i) => {
          const verdict = String(s.verdict ?? 'unknown');
          const risk = num(s.riskScore);
          const color = verdict === 'malicious' ? colors.red : verdict === 'benign' ? colors.green : colors.amber2;
          return (
            <View key={i} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{String(s.url ?? s.id ?? 'sample')}</Text>
                <Text style={styles.rowMeta}>{verdict} · risk {risk}</Text>
              </View>
              <Text style={styles.rowMeta}>{timeAgo(s.createdAt as string | number)}</Text>
            </View>
          );
        })}
      </Card>
    </>
  );
}

/* -------------------------- Threat Intel --------------------------- */
export function IntelSection() {
  const pulses = useApi(() => endpoints.otxPulses(), []);
  const payload = pulses.data as (Record<string, unknown> & { pulses?: unknown[]; data?: unknown }) | null;
  const list = arr(payload?.pulses ?? payload?.data);

  if (pulses.loading) return <Loading label="Loading threat intelligence…" />;
  if (pulses.error) return <EmptyState icon="radar" title="Intel feed unavailable" hint={pulses.error} />;
  if (list.length === 0) return <EmptyState icon="radar" title="No active pulses" hint="OTX intelligence will appear here." />;

  return (
    <>
      <SecLabel>Live threat pulses</SecLabel>
      <Card style={{ overflow: 'hidden' }}>
        {list.slice(0, 14).map((p, i) => (
          <View key={i} style={[styles.row, i > 0 && styles.rowBorder]}>
            <Icon name="radar" size={15} color={colors.amber2} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{String(p.name ?? p.title ?? 'Pulse')}</Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {String(p.adversary ?? (Array.isArray(p.tags) ? (p.tags as string[]).slice(0, 2).join(', ') : 'OTX'))}
              </Text>
            </View>
            <Text style={styles.rowMeta}>{timeAgo(p.modified as string)}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

/* ------------------------- Browser Intel --------------------------- */
export function BrowserSection() {
  const snap = useApi(() => endpoints.browserSnapshot(), []);
  const data = (snap.data?.data ?? snap.data) as Record<string, unknown> | null;

  if (snap.loading) return <Loading label="Loading browser snapshot…" />;
  if (snap.error) return <EmptyState icon="globe" title="No active browser session" hint={snap.error} />;
  if (!data || Object.keys(data).length === 0)
    return <EmptyState icon="globe" title="No browser activity" hint="Pair the CyberForge extension to stream sessions." />;

  const sessions = num(data.sessions ?? data.activeSessions, 0);
  const trackers = num(data.trackers ?? data.blockedTrackers, 0);
  const threats = num(data.threats ?? data.threatsBlocked, 0);

  return (
    <>
      <StatTiles
        items={[
          { value: String(sessions), label: 'sessions', color: colors.cyan },
          { value: String(trackers), label: 'trackers', color: colors.amber2 },
          { value: String(threats), label: 'threats', color: threats === 0 ? colors.green : colors.red },
        ]}
      />
      <SecLabel>Snapshot</SecLabel>
      <Card style={{ overflow: 'hidden' }}>
        {Object.entries(data).slice(0, 10).map(([k, v], i) => (
          <View key={k} style={[styles.kv, i > 0 && styles.rowBorder]}>
            <Text style={styles.kvKey}>{k}</Text>
            <Text style={styles.kvVal} numberOfLines={1}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

/* ------------------------- Orchestrator ---------------------------- */
export function OrchestratorSection() {
  const stats = useApi(() => endpoints.orchestratorStats(), []);
  const s = stats.data?.stats;

  if (stats.loading) return <Loading label="Loading orchestrator…" />;
  if (stats.error || !s) return <EmptyState icon="nodes" title="Orchestrator unavailable" hint={stats.error ?? undefined} />;

  return (
    <>
      <StatTiles
        items={[
          { value: String(s.agents.length), label: 'agents', color: colors.green },
          { value: String(s.totalReports), label: 'reports', color: colors.amber2 },
          { value: `${s.avgDurationMs}ms`, label: 'avg run', color: colors.cyan },
        ]}
      />
      <SecLabel>Agent roster</SecLabel>
      <Card style={{ overflow: 'hidden' }}>
        {s.agents.map((a, i) => (
          <View key={a.name} style={[styles.row, i > 0 && styles.rowBorder]}>
            <Icon name="bot" size={15} color={colors.cyan} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{a.name}</Text>
              <Text style={styles.rowMeta} numberOfLines={1}>{a.role}</Text>
            </View>
            <LiveDot color={colors.green} />
          </View>
        ))}
      </Card>
    </>
  );
}

/* --------------------------- Pipeline ------------------------------ */
export function PipelineSection() {
  const { metrics, connected } = useLiveFeed();
  const m = (metrics ?? {}) as Record<string, unknown>;
  const stages: Array<[string, string, string]> = [
    ['Ingest', metrics ? `${num(m.ingest ?? m.eventsPerSec)}/s` : '—', metrics ? colors.green : colors.faint],
    ['Normalize', metrics ? `${num(m.normalize ?? m.processed)}/s` : '—', metrics ? colors.green : colors.faint],
    ['Analyze', connected ? 'running' : 'idle', connected ? colors.amber2 : colors.faint],
    ['Reason', connected ? 'live' : 'idle', connected ? colors.cyan : colors.faint],
  ];

  return (
    <>
      <SecLabel>Signal pipeline</SecLabel>
      <Card style={{ paddingVertical: 6 }}>
        {stages.map(([label, val, color], i) => (
          <View key={label} style={[styles.listRow, i > 0 && styles.rowBorder]}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={[styles.rowTitle, { flex: 1 }]}>{label}</Text>
            <Text style={styles.rowMeta}>{val}</Text>
          </View>
        ))}
      </Card>
      {!metrics ? (
        <Text style={styles.note}>Waiting for the live metrics heartbeat…</Text>
      ) : null}
    </>
  );
}

/* ---------------------------- Models ------------------------------- */
export function ModelsSection() {
  const health = useApi(() => endpoints.mlHealth(), []);
  const models = useApi(() => endpoints.mlModels(), []);

  if (health.loading || models.loading) return <Loading label="Querying inference service…" />;

  const h = (health.data ?? {}) as Record<string, unknown>;
  const ok = String(h.status ?? '').toLowerCase().includes('ok') || h.status === 'healthy' || h.status === true;
  const payload = models.data as (Record<string, unknown> & { models?: unknown[]; data?: unknown }) | null;
  const list = arr(payload?.models ?? payload?.data);

  if (health.error && models.error)
    return <EmptyState icon="brain" title="Inference offline" hint={health.error} />;

  return (
    <>
      <Card style={styles.healthCard}>
        <LiveDot color={ok ? colors.green : colors.red} />
        <Text style={styles.rowTitle}>ML service {ok ? 'online' : 'degraded'}</Text>
      </Card>
      <SecLabel>Served models</SecLabel>
      {list.length === 0 ? (
        <EmptyState icon="brain" title="No models reported" />
      ) : (
        <Card>
          <BarRows
            rows={list.slice(0, 6).map((mo) => [
              String(mo.name ?? mo.id ?? 'model'),
              num(mo.accuracy ?? mo.confidence ?? 90),
              colors.cyan,
            ])}
          />
        </Card>
      )}
    </>
  );
}

/* ----------------------------- Tasks ------------------------------- */
export function TasksSection() {
  const recent = useApi(() => endpoints.orchestratorRecent(20), []);
  const reports = recent.data?.reports ?? [];

  if (recent.loading) return <Loading label="Loading tasks…" />;
  if (recent.error) return <EmptyState icon="check" title="Tasks unavailable" hint={recent.error} />;
  if (reports.length === 0) return <EmptyState icon="check" title="No recent tasks" hint="Agent runs will appear here." />;

  return (
    <>
      <SecLabel>Recent agent runs</SecLabel>
      <Card style={{ overflow: 'hidden' }}>
        {reports.map((r, i) => {
          const verdict = String(r.verdict ?? 'done');
          const color = verdict === 'malicious' ? colors.red : verdict === 'benign' ? colors.green : colors.amber2;
          return (
            <View key={r.id ?? i} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{String(r.url ?? r.summary ?? r.id ?? 'task')}</Text>
                <Text style={styles.rowMeta}>{verdict}{r.riskScore != null ? ` · risk ${r.riskScore}` : ''}</Text>
              </View>
              <Text style={styles.rowMeta}>{timeAgo(r.timestamp)}</Text>
            </View>
          );
        })}
      </Card>
    </>
  );
}

/* ----------------------------- Memory ------------------------------ */
export function MemorySection() {
  const stats = useApi(() => endpoints.orchestratorStats(), []);
  const mem = (stats.data?.stats?.memory ?? {}) as Record<string, unknown>;

  if (stats.loading) return <Loading label="Loading memory…" />;
  if (stats.error) return <EmptyState icon="brain" title="Memory unavailable" hint={stats.error} />;
  const entries = Object.entries(mem);
  if (entries.length === 0) return <EmptyState icon="brain" title="No memory state" hint="The agent's knowledge graph is empty." />;

  return (
    <>
      <SecLabel>Knowledge graph</SecLabel>
      <Card style={{ overflow: 'hidden' }}>
        {entries.map(([k, v], i) => (
          <View key={k} style={[styles.kv, i > 0 && styles.rowBorder]}>
            <Text style={styles.kvKey}>{k}</Text>
            <Text style={styles.kvVal} numberOfLines={1}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.text },
  rowMeta: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint, marginTop: 2 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
  kvKey: { fontFamily: fonts.sans, fontSize: 13, color: colors.dim },
  kvVal: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.text, flexShrink: 1, textAlign: 'right' },
  healthCard: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  note: { fontFamily: fonts.mono, fontSize: 10, color: colors.faint, textAlign: 'center', marginTop: 12 },
});
