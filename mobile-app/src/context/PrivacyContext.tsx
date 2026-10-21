/**
 * Privacy choices on the phone (SEC-07): what CyberForge may collect here and
 * what it may send.
 *
 * Each control is separate and off until the user decides. The choices are
 * kept on this phone with the consent version and the time, plus the last 50
 * changes. A later CONSENT_VERSION counts as undecided, and an earlier "on"
 * does not carry over to it. The code that collects or sends checks its
 * control itself (VpnContext for capture and sync, the assistant for the
 * language model), so a screen cannot skip the check.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CONSENT_VERSION = 1;
const STORAGE_KEY = 'cf_privacy';
const MAX_LOG = 50;

export type PrivacyFeature = 'capture' | 'capture_sync' | 'llm_processing';

export const PRIVACY_FEATURES: Array<{ id: PrivacyFeature; label: string; detail: string }> = [
  {
    id: 'capture',
    label: 'Capture network traffic',
    detail:
      'Routes this phone\'s traffic through the on-device VPN so it can be inspected here. Android also asks for its own VPN permission. Nothing leaves the phone on its own.',
  },
  {
    id: 'capture_sync',
    label: 'Sync captures to your account',
    detail:
      'Sends captured requests (host, address with sign-in codes and tokens removed, method, status, sizes, app) to the CyberForge backend, so your desktop can see them.',
  },
  {
    id: 'llm_processing',
    label: 'Assistant (language model)',
    detail:
      'Sends your questions to the CyberForge backend, which answers with the ML service\'s model on Hugging Face or another configured provider.',
  },
];

export interface PrivacyChange {
  at: string;
  feature: PrivacyFeature;
  on: boolean;
}

interface Stored {
  consentVersion: number;
  decidedAt: string | null;
  choices: Partial<Record<PrivacyFeature, boolean>>;
  log: PrivacyChange[];
}

interface PrivacyContextValue {
  ready: boolean;
  /** True once the user has chosen under the current consent version. */
  decided: boolean;
  decidedAt: string | null;
  consentVersion: number;
  choices: Record<PrivacyFeature, boolean>;
  log: PrivacyChange[];
  allows: (feature: PrivacyFeature) => boolean;
  /** Changes some controls; the rest keep their value. Marks the choice as made. */
  set: (changes: Partial<Record<PrivacyFeature, boolean>>) => Promise<void>;
  /** For code that runs outside React renders (timers, callbacks). */
  allowsNow: (feature: PrivacyFeature) => boolean;
}

const EMPTY: Stored = { consentVersion: CONSENT_VERSION, decidedAt: null, choices: {}, log: [] };
const OFF: Record<PrivacyFeature, boolean> = { capture: false, capture_sync: false, llm_processing: false };

const Ctx = createContext<PrivacyContextValue | null>(null);

function current(stored: Stored): Record<PrivacyFeature, boolean> {
  if (stored.consentVersion !== CONSENT_VERSION || !stored.decidedAt) return { ...OFF };
  return {
    capture: stored.choices.capture === true,
    capture_sync: stored.choices.capture_sync === true,
    llm_processing: stored.choices.llm_processing === true,
  };
}

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useState<Stored>(EMPTY);
  const [ready, setReady] = useState(false);
  const ref = useRef<Stored>(EMPTY);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Stored) : null;
        if (parsed && typeof parsed === 'object' && parsed.choices) {
          const value = { ...EMPTY, ...parsed, log: Array.isArray(parsed.log) ? parsed.log : [] };
          ref.current = value;
          setStored(value);
        }
      } catch {
        // unreadable choices count as undecided: everything stays off
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const set = useCallback(async (changes: Partial<Record<PrivacyFeature, boolean>>) => {
    const before = current(ref.current);
    const at = new Date().toISOString();
    const choices = { ...before };
    const log = [...ref.current.log];
    for (const feature of Object.keys(changes) as PrivacyFeature[]) {
      if (!(feature in OFF) || typeof changes[feature] !== 'boolean') continue;
      const on = changes[feature] as boolean;
      if (on !== before[feature] || !ref.current.decidedAt) log.unshift({ at, feature, on });
      choices[feature] = on;
    }
    const next: Stored = { consentVersion: CONSENT_VERSION, decidedAt: at, choices, log: log.slice(0, MAX_LOG) };
    ref.current = next;
    setStored(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const value = useMemo<PrivacyContextValue>(() => {
    const choices = current(stored);
    return {
      ready,
      decided: stored.consentVersion === CONSENT_VERSION && Boolean(stored.decidedAt),
      decidedAt: stored.decidedAt,
      consentVersion: CONSENT_VERSION,
      choices,
      log: stored.log,
      allows: (feature) => choices[feature] === true,
      allowsNow: (feature) => current(ref.current)[feature] === true,
      set,
    };
  }, [stored, ready, set]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePrivacy must be used within PrivacyProvider');
  return ctx;
}
