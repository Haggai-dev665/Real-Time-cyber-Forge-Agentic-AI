/**
 * Typed JS bridge to the native CyberForge VPN capture engine.
 *
 * The real implementation lives in the local Expo module `modules/cyberforge-vpn`
 * (Android `VpnService` + on-device TLS MITM). That module only exists in a
 * custom dev/EAS build — it is NOT present in Expo Go, on web, or (for now) iOS.
 * So everything here is written to degrade gracefully: when the native module is
 * missing, `isSupported` is false and the calls resolve to inert values, which
 * keeps the rest of the app (and `tsc`) working everywhere.
 *
 * Capture depth: full request/response payloads. That requires the user to
 * install and trust the CyberForge root CA (exposed via `getCaPem`/`installCa`)
 * so the engine can terminate TLS locally. Without a trusted CA, HTTPS flows are
 * still seen at the metadata level (host/SNI/IP) but bodies stay opaque.
 */
import { Platform } from 'react-native';

/** A single captured network request/response (one TCP flow, post-MITM). */
export interface NetworkFlow {
  /** Stable id minted by the native engine. */
  id: string;
  /** Epoch millis when the request started. */
  ts: number;
  /** Destination host (from TLS SNI / HTTP Host). */
  host: string;
  /** 'https' | 'http'. */
  scheme: 'http' | 'https' | string;
  /** HTTP method, when the payload was decryptable. */
  method?: string;
  /** Request path (no host). */
  path?: string;
  /** Full URL when known. */
  url?: string;
  /** Resolved destination IP. */
  ip?: string;
  /** Destination port. */
  port?: number;
  /** HTTP status code of the response. */
  status?: number;
  /** Response content-type. */
  mime?: string;
  /** Bytes sent / received on the flow. */
  reqBytes?: number;
  respBytes?: number;
  /** Total flow duration in ms. */
  durationMs?: number;
  /** Android package name that originated the flow, when attributable. */
  app?: string;
  /** True when TLS was MITM-decrypted (bodies/headers available). */
  decrypted?: boolean;
  /** Truncated, redacted previews (only present when decrypted). */
  reqHeaders?: Record<string, string>;
  respHeaders?: Record<string, string>;
  reqBodyPreview?: string;
  respBodyPreview?: string;
  /** Heuristic risk flags raised on-device (e.g. cleartext-credentials). */
  flags?: string[];
}

export type VpnStatus = 'unsupported' | 'idle' | 'preparing' | 'running' | 'stopping' | 'error';

export interface VpnState {
  status: VpnStatus;
  /** Flows captured since the tunnel started. */
  flowCount: number;
  /** Whether the CyberForge root CA is installed & trusted on this device. */
  caInstalled: boolean;
  error?: string;
}

type FlowListener = (flow: NetworkFlow) => void;
type StateListener = (state: VpnState) => void;

/** Shape of the native module (Expo Modules API). */
interface NativeVpn {
  isCaInstalled(): Promise<boolean>;
  getCaPem(): Promise<string>;
  /** Opens the system dialog to install/trust the root CA. */
  installCa(): Promise<boolean>;
  /** Triggers the Android VpnService consent dialog; resolves true if granted. */
  prepare(): Promise<boolean>;
  /** Starts the tunnel + capture. `backendUrl`/`token`/`userId` let the native
   *  side stream captures straight to the backend for the signed-in user. */
  start(opts: { backendUrl: string; token?: string | null; userId?: string | null }): Promise<boolean>;
  stop(): Promise<boolean>;
  getState(): Promise<VpnState>;
  addListener(event: 'onFlow', cb: FlowListener): { remove(): void };
  addListener(event: 'onState', cb: StateListener): { remove(): void };
}

/**
 * Resolve the native module if (and only if) it is linked into this build.
 * Done lazily and defensively so a missing module never throws at import time.
 */
function loadNative(): NativeVpn | null {
  if (Platform.OS !== 'android') return null;
  try {
    // Required lazily; absent in Expo Go where the module isn't autolinked.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireNativeModule } = require('expo-modules-core') as {
      requireNativeModule: (name: string) => NativeVpn;
    };
    return requireNativeModule('CyberForgeVpn');
  } catch {
    return null;
  }
}

const native = loadNative();

export const isSupported = native !== null;

const UNSUPPORTED: VpnState = {
  status: 'unsupported',
  flowCount: 0,
  caInstalled: false,
  error:
    Platform.OS === 'android'
      ? 'Native capture engine not in this build — run a dev/EAS build.'
      : 'Network capture is Android-only.',
};

export const vpn = {
  isSupported,

  async getState(): Promise<VpnState> {
    if (!native) return UNSUPPORTED;
    try {
      return await native.getState();
    } catch (e) {
      return { ...UNSUPPORTED, status: 'error', error: errMsg(e) };
    }
  },

  async isCaInstalled(): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.isCaInstalled();
    } catch {
      return false;
    }
  },

  async getCaPem(): Promise<string> {
    if (!native) return '';
    return native.getCaPem();
  },

  async installCa(): Promise<boolean> {
    if (!native) return false;
    return native.installCa();
  },

  async prepare(): Promise<boolean> {
    if (!native) return false;
    return native.prepare();
  },

  async start(opts: { backendUrl: string; token?: string | null; userId?: string | null }): Promise<boolean> {
    if (!native) return false;
    return native.start(opts);
  },

  async stop(): Promise<boolean> {
    if (!native) return false;
    return native.stop();
  },

  onFlow(cb: FlowListener): () => void {
    if (!native) return () => {};
    const sub = native.addListener('onFlow', cb);
    return () => sub.remove();
  },

  onState(cb: StateListener): () => void {
    if (!native) return () => {};
    const sub = native.addListener('onState', cb);
    return () => sub.remove();
  },
};

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
