// Commands to devices (DEV-05): one exact, approved action; delivered only to
// that active device before it expires, signed by the server; done only on the
// device's signed receipt. Through the real routes, session check and repository.
process.env.DEVICE_COMMAND_KEY = Buffer.alloc(32, 9).toString('base64');
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
jest.mock('../../src/models/DeviceCommand', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['commandId'] }, { fields: ['workspaceId', 'idempotencyKey'] }] }),
  { TYPES: ['block_domain', 'unblock_domain'], STATES: ['queued', 'delivered', 'applied', 'failed', 'expired', 'cancelled'], RETENTION_DAYS: 90 }
));
jest.mock('../../src/models/DeviceEvent', () => Object.assign(require('../helpers/fakeCollection').fakeCollection(), { TYPES: ['enforcement'], RETENTION_DAYS: 30 }));
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
const DeviceCommand = require('../../src/models/DeviceCommand');
const AuditEvent = require('../../src/models/AuditEvent');
const { signSessionToken } = require('../../src/services/sessionTokens');
const deviceService = require('../../src/services/deviceService');
const { commandMessage } = require('../../src/services/deviceCommandService');
const devicesRouter = require('../../src/routes/devices');

const account = (id, email) => ({ _id: id, email, role: 'user', isActive: true, isLocked: () => false, activity: {}, save: jest.fn() });
const alice = account('507f1f77bcf86cd799439011', 'alice@example.com');
const bob = account('507f1f77bcf86cd799439012', 'bob@example.com');

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
  Device.reset(); DeviceEnrollment.reset(); DeviceCommand.reset(); AuditEvent.reset();
  for (const key of ['127.0.0.1', '::ffff:127.0.0.1', '::1']) devicesRouter.claimLimiter.resetKey(key);
  User.findById.mockImplementation(async id => [alice, bob].find(u => u._id === String(id)) || null);
  process.env.DEVICE_COMMAND_KEY = Buffer.alloc(32, 9).toString('base64');
});

async function call(method, path, { as, body, headers = {}, raw } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(as ? { Authorization: `Bearer ${signSessionToken(as)}` } : {}), ...headers },
    body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}
function installation() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    installationId: crypto.randomBytes(12).toString('hex'),
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64'),
    sign: message => crypto.sign(null, Buffer.from(message, 'utf8'), privateKey).toString('base64')
  };
}
let seq = 0;
function signed(inst, deviceId, path, body = {}) {
  seq += 1;
  const raw = JSON.stringify(body);
  const timestamp = Date.now();
  const message = deviceService.requestMessage({ method: 'POST', path, deviceId, timestamp, seq, bodyDigest: deviceService.bodyDigest(Buffer.from(raw)) });
  return call('POST', path, { raw, headers: { 'X-CF-Device': deviceId, 'X-CF-Timestamp': String(timestamp), 'X-CF-Seq': String(seq), 'X-CF-Signature': inst.sign(message) } });
}
async function enrolled({ approve = true, capabilities = ['browser_history', 'hosts_blocking'] } = {}) {
  const inst = installation();
  const { code } = (await call('POST', '/api/v1/device-enrollments', { as: alice, body: { flow: 'pair' } })).body.data;
  const normalized = deviceService.normalizeCode(code);
  const claimed = (await call('POST', '/api/v1/device-enrollments/claim', { body: {
    code, installationId: inst.installationId, publicKey: inst.publicKey, platform: 'windows', displayName: 'Laptop', capabilities,
    signature: inst.sign(deviceService.claimMessage({ code: normalized, installationId: inst.installationId, publicKey: inst.publicKey }))
  } })).body.data;
  if (approve) await call('POST', `/api/v1/devices/${claimed.deviceId}/approve`, { as: alice, body: { keyFingerprint: claimed.keyFingerprint } });
  return { inst, deviceId: claimed.deviceId, serverCommandKey: claimed.serverCommandKey };
}
const send = (deviceId, body, as = alice) => call('POST', `/api/v1/devices/${deviceId}/commands`, { as, body: { type: 'block_domain', domain: 'phish.example', idempotencyKey: crypto.randomUUID(), ...body } });
const pull = d => signed(d.inst, d.deviceId, `/api/v1/devices/${d.deviceId}/commands/pull`);
const receipt = (d, commandId, body) => signed(d.inst, d.deviceId, `/api/v1/devices/${d.deviceId}/commands/${commandId}/receipt`, body);
const verifyServer = (key, command, deviceId) => crypto.verify(null, Buffer.from(commandMessage({ ...command, deviceId }), 'utf8'),
  crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(key, 'base64')]), format: 'der', type: 'spki' }),
  Buffer.from(command.signature, 'base64'));

test('without a signing key, commands are not available', async () => {
  const d = await enrolled();
  delete process.env.DEVICE_COMMAND_KEY;
  expect((await send(d.deviceId)).body.code).toBe('COMMANDS_NOT_CONFIGURED');
});

