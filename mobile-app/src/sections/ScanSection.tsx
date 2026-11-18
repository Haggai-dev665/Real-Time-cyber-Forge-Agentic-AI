/**
 * Scan an address from the phone: the backend's eight analysis agents run on
 * it (POST /api/orchestrator/analyze) and the full report comes back — the
 * verdict and risk score, what was found, what each agent did (or why it
 * failed), the indicators and ATT&CK techniques, and the summary.
 *
 * Sends the address only while "Cloud scanning" is on in Settings › Privacy,
 * and only when the user taps Scan. An address passed in the link
 * (cyberforge://screen/scan?url=…) is filled in, not scanned on its own.
 * The account's recent scans are listed below, also on the desktop.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { colors, fonts, tint } from '../theme';
import { Card, SecLabel, Pill, EmptyState } from '../components/ui';
import { Icon } from '../components/Icon';
import { Ring } from '../components/Ring';
import { Markdown } from '../components/Markdown';
import { endpoints } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import { usePrivacy } from '../context/PrivacyContext';
import { useAuth } from '../context/AuthContext';
import type { ScanReport } from '../api/types';
import { timeAgo } from '../utils/format';

const VERDICT_COLOR: Record<string, string> = {
  malicious: colors.red,
  suspicious: colors.amber2,
  'low-risk': colors.cyan,
  clean: colors.green,
  unknown: colors.faint,
};

const AGENT_LABEL: Record<string, string> = {
  url_classifier: 'URL classifier',
  dga_detector: 'DGA detector',
  web_scraper: 'Web scraper',
  memory: 'Memory reader',
  ioc_extractor: 'IOC extractor',
  behavioral: 'Behavioural analyser',
  mitre_mapper: 'MITRE mapper',
  threat_intel: 'Threat intelligence',
};
const AGENT_ORDER = Object.keys(AGENT_LABEL);

function normalizeUrl(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.toString() : null;
  } catch {
    return null;
  }
}

/** One line on what an agent found, from its own result. */
function agentDetail(name: string, result: Record<string, unknown> | undefined): string {
  if (!result) return '';
  const r = result as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (name) {
    case 'url_classifier': return `${r.verdict ?? r.label ?? '?'}${r.confidence != null ? ` · ${r.confidence}%` : ''}`;
    case 'dga_detector': return `${r.verdict === 'dga' ? 'looks generated' : 'looks legitimate'}${r.confidence != null ? ` · ${r.confidence}%` : ''}`;
    case 'web_scraper': return `${r.pageLoaded ? 'page loaded' : 'page not loaded'} · evidence ${r.evidenceStatus ?? '?'}${r.networkRequests != null ? ` · ${r.networkRequests} requests` : ''}`;
    case 'memory': return r.visitCount ? `${r.visitCount} earlier visits · last verdict ${r.lastVerdict ?? 'none'}` : 'first visit';
    case 'ioc_extractor': return `${r.count ?? 0} indicators`;
    case 'behavioral': return Array.isArray(r.findings) && r.findings.length ? String(r.findings[0]) : `${r.forms ?? 0} forms · nothing risky`;
    case 'mitre_mapper': return `${r.techniqueCount ?? 0} techniques`;
    case 'threat_intel': return `${r.checked ?? 0} checked · ${r.flagged ?? 0} known bad`;
    default: return '';
  }
}

