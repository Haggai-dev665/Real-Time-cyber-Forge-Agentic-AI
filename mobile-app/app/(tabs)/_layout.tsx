import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';

import { colors, fonts } from '../../src/theme';
import { Icon, IconName } from '../../src/components/Icon';
import { useAuth } from '../../src/context/AuthContext';
import { useTabBarHeight, MAX_CONTROL_FONT_SCALE } from '../../src/components/layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS: Array<{ name: string; title: string; icon: IconName }> = [
  { name: 'home', title: 'Home', icon: 'shield' },
  { name: 'alerts', title: 'Alerts', icon: 'bell' },
  { name: 'agent', title: 'Agent', icon: 'bot' },
  { name: 'globe', title: 'Globe', icon: 'globe' },
  { name: 'more', title: 'More', icon: 'grid' },
];

export default function TabsLayout() {
  const router = useRouter();
  const { ready, signedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const height = useTabBarHeight();

  // Guard: bounce to onboarding if not signed in.
  useEffect(() => {
    if (ready && !signedIn) router.replace('/');
  }, [ready, signedIn]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // the bar grows by the system's bottom inset (gesture bar or buttons), so it is never covered
        tabBarStyle: [styles.bar, { height, paddingBottom: Math.max(insets.bottom, 8) }],
        tabBarItemStyle: styles.item,
        tabBarBackground: () => (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        ),
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            tabBarButton: undefined,
            tabBarLabel: () => null,
            tabBarIcon: ({ focused }) => <TabIcon icon={t.icon} label={t.title} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}

function TabIcon({ icon, label, focused }: { icon: IconName; label: string; focused: boolean }) {
  const color = focused ? colors.amber2 : colors.faint;
  return (
    <View style={styles.tab}>
      <Icon name={icon} size={23} color={color} strokeWidth={focused ? 2 : 1.8} />
      <Text style={[styles.label, focused && styles.labelOn]} numberOfLines={1} maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}>
        {label}
      </Text>
      {focused ? <View style={styles.dot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: 'rgba(7,11,20,0.92)',
    paddingTop: 8,
    elevation: 0,
  },
  item: { flex: 1, minWidth: 0 },
  tab: { alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 52, maxWidth: 80, paddingHorizontal: 2 },
  label: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.faint },
  labelOn: { color: colors.amber2, fontFamily: fonts.sansSemiBold },
  dot: { position: 'absolute', bottom: -6, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.amber2 },
});
