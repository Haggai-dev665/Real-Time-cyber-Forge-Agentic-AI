/**
 * This phone as a device of the signed-in account (DEV-01/02/04/05).
 *
 * - Enroll: a one-time code for this phone, claimed with a key made here.
 * - Approve: the user compares the key fingerprint and approves, on this phone
 *   or on the desktop's Devices page.
 * - Heartbeats: signed with the phone's key every two minutes while the app is
 *   open (and on returning to it), reporting what the phone's own checks
 *   confirm. The desktop then shows the phone as online, stale or offline,
 *   with its coverage, from the server's clock.
 * - Revocation: a revoked phone stops sending and says so; enrolling again
 *   updates the same device record (same installation) with a new key.
 *
 * The identity belongs to the account that enrolled it; for another account
 * the phone is "not enrolled" until it is enrolled there too.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from './AuthContext';
import { usePrivacy } from './PrivacyContext';
import { useLiveFeed } from './LiveFeedContext';
import { endpoints } from '../api/endpoints';
import { ApiError } from '../api/client';
import { isSupported as captureBuilt } from '../native/vpn';
import {
  canEnroll, enrollThisPhone, forgetIdentity, loadIdentity, saveIdentity, sendHeartbeat, type PhoneIdentity,
} from '../device/identity';
import type { DeviceRecord } from '../api/types';

const HEARTBEAT_MS = 2 * 60 * 1000;

export type PhoneDeviceStatus = 'loading' | 'unsupported' | 'not_enrolled' | 'pending_approval' | 'active' | 'revoked';

interface DeviceValue {
  status: PhoneDeviceStatus;
  identity: PhoneIdentity | null;
  /** The server's record of this phone, when it has been read. */
  record: DeviceRecord | null;
  lastError: string | null;
  busy: boolean;
  /** The enrolled device ID while active, for attributing what this phone sends. */
  activeDeviceId: string | null;
  enroll: (displayName: string) => Promise<void>;
  approveHere: () => Promise<void>;
  checkIn: () => Promise<void>;
  forget: () => Promise<void>;
}

const Ctx = createContext<DeviceValue | null>(null);

/** Capabilities this phone can have; reported each heartbeat as confirmed by its own checks. */
export const ADVERTISED = ['alerts', 'approvals', 'live_feed', ...(captureBuilt ? ['network_capture'] : [])];

