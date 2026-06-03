/**
 * VPN / network-capture state for the whole app.
 *
 * Owns the connection to the native capture engine (src/native/vpn.ts): it
 * subscribes to live flows + status, keeps a capped in-memory buffer for the
 * Capture screen, and — for a signed-in user — batches captured flows up to the
 * backend so they are saved to the database and become readable from the
 * desktop app and the user's other devices.
 *
 * When the native engine isn't in the build (Expo Go / web / iOS), everything
 * still works: `supported` is false and the screen shows an honest "needs a dev
 * build" state instead of pretending to capture.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { endpoints } from '../api/endpoints';
import { API_BASE_URL } from '../api/config';
import { getItem, TOKEN_KEY } from '../api/storage';
import { vpn, isSupported, type NetworkFlow, type VpnState } from '../native/vpn';
import type { NetworkCaptureRecord } from '../api/types';
import { useAuth } from './AuthContext';

const MAX_BUFFER = 300; // live flows kept in memory for the UI
const FLUSH_EVERY_MS = 8000; // batch-push cadence
const FLUSH_AT = 25; // …or when this many flows are queued

interface VpnContextValue {
  supported: boolean;
  state: VpnState;
  flows: NetworkFlow[];
  /** Cleared count of flows pushed to the backend this session. */
  syncedCount: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  installCa: () => Promise<void>;
  refreshCa: () => Promise<void>;
  clear: () => void;
}

const VpnCtx = createContext<VpnContextValue | null>(null);

const INITIAL: VpnState = { status: isSupported ? 'idle' : 'unsupported', flowCount: 0, caInstalled: false };

export function VpnProvider({ children }: { children: React.ReactNode }) {
  const { token, user, isGuest } = useAuth();
  const [state, setState] = useState<VpnState>(INITIAL);
  const [flows, setFlows] = useState<NetworkFlow[]>([]);
  const [syncedCount, setSyncedCount] = useState(0);

  // Pending flows awaiting a batched push to the backend.
  const queue = useRef<NetworkFlow[]>([]);
  // Keep the freshest auth in a ref so the flush timer never closes over a
  // stale token without needing to be re-created on every auth change.
  const auth = useRef({ token, userId: user?.id ?? null, isGuest });
  useEffect(() => {
    auth.current = { token, userId: user?.id ?? null, isGuest };
  }, [token, user, isGuest]);

  // Subscribe to native flow + status events for the lifetime of the provider.
  useEffect(() => {
    if (!isSupported) return;
    const offFlow = vpn.onFlow((flow) => {
      setFlows((prev) => {
        const next = [flow, ...prev];
        return next.length > MAX_BUFFER ? next.slice(0, MAX_BUFFER) : next;
      });
      queue.current.push(flow);
      if (queue.current.length >= FLUSH_AT) void flush();
    });
    const offState = vpn.onState((s) => setState(s));
    // Pull the current state once on mount.
    void vpn.getState().then(setState);
    return () => {
      offFlow();
      offState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic batched push of queued captures to the backend.
  const flush = useCallback(async () => {
    const { token: tok, userId, isGuest: guest } = auth.current;
    // Only signed-in (non-guest) users get a server-side, cross-device copy.
    if (guest || !tok || !userId) {
      queue.current = [];
      return;
    }
    if (queue.current.length === 0) return;
    const batch = queue.current.splice(0, queue.current.length);
    const records: NetworkCaptureRecord[] = batch.map(toRecord);
    try {
      const res = await endpoints.pushNetworkCapture(records, 'mobile');
      const stored = res?.data?.stored ?? records.length;
      setSyncedCount((n) => n + stored);
    } catch {
      // On failure, drop the batch rather than growing unbounded — the native
      // engine also persists locally, so nothing is truly lost.
    }
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    const id = setInterval(() => void flush(), FLUSH_EVERY_MS);
    return () => clearInterval(id);
  }, [flush]);

  const start = useCallback(async () => {
    if (!isSupported) return;
    setState((s) => ({ ...s, status: 'preparing', error: undefined }));
    try {
      const granted = await vpn.prepare();
      if (!granted) {
        setState((s) => ({ ...s, status: 'idle', error: 'VPN permission was not granted.' }));
        return;
      }
      const tok = await getItem(TOKEN_KEY);
      await vpn.start({ backendUrl: API_BASE_URL, token: tok, userId: auth.current.userId });
      // Native will emit the authoritative 'running' state via onState.
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: e instanceof Error ? e.message : String(e) }));
    }
  }, []);

  const stop = useCallback(async () => {
    if (!isSupported) return;
    setState((s) => ({ ...s, status: 'stopping' }));
    try {
      await vpn.stop();
      await flush();
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: e instanceof Error ? e.message : String(e) }));
    }
  }, [flush]);

  const installCa = useCallback(async () => {
    if (!isSupported) return;
    await vpn.installCa();
    await refreshCa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshCa = useCallback(async () => {
    if (!isSupported) return;
    const caInstalled = await vpn.isCaInstalled();
    setState((s) => ({ ...s, caInstalled }));
  }, []);

  const clear = useCallback(() => setFlows([]), []);

  const value = useMemo<VpnContextValue>(
    () => ({ supported: isSupported, state, flows, syncedCount, start, stop, installCa, refreshCa, clear }),
    [state, flows, syncedCount, start, stop, installCa, refreshCa, clear]
  );

  return <VpnCtx.Provider value={value}>{children}</VpnCtx.Provider>;
}

export function useVpn(): VpnContextValue {
  const ctx = useContext(VpnCtx);
  if (!ctx) throw new Error('useVpn must be used within VpnProvider');
  return ctx;
}

/** Map a native flow to the backend's snake_case capture record. */
function toRecord(f: NetworkFlow): NetworkCaptureRecord {
  return {
    id: f.id,
    host: f.host,
    url: f.url,
    method: f.method,
    scheme: f.scheme,
    ip: f.ip,
    port: f.port,
    status: f.status,
    mime: f.mime,
    app: f.app,
    decrypted: f.decrypted,
    flags: f.flags,
    req_bytes: f.reqBytes,
    resp_bytes: f.respBytes,
    duration_ms: f.durationMs,
    created_at: f.ts,
  };
}
