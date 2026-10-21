// SEC-08: signed checkpoints over the audit trail, the check against them, and
// evidence exported with a signed manifest. In-memory stand-ins for the stores.
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/services/workspaceService', () => ({
  ensurePersonalWorkspace: jest.fn(async user => `ws-${user._id}`),
  workspaceIdFor: jest.fn(async principal => (principal && principal.userId ? (principal.workspaceId || `ws-${principal.userId}`) : null)),
  activeMembership: jest.fn(async (workspaceId, userId) => (workspaceId === `ws-${userId}` ? { role: 'owner' } : null))
}));
jest.mock('../../src/models/AuditEvent', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection(),
  { OUTCOMES: ['success', 'failure', 'warning'], RETENTION_DAYS: 90 }
));
jest.mock('../../src/models/AuditCheckpoint', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['checkpointId'] }] }),
  { RETENTION_DAYS: 91 }
));
jest.mock('../../src/models/SandboxScan', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['scanId'] }] }),
  { VERDICTS: ['clean', 'suspicious', 'malicious', 'unknown'], RETENTION_DAYS: 90 }
));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/services/cyberforgeMLService', () => ({ cyberforgeML: {} }));

const crypto = require('crypto');
const express = require('express');
const User = require('../../src/models/User');
const AuditEvent = require('../../src/models/AuditEvent');
const AuditCheckpoint = require('../../src/models/AuditCheckpoint');
const SandboxScan = require('../../src/models/SandboxScan');
const auditLog = require('../../src/services/auditLogService');
const integrity = require('../../src/services/auditIntegrityService');
const { verifySignature } = require('../../src/services/integrityKey');
const { sandboxAnalysisService } = require('../../src/services/sandboxAnalysisService');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { serve } = require('../helpers/http');

const account = (id, role = 'user') => ({ _id: id, email: `${id}@example.com`, role, isActive: true, isLocked: () => false, activity: {}, save: jest.fn() });
const alice = account('507f1f77bcf86cd799439011');
const bob = account('507f1f77bcf86cd799439012');
const admin = account('507f1f77bcf86cd799439013', 'admin');
const principal = user => ({ userId: user._id, workspaceId: `ws-${user._id}` });
const later = () => Date.now() + 5 * 60 * 1000; // past the settling margin

let client;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/audit', require('../../src/routes/audit'));
  app.use('/api/sandbox', require('../../src/routes/sandbox'));
  client = await serve(app);
});
afterAll(() => client.close());
beforeEach(() => {
  process.env.AUDIT_SIGNING_KEY = Buffer.alloc(32, 5).toString('base64');
  for (const m of [AuditEvent, AuditCheckpoint, SandboxScan]) m.reset();
  User.findById.mockImplementation(async id => [alice, bob, admin].find(u => u._id === String(id)) || null);
});
const as = (user, path, options = {}) => client.request(path, { ...options, headers: { Authorization: `Bearer ${signSessionToken(user)}` } });
async function events(user, n) {
  for (let i = 0; i < n; i++) {
    await auditLog.record({ principal: principal(user), action: 'policy.update', resource: `thing ${i}`, details: { n: i } });
    await new Promise(resolve => setTimeout(resolve, 3)); // distinct times, as real events have
  }
}
const workspaceEvents = user => AuditEvent.docs.filter(e => e.workspaceId === `ws-${user._id}`);

describe('content hashes and checkpoints', () => {
  test('every recorded event carries a content hash of its fields', async () => {
    await events(alice, 2);
    for (const e of workspaceEvents(alice)) expect(e.contentHash).toBe(auditLog.contentHashOf(e));
  });

  test('a checkpoint covers the events since the last one, chains to it, and is signed', async () => {
    await events(alice, 3);
    const first = await integrity.checkpoint('workspace', `ws-${alice._id}`, later());
    expect(first).toMatchObject({ count: 3, previousCheckpointId: null, from: null });
    expect(verifySignature(require('../../src/services/integrityKey').integritySigner().publicKey, integrity.message(first), first.signature)).toBe(true);
    expect(await integrity.checkpoint('workspace', `ws-${alice._id}`, later())).toBeNull(); // nothing new
    await events(alice, 2);
    const second = await integrity.checkpoint('workspace', `ws-${alice._id}`, later());
    expect(second).toMatchObject({ count: 2, previousCheckpointId: first.checkpointId, previousRootHash: first.rootHash });
    expect(new Date(second.from).getTime()).toBe(new Date(first.to).getTime());
  });

  test('events from the last minute wait for the next checkpoint', async () => {
    await events(alice, 2);
    expect(await integrity.checkpoint('workspace', `ws-${alice._id}`, Date.now())).toBeNull();
  });
});

