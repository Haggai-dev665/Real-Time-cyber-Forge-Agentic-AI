// Device enrollment, approval, signed heartbeats and revocation (DEV-01, DEV-02,
// first parts of DEV-04 and DEV-05), through the real routes, the real session
// check and the workspace repository.
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/services/workspaceService', () => ({
  ensurePersonalWorkspace: jest.fn(async user => `ws-${user._id}`),
  workspaceIdFor: jest.fn(async principal => (principal && principal.userId ? (principal.workspaceId || `ws-${principal.userId}`) : null)),
  activeMembership: jest.fn(async (workspaceId, userId) => (workspaceId === `ws-${userId}` ? { role: 'owner' } : null))
}));
jest.mock('../../src/models/Device', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['deviceId'] }, { fields: ['workspaceId', 'installationId'] }] }),
  { KINDS: ['endpoint', 'backend_worker', 'inventory_only'], PLATFORMS: ['windows', 'macos', 'linux', 'android', 'ios', 'other'], STATES: ['pending_approval', 'active', 'revoked', 'inventory'] }
));
jest.mock('../../src/models/DeviceEnrollment', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['enrollmentId'] }, { fields: ['codeHash'] }] }),
  { STATES: ['pending', 'claimed', 'cancelled'], FLOWS: ['this_device', 'pair'] }
));
jest.mock('../../src/models/DeviceEvent', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['deviceId', 'batchId', 'index'] }] }),
  { TYPES: ['enforcement', 'capability_change', 'app_event'], RETENTION_DAYS: 30 }
));
jest.mock('../../src/models/AuditEvent', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection(),
  { OUTCOMES: ['success', 'failure', 'warning'], RETENTION_DAYS: 90 }
));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const crypto = require('crypto');
const express = require('express');
const User = require('../../src/models/User');
const Device = require('../../src/models/Device');
const DeviceEnrollment = require('../../src/models/DeviceEnrollment');
const AuditEvent = require('../../src/models/AuditEvent');
const DeviceEvent = require('../../src/models/DeviceEvent');
const { signSessionToken } = require('../../src/services/sessionTokens');
const deviceService = require('../../src/services/deviceService');

const account = (id, email) => ({ _id: id, email, role: 'user', isActive: true, isLocked: () => false, activity: {}, save: jest.fn() });
const alice = account('507f1f77bcf86cd799439011', 'alice@example.com');
const bob = account('507f1f77bcf86cd799439012', 'bob@example.com');

