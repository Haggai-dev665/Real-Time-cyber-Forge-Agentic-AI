/** Explore — entry point to every CyberForge sub-screen. */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, fonts, tint } from '../../src/theme';
import { Screen } from '../../src/components/Screen';
import { Card, SecLabel, TopBar } from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import { SECTIONS, FEATURED, REST } from '../../src/data/sections';

export default function More() {
  const router = useRouter();
  const go = (key: string) => {
    // The VPN capture engine has its own full-screen route + provider.
    if (key === 'vpn') return router.push('/capture');
    router.push({ pathname: '/screen/[key]', params: { key } });
  };

  return (
    <Screen>
      <TopBar title="Explore" sub="every CyberForge screen" />

      <SecLabel style={{ marginLeft: 22 }}>Featured</SecLabel>
      <View style={styles.grid}>
        {FEATURED.map((k) => {
          const m = SECTIONS[k];
          return (
            <Pressable key={k} style={styles.tile} onPress={() => go(k)}>
              <View style={[styles.tileIcon, { backgroundColor: tint(m.color, 0.13) }]}>
                <Icon name={m.icon} size={19} color={m.color} />
              </View>
              <View>
                <Text style={styles.tileTitle}>{m.title}</Text>
                <Text style={styles.tileSub}>{m.sub}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <SecLabel style={{ marginLeft: 22 }}>All screens</SecLabel>
      <Card style={styles.list}>
        {REST.map((k, i) => {
          const m = SECTIONS[k];
          return (
            <Pressable key={k} style={[styles.row, i > 0 && styles.rowBorder]} onPress={() => go(k)}>
              <View style={[styles.rowIcon, { borderColor: colors.line2 }]}>
                <Icon name={m.icon} size={16} color={m.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{m.title}</Text>
                <Text style={styles.rowSub}>{m.sub}</Text>
              </View>
              <Icon name="chevR" size={16} color={colors.faint} />
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, paddingHorizontal: 18 },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 16,
    gap: 11,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line2 },
  tileTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.text },
  tileSub: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint, marginTop: 2 },
  list: { marginHorizontal: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rowIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tile, borderWidth: 1 },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.text },
  rowSub: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint, marginTop: 2 },
});
