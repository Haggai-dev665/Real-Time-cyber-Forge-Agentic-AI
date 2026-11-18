/**
 * This phone as an enrolled device (DEV-01/02/04): its installation ID, its
 * own Ed25519 key, the device record it claimed, and the sequence number of
 * its signed requests.
 *
 * The key is made on the phone and kept in the system keystore
 * (expo-secure-store); only the public half leaves the phone. The installation
 * ID is kept across accounts and enrollments, so enrolling again updates the
 * same device record instead of adding a duplicate. The identity remembers the
 * account that enrolled it and is not used for another account.
 */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { endpoints } from '../api/endpoints';
import { newKeys, claimBody, signedHeaders, keyFingerprint, type DeviceKeys, type Sha256Hex } from './protocol';
import type { DeviceRecord } from '../api/types';

const INSTALLATION_KEY = 'cf_installation_id';
const IDENTITY_KEY = 'cf_device_identity_v1';
export const CLIENT_VERSION = '1.1.0';

export interface PhoneIdentity {
  ownerUserId: string;
  installationId: string;
  keys: DeviceKeys;
  deviceId: string;
  fingerprint: string;
  displayName: string;
  state: DeviceRecord['state'];
  /** The last sequence number used; the next request uses a higher one. */
  seq: number;
  enrolledAt: string;
  lastHeartbeatAt: string | null;
}

export const sha256Hex: Sha256Hex = async (bytes) => {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const secure = Platform.OS !== 'web';

async function getSecure(key: string): Promise<string | null> {
  if (!secure) return null; // no keystore on the web: the web build does not enroll
  return SecureStore.getItemAsync(key);
}

async function setSecure(key: string, value: string): Promise<void> {
  if (!secure) throw new Error('This build cannot keep a device key: enroll from the Android or iOS app.');
  await SecureStore.setItemAsync(key, value);
}

export const canEnroll = secure;

export const platformName = (): string => (Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other');

async function installationId(): Promise<string> {
  const existing = await getSecure(INSTALLATION_KEY);
  if (existing) return existing;
  const id = `m-${Crypto.randomUUID().replace(/-/g, '')}`.slice(0, 40);
  await setSecure(INSTALLATION_KEY, id);
  return id;
}

export async function loadIdentity(): Promise<PhoneIdentity | null> {
  try {
    const raw = await getSecure(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as PhoneIdentity) : null;
  } catch {
    return null;
  }
}

export async function saveIdentity(identity: PhoneIdentity): Promise<void> {
  await setSecure(IDENTITY_KEY, JSON.stringify(identity));
}

export async function forgetIdentity(): Promise<void> {
  if (secure) await SecureStore.deleteItemAsync(IDENTITY_KEY);
}

/**
 * Enroll this phone into the signed-in account: a one-time code for this
 * device, claimed with a key made here. The device is then awaiting approval.
 */
export async function enrollThisPhone(ownerUserId: string, displayName: string, capabilities: string[]): Promise<PhoneIdentity> {
  const platform = platformName();
  const code = (await endpoints.deviceEnrollmentCreate('this_device', platform)).data?.code;
  if (!code) throw new Error('The backend did not return an enrollment code.');
  const keys = newKeys(Crypto.getRandomBytes(32));
  const install = await installationId();
  const claimed = await endpoints.deviceClaim(
    claimBody(keys, code, install, { platform, displayName, capabilities, clientVersion: CLIENT_VERSION }),
  );
  const record = claimed.data;
  if (!record?.deviceId) throw new Error('The backend did not return the device record.');
  const identity: PhoneIdentity = {
    ownerUserId,
    installationId: install,
    keys,
    deviceId: record.deviceId,
    fingerprint: await keyFingerprint(keys.publicKey, sha256Hex),
    displayName,
    state: record.state,
    seq: 0,
    enrolledAt: new Date().toISOString(),
    lastHeartbeatAt: null,
  };
  await saveIdentity(identity);
  return identity;
}

/**
 * One signed heartbeat with what this phone's own checks confirm. The sequence
 * number is saved before the request goes out, so it is never reused even if
 * the app stops mid-request.
 */
export async function sendHeartbeat(identity: PhoneIdentity, capabilities: Record<string, 'ok' | 'denied' | 'unavailable'>) {
  const next = { ...identity, seq: identity.seq + 1 };
  await saveIdentity(next);
  const body = JSON.stringify({ clientVersion: CLIENT_VERSION, capabilities });
  const path = `/api/v1/devices/${encodeURIComponent(identity.deviceId)}/heartbeat`;
  const headers = await signedHeaders(
    identity.keys,
    { method: 'POST', path, deviceId: identity.deviceId, timestamp: Date.now(), seq: next.seq, body },
    sha256Hex,
  );
  const res = await endpoints.deviceHeartbeat(identity.deviceId, body, headers);
  const updated: PhoneIdentity = { ...next, state: res.data?.device?.state ?? 'active', lastHeartbeatAt: new Date().toISOString() };
  await saveIdentity(updated);
  return { identity: updated, device: res.data?.device ?? null };
}
