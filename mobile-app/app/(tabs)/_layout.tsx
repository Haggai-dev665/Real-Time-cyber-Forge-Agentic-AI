import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';

import { colors, fonts } from '../../src/theme';
import { Icon, IconName } from '../../src/components/Icon';
import { useAuth } from '../../src/context/AuthContext';

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

  // Guard: bounce to onboarding if not signed in.
  useEffect(() => {
    if (ready && !signedIn) router.replace('/');
  }, [ready, signedIn]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
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
      <Text style={[styles.label, focused && styles.labelOn]}>{label}</Text>
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
    height: 78,
    paddingTop: 10,
    paddingBottom: 18,
  },
  tab: { alignItems: 'center', justifyContent: 'center', gap: 4, width: 64 },
  label: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.faint },
  labelOn: { color: colors.amber2, fontFamily: fonts.sansSemiBold },
  dot: { position: 'absolute', bottom: -8, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.amber2 },
});
