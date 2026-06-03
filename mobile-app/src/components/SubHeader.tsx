/** Top bar with a back button — used by Explore sub-screens. */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';
import { LiveDot } from './LiveDot';

export function SubHeader({ title, sub, live }: { title: string; sub?: string; live?: boolean }) {
  const router = useRouter();
  return (
    <View style={styles.bar}>
      <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
        <Icon name="chevL" size={18} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {sub ? (
          <View style={styles.subRow}>
            {live ? <LiveDot color={colors.cyan} /> : null}
            <Text style={styles.sub}>{sub}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  back: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.sansBold, fontSize: 24, color: colors.text, letterSpacing: -0.5 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  sub: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.dim },
});
