/**
 * Alert detail sheet. Reads the alert from the shared alerts store by id and,
 * for a finding the backend holds, its guidance (why it matters, next step)
 * and timeline.
 *
 * Actions move the finding through its workflow on the backend (acknowledge,
 * investigate, resolve, false positive, reopen). Only the actions the current
 * state allows are offered. The change reaches the desktop and the account's
 * other devices through the live feed (`threat:update`).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, severityColor, tint } from '../../src/theme';
import { Card, Pill, SecLabel, EmptyState } from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import { useAlerts, FINDING_ACTIONS, OPEN_STATES } from '../../src/context/AlertsContext';
import { useAuth } from '../../src/context/AuthContext';
import { endpoints } from '../../src/api/endpoints';
import type { FindingAction, Threat } from '../../src/api/types';
import { timeAgo } from '../../src/utils/format';

const STATE_LABEL: Record<string, string> = {
  detected: 'new', active: 'new', acknowledged: 'acknowledged', investigating: 'investigating', confirmed: 'confirmed',
  resolved: 'resolved', false_positive: 'false positive', dismissed: 'dismissed', mitigated: 'mitigated', excepted: 'excepted',
};

export default function AlertDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getById, transition } = useAlerts();
  const { isGuest } = useAuth();
  const [detail, setDetail] = useState<Threat | null>(null);
  const [busy, setBusy] = useState<FindingAction | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const alert = id ? getById(id) : undefined;
  const color = alert ? severityColor[alert.severity] : colors.amber2;
  const open = alert ? OPEN_STATES.includes(alert.status) : false;

  // the stored finding's guidance and timeline (refetched after each change)
  useEffect(() => {
    if (!alert?.stored || isGuest) return;
    let cancelled = false;
    endpoints
      .threat(alert.id)
      .then((res) => {
        if (!cancelled) setDetail(res.data?.threat ?? null);
      })
      .catch(() => {
        /* the sheet still shows what the list has */
      });
    return () => {
      cancelled = true;
    };
  }, [alert?.id, alert?.stored, alert?.status, isGuest]);

  const close = () => router.back();

  const act = async (action: FindingAction) => {
    if (!alert) return;
    setBusy(action);
    setProblem(null);
    try {
      await transition(alert.id, action);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'The change was not saved');
    } finally {
      setBusy(null);
    }
  };

  const ask = () => {
    if (!alert) return;
    const q = `Explain this alert and what I should do: "${alert.title}" (severity ${alert.severity}, source ${alert.source}).`;
    router.push({ pathname: '/screen/[key]', params: { key: 'assistant', q } });
  };

  const actions = alert ? FINDING_ACTIONS.filter((a) => a.from.includes(alert.status)) : [];
  const timeline = (detail?.timeline ?? []).slice(-6).reverse();
  const guidance = detail?.guidance;

  return (
    <View style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.scrim} onPress={close} />
      <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <View style={styles.grab} />
          {!alert ? (
            <View style={{ padding: 24 }}>
              <EmptyState icon="alert" title="Alert not found" hint="It may have rolled out of the live window." />
              <Pressable accessibilityRole="button" style={styles.closeBtn} onPress={close}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
              <LinearGradient colors={[tint(color, 0.15), 'transparent']} style={styles.headerGrad}>
                <View style={styles.headerRow}>
                  <View style={[styles.headerIcon, { backgroundColor: tint(color, 0.15), borderColor: tint(color, 0.4) }]}>
                    <Icon name="alert" size={24} color={color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      <Pill label={alert.severity} color={color} />
                      <Pill label={STATE_LABEL[alert.status] ?? alert.status} color={open ? colors.amber2 : colors.green} />
                    </View>
                    <Text style={styles.title}>{alert.title}</Text>
                  </View>
                </View>
              </LinearGradient>

              <View style={styles.body}>
                {alert.description ? <Text style={styles.desc}>{alert.description}</Text> : null}

                <Card style={styles.sourceCard}>
                  <Icon name="globe" size={16} color={colors.cyan} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.sourceLabel}>SOURCE</Text>
                    <Text style={styles.sourceVal} numberOfLines={1}>{alert.source}</Text>
                  </View>
                  <Text style={styles.time}>{timeAgo(alert.ts)} ago</Text>
                </Card>

                {guidance?.whyItMatters ? (
                  <Card style={styles.recCard}>
                    <Text style={styles.recLabel}>WHY IT MATTERS</Text>
                    <Text style={styles.recText}>{guidance.whyItMatters}</Text>
                    {guidance.nextStep ? (
                      <>
                        <Text style={[styles.recLabel, { marginTop: 10 }]}>NEXT STEP</Text>
                        <Text style={styles.recText}>{guidance.nextStep}</Text>
                      </>
                    ) : null}
                    {guidance.occurrences && guidance.occurrences > 1 ? (
                      <Text style={[styles.time, { marginTop: 8 }]}>seen {guidance.occurrences} times</Text>
                    ) : null}
                  </Card>
                ) : alert.recommendation ? (
                  <Card style={styles.recCard}>
                    <Text style={styles.recLabel}>RECOMMENDATION</Text>
                    <Text style={styles.recText}>{alert.recommendation}</Text>
                  </Card>
                ) : null}

                {alert.indicators.length > 0 ? (
                  <>
                    <SecLabel>Indicators</SecLabel>
                    <Card style={{ overflow: 'hidden' }}>
                      {alert.indicators.map(([k, v], i) => (
                        <View key={i} style={[styles.ioc, i > 0 && styles.iocBorder]}>
                          <Text style={styles.iocKey}>{k}</Text>
                          <Text style={styles.iocVal} selectable>{v}</Text>
                        </View>
                      ))}
                    </Card>
                  </>
                ) : null}

                {timeline.length > 0 ? (
                  <>
                    <SecLabel>History</SecLabel>
                    <Card style={{ overflow: 'hidden' }}>
                      {timeline.map((t, i) => (
                        <View key={i} style={[styles.ioc, i > 0 && styles.iocBorder]}>
                          <Text style={styles.iocKey}>{t.timestamp ? timeAgo(t.timestamp) : ''}</Text>
                          <Text style={styles.iocVal}>{t.event}{t.details ? ` · ${t.details}` : ''}</Text>
                        </View>
                      ))}
                    </Card>
                  </>
                ) : null}

                {alert.stored && !isGuest && actions.length > 0 ? (
                  <>
                    <SecLabel>Decide</SecLabel>
                    <View style={styles.actions}>
                      {actions.map((a) => (
                        <Pressable
                          key={a.action}
                          accessibilityRole="button"
                          accessibilityLabel={a.label}
                          disabled={busy !== null}
                          onPress={() => void act(a.action)}
                          style={[styles.actBtn, a.action === 'resolve' && styles.primaryBtn, busy !== null && { opacity: 0.6 }]}
                        >
                          {busy === a.action ? <ActivityIndicator size="small" color={colors.text} /> : null}
                          <Text style={[styles.actText, a.action === 'resolve' && { color: '#08130c' }]}>{a.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.hint}>Saved to your account; your desktop and other devices show the change.</Text>
                  </>
                ) : !alert.stored ? (
                  <Text style={styles.hint}>A live event only: it can be decided once it is saved as a finding.</Text>
                ) : null}
                {problem ? <Text style={styles.error}>{problem}</Text> : null}

                <Pressable accessibilityRole="button" style={styles.askBtn} onPress={ask}>
                  <Icon name="spark" size={16} color={colors.amber2} />
                  <Text style={styles.askText}>Ask the assistant about this alert</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.closeBtn} onPress={close}>
                  <Text style={styles.closeText}>Close</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheetWrap: { maxHeight: '92%', backgroundColor: colors.bg2 },
  sheet: {
    backgroundColor: colors.bg2,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: colors.line2,
    borderBottomWidth: 0,
    paddingTop: 14,
    overflow: 'hidden',
  },
  grab: { width: 40, height: 4, borderRadius: 99, backgroundColor: colors.line2, alignSelf: 'center', marginBottom: 8 },
  headerGrad: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 19, color: colors.text, marginTop: 6, lineHeight: 23 },
  body: { paddingHorizontal: 20, paddingBottom: 12 },
  desc: { fontFamily: fonts.sans, color: colors.dim, fontSize: 13.5, lineHeight: 21, marginTop: 10 },
  sourceCard: { padding: 13, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sourceLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.faint },
  sourceVal: { fontFamily: fonts.mono, fontSize: 12, color: colors.text },
  time: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint },
  ioc: { flexDirection: 'row', gap: 10, padding: 12 },
  iocBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  iocKey: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint, width: 70, textTransform: 'uppercase' },
  iocVal: { flex: 1, fontFamily: fonts.mono, fontSize: 11.5, color: colors.text },
  recCard: { padding: 14, marginTop: 16, borderColor: tint(colors.amber, 0.28), backgroundColor: colors.amberDim },
  recLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.amber2, letterSpacing: 1, marginBottom: 4 },
  recText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actBtn: {
    flexGrow: 1, flexBasis: '45%', minHeight: 46, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line2,
  },
  primaryBtn: { backgroundColor: colors.green, borderColor: colors.green },
  actText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
  hint: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.faint, marginTop: 8, lineHeight: 16 },
  error: { fontFamily: fonts.sans, fontSize: 12, color: colors.red, marginTop: 8 },
  askBtn: {
    marginTop: 16, minHeight: 46, borderRadius: 13, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: tint(colors.amber2, 0.4), backgroundColor: tint(colors.amber2, 0.08),
  },
  askText: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.amber2 },
  closeBtn: { marginTop: 10, height: 46, borderRadius: 13, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
});
