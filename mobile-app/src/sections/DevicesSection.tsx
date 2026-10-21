/**
 * Devices — this phone's connection to the backend, and the workspace's
 * enrolled devices (DEV-01/02). The phone is the approving companion: it lists
 * the devices the backend has, shows a one-time code for adding a computer,
 * approves a device that claimed a code once the user has compared its key
 * fingerprint on both screens, and revokes. Nothing here is invented: the list
 * is what /api/v1/devices returns, with the connection state the server works
 * out from its own clock.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Platform } from 'react-native';

import { colors, fonts, tint } from '../theme';
import { Card, SecLabel, Pill, Loading } from '../components/ui';
import { Icon } from '../components/Icon';
import { LiveDot } from '../components/LiveDot';
import { useLiveFeed } from '../context/LiveFeedContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api/config';
import { endpoints } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import type { DeviceCommand, DeviceEnrollmentCode, DeviceRecord } from '../api/types';

const CONNECTION_COLOR: Record<string, string> = {
  online: colors.green,
  stale: colors.amber2,
  never_connected: colors.amber2,
  awaiting_approval: colors.amber2,
  offline: colors.red,
  revoked: colors.red,
  not_applicable: colors.faint,
};

export function DevicesSection() {
  const { connected } = useLiveFeed();
  const { isGuest, user } = useAuth();

  return (
    <>
      <Card style={styles.bridgeCard}>
        <View style={styles.bridge}>
          <Node icon="phone" color={colors.cyan} />
          <Connector active={connected} />
          <Node icon="globe" color={connected ? colors.amber2 : colors.faint} pulse={connected} />
          <Connector active={connected} />
          <Node icon="desktop" color={connected ? colors.green : colors.faint} />
        </View>
        <Text style={styles.bridgeText}>
          Phone ↔ Secure relay ↔ Backend ·{' '}
          <Text style={{ color: connected ? colors.green : colors.faint }}>
            {connected ? 'live bridge' : 'offline'}
          </Text>
        </Text>
      </Card>

      <SecLabel>This device</SecLabel>
      <Card style={{ overflow: 'hidden' }}>
        <Row icon="phone" title={`${Platform.OS === 'ios' ? 'iPhone' : 'Android device'}`} sub="this device" color={colors.cyan} online />
        <Row
          icon="desktop"
          title="CyberForge backend"
          sub={API_BASE_URL.replace(/^https?:\/\//, '')}
          color={connected ? colors.green : colors.faint}
          online={connected}
          border
        />
        <Row
          icon="lock"
          title={isGuest ? 'Guest session' : 'Authenticated session'}
          sub={isGuest ? 'public access' : user?.email ?? 'signed in'}
          color={colors.amber2}
          online
          border
        />
      </Card>

      {isGuest ? null : <WorkspaceDevices />}
    </>
  );
}

function WorkspaceDevices() {
  const { data, loading, error, refresh } = useApi(() => endpoints.devices(), []);
  const [code, setCode] = useState<DeviceEnrollmentCode | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const devices: DeviceRecord[] = data?.data?.devices ?? [];

  const act = async (work: () => Promise<unknown>) => {
    setProblem(null);
    try {
      await work();
      await refresh();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'The request failed');
    }
  };

  return (
    <>
      <SecLabel>Devices in your workspace</SecLabel>
      <Card style={{ padding: 13 }}>
        <Text style={styles.note}>
          To add a computer, show a code here and enter it in CyberForge on that computer. The code works once and expires
          after 10 minutes. The computer then waits until you approve it below.
        </Text>
        <Button label="Show a code" onPress={() => act(async () => setCode((await endpoints.deviceEnrollmentCreate()).data ?? null))} />
        {code ? (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.code}>{code.code}</Text>
            <Text style={styles.rowSub}>expires {new Date(code.expiresAt).toLocaleTimeString()}</Text>
          </View>
        ) : null}
        {problem ? <Text style={styles.error}>{problem}</Text> : null}
      </Card>

      <Card style={{ overflow: 'hidden', marginTop: 10 }}>
        {loading && !data ? <Loading label="Loading devices…" /> : null}
        {error ? <Text style={[styles.error, { padding: 13 }]}>{error}</Text> : null}
        {!loading && !error && devices.length === 0 ? (
          <Text style={[styles.note, { padding: 13 }]}>No devices yet. Enroll a computer from its Devices page.</Text>
        ) : null}
        {devices.map((device, index) => (
          <DeviceRow key={device.deviceId} device={device} border={index > 0} act={act} />
        ))}
      </Card>
    </>
  );
}

function DeviceRow({ device, border, act }: { device: DeviceRecord; border: boolean; act: (work: () => Promise<unknown>) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const color = CONNECTION_COLOR[device.connection] ?? colors.faint;
  const lastSeen = device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : 'never';

  return (
    <View style={[styles.device, border && styles.rowBorder]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>{device.displayName}</Text>
        <Pill label={device.connection.replace(/_/g, ' ')} color={color} />
      </View>
      <Text style={styles.rowSub}>
        {device.platform} · {device.kind.replace(/_/g, ' ')} · last seen {lastSeen}
      </Text>
      {device.coverage === 'degraded' ? (
        <Text style={[styles.rowSub, { color: colors.amber2 }]}>degraded: {device.degradedBy.join(', ')}</Text>
      ) : null}
      {device.keyFingerprint ? <Text style={styles.fingerprint}>{device.keyFingerprint}</Text> : null}

      {device.state === 'pending_approval' ? (
        confirming ? (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.note}>
              Check that the computer shows exactly this fingerprint before approving. If it differs, do not approve.
            </Text>
            <View style={styles.buttons}>
              <Button label="It matches — approve" tone="go" onPress={() => act(() => endpoints.deviceApprove(device.deviceId, device.keyFingerprint ?? ''))} />
              <Button label="Cancel" onPress={() => setConfirming(false)} />
            </View>
          </View>
        ) : (
          <View style={styles.buttons}>
            <Button label="Approve…" tone="go" onPress={() => setConfirming(true)} />
          </View>
        )
      ) : null}

      {device.state === 'active' && device.capabilities.advertised.includes('hosts_blocking') ? (
        <Commands device={device} act={act} />
      ) : null}

      {device.state === 'active' || device.state === 'pending_approval' ? (
        <View style={styles.buttons}>
          {revoking ? (
            <>
              <Button label="Confirm revoke" tone="warn" onPress={() => act(() => endpoints.deviceRevoke(device.deviceId))} />
              <Button label="Cancel" onPress={() => setRevoking(false)} />
            </>
          ) : (
            <Button label="Revoke" tone="warn" onPress={() => setRevoking(true)} />
          )}
        </View>
      ) : null}
    </View>
  );
}

/** Send one exact action to the device, and show what its receipts said. */
function Commands({ device, act }: { device: DeviceRecord; act: (work: () => Promise<unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [recent, setRecent] = useState<DeviceCommand[] | null>(null);
  const load = async () => setRecent((await endpoints.deviceCommands(device.deviceId)).data?.commands ?? []);
  const send = (type: DeviceCommand['type']) =>
    act(async () => {
      const key = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      await endpoints.deviceCommandSend(device.deviceId, type, domain.trim().toLowerCase(), key);
      await load();
    });

  if (!open) {
    return (
      <View style={styles.buttons}>
        <Button label="Block or unblock a domain…" onPress={() => { setOpen(true); act(load); }} />
      </View>
    );
  }
  return (
    <View style={{ marginTop: 8 }}>
      <TextInput
        value={domain}
        onChangeText={setDomain}
        placeholder="example.com"
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <View style={styles.buttons}>
        <Button label="Block" tone="warn" onPress={() => send('block_domain')} />
        <Button label="Unblock" onPress={() => send('unblock_domain')} />
        <Button label="Close" onPress={() => setOpen(false)} />
      </View>
      <Text style={styles.note}>It shows as applied only when {device.displayName} reports that it carried it out.</Text>
      {(recent ?? []).map((c) => (
        <Text key={c.commandId} style={styles.rowSub}>
          {c.type === 'block_domain' ? 'Block' : 'Unblock'} {c.domain} · {c.state}
          {c.receipt?.detail ? ` · ${c.receipt.detail}` : ''}
        </Text>
      ))}
    </View>
  );
}

function Button({ label, onPress, tone }: { label: string; onPress: () => void; tone?: 'go' | 'warn' }) {
  const color = tone === 'go' ? colors.green : tone === 'warn' ? colors.red : colors.dim;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, { borderColor: tint(color, 0.45) }]}>
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function Node({ icon, color, pulse }: { icon: 'phone' | 'globe' | 'desktop'; color: string; pulse?: boolean }) {
  return (
    <View style={[styles.node, { borderColor: color, backgroundColor: tint(color, 0.13) }]}>
      {pulse ? <LiveDot color={color} size={10} /> : null}
      <Icon name={icon} size={22} color={color} />
    </View>
  );
}

function Connector({ active }: { active: boolean }) {
  return <View style={[styles.connector, active && { backgroundColor: tint(colors.cyan, 0.6) }]} />;
}

function Row({
  icon,
  title,
  sub,
  color,
  online,
  border,
}: {
  icon: 'phone' | 'desktop' | 'lock';
  title: string;
  sub: string;
  color: string;
  online?: boolean;
  border?: boolean;
}) {
  return (
    <View style={[styles.row, border && styles.rowBorder]}>
      <View style={[styles.rowIcon, { borderColor: color }]}>
        <Icon name={icon} size={15} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>
      </View>
      {online ? <LiveDot color={color} /> : <Text style={styles.offline}>offline</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  bridgeCard: { padding: 16, alignItems: 'center' },
  bridge: { flexDirection: 'row', alignItems: 'center' },
  node: { width: 54, height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  connector: { width: 26, height: 2, backgroundColor: colors.line, marginHorizontal: 2 },
  bridgeText: { fontFamily: fonts.mono, fontSize: 10, color: colors.dim, marginTop: 12, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rowIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tile, borderWidth: 1 },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.text },
  rowSub: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.faint, marginTop: 2 },
  offline: { fontFamily: fonts.mono, fontSize: 9, color: colors.faint },
  device: { padding: 13 },
  note: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.dim, lineHeight: 17, marginBottom: 8 },
  error: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.red, marginTop: 6 },
  code: { fontFamily: fonts.mono, fontSize: 22, letterSpacing: 2, color: colors.amber2 },
  fingerprint: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.cyan, marginTop: 4 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  button: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.tile },
  buttonText: { fontFamily: fonts.mono, fontSize: 10.5 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, color: colors.text, fontFamily: fonts.mono, fontSize: 12, backgroundColor: colors.tile },
});
