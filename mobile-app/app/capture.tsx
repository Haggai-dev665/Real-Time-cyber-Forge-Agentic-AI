/**
 * Network Capture — start the on-device VPN, watch live decrypted flows, and
 * mirror everything the desktop app saved for the signed-in user.
 *
 * The capture engine is native + Android-only (see src/native/vpn.ts). When it
 * isn't in the build, this screen shows an honest "needs a dev build" state
 * rather than faking traffic.
 */
import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, fonts, tint } from '../src/theme';
import { Screen } from '../src/components/Screen';
import { Card, SecLabel, Pill, StatTiles, EmptyState } from '../src/components/ui';
import { Icon } from '../src/components/Icon';
import { LiveDot } from '../src/components/LiveDot';
import { useVpn } from '../src/context/VpnContext';
import { useApi } from '../src/hooks/useApi';
import { endpoints } from '../src/api/endpoints';
import type { NetworkFlow } from '../src/native/vpn';

export default function Capture() {
  const router = useRouter();
  const { supported, state, flows, syncedCount, start, stop, installCa, refreshCa, clear } = useVpn();

  const running = state.status === 'running';
  const busy = state.status === 'preparing' || state.status === 'stopping';

  // Data the DESKTOP app wrote to the DB — read back here for the same user.
  const desktop = useApi(
    () =>
      Promise.all([
        endpoints.browserSnapshot().catch(() => null),
        endpoints.threatStats().catch(() => null),
        endpoints.threats({ limit: 5 }).catch(() => null),
      ]),
    []
  );

  const onPrimary = useCallback(() => {
    if (running) void stop();
    else void start();
  }, [running, start, stop]);

  return (
    <Screen refreshing={desktop.loading} onRefresh={() => { desktop.refresh(); void refreshCa(); }}>
      {/* header */}
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
          <Icon name="chevL" size={20} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Network Capture</Text>
          <View style={styles.subRow}>
            {running ? <LiveDot color={colors.green} /> : null}
            <Text style={styles.sub}>{statusLabel(state.status)}</Text>
          </View>
        </View>
      </View>

      {!supported ? (
        <View style={{ paddingHorizontal: 18 }}>
          <Card style={styles.notice}>
            <Icon name="plug" size={22} color={colors.amber2} />
            <Text style={styles.noticeTitle}>Capture engine not in this build</Text>
            <Text style={styles.noticeBody}>
              The VPN capture engine is a native Android module. Run a dev or EAS build
              (not Expo Go) on an Android device to enable device-wide capture.
            </Text>
          </Card>
        </View>
      ) : (
        <>
          {/* control */}
          <View style={{ paddingHorizontal: 18 }}>
            <Card style={styles.control}>
              <View style={styles.controlTop}>
                <View style={[styles.shield, { borderColor: tint(running ? colors.green : colors.faint, 0.5) }]}>
                  <Icon name={running ? 'shieldCheck' : 'shield'} size={26} color={running ? colors.green : colors.faint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.controlTitle}>{running ? 'Capturing all traffic' : 'Capture is off'}</Text>
                  <Text style={styles.controlSub}>
                    {running
                      ? 'Every request on this device is being inspected.'
                      : 'Start the VPN to route and inspect device traffic.'}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={onPrimary}
                disabled={busy}
                style={[styles.btn, { backgroundColor: running ? tint(colors.red, 0.16) : tint(colors.green, 0.18), borderColor: tint(running ? colors.red : colors.green, 0.5) }]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <>
                    <Icon name={running ? 'x' : 'bolt'} size={17} color={running ? colors.red : colors.green} />
                    <Text style={[styles.btnText, { color: running ? colors.red : colors.green }]}>
                      {running ? 'Stop capture' : 'Start capture'}
                    </Text>
                  </>
                )}
              </Pressable>

              {state.error ? <Text style={styles.err}>{state.error}</Text> : null}
            </Card>
          </View>

          {/* live counters */}
          <View style={{ paddingHorizontal: 18, marginTop: 12 }}>
            <StatTiles
              items={[
                { value: String(flows.length), label: 'flows (live)', color: colors.cyan, icon: 'activity' },
                { value: String(syncedCount), label: 'synced to DB', color: colors.green, icon: 'refresh' },
                { value: state.caInstalled ? 'trusted' : 'off', label: 'root CA', color: state.caInstalled ? colors.green : colors.amber2, icon: 'lock' },
              ]}
            />
          </View>

          {/* CA trust — required for full-payload (HTTPS) decryption */}
          {!state.caInstalled ? (
            <View style={{ paddingHorizontal: 18 }}>
              <Card style={styles.caCard}>
                <View style={styles.caRow}>
                  <Icon name="lock" size={18} color={colors.amber2} />
                  <Text style={styles.caTitle}>Decrypt HTTPS payloads</Text>
                </View>
                <Text style={styles.caBody}>
                  To read full request and response bodies over HTTPS, install and trust the
                  CyberForge root certificate. Without it, encrypted flows show host and IP only.
                </Text>
                <Pressable onPress={() => void installCa()} style={[styles.btn, styles.caBtn]}>
                  <Icon name="shieldCheck" size={16} color={colors.amber2} />
                  <Text style={[styles.btnText, { color: colors.amber2 }]}>Install root CA</Text>
                </Pressable>
              </Card>
            </View>
          ) : null}

          {/* live flows */}
          <View style={styles.secHead}>
            <SecLabel style={{ marginTop: 0 }}>Live flows</SecLabel>
            {flows.length > 0 ? (
              <Pressable onPress={clear} hitSlop={8}>
                <Text style={styles.clear}>clear</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ paddingHorizontal: 18 }}>
            {flows.length === 0 ? (
              <Card style={{ paddingVertical: 28 }}>
                <EmptyState
                  icon="activity"
                  title={running ? 'Waiting for traffic…' : 'No flows yet'}
                  hint={running ? 'Open an app or browser to see requests appear.' : 'Start capture to inspect device traffic.'}
                />
              </Card>
            ) : (
              <Card style={{ overflow: 'hidden' }}>
                {flows.slice(0, 60).map((f, i) => (
                  <FlowRow key={f.id} flow={f} first={i === 0} />
                ))}
              </Card>
            )}
          </View>
        </>
      )}

      {/* desktop-synced data — works on mobile because the desktop saved it for this user */}
      <SecLabel style={{ marginLeft: 22 }}>Synced from desktop</SecLabel>
      <View style={{ paddingHorizontal: 18 }}>
        {desktop.error ? (
          <Card style={{ paddingVertical: 22 }}>
            <EmptyState icon="desktop" title="Couldn't load desktop data" hint={desktop.error} />
          </Card>
        ) : (
          <DesktopSync data={desktop.data} loading={desktop.loading} />
        )}
      </View>
    </Screen>
  );
}

