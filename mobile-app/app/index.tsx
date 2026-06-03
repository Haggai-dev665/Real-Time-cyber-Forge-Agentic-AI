/**
 * Onboarding / connect screen — the design's "device pairing" flow, adapted to a
 * real backend handshake. "Connect" pings the backend /health endpoint; on
 * success it advances to the sign-in screen. Already-authenticated users are
 * redirected straight to the dashboard.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, tint } from '../src/theme';
import { Icon, IconName } from '../src/components/Icon';
import { BrandMark } from '../src/components/BrandMark';
import { LiveDot } from '../src/components/LiveDot';
import { useAuth } from '../src/context/AuthContext';
import { endpoints } from '../src/api/endpoints';

type Step = 'intro' | 'checking' | 'connected' | 'error';

export default function Connect() {
  const router = useRouter();
  const { ready, signedIn } = useAuth();
  const [step, setStep] = useState<Step>('intro');
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (ready && signedIn) router.replace('/(tabs)/home');
  }, [ready, signedIn]);

  const check = async () => {
    setStep('checking');
    try {
      await endpoints.health();
      setStep('connected');
      setTimeout(() => router.replace('/login'), 1400);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Could not reach CyberForge');
      setStep('error');
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <LinearGradient colors={['#0c1726', colors.bg]} style={StyleSheet.absoluteFill} />

      {/* header */}
      <View style={styles.header}>
        <BrandMark size={32} />
        <View>
          <Text style={styles.brand}>
            Cyber<Text style={{ color: colors.orange }}>Forge</Text>
          </Text>
          <Text style={styles.brandSub}>DEVICE PAIRING</Text>
        </View>
      </View>

      <Diagram active={step === 'checking'} paired={step === 'connected'} />

      {step === 'intro' && <Intro onCheck={check} />}
      {step === 'checking' && <Checking />}
      {step === 'connected' && <Connected />}
      {step === 'error' && <ErrorState message={errMsg} onRetry={check} />}
    </SafeAreaView>
  );
}

/* ---------------- pairing diagram ---------------- */
function Diagram({ active, paired }: { active: boolean; paired: boolean }) {
  return (
    <View style={styles.diagram}>
      <DNode icon="phone" label="This phone" color={colors.cyan} on />
      <DLink on={active || paired} />
      <DNode icon="globe" label="Secure relay" color={colors.amber2} on={active || paired} pulse={active} />
      <DLink on={paired} />
      <DNode icon="desktop" label="Backend" color={paired ? colors.green : colors.faint} on={paired} />
    </View>
  );
}

function DNode({
  icon,
  label,
  color,
  on,
  pulse,
}: {
  icon: IconName;
  label: string;
  color: string;
  on?: boolean;
  pulse?: boolean;
}) {
  return (
    <View style={styles.dnode}>
      <View
        style={[
          styles.dnodeIc,
          on && { borderColor: color, backgroundColor: tint(color, 0.13) },
        ]}
      >
        {pulse ? <LiveDot color={color} size={10} /> : null}
        <Icon name={icon} size={24} color={on ? color : colors.faint} />
      </View>
      <Text style={[styles.dnodeLab, on && { color: colors.dim }]}>{label}</Text>
    </View>
  );
}

function DLink({ on }: { on: boolean }) {
  return <View style={[styles.dlink, on && { backgroundColor: tint(colors.amber2, 0.5) }]} />;
}

/* ---------------- step bodies ---------------- */
function Intro({ onCheck }: { onCheck: () => void }) {
  return (
    <View style={styles.body}>
      <Text style={styles.kick}>STEP 1 · CONNECT</Text>
      <Text style={styles.h1}>
        Sync with your{' '}
        <Text style={{ color: colors.orange }}>CyberForge</Text> agent
      </Text>
      <Text style={styles.p}>
        CyberForge mobile mirrors your security agent in real time over an encrypted
        connection. We'll verify the link to the backend, then sign you in.
      </Text>

      <View style={styles.infoCard}>
        <View style={[styles.infoIcon, { backgroundColor: colors.cyanDim }]}>
          <Icon name="lock" size={17} color={colors.cyan} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>End-to-end encrypted</Text>
          <Text style={styles.infoSub}>Your data stays on your devices</Text>
        </View>
      </View>

      <View style={{ flex: 1 }} />
      <BigButton icon="eye" label="Check connection" onPress={onCheck} />
    </View>
  );
}

function Checking() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.cyan} />
      <Text style={[styles.kick, { color: colors.cyan, marginTop: 18 }]}>CONNECTING</Text>
      <Text style={styles.h2}>Reaching CyberForge…</Text>
      <Text style={styles.pc}>Verifying the secure link to the backend.</Text>
    </View>
  );
}

function Connected() {
  return (
    <View style={styles.center}>
      <View style={styles.successCore}>
        <Icon name="check" size={44} color={colors.green} strokeWidth={3} />
      </View>
      <Text style={[styles.kick, { color: colors.green, marginTop: 22 }]}>CONNECTED</Text>
      <Text style={styles.h2}>Link established</Text>
      <Text style={styles.pc}>The backend is reachable. Taking you to sign in…</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <LiveDot color={colors.green} />
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.green }}>online</Text>
      </View>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.body}>
      <View style={styles.center}>
        <View style={[styles.glyphBox, { backgroundColor: tint(colors.red, 0.12) }]}>
          <Icon name="alert" size={40} color={colors.red} />
        </View>
        <Text style={[styles.kick, { color: colors.red, marginTop: 22 }]}>UNREACHABLE</Text>
        <Text style={styles.h2}>Can't reach CyberForge</Text>
        <Text style={styles.pc}>{message}</Text>
      </View>
      <View style={{ flex: 1 }} />
      <BigButton icon="refresh" label="Try again" onPress={onRetry} />
    </View>
  );
}

/* ---------------- primitives ---------------- */
function BigButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPressIn={() => Animated.timing(scale, { toValue: 0.96, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()}
      onPressOut={() => Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start()}
      onPress={onPress}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient colors={[colors.orange, '#d97f25']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.bigBtn}>
          <Icon name={icon} size={16} color="#1a1206" />
          <Text style={styles.bigBtnText}>{label}</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 22, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 24, marginBottom: 8 },
  brand: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.text },
  brandSub: { fontFamily: fonts.mono, fontSize: 9, color: colors.faint, letterSpacing: 0.5 },
  diagram: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 24 },
  dnode: { alignItems: 'center', gap: 8, width: 84 },
  dnodeIc: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.tile,
  },
  dnodeLab: { fontFamily: fonts.mono, fontSize: 9, textAlign: 'center', color: colors.faint },
  dlink: { flex: 1, height: 2, backgroundColor: colors.line, marginBottom: 22, marginHorizontal: -2 },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kick: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, color: colors.amber2 },
  h1: { fontFamily: fonts.sansSemiBold, fontSize: 27, color: colors.text, marginVertical: 10, lineHeight: 32 },
  h2: { fontFamily: fonts.sansSemiBold, fontSize: 23, color: colors.text, marginVertical: 8, textAlign: 'center' },
  p: { fontFamily: fonts.sans, color: colors.dim, fontSize: 14, lineHeight: 22 },
  pc: { fontFamily: fonts.sans, color: colors.dim, fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 280 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  infoIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line2 },
  infoTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.text },
  infoSub: { fontFamily: fonts.mono, fontSize: 10, color: colors.faint, marginTop: 2 },
  glyphBox: { width: 96, height: 96, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line2 },
  successCore: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: tint(colors.green, 0.1),
    borderWidth: 2,
    borderColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigBtn: { height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  bigBtnText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: '#1a1206' },
});