describe('checking the trail', () => {
  test('an untouched trail is intact, and another workspace\'s events are not counted', async () => {
    await events(alice, 3);
    await events(bob, 4);
    const result = await integrity.verify('workspace', `ws-${alice._id}`, later());
    expect(result).toMatchObject({ available: true, intact: true, checkpoints: 1, eventsCovered: 3, eventsNotYetCovered: 0, problems: [] });
  });

  test('a changed, removed or added event is found', async () => {
    await events(alice, 4);
    await integrity.checkpoint('workspace', `ws-${alice._id}`, later());
    const [first, second] = workspaceEvents(alice);

    first.details = { n: 99 };          // changed
    let result = await integrity.verify('workspace', `ws-${alice._id}`, later());
    expect(result.intact).toBe(false);
    expect(result.problems[0]).toMatchObject({ state: 'altered', changedEventIds: [String(first._id)] });

    first.details = { n: 0 };           // restored
    expect((await integrity.verify('workspace', `ws-${alice._id}`, later())).intact).toBe(true);

    AuditEvent.docs.splice(AuditEvent.docs.indexOf(second), 1); // removed
    result = await integrity.verify('workspace', `ws-${alice._id}`, later());
    expect(result.problems[0]).toMatchObject({ state: 'altered', eventsAtCheckpoint: 4, eventsNow: 3 });
  });

  test('an event slipped into a covered range is found', async () => {
    await events(alice, 2);
    const c = await integrity.checkpoint('workspace', `ws-${alice._id}`, later());
    const inside = new Date(new Date(c.to).getTime() - 1);
    const forged = { scope: 'workspace', workspaceId: `ws-${alice._id}`, actorType: 'system', actorUserId: null, action: 'policy.update', resource: 'forged', outcome: 'success', origin: 'server', details: {}, correlationId: null, ipAddress: null, createdAt: inside };
    await AuditEvent.create({ ...forged, contentHash: auditLog.contentHashOf(forged) }); // even with a correct content hash
    const result = await integrity.verify('workspace', `ws-${alice._id}`, later());
    expect(result.problems[0]).toMatchObject({ state: 'altered', eventsAtCheckpoint: 2, eventsNow: 3 });
  });

  test('a changed checkpoint fails its signature; a removed one breaks the chain', async () => {
    await events(alice, 1); await integrity.checkpoint('workspace', `ws-${alice._id}`, later());
    await events(alice, 1); await integrity.checkpoint('workspace', `ws-${alice._id}`, later() + 1000);
    await events(alice, 1); await integrity.checkpoint('workspace', `ws-${alice._id}`, later() + 2000);
    const [, middle, last] = AuditCheckpoint.docs;

    const real = last.count; last.count = 99;
    expect((await integrity.verify('workspace', `ws-${alice._id}`, later() + 3000)).problems.map(p => p.state)).toContain('signature_invalid');
    last.count = real;

    AuditCheckpoint.docs.splice(AuditCheckpoint.docs.indexOf(middle), 1);
    expect((await integrity.verify('workspace', `ws-${alice._id}`, later() + 3000)).problems.map(p => p.state)).toContain('chain_broken');
  });

  test('events recorded before content hashes existed are checked by ID only', async () => {
    await AuditEvent.create({ scope: 'workspace', workspaceId: `ws-${alice._id}`, actorType: 'system', action: 'system.startup', resource: 'old', outcome: 'success', origin: 'server', details: {}, createdAt: new Date() });
    const result = await integrity.verify('workspace', `ws-${alice._id}`, later());
    expect(result).toMatchObject({ intact: true, eventsWithoutContentHash: 1 });
  });

  test('without a signing key nothing is signed, and the route says so', async () => {
    delete process.env.AUDIT_SIGNING_KEY;
    const response = await as(alice, '/api/audit/integrity');
    expect(response.status).toBe(501);
    expect(response.body.data.reason).toMatch(/AUDIT_SIGNING_KEY/);
    expect(AuditCheckpoint.docs).toHaveLength(0);
  });

  test('the route checks the caller\'s workspace; the platform is for administrators', async () => {
    await events(alice, 2);
    const response = await as(alice, '/api/audit/integrity');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ scope: 'workspace', data: { available: true, intact: true } });
    expect((await as(alice, '/api/audit/integrity?scope=platform')).status).toBe(403);
    expect((await as(admin, '/api/audit/integrity?scope=platform')).body.scope).toBe('platform');
  });

  test('a client cannot report an account or evidence event', async () => {
    for (const action of ['account.delete', 'evidence.export']) {
      expect((await as(alice, '/api/audit/log', { method: 'POST', body: { action, resource: 'x' } })).status).toBe(400);
    }
  });
});