/* ---------- live flow row ---------- */
function FlowRow({ flow, first }: { flow: NetworkFlow; first?: boolean }) {
  const ok = (flow.status ?? 0) < 400;
  const statusColor = flow.status == null ? colors.faint : ok ? colors.green : colors.red;
  return (
    <View style={[styles.flow, !first && styles.flowBorder]}>
      <View style={styles.flowTop}>
        <Text style={[styles.method, { color: methodColor(flow.method) }]}>{flow.method || (flow.scheme === 'https' ? 'TLS' : 'TCP')}</Text>
        <Text style={styles.host} numberOfLines={1}>{flow.host || flow.ip || '—'}</Text>
        {flow.decrypted ? <Icon name="lock" size={11} color={colors.green} /> : null}
        {flow.status != null ? <Text style={[styles.status, { color: statusColor }]}>{flow.status}</Text> : null}
      </View>
      <Text style={styles.path} numberOfLines={1}>{flow.path || flow.url || `${flow.ip ?? ''}:${flow.port ?? ''}`}</Text>
      <View style={styles.flowMeta}>
        {flow.mime ? <Text style={styles.metaTag}>{flow.mime.split(';')[0]}</Text> : null}
        {flow.app ? <Text style={styles.metaTag}>{flow.app}</Text> : null}
        {typeof flow.respBytes === 'number' ? <Text style={styles.metaTag}>{fmtBytes(flow.respBytes)}</Text> : null}
        {(flow.flags || []).map((fl) => (
          <View key={fl} style={{ marginRight: 6 }}><Pill label={fl} color={colors.red} /></View>
        ))}
      </View>
    </View>
  );
}

/* ---------- desktop sync block ---------- */
type DesktopTriple = [
  Awaited<ReturnType<typeof endpoints.browserSnapshot>> | null,
  Awaited<ReturnType<typeof endpoints.threatStats>> | null,
  Awaited<ReturnType<typeof endpoints.threats>> | null
];