test('a command goes only to an approved device that offers the capability', async () => {
  const pending = await enrolled({ approve: false });
  expect((await send(pending.deviceId)).body.code).toBe('DEVICE_NOT_ACTIVE');
  const withoutHosts = await enrolled({ capabilities: ['browser_history'] });
  expect((await send(withoutHosts.deviceId)).body.code).toBe('DEVICE_CAPABILITY_MISSING');
  const inventory = (await call('POST', '/api/v1/devices', { as: alice, body: { displayName: 'Printer' } })).body.data;
  expect((await send(inventory.deviceId)).body.code).toBe('DEVICE_NOT_ACTIVE');
  const d = await enrolled();
  expect((await send(d.deviceId, { domain: 'not a domain' })).body.code).toBe('COMMAND_DOMAIN_INVALID');
  expect((await send(d.deviceId, { type: 'wipe_disk' })).body.code).toBe('COMMAND_TYPE_INVALID');
  expect((await send(d.deviceId, {}, bob)).status).toBe(404);
});

test('the same request twice creates one command; the key cannot be reused for another', async () => {
  const d = await enrolled();
  const first = await send(d.deviceId, { idempotencyKey: 'key-00000001' });
  const again = await send(d.deviceId, { idempotencyKey: 'key-00000001' });
  expect([first.status, again.status]).toEqual([201, 200]);
  expect(again.body.data.commandId).toBe(first.body.data.commandId);
  expect((await send(d.deviceId, { idempotencyKey: 'key-00000001', domain: 'other.example' })).body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  expect(DeviceCommand.docs).toHaveLength(1);
});

test('a device receives its command once, signed by the key it was given at enrollment, and it counts as done only on its receipt', async () => {
  const d = await enrolled();
  expect(d.serverCommandKey).toMatch(/^[A-Za-z0-9+/]{43}=$/);
  const created = (await send(d.deviceId)).body.data;
  expect(created.state).toBe('queued');

  const pulled = (await pull(d)).body.data;
  expect(pulled.serverKey).toBe(d.serverCommandKey);
  expect(pulled.commands).toHaveLength(1);
  expect(verifyServer(d.serverCommandKey, pulled.commands[0], d.deviceId)).toBe(true);
  // the signature covers the device: it does not verify for another one
  expect(verifyServer(d.serverCommandKey, pulled.commands[0], 'another-device')).toBe(false);
  expect((await pull(d)).body.data.commands).toHaveLength(0);

  const listed = (await call('GET', `/api/v1/devices/${d.deviceId}/commands`, { as: alice })).body.data.commands;
  expect(listed[0]).toMatchObject({ state: 'delivered', receipt: null });

  const done = await receipt(d, created.commandId, { status: 'applied', executor: 'hosts_file', detail: 'enforced' });
  expect(done.body.data).toMatchObject({ state: 'applied', receipt: { status: 'applied', executor: 'hosts_file' } });
  expect((await receipt(d, created.commandId, { status: 'applied' })).status).toBe(200); // the same receipt again
  expect((await receipt(d, created.commandId, { status: 'failed' })).body.code).toBe('COMMAND_NOT_DELIVERED');
  expect(AuditEvent.docs.map(e => e.action)).toEqual(expect.arrayContaining(['device.command_create', 'device.command_receipt']));
});

test('a receipt is taken only from the device the command was for, and only after delivery', async () => {
  const d = await enrolled();
  const other = await enrolled();
  const created = (await send(d.deviceId)).body.data;
  expect((await receipt(d, created.commandId, { status: 'applied' })).body.code).toBe('COMMAND_NOT_DELIVERED');
  await pull(d);
  expect((await receipt(other, created.commandId, { status: 'applied' })).status).toBe(404);
  expect((await receipt(d, created.commandId, { status: 'maybe' })).body.code).toBe('RECEIPT_INVALID');
});

test('stale work never starts: expired, cancelled, or for a revoked device', async () => {
  const d = await enrolled();
  const expired = (await send(d.deviceId, { domain: 'expired.example' })).body.data;
  DeviceCommand.docs.find(c => c.commandId === expired.commandId).expiresAt = new Date(Date.now() - 1000);
  const cancelled = (await send(d.deviceId, { domain: 'cancelled.example' })).body.data;
  expect((await call('DELETE', `/api/v1/devices/${d.deviceId}/commands/${cancelled.commandId}`, { as: bob })).status).toBe(404);
  expect((await call('DELETE', `/api/v1/devices/${d.deviceId}/commands/${cancelled.commandId}`, { as: alice })).body.data.state).toBe('cancelled');
  expect((await pull(d)).body.data.commands).toHaveLength(0);
  const states = (await call('GET', `/api/v1/devices/${d.deviceId}/commands`, { as: alice })).body.data.commands.map(c => `${c.domain}:${c.state}`).sort();
  expect(states).toEqual(['cancelled.example:cancelled', 'expired.example:expired']);

  const queuedForRevoked = (await send(d.deviceId, { domain: 'late.example' })).body.data;
  await call('POST', `/api/v1/devices/${d.deviceId}/revoke`, { as: alice });
  expect((await pull(d)).body.code).toBe('DEVICE_REVOKED');
  expect(DeviceCommand.docs.find(c => c.commandId === queuedForRevoked.commandId).state).toBe('queued');
  expect((await send(d.deviceId, { domain: 'after.example' })).body.code).toBe('DEVICE_NOT_ACTIVE');
});

test('a delivered command cannot be cancelled: it may already be running', async () => {
  const d = await enrolled();
  const created = (await send(d.deviceId)).body.data;
  await pull(d);
  expect((await call('DELETE', `/api/v1/devices/${d.deviceId}/commands/${created.commandId}`, { as: alice })).body.code).toBe('COMMAND_NOT_QUEUED');
});