describe('evidence export', () => {
  async function scan(user, target) {
    return sandboxAnalysisService._store({
      id: crypto.randomUUID(), type: 'url', target, verdict: 'suspicious', mlReport: { score: 0.6 }, iocs: [], mitre: { techniques: [] },
      findings: ['form posts to another domain'], timeline: [], metadata: {}, durationMs: 12, createdAt: new Date().toISOString()
    }, principal(user));
  }

  test('a signed manifest names each item\'s source, collection time and fingerprint, and verifies', async () => {
    const one = await scan(alice, 'https://a.example');
    await scan(alice, 'https://b.example');
    await scan(bob, 'https://bob.example');
    const exported = (await as(alice, '/api/sandbox/export')).body.data;
    expect(exported.manifest.items).toHaveLength(2);
    expect(exported.manifest.items.find(i => i.id === one.id)).toMatchObject({ kind: 'sandbox_scan', source: 'sandbox url analysis', evidenceHash: one.integrity.evidenceHash, intactAtExport: true });
    expect(exported.manifest.transformations).toEqual([]);
    expect(exported.signature).toMatchObject({ keyId: expect.any(String), publicKey: expect.any(String) });
    expect(AuditEvent.docs.some(e => e.action === 'evidence.export')).toBe(true);

    const check = (await as(alice, '/api/sandbox/export/verify', { method: 'POST', body: { manifest: exported.manifest, signature: exported.signature } })).body.data;
    expect(check).toMatchObject({ valid: true, signature: 'valid', counts: { intact: 2 } });
  });

  test('a changed item, a deleted item and an edited manifest are each reported', async () => {
    const one = await scan(alice, 'https://a.example');
    const two = await scan(alice, 'https://b.example');
    const exported = (await as(alice, '/api/sandbox/export')).body.data;

    SandboxScan.docs.find(d => d.scanId === one.id).verdict = 'clean';            // changed after export
    await sandboxAnalysisService.deleteScan(two.id, principal(alice));             // deleted, leaving its record
    let check = (await as(alice, '/api/sandbox/export/verify', { method: 'POST', body: exported })).body.data;
    expect(check.valid).toBe(false);
    const states = Object.fromEntries(check.items.map(i => [i.id, i]));
    expect(states[one.id].state).toBe('changed');
    expect(states[two.id]).toMatchObject({ state: 'deleted', deletionHashMatches: true, deletedAt: expect.any(String) });

    const edited = JSON.parse(JSON.stringify(exported));
    edited.manifest.items[0].evidenceHash = 'f'.repeat(64);
    check = (await as(alice, '/api/sandbox/export/verify', { method: 'POST', body: edited })).body.data;
    expect(check.signature).toBe('invalid');
  });

  test('another workspace\'s manifest is not looked up', async () => {
    await scan(alice, 'https://a.example');
    const exported = (await as(alice, '/api/sandbox/export')).body.data;
    const check = (await as(bob, '/api/sandbox/export/verify', { method: 'POST', body: exported })).body.data;
    expect(check).toMatchObject({ valid: false, reason: expect.stringMatching(/another workspace/) });
    expect(check.items).toBeUndefined();
  });
});
