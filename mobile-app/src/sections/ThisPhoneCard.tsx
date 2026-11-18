/**
 * This phone as a device of the account: enroll it, compare its key
 * fingerprint and approve it (here or on the desktop), and see its heartbeats.
 * State and actions come from src/context/DeviceContext.tsx.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';

import { colors, fonts, tint } from '../theme';
import { Card, Pill } from '../components/ui';
import { Icon } from '../components/Icon';
import { usePhoneDevice, defaultPhoneName } from '../context/DeviceContext';
import { timeAgo } from '../utils/format';

const STATUS: Record<string, { label: string; color: string }> = {
  loading: { label: 'checking', color: colors.faint },
  unsupported: { label: 'not on this build', color: colors.faint },
  not_enrolled: { label: 'not enrolled', color: colors.faint },
  pending_approval: { label: 'awaiting approval', color: colors.amber2 },
  active: { label: 'enrolled', color: colors.green },
  revoked: { label: 'revoked', color: colors.red },
};

export function ThisPhoneCard() {
  const phone = usePhoneDevice();
  const [name, setName] = useState(defaultPhoneName());
  const s = STATUS[phone.status] ?? STATUS.loading;
  const id = phone.identity;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Icon name="phone" size={18} color={colors.cyan} />
        <Text style={styles.title}>This phone</Text>
        <Pill label={s.label} color={s.color} />
      </View>

      {phone.status === 'unsupported' ? (
        <Text style={styles.text}>The web build has no system keystore for a device key. Enroll from the Android or iOS app.</Text>
      ) : phone.status === 'not_enrolled' || phone.status === 'revoked' ? (
        <>
          <Text style={styles.text}>
            {phone.status === 'revoked'
              ? 'This phone was revoked. Enroll it again to show it on your desktop and receive its heartbeats; it keeps the same device record with a new key.'
              : 'Enroll this phone to list it with your computers: it gets its own key, appears on the desktop’s Devices page and reports when it was last seen.'}
          </Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            maxLength={80}
            placeholder="Name for this phone"
            placeholderTextColor={colors.faint}
            accessibilityLabel="Name for this phone"
          />
          <Button label={phone.status === 'revoked' ? 'Enroll again' : 'Enroll this phone'} busy={phone.busy} onPress={() => void phone.enroll(name)} />
        </>
      ) : phone.status === 'pending_approval' && id ? (
        <>
          <Text style={styles.text}>
            Approve this phone here, or on the desktop's Devices page. Check that the desktop shows the same key fingerprint:
          </Text>
          <Text style={styles.fingerprint} selectable>{id.fingerprint}</Text>
          <Button label="Approve this phone" busy={phone.busy} onPress={() => void phone.approveHere()} />
        </>
      ) : phone.status === 'active' && id ? (
        <>
          <KV k="Name" v={id.displayName} />
          <KV k="Key" v={id.fingerprint} />
          <KV
            k="Last heartbeat"
            v={id.lastHeartbeatAt ? `${timeAgo(id.lastHeartbeatAt)} ago` : 'not yet'}
          />
          {phone.record ? (
            <KV
              k="Desktop sees"
              v={`${phone.record.connection}${phone.record.coverage === 'degraded' ? ` · degraded (${phone.record.degradedBy.join(', ')})` : phone.record.coverage === 'full' ? ' · full coverage' : ''}`}
            />
          ) : null}
          <Text style={styles.small}>A signed heartbeat goes every two minutes while CyberForge is open.</Text>
          <Button label="Check in now" busy={phone.busy} onPress={() => void phone.checkIn()} secondary />
        </>
      ) : (
        <ActivityIndicator color={colors.amber2} />
      )}
      {phone.lastError ? <Text style={styles.error}>{phone.lastError}</Text> : null}
    </Card>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={styles.kvVal} numberOfLines={2} selectable>{v}</Text>
    </View>
  );
}

function Button({ label, onPress, busy, secondary }: { label: string; onPress: () => void; busy?: boolean; secondary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={busy}
      style={[styles.btn, secondary && styles.btnSecondary, busy && { opacity: 0.6 }]}
    >
      {busy ? <ActivityIndicator size="small" color={secondary ? colors.text : '#1a1206'} /> : null}
      <Text style={[styles.btnText, secondary && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginTop: 10, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
  text: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.dim, lineHeight: 18 },
  small: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.faint, lineHeight: 16 },
  input: {
    height: 46, paddingHorizontal: 14, backgroundColor: colors.tile, borderWidth: 1, borderColor: colors.line2,
    borderRadius: 13, color: colors.text, fontFamily: fonts.sans, fontSize: 13.5,
  },
  fingerprint: {
    fontFamily: fonts.monoSemiBold, fontSize: 14, color: colors.amber2, letterSpacing: 1, textAlign: 'center',
    paddingVertical: 10, borderRadius: 12, backgroundColor: tint(colors.amber2, 0.08),
  },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  kvKey: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.dim },
  kvVal: { flexShrink: 1, fontFamily: fonts.mono, fontSize: 11.5, color: colors.text, textAlign: 'right' },
  btn: {
    minHeight: 46, borderRadius: 13, backgroundColor: colors.amber2, flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14,
  },
  btnSecondary: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line2 },
  btnText: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: '#1a1206' },
  error: { fontFamily: fonts.sans, fontSize: 12, color: colors.red },
});
