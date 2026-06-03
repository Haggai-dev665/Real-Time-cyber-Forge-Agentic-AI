/**
 * Alert detail bottom sheet. Reads the alert from the shared alerts store by id.
 * Actions acknowledge the alert locally (clearly labelled) — the public API
 * exposes no per-alert mutation endpoint, so we don't pretend to push state.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, severityColor, tint } from '../../src/theme';
import { Card, Pill, SecLabel, Timeline, EmptyState } from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import { LiveDot } from '../../src/components/LiveDot';
import { useAlerts } from '../../src/context/AlertsContext';
import { timeAgo } from '../../src/utils/format';

export default function AlertDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getById } = useAlerts();
  const [resolved, setResolved] = useState<string | null>(null);

  const alert = id ? getById(id) : undefined;
  const color = alert ? severityColor[alert.severity] : colors.amber2;

  const close = () => router.back();

  return (
    <View style={styles.root}>
      <Pressable style={styles.scrim} onPress={close} />
      <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <View style={styles.grab} />
          {!alert ? (
            <View style={{ padding: 24 }}>
              <EmptyState icon="alert" title="Alert not found" hint="It may have rolled out of the live window." />
              <Pressable style={styles.closeBtn} onPress={close}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              <LinearGradient colors={[tint(color, 0.15), 'transparent']} style={styles.headerGrad}>
                <View style={styles.headerRow}>
                  <View style={[styles.headerIcon, { backgroundColor: tint(color, 0.15), borderColor: tint(color, 0.4) }]}>
                    <Icon name="alert" size={24} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Pill label={alert.severity} color={color} />
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

                {alert.indicators.length > 0 ? (
                  <>
                    <SecLabel>Indicators</SecLabel>
                    <Card style={{ overflow: 'hidden' }}>
                      {alert.indicators.map(([k, v], i) => (
                        <View key={i} style={[styles.ioc, i > 0 && styles.iocBorder]}>
                          <Text style={styles.iocKey}>{k}</Text>
                          <Text style={styles.iocVal}>{v}</Text>
                        </View>
                      ))}
                    </Card>
                  </>
                ) : null}

                {alert.recommendation ? (
                  <Card style={styles.recCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Icon name="bot" size={15} color={colors.amber2} />
                      <Text style={styles.recLabel}>AGENT RECOMMENDATION</Text>
                    </View>
                    <Text style={styles.recText}>{alert.recommendation}</Text>
                  </Card>
                ) : null}

                {resolved ? (
                  <Card style={[styles.resolvedCard, { borderColor: tint(colors.green, 0.3) }]}>
                    <Icon name="check" size={18} color={colors.green} />
                    <Text style={styles.resolvedText}>{resolved} · on this device</Text>
                  </Card>
                ) : (
                  <View style={styles.actions}>
                    <Pressable style={styles.actBtn} onPress={() => setResolved('Acknowledged')}>
                      <LinearGradient colors={[colors.red, '#c43146']} style={styles.actGrad}>
                        <Icon name="shield" size={15} color="#fff" />
                        <Text style={styles.actText}>Acknowledge</Text>
                      </LinearGradient>
                    </Pressable>
                    <Pressable style={[styles.actBtn, styles.dismissBtn]} onPress={close}>
                      <Text style={[styles.actText, { color: colors.text }]}>Dismiss</Text>
                    </Pressable>
                  </View>
                )}
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
  sheetWrap: { maxHeight: '92%' },
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
  body: { paddingHorizontal: 20, paddingBottom: 24 },
  desc: { fontFamily: fonts.sans, color: colors.dim, fontSize: 13.5, lineHeight: 21, marginTop: 10 },
  sourceCard: { padding: 13, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sourceLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.faint },
  sourceVal: { fontFamily: fonts.mono, fontSize: 12, color: colors.text },
  time: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint },
  ioc: { flexDirection: 'row', gap: 10, padding: 12 },
  iocBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  iocKey: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint, width: 64, textTransform: 'uppercase' },
  iocVal: { flex: 1, fontFamily: fonts.mono, fontSize: 11.5, color: colors.text },
  recCard: { padding: 14, marginTop: 16, borderColor: tint(colors.amber, 0.28), backgroundColor: colors.amberDim },
  recLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.amber2, letterSpacing: 1 },
  recText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.text },
  resolvedCard: { padding: 14, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  resolvedText: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.green },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actBtn: { flex: 1, height: 48, borderRadius: 13, overflow: 'hidden' },
  actGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dismissBtn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  actText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: '#fff' },
  closeBtn: { marginTop: 16, height: 46, borderRadius: 13, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
});
