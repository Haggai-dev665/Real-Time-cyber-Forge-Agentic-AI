/**
 * Settings — privacy choices, the account's data (export, deletion, account
 * deletion), account info from the auth session, and sign-out.
 *
 * Privacy choices are kept on this phone (src/context/PrivacyContext.tsx) and
 * checked by the code that collects or sends. Export and deletion call the
 * backend's /api/v1/me routes (SEC-07); account deletion asks for the account's
 * email address typed out, and shows the receipt it returns.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Share, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, fonts, tint } from '../theme';
import { Card, SecLabel, Toggle } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { usePrivacy, PRIVACY_FEATURES } from '../context/PrivacyContext';
import { useVpn } from '../context/VpnContext';
import { API_BASE_URL } from '../api/config';
import { endpoints } from '../api/endpoints';
import type { AccountDataScope, AccountDeletionReceipt } from '../api/types';

const PREFS: Array<[string, boolean]> = [
  ['Critical alerts', true],
  ['Browser vulnerabilities', true],
  ['Daily digest', false],
  ['Agent approvals', true],
];

const SCOPES: Array<{ scope: AccountDataScope; label: string; what: string }> = [
  { scope: 'memory', label: 'Synced memory', what: 'the memory your desktop synced' },
  { scope: 'scans', label: 'Scans and threats', what: 'scans, threats, sandbox results and policy responses' },
  { scope: 'agents', label: 'Agents', what: 'agents, their runs and proposals' },
  { scope: 'devices', label: 'Devices', what: 'enrolled devices, codes, device events and commands' },
  { scope: 'all', label: 'All synced data', what: 'all of the above, plus captures, alerts and browser reports' },
];

// Larger exports are too big to hand to the share sheet; the desktop saves them as a file.
const SHARE_LIMIT = 400 * 1024;

export function SettingsSection() {
  const router = useRouter();
  const { user, isGuest, logout } = useAuth();
  const privacy = usePrivacy();
  const { syncedCount } = useVpn();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(PREFS) as Record<string, boolean>
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [receipt, setReceipt] = useState<AccountDeletionReceipt | null>(null);

  const signedIn = !isGuest && Boolean(user);
  const emailMatches = Boolean(user?.email) && typed.trim().toLowerCase() === String(user?.email).toLowerCase();

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

  const toggle = (id: (typeof PRIVACY_FEATURES)[number]['id']) => void privacy.set({ [id]: !privacy.choices[id] });

  const exportData = async () => {
    setBusy('export');
    setMessage(null);
    try {
      const res = await endpoints.accountExport();
      const data = (res.data || {}) as { stores?: Record<string, { records?: unknown[] }> };
      const counts = Object.entries(data.stores || {})
        .map(([name, store]) => `${name.replace(/_/g, ' ')}: ${store.records?.length ?? 0}`)
        .join('\n');
      const text = JSON.stringify(res.data, null, 2);
      if (text.length > SHARE_LIMIT) {
        setMessage(`Export ready (${Math.round(text.length / 1024)} KB), too large to share from the phone. Use Settings › Privacy › Export on the desktop to save it as a file.\n\n${counts}`);
      } else {
        await Share.share({ title: 'CyberForge data export', message: text });
        setMessage(`Export shared.\n\n${counts}`);
      }
    } catch (e) {
      setMessage(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const deleteScope = (scope: AccountDataScope, label: string, what: string) => {
    Alert.alert(`Delete ${label.toLowerCase()}?`, `This removes ${what} from your account. Your account stays. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(scope);
          setMessage(null);
          try {
            const res = await endpoints.accountDataDelete(scope);
            const result = res.data;
            const removed = Object.values(result?.results || {}).reduce((n, r) => n + (r.removed || 0), 0);
            setMessage(
              result?.complete
                ? `${label}: ${removed} record${removed === 1 ? '' : 's'} deleted.`
                : `${label}: ${removed} deleted, but these could not be: ${(result?.failed || []).join(', ')}. Try again later.`
            );
          } catch (e) {
            setMessage(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const deleteAccount = async () => {
    if (!emailMatches) return;
    setBusy('account');
    setMessage(null);
    try {
      const res = await endpoints.accountDelete(typed.trim());
      const r = res.data || null;
      setReceipt(r);
      if (r?.state === 'completed') {
        setConfirming(false);
        setTyped('');
      }
    } catch (e) {
      setMessage(`Account deletion failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const finishDeletion = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <>
      <SecLabel>Privacy</SecLabel>
      {!privacy.decided ? (
        <Card style={styles.banner}>
          <Icon name="shield" size={16} color={colors.amber2} />
          <Text style={styles.bannerText}>
            Choose what CyberForge may collect and send from this phone. Everything below is off until you choose.
          </Text>
        </Card>
      ) : null}
      <Card style={{ marginTop: privacy.decided ? 0 : 10 }}>
        {PRIVACY_FEATURES.map((f, i) => (
          <View key={f.id} style={[styles.privRow, i > 0 && styles.border]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.privLabel}>{f.label}</Text>
              <Text style={styles.privDetail}>{f.detail}</Text>
            </View>
            <Toggle on={privacy.choices[f.id]} onToggle={() => toggle(f.id)} />
          </View>
        ))}
      </Card>
      <Text style={styles.note}>
        {privacy.decided
          ? `Chosen ${new Date(privacy.decidedAt as string).toLocaleString()} · consent version ${privacy.consentVersion} · kept on this phone`
          : `Not chosen yet · consent version ${privacy.consentVersion}`}
        {privacy.choices.capture_sync ? ` · ${syncedCount} captures sent this session` : ''}
      </Text>
      {privacy.log.length > 0 ? (
        <Card style={{ marginTop: 10 }}>
          {privacy.log.slice(0, 5).map((c, i) => (
            <KV
              key={`${c.at}-${c.feature}`}
              k={new Date(c.at).toLocaleString()}
              v={`${PRIVACY_FEATURES.find((f) => f.id === c.feature)?.label ?? c.feature}: ${c.on ? 'on' : 'off'}`}
              border={i > 0}
            />
          ))}
        </Card>
      ) : null}

      {signedIn ? (
        <>
          <SecLabel>Your data</SecLabel>
          <Card>
            <ActionRow
              icon="download"
              label="Export your data"
              hint="Everything kept about your account, as one JSON file"
              busy={busy === 'export'}
              onPress={() => void exportData()}
            />
            {SCOPES.map((s) => (
              <ActionRow
                key={s.scope}
                icon="trash"
                label={`Delete ${s.label.toLowerCase()}`}
                hint={s.what}
                danger
                border
                busy={busy === s.scope}
                onPress={() => deleteScope(s.scope, s.label, s.what)}
              />
            ))}
          </Card>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <SecLabel>Delete account</SecLabel>
          <Card style={styles.deleteCard}>
            {receipt ? (
              <>
                <Text style={styles.privLabel}>
                  {receipt.state === 'completed' ? 'Your account was deleted.' : 'Deletion is not finished.'}
                </Text>
                <Text style={styles.privDetail}>
                  {receipt.state === 'completed'
                    ? 'Receipt ' + receipt.deletionId + '. Keep it to check the deletion later.'
                    : `These could not be deleted: ${receipt.failed.join(', ')}. Your account is kept; ask again to finish.`}
                </Text>
                {receipt.kept.map((k) => (
                  <Text key={k} style={styles.kept}>• {k}</Text>
                ))}
                {receipt.state === 'completed' ? (
                  <Pressable accessibilityRole="button" style={styles.dangerBtn} onPress={() => void finishDeletion()}>
                    <Text style={styles.dangerText}>Done</Text>
                  </Pressable>
                ) : null}
              </>
            ) : !confirming ? (
              <>
                <Text style={styles.privDetail}>
                  Deletes your account and everything it holds: synced memory, scans, agents, devices, captures and
                  the sign-in. Audit events stay until their 90-day retention ends.
                </Text>
                <Pressable accessibilityRole="button" style={styles.dangerBtn} onPress={() => setConfirming(true)}>
                  <Text style={styles.dangerText}>Delete account…</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.privDetail}>Type your account's email address to confirm. This cannot be undone.</Text>
                <TextInput
                  value={typed}
                  onChangeText={setTyped}
                  placeholder={user?.email ?? 'email'}
                  placeholderTextColor={colors.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  style={styles.input}
                  accessibilityLabel="Account email address"
                />
                <View style={styles.confirmRow}>
                  <Pressable accessibilityRole="button" style={[styles.plainBtn]} onPress={() => { setConfirming(false); setTyped(''); }}>
                    <Text style={styles.plainText}>Cancel</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button"
                    style={[styles.dangerBtn, styles.flex, !emailMatches && styles.disabled]}
                    disabled={!emailMatches || busy === 'account'}
                    onPress={() => void deleteAccount()}
                  >
                    {busy === 'account' ? <ActivityIndicator color={colors.red} /> : <Text style={styles.dangerText}>Delete my account</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </Card>
        </>
      ) : null}

      <SecLabel>Notifications</SecLabel>
      <Card>
        {PREFS.map(([label], i) => (
          <View key={label} style={[styles.listRow, i > 0 && styles.border]}>
            <Text style={styles.label}>{label}</Text>
            <Toggle on={prefs[label]} onToggle={() => setPrefs((p) => ({ ...p, [label]: !p[label] }))} />
          </View>
        ))}
      </Card>
      <Text style={styles.note}>Notification preferences are not saved yet: they reset when the app restarts.</Text>

      <SecLabel>Account</SecLabel>
      <Card>
        <KV k="Signed in as" v={isGuest ? 'Guest' : user?.email ?? '—'} />
        <KV k="Role" v={isGuest ? 'public' : user?.role ?? 'user'} border />
        <KV k="Backend" v={API_BASE_URL.replace(/^https?:\/\//, '')} border />
        <KV k="App version" v="1.0.0" border />
      </Card>

      <Pressable accessibilityRole="button" style={styles.signOut} onPress={signOut}>
        <Icon name="lock" size={16} color={colors.red} />
        <Text style={styles.signOutText}>{isGuest ? 'Exit guest mode' : 'Sign out'}</Text>
      </Pressable>
    </>
  );
}

function ActionRow({
  icon, label, hint, onPress, busy, danger, border,
}: { icon: IconName; label: string; hint: string; onPress: () => void; busy?: boolean; danger?: boolean; border?: boolean }) {
  return (
    <Pressable style={[styles.privRow, border && styles.border]} onPress={onPress} disabled={busy} accessibilityRole="button">
      <View style={{ flex: 1 }}>
        <Text style={[styles.privLabel, danger && { color: colors.red }]}>{label}</Text>
        <Text style={styles.privDetail}>{hint}</Text>
      </View>
      {busy ? <ActivityIndicator color={colors.dim} /> : <Icon name={icon} size={16} color={danger ? colors.red : colors.dim} />}
    </Pressable>
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
  privRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  border: { borderTopWidth: 1, borderTopColor: colors.line },
  label: { fontFamily: fonts.sans, fontSize: 13, color: colors.dim, flexShrink: 1 },
  value: { fontFamily: fonts.mono, fontSize: 12, color: colors.text, flexShrink: 1, textAlign: 'right' },
  privLabel: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.text },
  privDetail: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.dim, marginTop: 3, lineHeight: 16 },
  note: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint, marginTop: 8, marginLeft: 4 },
  message: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.dim, marginTop: 10, marginLeft: 4, lineHeight: 15 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderColor: tint(colors.amber2, 0.4) },
  bannerText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.text, lineHeight: 17 },
  deleteCard: { padding: 14, gap: 10 },
  kept: { fontFamily: fonts.sans, fontSize: 11, color: colors.faint, lineHeight: 15 },
  input: {
    height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12,
    fontFamily: fonts.mono, fontSize: 13, color: colors.text, backgroundColor: colors.tile,
  },
  confirmRow: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  disabled: { opacity: 0.4 },
  dangerBtn: {
    height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(244,73,94,0.3)', backgroundColor: 'rgba(244,73,94,0.08)',
  },
  dangerText: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.red },
  plainBtn: { height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line },
  plainText: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.dim },
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
