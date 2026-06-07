/**
 * Sign-in / register screen. Talks to /api/auth/login and /api/auth/register.
 * Offers a guest path that relies on the backend's public endpoints so the app
 * is explorable without an account.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, tint } from '../src/theme';
import { Icon } from '../src/components/Icon';
import { BrandMark } from '../src/components/BrandMark';
import { useAuth } from '../src/context/AuthContext';

type Mode = 'login' | 'register';

export default function Login() {
  const router = useRouter();
  const { login, register, continueAsGuest } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register({ email: email.trim(), password, firstName: firstName.trim(), lastName: lastName.trim() });
      }
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const guest = async () => {
    await continueAsGuest();
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={styles.root}>
      <LinearGradient colors={['#0c1726', colors.bg]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <BrandMark size={44} />
            <Text style={styles.brand}>
              Cyber<Text style={{ color: colors.orange }}>Forge</Text>
            </Text>
            <Text style={styles.tagline}>
              {mode === 'login' ? 'Welcome back. Sign in to your agent.' : 'Create your CyberForge account.'}
            </Text>
          </View>

          {/* mode switch */}
          <View style={styles.segment}>
            {(['login', 'register'] as Mode[]).map((m) => (
              <Pressable key={m} style={[styles.segItem, mode === m && styles.segItemOn]} onPress={() => { setMode(m); setError(''); }}>
                <Text style={[styles.segText, mode === m && styles.segTextOn]}>
                  {m === 'login' ? 'Sign in' : 'Register'}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'register' && (
            <View style={styles.row}>
              <Field style={{ flex: 1 }} icon="bot" placeholder="First name" value={firstName} onChangeText={setFirstName} />
              <Field style={{ flex: 1 }} icon="bot" placeholder="Last name" value={lastName} onChangeText={setLastName} />
            </View>
          )}

          <Field
            icon="globe"
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Field
            icon="lock"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            trailing={
              <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={10}>
                <Icon name={showPw ? 'eyeoff' : 'eye'} size={18} color={colors.faint} />
              </Pressable>
            }
          />

          {error ? (
            <View style={styles.errorBox}>
              <Icon name="alert" size={15} color={colors.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable onPress={submit} disabled={busy}>
            <LinearGradient colors={[colors.orange, '#d97f25']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.primaryBtn}>
              {busy ? (
                <ActivityIndicator color="#1a1206" />
              ) : (
                <>
                  <Icon name="shield" size={16} color="#1a1206" />
                  <Text style={styles.primaryText}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <Pressable style={styles.ghostBtn} onPress={guest}>
            <Icon name="eye" size={16} color={colors.text} />
            <Text style={styles.ghostText}>Continue as guest</Text>
          </Pressable>
          <Text style={styles.guestHint}>
            Guest mode shows live public intelligence (threat feeds, agent activity) without an account.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  icon,
  trailing,
  style,
  ...props
}: {
  icon: 'globe' | 'lock' | 'bot';
  trailing?: React.ReactNode;
  style?: object;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={[styles.field, style]}>
      <Icon name={icon} size={17} color={colors.faint} />
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.faint}
        {...props}
      />
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 26, gap: 10 },
  brand: { fontFamily: fonts.sansBold, fontSize: 26, color: colors.text },
  tagline: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.dim, textAlign: 'center' },
  segment: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 13, padding: 4, borderWidth: 1, borderColor: colors.line, marginBottom: 18 },
  segItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  segItemOn: { backgroundColor: colors.amberDim },
  segText: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.dim },
  segTextOn: { color: colors.amber2, fontFamily: fonts.sansSemiBold },
  row: { flexDirection: 'row', gap: 10 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 52,
    backgroundColor: colors.tile,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: 13,
    marginBottom: 12,
  },
  input: { flex: 1, color: colors.text, fontFamily: fonts.sans, fontSize: 14.5 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: tint(colors.red, 0.1),
    borderWidth: 1,
    borderColor: tint(colors.red, 0.3),
    marginBottom: 12,
  },
  errorText: { flex: 1, fontFamily: fonts.sans, fontSize: 12.5, color: colors.red },
  primaryBtn: { height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 4 },
  primaryText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: '#1a1206' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontFamily: fonts.mono, fontSize: 11, color: colors.faint },
  ghostBtn: {
    height: 50,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface2,
  },
  ghostText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
  guestHint: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint, textAlign: 'center', marginTop: 12, lineHeight: 15 },
});
