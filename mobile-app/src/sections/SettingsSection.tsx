/**
 * Settings — real account info from the auth session plus local notification
 * preferences and sign-out. Preferences are device-local (clearly the case),
 * since the public API exposes no preferences endpoint.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, fonts } from '../theme';
import { Card, SecLabel, Toggle } from '../components/ui';
import { Icon } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api/config';

const PREFS: Array<[string, boolean]> = [
  ['Critical alerts', true],
  ['Browser vulnerabilities', true],
  ['Daily digest', false],
  ['Agent approvals', true],
];

export function SettingsSection() {
  const router = useRouter();
  const { user, isGuest, logout } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(PREFS) as Record<string, boolean>
  );

  const signOut = () => {
    Alert.alert('Sign out', 'End this session on the device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <>
      <SecLabel>Notifications</SecLabel>
      <Card>
        {PREFS.map(([label], i) => (
          <View key={label} style={[styles.listRow, i > 0 && styles.border]}>
            <Text style={styles.label}>{label}</Text>
            <Toggle on={prefs[label]} onToggle={() => setPrefs((p) => ({ ...p, [label]: !p[label] }))} />
          </View>
        ))}
      </Card>
      <Text style={styles.note}>Notification preferences are stored on this device.</Text>

      <SecLabel>Account</SecLabel>
      <Card>
        <KV k="Signed in as" v={isGuest ? 'Guest' : user?.email ?? '—'} />
        <KV k="Role" v={isGuest ? 'public' : user?.role ?? 'user'} border />
        <KV k="Backend" v={API_BASE_URL.replace(/^https?:\/\//, '')} border />
        <KV k="App version" v="1.0.0" border />
      </Card>

      <Pressable style={styles.signOut} onPress={signOut}>
        <Icon name="lock" size={16} color={colors.red} />
        <Text style={styles.signOutText}>{isGuest ? 'Exit guest mode' : 'Sign out'}</Text>
      </Pressable>
    </>
  );
}

function KV({ k, v, border }: { k: string; v: string; border?: boolean }) {
  return (
    <View style={[styles.listRow, border && styles.border]}>
      <Text style={styles.label}>{k}</Text>
      <Text style={styles.value} numberOfLines={1}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  border: { borderTopWidth: 1, borderTopColor: colors.line },
  label: { fontFamily: fonts.sans, fontSize: 13, color: colors.dim, flexShrink: 1 },
  value: { fontFamily: fonts.mono, fontSize: 12, color: colors.text, flexShrink: 1, textAlign: 'right' },
  note: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint, marginTop: 8, marginLeft: 4 },
  signOut: {
    marginTop: 22,
    height: 50,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: 'rgba(244,73,94,0.3)',
    backgroundColor: 'rgba(244,73,94,0.08)',
  },
  signOutText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.red },
});
