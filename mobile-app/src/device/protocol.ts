/**
 * The device protocol, as backend/src/services/deviceService.js checks it:
 * an Ed25519 key per installation, a signed claim of a one-time code, and a
 * signature over every device request (method, path, device ID, time,
 * sequence number and the SHA-256 of the exact body bytes).
 *
 * No React Native imports: the backend's contract test signs with this file
 * and verifies with the backend's own functions, so the two cannot drift.
 * SHA-256 is passed in (expo-crypto on the phone, node:crypto in the test).
 */
import nacl from 'tweetnacl';

export type Sha256Hex = (bytes: Uint8Array) => Promise<string>;

export interface DeviceKeys {
  /** 32-byte Ed25519 public key, standard base64. */
  publicKey: string;
  /** 64-byte tweetnacl secret key, standard base64. */
  secretKey: string;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let index = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('not base64');
    value = (value << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (value >> bits) & 0xff;
    }
  }
  return out;
}

export const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/** A new key pair. `seed` is 32 random bytes from a secure source. */
export function newKeys(seed: Uint8Array): DeviceKeys {
  if (seed.length !== 32) throw new Error('a key seed is 32 bytes');
  const pair = nacl.sign.keyPair.fromSeed(seed);
  return { publicKey: toBase64(pair.publicKey), secretKey: toBase64(pair.secretKey) };
}

export function sign(keys: DeviceKeys, message: string): string {
  return toBase64(nacl.sign.detached(utf8(message), fromBase64(keys.secretKey)));
}

export const claimMessage = (code: string, installationId: string, publicKey: string): string =>
  ['cyberforge-device-claim-v1', code, installationId, publicKey].join('\n');

export const requestMessage = (method: string, path: string, deviceId: string, timestamp: number, seq: number, bodyDigest: string): string =>
  ['cyberforge-device-request-v1', method.toUpperCase(), path, deviceId, String(timestamp), String(seq), bodyDigest].join('\n');

/** The code as the backend reads it: upper case, no dashes or spaces, O read as 0 and I/L as 1. */
export const normalizeCode = (input: string): string =>
  input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');

/** What the user compares on both screens before approving: 32 hex characters in groups of four. */
export async function keyFingerprint(publicKey: string, sha256Hex: Sha256Hex): Promise<string> {
  const digest = (await sha256Hex(fromBase64(publicKey))).slice(0, 32);
  return (digest.match(/.{4}/g) ?? []).join(' ');
}

/** The body of a claim: the code, this installation, its key, and the key's signature over them. */
export function claimBody(
  keys: DeviceKeys,
  code: string,
  installationId: string,
  details: { platform: string; displayName: string; capabilities: string[]; clientVersion: string },
) {
  const normalized = normalizeCode(code);
  return {
    code: normalized,
    installationId,
    publicKey: keys.publicKey,
    kind: 'endpoint',
    ...details,
    signature: sign(keys, claimMessage(normalized, installationId, keys.publicKey)),
  };
}

/**
 * The headers for one signed device request. `path` is the request path as
 * the server sees it (for example /api/v1/devices/<id>/heartbeat); `body` is
 * the exact text that will be sent.
 */
export async function signedHeaders(
  keys: DeviceKeys,
  request: { method: string; path: string; deviceId: string; timestamp: number; seq: number; body: string },
  sha256Hex: Sha256Hex,
): Promise<Record<string, string>> {
  const digest = await sha256Hex(utf8(request.body));
  const message = requestMessage(request.method, request.path, request.deviceId, request.timestamp, request.seq, digest);
  return {
    'X-CF-Device': request.deviceId,
    'X-CF-Timestamp': String(request.timestamp),
    'X-CF-Seq': String(request.seq),
    'X-CF-Signature': sign(keys, message),
  };
}
