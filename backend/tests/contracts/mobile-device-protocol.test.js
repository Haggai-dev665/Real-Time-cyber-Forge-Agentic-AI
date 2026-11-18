// The phone enrolls itself and signs its heartbeats with
// mobile-app/src/device/protocol.ts. This signs with that file and verifies
// with the backend's own functions (deviceService), so the phone and the
// server cannot drift apart. Node runs the phone's TypeScript directly
// (type stripping, Node 22.18 and later).
const { execFileSync } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const deviceService = require('../../src/services/deviceService');

const repo = path.join(__dirname, '..', '..', '..');
const protocol = path.join(repo, 'mobile-app', 'src', 'device', 'protocol.ts');
const [major, minor] = process.versions.node.split('.').map(Number);
const canStripTypes = major > 22 || (major === 22 && minor >= 18);

const SCRIPT = `
import * as p from ${JSON.stringify(require('url').pathToFileURL(protocol).href)};
import { createHash } from 'node:crypto';
const sha = async bytes => createHash('sha256').update(bytes).digest('hex');
const seed = new Uint8Array(32).map((_, i) => (i * 7 + 3) & 255);
const keys = p.newKeys(seed);
const claim = p.claimBody(keys, 'abcd-efgh-jk0o', 'phone-install-1234', { platform: 'android', displayName: 'Pixel', capabilities: ['alerts'], clientVersion: '1.0.0' });
const body = JSON.stringify({ clientVersion: '1.0.0', capabilities: { alerts: 'ok', network_capture: 'unavailable' } });
const headers = await p.signedHeaders(keys, { method: 'post', path: '/api/v1/devices/dev-9/heartbeat', deviceId: 'dev-9', timestamp: 1792100000000, seq: 7, body }, sha);
const fingerprint = await p.keyFingerprint(keys.publicKey, sha);
const roundTrip = p.toBase64(p.fromBase64(keys.secretKey)) === keys.secretKey;
console.log(JSON.stringify({ keys, claim, body, headers, fingerprint, roundTrip }));
`;

(canStripTypes ? test : test.skip)('a claim and a heartbeat signed by the phone verify with the backend\'s own checks', () => {
  const out = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', SCRIPT], { cwd: repo, encoding: 'utf8' }));
  const verify = (publicKey, message, signature) => {
    const key = crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(publicKey, 'base64')]), format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(message, 'utf8'), key, Buffer.from(signature, 'base64'));
  };
  expect(out.roundTrip).toBe(true);

  // the claim: the code as the backend normalizes it, and the key's proof
  expect(out.claim.code).toBe(deviceService.normalizeCode('abcd-efgh-jk0o'));
  const claimMsg = deviceService.claimMessage({ code: out.claim.code, installationId: out.claim.installationId, publicKey: out.keys.publicKey });
  expect(verify(out.keys.publicKey, claimMsg, out.claim.signature)).toBe(true);
  expect(verify(out.keys.publicKey, claimMsg + 'x', out.claim.signature)).toBe(false);

  // the heartbeat: the same message the server rebuilds from the request
  const message = deviceService.requestMessage({
    method: 'POST', path: '/api/v1/devices/dev-9/heartbeat', deviceId: out.headers['X-CF-Device'],
    timestamp: Number(out.headers['X-CF-Timestamp']), seq: Number(out.headers['X-CF-Seq']), bodyDigest: deviceService.bodyDigest(Buffer.from(out.body, 'utf8'))
  });
  expect(verify(out.keys.publicKey, message, out.headers['X-CF-Signature'])).toBe(true);
  // a changed body no longer matches
  const tampered = message.replace(deviceService.bodyDigest(Buffer.from(out.body)), deviceService.bodyDigest(Buffer.from(out.body + ' ')));
  expect(verify(out.keys.publicKey, tampered, out.headers['X-CF-Signature'])).toBe(false);

  // the fingerprint the phone shows is the one the server asks the approver to name
  expect(out.fingerprint).toBe(deviceService.keyFingerprint(out.keys.publicKey));
});