const devicesRouter = require('../../src/routes/devices');
let base;
let server;
beforeAll(async () => {
  const app = express();
  app.use(express.json({ verify: (req, res, buf) => { if (req.originalUrl.startsWith('/api/v1/devices')) req.rawBody = buf; } }));
  app.use('/api/v1', devicesRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
beforeEach(() => {
  Device.reset(); DeviceEnrollment.reset(); AuditEvent.reset(); DeviceEvent.reset();
  // the claim limit counts per address, and every test here claims from 127.0.0.1
  for (const key of ['127.0.0.1', '::ffff:127.0.0.1', '::1']) devicesRouter.claimLimiter.resetKey(key);
  User.findById.mockImplementation(async id => [alice, bob].find(u => u._id === String(id)) || null);
});

async function call(method, path, { as, body, headers = {}, raw } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(as ? { Authorization: `Bearer ${signSessionToken(as)}` } : {}), ...headers },
    body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

// an installation: its own key pair and installation ID
function installation(id = crypto.randomBytes(12).toString('hex')) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64');
  return { installationId: id, publicKey: raw, sign: message => crypto.sign(null, Buffer.from(message, 'utf8'), privateKey).toString('base64') };
}
function claimBody(inst, code, extra = {}) {
  const normalized = deviceService.normalizeCode(code);
  return {
    code, installationId: inst.installationId, publicKey: inst.publicKey, platform: 'windows', displayName: 'Work laptop',
    capabilities: ['browser_history', 'hosts_blocking'], clientVersion: '1.0.0',
    signature: inst.sign(deviceService.claimMessage({ code: normalized, installationId: inst.installationId, publicKey: inst.publicKey })),
    ...extra
  };
}
async function newCode(as = alice) {
  return (await call('POST', '/api/v1/device-enrollments', { as, body: { flow: 'pair', platform: 'windows' } })).body.data;
}
async function enrolled(inst = installation(), as = alice) {
  const { code } = await newCode(as);
  const claimed = await call('POST', '/api/v1/device-enrollments/claim', { body: claimBody(inst, code) });
  await call('POST', `/api/v1/devices/${claimed.body.data.deviceId}/approve`, { as, body: { keyFingerprint: claimed.body.data.keyFingerprint } });
  return { inst, deviceId: claimed.body.data.deviceId };
}
function heartbeat(inst, deviceId, { seq, body = { capabilities: { browser_history: 'ok', hosts_blocking: 'denied' } }, timestamp = Date.now(), headerDevice = deviceId, path = `/api/v1/devices/${deviceId}/heartbeat`, signBody } = {}) {
  const raw = JSON.stringify(body);
  const message = deviceService.requestMessage({ method: 'POST', path, deviceId: headerDevice, timestamp, seq, bodyDigest: deviceService.bodyDigest(Buffer.from(signBody !== undefined ? signBody : raw)) });
  return call('POST', path, {
    raw,
    headers: { 'X-CF-Device': headerDevice, 'X-CF-Timestamp': String(timestamp), 'X-CF-Seq': String(seq), 'X-CF-Signature': inst.sign(message) }
  });
}

describe('enrollment codes', () => {
  test('a code is one-time, short-lived, shown once and stored only as a hash; it carries no user credential', async () => {
    const created = await newCode();
    expect(created.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(new Date(created.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(deviceService.ENROLLMENT_TTL_MS);
    expect(created.link).toBe(`cyberforge://enroll?code=${created.code.replace(/-/g, '')}`);
    const stored = JSON.stringify(DeviceEnrollment.docs);
    expect(stored).not.toContain(created.code.replace(/-/g, ''));
    expect(stored).not.toMatch(/eyJ/); // no JWT anywhere
    expect((await call('POST', '/api/v1/device-enrollments', { body: {} })).status).toBe(401);
  });

  test('two concurrent claims of one code: exactly one device is enrolled', async () => {
    const { code } = await newCode();
    const results = await Promise.all([installation(), installation(), installation()].map(inst =>
      call('POST', '/api/v1/device-enrollments/claim', { body: claimBody(inst, code) })));
    expect(results.map(r => r.status).sort()).toEqual([201, 409, 409]);
    expect(Device.docs).toHaveLength(1);
  });

  test('a bad signature is refused without using the code up', async () => {
    const { code } = await newCode();
    const inst = installation();
    const forged = await call('POST', '/api/v1/device-enrollments/claim', { body: claimBody(inst, code, { signature: installation().sign('anything') }) });
    expect(forged.body).toMatchObject({ code: 'DEVICE_KEY_PROOF_INVALID' });
    expect((await call('POST', '/api/v1/device-enrollments/claim', { body: claimBody(inst, code) })).status).toBe(201);
  });

  test('expired, cancelled and unknown codes are refused, and refusal enrolls nothing', async () => {
    const expired = await newCode();
    DeviceEnrollment.docs[0].expiresAt = new Date(Date.now() - 1000);
    expect((await call('POST', '/api/v1/device-enrollments/claim', { body: claimBody(installation(), expired.code) })).body.code).toBe('ENROLLMENT_EXPIRED');

    const cancelled = await newCode();
    expect((await call('DELETE', `/api/v1/device-enrollments/${cancelled.enrollmentId}`, { as: bob })).status).toBe(404); // not bob's
    expect((await call('DELETE', `/api/v1/device-enrollments/${cancelled.enrollmentId}`, { as: alice })).status).toBe(200);
    expect((await call('POST', '/api/v1/device-enrollments/claim', { body: claimBody(installation(), cancelled.code) })).body.code).toBe('ENROLLMENT_CANCELLED');

    expect((await call('POST', '/api/v1/device-enrollments/claim', { body: claimBody(installation(), 'ABCD-EFGH-JKMN') })).body.code).toBe('ENROLLMENT_INVALID');
    expect(Device.docs).toHaveLength(0);
  });

  test('the code is typed forgivingly: lower case, no dashes, O for 0 and I or L for 1', async () => {
    expect(deviceService.normalizeCode('abcd-0011-wxyz')).toBe('ABCD0011WXYZ');
    expect(deviceService.normalizeCode('abcdOoiLwxyz')).toBe('ABCD0011WXYZ');
    expect(deviceService.normalizeCode('ABCD-0011-WXYU')).toBeNull(); // U is not in the alphabet
    expect(deviceService.normalizeCode('ABCD-0011')).toBeNull();
  });
});

describe('approval', () => {
  test('a claimed device cannot sign in until a member approves the fingerprint they were shown', async () => {
    const inst = installation();
    const { code } = await newCode();
    const claimed = (await call('POST', '/api/v1/device-enrollments/claim', { body: claimBody(inst, code) })).body.data;
    expect(claimed).toMatchObject({ state: 'pending_approval', keyVersion: 1 });

    expect((await heartbeat(inst, claimed.deviceId, { seq: 1 })).body.code).toBe('DEVICE_NOT_ACTIVE');
    expect((await call('POST', `/api/v1/devices/${claimed.deviceId}/approve`, { as: alice, body: { keyFingerprint: '0000 0000 0000 0000 0000 0000 0000 0000' } })).body.code).toBe('DEVICE_KEY_CHANGED');
    expect((await call('POST', `/api/v1/devices/${claimed.deviceId}/approve`, { as: bob, body: { keyFingerprint: claimed.keyFingerprint } })).status).toBe(404);
    const approved = await call('POST', `/api/v1/devices/${claimed.deviceId}/approve`, { as: alice, body: { keyFingerprint: claimed.keyFingerprint } });
    expect(approved.body.data).toMatchObject({ state: 'active', connection: 'never_connected' });
    expect(AuditEvent.docs.map(e => e.action)).toEqual(expect.arrayContaining(['device.enrollment_create', 'device.claim', 'device.approve']));
  });
});

describe('signed heartbeats', () => {
  test('an approved device reports itself; the server records presence and what its checks confirmed', async () => {
    const { inst, deviceId } = await enrolled();
    const beat = await heartbeat(inst, deviceId, { seq: 1 });
    expect(beat.status).toBe(200);
    expect(beat.body.data.device).toMatchObject({ connection: 'online', capabilities: { advertised: ['browser_history', 'hosts_blocking'], confirmed: { browser_history: 'ok', hosts_blocking: 'denied' } } });
  });

  test('replayed, reordered, forged, altered, late and borrowed requests are refused', async () => {
    const { inst, deviceId } = await enrolled();
    expect((await heartbeat(inst, deviceId, { seq: 5 })).status).toBe(200);
    expect((await heartbeat(inst, deviceId, { seq: 5 })).body.code).toBe('DEVICE_REPLAY');
    expect((await heartbeat(inst, deviceId, { seq: 4 })).body.code).toBe('DEVICE_REPLAY');
    expect((await heartbeat(installation(), deviceId, { seq: 6 })).body.code).toBe('DEVICE_SIGNATURE_INVALID');
    expect((await heartbeat(inst, deviceId, { seq: 6, signBody: '{"capabilities":{}}' })).body.code).toBe('DEVICE_SIGNATURE_INVALID');
    expect((await heartbeat(inst, deviceId, { seq: 6, timestamp: Date.now() - deviceService.CLOCK_SKEW_MS - 1000 })).body.code).toBe('DEVICE_CLOCK_SKEW');
    const other = await enrolled();
    expect((await heartbeat(inst, other.deviceId, { seq: 6, headerDevice: deviceId })).body.code).toBe('DEVICE_MISMATCH');
    expect((await heartbeat(inst, deviceId, { seq: 6 })).status).toBe(200); // a correct one still works
  });

  test('a revoked device cannot report again', async () => {
    const { inst, deviceId } = await enrolled();
    expect((await heartbeat(inst, deviceId, { seq: 1 })).status).toBe(200);
    expect((await call('POST', `/api/v1/devices/${deviceId}/revoke`, { as: bob })).status).toBe(404);
    expect((await call('POST', `/api/v1/devices/${deviceId}/revoke`, { as: alice })).body.data).toMatchObject({ state: 'revoked', connection: 'revoked' });
    expect((await heartbeat(inst, deviceId, { seq: 2 })).body.code).toBe('DEVICE_REVOKED');
  });
});

describe('identity', () => {
  test('the same installation enrolling again keeps its device record, with a new key; the old key no longer works', async () => {
    const first = await enrolled(installation('install-0001'));
    expect((await heartbeat(first.inst, first.deviceId, { seq: 1 })).status).toBe(200);
    const again = await enrolled(installation('install-0001'));
    expect(again.deviceId).toBe(first.deviceId);
    expect(Device.docs).toHaveLength(1);
    expect(Device.docs[0]).toMatchObject({ keyVersion: 2, state: 'active' });
    expect((await heartbeat(first.inst, first.deviceId, { seq: 2 })).body.code).toBe('DEVICE_SIGNATURE_INVALID');
    expect((await heartbeat(again.inst, again.deviceId, { seq: 1 })).status).toBe(200); // sequence starts again with the new key
  });

  test('two devices with the same name stay two devices, and a rename keeps the ID', async () => {
    const a = await enrolled();
    const b = await enrolled();
    expect(a.deviceId).not.toBe(b.deviceId);
    const renamed = await call('PATCH', `/api/v1/devices/${a.deviceId}`, { as: alice, body: { displayName: 'Desk PC' } });
    expect(renamed.body.data).toMatchObject({ deviceId: a.deviceId, displayName: 'Desk PC' });
    expect((await call('PATCH', `/api/v1/devices/${a.deviceId}`, { as: alice, body: { displayName: 'a\u0000b' } })).body.code).toBe('DEVICE_NAME_INVALID');
  });

  test('another workspace sees none of these devices', async () => {
    const { deviceId } = await enrolled();
    expect((await call('GET', '/api/v1/devices', { as: alice })).body.data.total).toBe(1);
    expect((await call('GET', '/api/v1/devices', { as: bob })).body.data).toEqual({ devices: [], total: 0 });
    expect((await call('GET', `/api/v1/devices/${deviceId}`, { as: bob })).status).toBe(404);
    expect((await call('PATCH', `/api/v1/devices/${deviceId}`, { as: bob, body: { displayName: 'mine now' } })).status).toBe(404);
  });

  test('an inventory record has no credential, no telemetry and no connection state', async () => {
    const created = await call('POST', '/api/v1/devices', { as: alice, body: { displayName: 'Office printer', platform: 'other' } });
    expect(created.body.data).toMatchObject({ kind: 'inventory_only', state: 'inventory', connection: 'not_applicable', keyFingerprint: null });
    expect((await call('POST', `/api/v1/devices/${created.body.data.deviceId}/revoke`, { as: alice })).body.code).toBe('DEVICE_HAS_NO_CREDENTIAL');
  });

  test('connection is worked out from server time', () => {
    const now = Date.now();
    const at = ms => ({ state: 'active', lastSeenAt: new Date(now - ms) });
    expect(deviceService.connectionOf(at(60 * 1000), now)).toBe('online');
    expect(deviceService.connectionOf(at(deviceService.ONLINE_MS + 1000), now)).toBe('stale');
    expect(deviceService.connectionOf(at(deviceService.STALE_MS + 1000), now)).toBe('offline');
  });
});

// a request signed by an installation's key, for any device path
function signed(inst, deviceId, path, body, seq) {
  const raw = JSON.stringify(body);
  const timestamp = Date.now();
  const message = deviceService.requestMessage({ method: 'POST', path, deviceId, timestamp, seq, bodyDigest: deviceService.bodyDigest(Buffer.from(raw)) });
  return call('POST', path, { raw, headers: { 'X-CF-Device': deviceId, 'X-CF-Timestamp': String(timestamp), 'X-CF-Seq': String(seq), 'X-CF-Signature': inst.sign(message) } });
}
const batch = (id, events) => ({ batchId: id, events });
const event = (type = 'enforcement', data = { action: 'block', domain: 'phish.example', enforced: true }) => ({ type, at: new Date().toISOString(), data });

describe('telemetry batches (DEV-04)', () => {
  test('a batch is stored once, even when it is sent again after a lost acknowledgement', async () => {
    const { inst, deviceId } = await enrolled();
    const path = `/api/v1/devices/${deviceId}/telemetry`;
    const body = batch('batch-0001', [event(), event('capability_change', { name: 'hosts_blocking', from: 'ok', to: 'denied' })]);
    const first = await signed(inst, deviceId, path, body, 1);
    expect(first.body.data).toEqual({ batchId: 'batch-0001', accepted: 2, stored: 2, duplicates: 0 });
    const again = await signed(inst, deviceId, path, body, 2);
    expect(again.body.data).toEqual({ batchId: 'batch-0001', accepted: 2, stored: 0, duplicates: 2 });
    expect(DeviceEvent.docs).toHaveLength(2);
    // the same request with the same sequence again is a replay, refused before anything is stored
    expect((await signed(inst, deviceId, path, body, 2)).body.code).toBe('DEVICE_REPLAY');

    const events = await call('GET', `/api/v1/devices/${deviceId}/events`, { as: alice });
    expect(events.body.data.events.map(e => e.type).sort()).toEqual(['capability_change', 'enforcement']);
    expect((await call('GET', `/api/v1/devices/${deviceId}/events`, { as: bob })).status).toBe(404);
  });

  test('a batch with a bad event is refused whole, and stores nothing', async () => {
    const { inst, deviceId } = await enrolled();
    const path = `/api/v1/devices/${deviceId}/telemetry`;
    const bads = [
      { type: 'keystrokes', at: new Date().toISOString(), data: {} },
      { type: 'enforcement', at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(), data: {} },
      { type: 'enforcement', at: new Date().toISOString(), data: { blob: 'x'.repeat(3000) } },
      { type: 'enforcement', at: new Date().toISOString(), data: [1, 2] }
    ];
    for (const [n, bad] of bads.entries()) {
      const response = await signed(inst, deviceId, path, batch(`bad-batch-${n}`, [event(), bad]), n + 1);
      expect(response.body.code).toBe('TELEMETRY_EVENT_INVALID');
    }
    expect((await signed(inst, deviceId, path, batch('short', [event()]), 10)).body.code).toBe('TELEMETRY_BATCH_INVALID');
    expect((await signed(inst, deviceId, path, batch('too-many-events', Array.from({ length: 101 }, () => event())), 11)).body.code).toBe('TELEMETRY_BATCH_INVALID');
    expect(DeviceEvent.docs).toHaveLength(0);
  });

  test('one device cannot send telemetry as another, and a revoked one cannot send any', async () => {
    const a = await enrolled();
    const b = await enrolled();
    const asOther = await signed(a.inst, a.deviceId, `/api/v1/devices/${b.deviceId}/telemetry`, batch('batch-0002', [event()]), 1);
    expect(asOther.body.code).toBe('DEVICE_MISMATCH');
    await call('POST', `/api/v1/devices/${a.deviceId}/revoke`, { as: alice });
    expect((await signed(a.inst, a.deviceId, `/api/v1/devices/${a.deviceId}/telemetry`, batch('batch-0003', [event()]), 2)).body.code).toBe('DEVICE_REVOKED');
    expect(DeviceEvent.docs).toHaveLength(0);
  });
});

describe('key rotation (DEV-04)', () => {
  const proofFor = (newInst, deviceId, keyVersion) =>
    newInst.sign(deviceService.rotateMessage({ deviceId, keyVersion, publicKey: newInst.publicKey }));

  test('a device rotates with its current key and a proof from the new one; the old key then stops working', async () => {
    const { inst, deviceId } = await enrolled();
    const next = installation(inst.installationId);
    const rotated = await signed(inst, deviceId, `/api/v1/devices/${deviceId}/rotate-key`, { publicKey: next.publicKey, proof: proofFor(next, deviceId, 2) }, 1);
    expect(rotated.body.data).toMatchObject({ deviceId, keyVersion: 2, keyFingerprint: deviceService.keyFingerprint(next.publicKey) });
    expect((await heartbeat(inst, deviceId, { seq: 2 })).body.code).toBe('DEVICE_SIGNATURE_INVALID');
    expect((await heartbeat(next, deviceId, { seq: 3 })).status).toBe(200);
    expect(AuditEvent.docs.map(e => e.action)).toContain('device.key_rotate');
  });

  test('a rotation without the new key\'s proof, or for the wrong version, changes nothing', async () => {
    const { inst, deviceId } = await enrolled();
    const next = installation();
    for (const [seq, proof] of [[1, inst.sign('anything')], [2, proofFor(next, deviceId, 5)], [3, undefined]]) {
      const response = await signed(inst, deviceId, `/api/v1/devices/${deviceId}/rotate-key`, { publicKey: next.publicKey, proof }, seq);
      expect(response.body.code).toBe('DEVICE_KEY_PROOF_INVALID');
    }
    expect(Device.docs[0].keyVersion).toBe(1);
    expect((await heartbeat(inst, deviceId, { seq: 4 })).status).toBe(200);
  });

  test('two rotations at once: only one applies', async () => {
    const { inst, deviceId } = await enrolled();
    const [x, y] = [installation(), installation()];
    const results = await Promise.all([
      signed(inst, deviceId, `/api/v1/devices/${deviceId}/rotate-key`, { publicKey: x.publicKey, proof: proofFor(x, deviceId, 2) }, 10),
      signed(inst, deviceId, `/api/v1/devices/${deviceId}/rotate-key`, { publicKey: y.publicKey, proof: proofFor(y, deviceId, 2) }, 11)
    ]);
    expect(results.filter(r => r.status === 200)).toHaveLength(1);
    expect(Device.docs[0].keyVersion).toBe(2);
  });
});

describe('coverage (DEV-03)', () => {
  test('an online device whose checks deny a capability is degraded, apart from being online', async () => {
    const { inst, deviceId } = await enrolled();
    const before = (await call('GET', `/api/v1/devices/${deviceId}`, { as: alice })).body.data;
    expect(before).toMatchObject({ coverage: 'unknown', degradedBy: [] });
    const degraded = (await heartbeat(inst, deviceId, { seq: 1 })).body.data.device; // reports hosts_blocking: denied
    expect(degraded).toMatchObject({ connection: 'online', coverage: 'degraded', degradedBy: ['hosts_blocking'] });
    const full = (await heartbeat(inst, deviceId, { seq: 2, body: { capabilities: { browser_history: 'ok', hosts_blocking: 'ok' } } })).body.data.device;
    expect(full).toMatchObject({ connection: 'online', coverage: 'full', degradedBy: [] });
  });
});

test('claims are limited per address: the 21st within 15 minutes is refused', async () => {
  const statuses = [];
  for (let i = 0; i < 21; i += 1) {
    statuses.push((await call('POST', '/api/v1/device-enrollments/claim', { body: { code: 'not-a-code' } })).status);
  }
  expect(statuses.slice(0, 20).every(status => status === 400)).toBe(true);
  expect(statuses[20]).toBe(429);
});