export const defaultPhoneName = () =>
  Platform.OS === 'ios' ? 'iPhone (CyberForge)' : Platform.OS === 'android' ? 'Android phone (CyberForge)' : 'Phone (CyberForge)';

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const { user, isGuest } = useAuth();
  const privacy = usePrivacy();
  const { connected } = useLiveFeed();
  const userId = user?.id ?? null;

  const [identity, setIdentity] = useState<PhoneIdentity | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [record, setRecord] = useState<DeviceRecord | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<PhoneIdentity | null>(null);
  ref.current = identity;

  // what the phone's own checks confirm, read fresh at each heartbeat
  const confirmed = useRef<Record<string, 'ok' | 'denied' | 'unavailable'>>({});
  confirmed.current = {
    alerts: 'ok',
    approvals: 'ok',
    live_feed: connected ? 'ok' : 'unavailable',
    ...(captureBuilt ? { network_capture: privacy.allows('capture') ? 'ok' : 'denied' } : {}),
  };

  useEffect(() => {
    let cancelled = false;
    void loadIdentity().then((found) => {
      if (cancelled) return;
      setIdentity(found);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // only this account's identity counts
  const mine = identity && userId && identity.ownerUserId === userId ? identity : null;

  const status: PhoneDeviceStatus = !canEnroll
    ? 'unsupported'
    : !loaded
      ? 'loading'
      : !mine
        ? 'not_enrolled'
        : mine.state === 'active'
          ? 'active'
          : mine.state === 'revoked'
            ? 'revoked'
            : 'pending_approval';

  const remember = useCallback(async (next: PhoneIdentity) => {
    ref.current = next;
    setIdentity(next);
    await saveIdentity(next);
  }, []);

  const beat = useCallback(async () => {
    const current = ref.current;
    if (!current || !userId || current.ownerUserId !== userId || current.state !== 'active') return;
    try {
      const { identity: next, device } = await sendHeartbeat(current, confirmed.current);
      ref.current = next;
      setIdentity(next);
      if (device) setRecord(device);
      setLastError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Heartbeat failed';
      const code = e instanceof ApiError ? e.code : null;
      setLastError(message);
      // the server refuses a revoked or no longer approved device: stop sending
      if (code === 'DEVICE_REVOKED' || code === 'DEVICE_UNKNOWN') await remember({ ...current, state: 'revoked' });
      else if (code === 'DEVICE_NOT_ACTIVE') await remember({ ...current, state: 'pending_approval' });
      else if (code === 'DEVICE_REPLAY') await remember({ ...current, seq: current.seq + 100 }); // a reused number: skip ahead
    }
  }, [userId, remember]);

  // the server's view of this phone (approved elsewhere? revoked?)
  const refreshRecord = useCallback(async () => {
    const current = ref.current;
    if (!current || !userId || current.ownerUserId !== userId) return;
    try {
      const device = (await endpoints.device(current.deviceId)).data;
      if (!device) return;
      setRecord(device);
      if (device.state !== current.state) await remember({ ...current, state: device.state });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) await remember({ ...current, state: 'revoked' });
    }
  }, [userId, remember]);

  // heartbeats while the app is open and the phone is active
  useEffect(() => {
    if (status !== 'active' || isGuest) return;
    void beat();
    const timer = setInterval(() => void beat(), HEARTBEAT_MS);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void beat();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [status, isGuest, beat]);

  // while awaiting approval, look for it (approved on the desktop, for example)
  useEffect(() => {
    if (status !== 'pending_approval' && status !== 'active') return;
    void refreshRecord();
    if (status !== 'pending_approval') return;
    const timer = setInterval(() => void refreshRecord(), 15000);
    return () => clearInterval(timer);
  }, [status, refreshRecord]);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setLastError(null);
    try {
      await work();
    } catch (e) {
      setLastError(e instanceof Error ? e.message : 'The request failed');
    } finally {
      setBusy(false);
    }
  }, []);

  const enroll = useCallback(
    (displayName: string) =>
      run(async () => {
        if (!userId || isGuest) throw new Error('Sign in to enroll this phone.');
        const next = await enrollThisPhone(userId, displayName.trim() || defaultPhoneName(), ADVERTISED);
        ref.current = next;
        setIdentity(next);
      }),
    [run, userId, isGuest],
  );

  const approveHere = useCallback(
    () =>
      run(async () => {
        const current = ref.current;
        if (!current) throw new Error('This phone is not enrolled.');
        const approved = (await endpoints.deviceApprove(current.deviceId, current.fingerprint)).data;
        if (approved) setRecord(approved);
        await remember({ ...current, state: approved?.state ?? 'active' });
      }),
    [run, remember],
  );

  const checkIn = useCallback(
    () =>
      run(async () => {
        await refreshRecord();
        await beat();
      }),
    [run, refreshRecord, beat],
  );

  const forget = useCallback(
    () =>
      run(async () => {
        await forgetIdentity();
        ref.current = null;
        setIdentity(null);
        setRecord(null);
      }),
    [run],
  );

  const value = useMemo<DeviceValue>(
    () => ({
      status, identity: mine, record, lastError, busy,
      activeDeviceId: status === 'active' && mine ? mine.deviceId : null,
      enroll, approveHere, checkIn, forget,
    }),
    [status, mine, record, lastError, busy, enroll, approveHere, checkIn, forget],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePhoneDevice(): DeviceValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePhoneDevice must be used within DeviceProvider');
  return ctx;
}
