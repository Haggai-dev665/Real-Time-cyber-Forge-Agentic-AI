/**
 * Alerts list — unified persisted threats + live SSE alerts, filterable by
 * severity / category. Tapping a card opens the detail sheet.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, fonts, severityColor, tint } from '../../src/theme';
import { Screen } from '../../src/components/Screen';
import { TopBar, Pill, Loading, EmptyState } from '../../src/components/ui';
import { Icon, IconName } from '../../src/components/Icon';
import { useAlerts, NormalizedAlert } from '../../src/context/AlertsContext';
import { timeAgo } from '../../src/utils/format';

const FILTERS: Array<[string, string]> = [
  ['all', 'All'],
  ['critical', 'Critical'],
  ['browser', 'Browser'],
  ['network', 'Network'],
];

const CAT_ICON: Record<NormalizedAlert['category'], IconName> = {
  browser: 'globe',
  network: 'activity',
  system: 'alert',
};

export default function Alerts() {
  const router = useRouter();
  const { alerts, loading, error, rateLimited, refresh } = useAlerts();
  const [filter, setFilter] = useState('all');

  const list = useMemo(
    () => alerts.filter((a) => filter === 'all' || a.severity === filter || a.category === filter),
    [alerts, filter]
  );

  const unread = alerts.filter((a) => a.unread).length;

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <TopBar title="Alerts" sub={`${unread} unread · live`} live />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {FILTERS.map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.chip, filter === key && styles.chipOn]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.chipText, filter === key && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 18, gap: 11 }}>
        {loading && alerts.length === 0 ? (
          <Loading label="Loading alerts…" />
        ) : error && alerts.length === 0 ? (
          <EmptyState
            icon="bell"
            title="Couldn't load alerts"
            hint={rateLimited ? 'Rate limited — pull to refresh shortly.' : error}
          />
        ) : list.length === 0 ? (
          <EmptyState
            icon="shieldCheck"
            title={filter === 'all' ? 'No active alerts' : 'Nothing matches this filter'}
            hint={filter === 'all' ? 'You’re all clear. New alerts arrive here live.' : undefined}
          />
        ) : (
          list.map((a) => (
            <Pressable
              key={a.id}
              style={[styles.alert, { borderLeftColor: severityColor[a.severity] }]}
              onPress={() => router.push({ pathname: '/alert/[id]', params: { id: a.id } })}
            >
              <View style={[styles.aic, { backgroundColor: tint(severityColor[a.severity], 0.13) }]}>
                <Icon name={CAT_ICON[a.category]} size={18} color={severityColor[a.severity]} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text style={styles.atitle} numberOfLines={1}>
                    {a.title}
                  </Text>
                  {a.unread ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text style={styles.asrc} numberOfLines={1}>
                  {a.source}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <Pill label={a.severity} color={severityColor[a.severity]} />
                  <Text style={styles.atime}>{timeAgo(a.ts)} ago</Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: 18, paddingBottom: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
  },
  chipOn: { borderColor: tint(colors.amber2, 0.4), backgroundColor: colors.amberDim },
  chipText: { fontFamily: fonts.mono, fontSize: 11, color: colors.dim },
  chipTextOn: { color: colors.amber2 },
  alert: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 3,
    backgroundColor: colors.surface,
  },
  aic: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  atitle: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.text },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber2 },
  asrc: { fontFamily: fonts.mono, fontSize: 10, color: colors.faint, marginTop: 3 },
  atime: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint },
});