export function ScanSection() {
  const params = useLocalSearchParams<{ url?: string }>();
  const router = useRouter();
  const privacy = usePrivacy();
  const { isGuest } = useAuth();
  const [input, setInput] = useState(typeof params.url === 'string' ? params.url : '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [report, setReport] = useState<ScanReport | null>(null);
  const allowed = privacy.allows('cloud_scanning');
  const recent = useApi(() => endpoints.orchestratorRecent(10), [report?.id], { cacheKey: 'scan_recent' });

  const scan = async () => {
    const url = normalizeUrl(input);
    if (!url) {
      setProblem('Enter a web address, for example example.com or https://example.com/login.');
      return;
    }
    if (!privacy.allowsNow('cloud_scanning')) return;
    setBusy(true);
    setProblem(null);
    setReport(null);
    try {
      const res = await endpoints.orchestratorAnalyze(url);
      setReport(res.report);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'The scan did not finish');
    } finally {
      setBusy(false);
    }
  };

  const ask = () => {
    if (!report) return;
    const q = `I scanned ${report.url}. The verdict was ${report.verdict} with risk ${report.riskScore}/100. Findings: ${(report.findings ?? []).slice(0, 5).join('; ') || 'none'}. What does this mean and what should I do?`;
    router.push({ pathname: '/screen/[key]', params: { key: 'assistant', q } });
  };

  const color = report ? VERDICT_COLOR[report.verdict] ?? colors.amber2 : colors.faint;
  const agents = report?.agents ?? {};
  const ok = Object.values(agents).filter((a) => a.status === 'ok').length;

  return (
    <>
      <Card style={styles.intro}>
        <Text style={styles.introText}>
          Paste a link you are unsure about. CyberForge's eight analysis agents check it on the backend; nothing is opened on this
          phone.
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="https://example.com/login"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={() => void scan()}
            editable={!busy}
            accessibilityLabel="Address to scan"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan"
            onPress={() => void scan()}
            disabled={busy || !allowed || isGuest}
            style={[styles.scanBtn, (busy || !allowed || isGuest) && { opacity: 0.45 }]}
          >
            {busy ? <ActivityIndicator size="small" color="#1a1206" /> : <Text style={styles.scanText}>Scan</Text>}
          </Pressable>
        </View>
        {busy ? <Text style={styles.hint}>The agents are working: this usually takes 10 to 40 seconds.</Text> : null}
        {problem ? <Text style={styles.error}>{problem}</Text> : null}
      </Card>

      {isGuest ? (
        <Text style={styles.hint}>Sign in to scan addresses: scans are kept in your account.</Text>
      ) : !allowed ? (
        <Pressable
          style={styles.off}
          onPress={() => router.push({ pathname: '/screen/[key]', params: { key: 'settings' } })}
          accessibilityRole="button"
        >
          <Icon name="lock" size={16} color={colors.amber2} />
          <Text style={styles.offText}>
            Cloud scanning is off in Settings › Privacy. Turning it on lets an address you choose be sent to the CyberForge backend
            for analysis. Tap to open Privacy.
          </Text>
        </Pressable>
      ) : null}

      {report ? (
        <>
          <Card style={[styles.verdictCard, { borderColor: tint(color, 0.4) }]}>
            <Ring value={Math.max(0, Math.min(100, report.riskScore))} size={78} stroke={7} color={color}>
              <Text style={[styles.score, { color }]}>{report.riskScore}</Text>
            </Ring>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Pill label={report.verdict} color={color} />
              <Text style={styles.url} numberOfLines={2} selectable>{report.url}</Text>
              <Text style={styles.meta}>
                {ok}/{Object.keys(agents).length || 8} agents answered · page evidence {report.evidenceStatus ?? 'unknown'}
              </Text>
            </View>
          </Card>

          {report.coverage?.reason || (report.coverage?.agents_failed?.length ?? 0) > 0 ? (
            <Text style={styles.hint}>
              {report.coverage?.reason ? `Not everything could be checked: ${report.coverage.reason}. ` : ''}
              {report.coverage?.agents_failed?.length ? `Agents that did not answer: ${report.coverage.agents_failed.map((a) => AGENT_LABEL[a] ?? a).join(', ')}.` : ''}
            </Text>
          ) : null}

          {report.summary ? (
            <>
              <SecLabel>Summary</SecLabel>
              <Card style={{ padding: 14 }}>
                <Markdown text={report.summary} />
              </Card>
            </>
          ) : null}

          {report.findings && report.findings.length > 0 ? (
            <>
              <SecLabel>What was found</SecLabel>
              <Card style={{ overflow: 'hidden' }}>
                {report.findings.map((f, i) => (
                  <View key={i} style={[styles.row, i > 0 && styles.border]}>
                    <Icon name="alert" size={14} color={colors.amber2} />
                    <Text style={styles.rowText}>{f}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <SecLabel>The eight agents</SecLabel>
          <Card style={{ overflow: 'hidden' }}>
            {AGENT_ORDER.filter((n) => agents[n]).map((name, i) => {
              const a = agents[name];
              const good = a.status === 'ok';
              return (
                <View key={name} style={[styles.row, i > 0 && styles.border]}>
                  <View style={[styles.dot, { backgroundColor: good ? colors.green : colors.red }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle}>{AGENT_LABEL[name]}</Text>
                    <Text style={styles.meta} numberOfLines={2}>{good ? agentDetail(name, a.result) : `did not answer: ${a.error ?? 'unknown reason'}`}</Text>
                  </View>
                  <Text style={styles.meta}>{a.latencyMs != null ? `${(a.latencyMs / 1000).toFixed(1)} s` : ''}</Text>
                </View>
              );
            })}
          </Card>

          {report.iocs && report.iocs.length > 0 ? (
            <>
              <SecLabel>{`Indicators (${report.iocs.length})`}</SecLabel>
              <Card style={{ overflow: 'hidden' }}>
                {report.iocs.slice(0, 12).map((ioc, i) => (
                  <View key={i} style={[styles.row, i > 0 && styles.border]}>
                    <Text style={styles.iocType}>{ioc.type}</Text>
                    <Text style={styles.iocVal} numberOfLines={1} selectable>{ioc.value}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {report.mitre && report.mitre.length > 0 ? (
            <>
              <SecLabel>ATT&CK techniques (hints)</SecLabel>
              <View style={styles.chips}>
                {report.mitre.slice(0, 10).map((t, i) => (
                  <Pill key={i} label={`${t.id ?? t.techniqueId ?? ''} ${t.name ?? ''}`.trim()} color={colors.cyan} />
                ))}
              </View>
            </>
          ) : null}

          <Pressable accessibilityRole="button" style={styles.askBtn} onPress={ask}>
            <Icon name="spark" size={16} color={colors.amber2} />
            <Text style={styles.askText}>Ask the assistant about this result</Text>
          </Pressable>
        </>
      ) : null}

      {!isGuest ? (
        <>
          <SecLabel>{`Recent scans${recent.stale && recent.cachedAt ? ` · saved ${timeAgo(recent.cachedAt)} ago` : ''}`}</SecLabel>
          {(recent.data?.reports ?? []).length === 0 ? (
            <EmptyState icon="search" title="No scans yet" hint="Scans from this phone and from the desktop appear here." />
          ) : (
            <Card style={{ overflow: 'hidden' }}>
              {(recent.data?.reports ?? []).map((r, i) => {
                const c = VERDICT_COLOR[String(r.verdict)] ?? colors.amber2;
                return (
                  <View key={r.id ?? i} style={[styles.row, i > 0 && styles.border]}>
                    <View style={[styles.dot, { backgroundColor: c }]} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{String(r.url ?? r.id)}</Text>
                      <Text style={styles.meta}>{r.verdict ?? 'done'}{r.riskScore != null ? ` · risk ${r.riskScore}` : ''}</Text>
                    </View>
                    <Text style={styles.meta}>{timeAgo(r.timestamp)}</Text>
                  </View>
                );
              })}
            </Card>
          )}
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  intro: { padding: 14 },
  introText: { fontFamily: fonts.sans, fontSize: 13, color: colors.dim, lineHeight: 19 },
  inputRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  input: {
    flex: 1, minWidth: 0, height: 48, paddingHorizontal: 14, backgroundColor: colors.tile, borderWidth: 1, borderColor: colors.line2,
    borderRadius: 13, color: colors.text, fontFamily: fonts.mono, fontSize: 13,
  },
  scanBtn: { height: 48, minWidth: 76, paddingHorizontal: 16, borderRadius: 13, backgroundColor: colors.amber2, alignItems: 'center', justifyContent: 'center' },
  scanText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: '#1a1206' },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.faint, marginTop: 10, lineHeight: 17 },
  error: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.red, marginTop: 10 },
  off: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 12, borderRadius: 13,
    borderWidth: 1, borderColor: tint(colors.amber2, 0.4), backgroundColor: tint(colors.amber2, 0.08),
  },
  offText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.text, lineHeight: 17 },
  verdictCard: { marginTop: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  score: { fontFamily: fonts.monoSemiBold, fontSize: 20 },
  url: { fontFamily: fonts.mono, fontSize: 12, color: colors.text, marginTop: 6 },
  meta: { fontFamily: fonts.mono, fontSize: 10, color: colors.faint, marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  border: { borderTopWidth: 1, borderTopColor: colors.line },
  rowText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.text, lineHeight: 18 },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.text },
  dot: { width: 8, height: 8, borderRadius: 4 },
  iocType: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint, width: 64, textTransform: 'uppercase' },
  iocVal: { flex: 1, fontFamily: fonts.mono, fontSize: 11.5, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  askBtn: {
    marginTop: 16, minHeight: 46, borderRadius: 13, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: tint(colors.amber2, 0.4), backgroundColor: tint(colors.amber2, 0.08),
  },
  askText: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.amber2 },
});