function DesktopSync({ data, loading }: { data: DesktopTriple | null; loading: boolean }) {
  if (loading && !data) {
    return (
      <Card style={{ paddingVertical: 22 }}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={colors.amber2} />
          <Text style={styles.dim}>Loading desktop data…</Text>
        </View>
      </Card>
    );
  }
  const [snapRes, statsRes, threatsRes] = data || [null, null, null];
  const snap = snapRes?.data as { session_count?: number; total_domains?: number; total_alerts?: number; average_risk?: number } | undefined;
  const stats = statsRes?.data;
  const threats = threatsRes?.data?.threats ?? [];

  const nothing = !snap?.session_count && !stats?.total_threats && threats.length === 0;
  if (nothing) {
    return (
      <Card style={{ paddingVertical: 24 }}>
        <EmptyState
          icon="desktop"
          title="No desktop data yet"
          hint="Sign in on the desktop app and run a scan — it will appear here for your account."
        />
      </Card>
    );
  }

  return (
    <>
      <StatTiles
        items={[
          { value: String(snap?.total_domains ?? 0), label: 'domains tracked', color: colors.cyan, icon: 'globe' },
          { value: String(stats?.total_threats ?? snap?.total_alerts ?? 0), label: 'threats', color: colors.red, icon: 'shield' },
          { value: `${Math.round((snap?.average_risk ?? 0))}`, label: 'avg risk', color: colors.amber2, icon: 'activity' },
        ]}
      />
      {threats.length > 0 ? (
        <Card style={{ marginTop: 12, overflow: 'hidden' }}>
          {threats.map((t, i) => (
            <View key={t.id ?? t._id ?? i} style={[styles.flow, i > 0 && styles.flowBorder]}>
              <View style={styles.flowTop}>
                <Pill label={t.severity || 'info'} color={sevColor(t.severity)} />
                <Text style={styles.host} numberOfLines={1}>{t.title || t.type || 'Threat'}</Text>
              </View>
              {t.description ? <Text style={styles.path} numberOfLines={2}>{t.description}</Text> : null}
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );
}

/* ---------- helpers ---------- */
function statusLabel(s: string): string {
  switch (s) {
    case 'running': return 'capturing · device-wide';
    case 'preparing': return 'requesting permission…';
    case 'stopping': return 'stopping…';
    case 'unsupported': return 'android dev build required';
    case 'error': return 'error';
    default: return 'idle';
  }
}
function methodColor(m?: string): string {
  switch ((m || '').toUpperCase()) {
    case 'GET': return colors.cyan;
    case 'POST': return colors.amber2;
    case 'PUT': case 'PATCH': return colors.orange;
    case 'DELETE': return colors.red;
    default: return colors.faint;
  }
}
function sevColor(s?: string): string {
  switch (s) {
    case 'critical': case 'high': return colors.red;
    case 'medium': return colors.amber2;
    default: return colors.cyan;
  }
}
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  title: { fontFamily: fonts.sansBold, fontSize: 25, color: colors.text, letterSpacing: -0.5 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  sub: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.dim },

  notice: { padding: 18, gap: 9, alignItems: 'flex-start' },
  noticeTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.text },
  noticeBody: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.dim, lineHeight: 18 },

  control: { padding: 16, gap: 14 },
  controlTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  shield: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tile },
  controlTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15.5, color: colors.text },
  controlSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.dim, marginTop: 2, lineHeight: 17 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1 },
  btnText: { fontFamily: fonts.sansSemiBold, fontSize: 14 },
  err: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.red, textAlign: 'center' },

  caCard: { padding: 16, gap: 11, marginTop: 12 },
  caRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  caTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14.5, color: colors.text },
  caBody: { fontFamily: fonts.sans, fontSize: 12, color: colors.dim, lineHeight: 18 },
  caBtn: { backgroundColor: tint(colors.amber2, 0.13), borderColor: tint(colors.amber2, 0.45) },

  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, marginTop: 20, marginBottom: 9 },
  clear: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.faint, textTransform: 'uppercase', letterSpacing: 1 },

  flow: { paddingVertical: 11, paddingHorizontal: 14, gap: 4 },
  flowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  flowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  method: { fontFamily: fonts.monoSemiBold, fontSize: 10.5, width: 44 },
  host: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: colors.text },
  status: { fontFamily: fonts.monoSemiBold, fontSize: 11 },
  path: { fontFamily: fonts.mono, fontSize: 10, color: colors.faint },
  flowMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  metaTag: { fontFamily: fonts.mono, fontSize: 9, color: colors.dim, backgroundColor: colors.tile, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },

  dim: { fontFamily: fonts.mono, fontSize: 11, color: colors.faint },
});
