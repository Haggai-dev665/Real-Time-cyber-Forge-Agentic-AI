// SEC-07: export of an account's data, deletion of chosen kinds of it, and
// account deletion with a receipt, through the real routes, the real session
// check and the workspace repository. Every store is an in-memory stand-in.
jest.mock('../../src/models/User', () => ({ findById: jest.fn(), deleteOne: jest.fn() }));
jest.mock('../../src/services/workspaceService', () => ({
  ensurePersonalWorkspace: jest.fn(async user => `ws-${user._id}`),
  workspaceIdFor: jest.fn(async principal => (principal && principal.userId ? (principal.workspaceId || `ws-${principal.userId}`) : null)),
  activeMembership: jest.fn(async (workspaceId, userId) => (workspaceId === `ws-${userId}` ? { role: 'owner' } : null))
}));
const mockFake = () => require('../helpers/fakeCollection').fakeCollection();
jest.mock('../../src/models/SyncedMemory', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['workspaceId', 'memoryId'] }] }),
  { RETENTION_DAYS: 365, MAX_PER_WORKSPACE: 5000 }
));
jest.mock('../../src/models/AuditEvent', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection(),
  { OUTCOMES: ['success', 'failure', 'warning'], RETENTION_DAYS: 90 }
));
jest.mock('../../src/models/Threat', () => mockFake());
jest.mock('../../src/models/Analysis', () => mockFake());
jest.mock('../../src/models/SandboxScan', () => mockFake());
jest.mock('../../src/models/ResponseAction', () => mockFake());
jest.mock('../../src/models/FindingException', () => mockFake());
jest.mock('../../src/models/AlertDecision', () => mockFake());
jest.mock('../../src/models/Agent', () => mockFake());
jest.mock('../../src/models/AgentRun', () => mockFake());
jest.mock('../../src/models/AgentAction', () => mockFake());
jest.mock('../../src/models/Device', () => mockFake());
jest.mock('../../src/models/DeviceEnrollment', () => mockFake());
jest.mock('../../src/models/DeviceEvent', () => mockFake());
jest.mock('../../src/models/DeviceCommand', () => mockFake());
jest.mock('../../src/models/Policy', () => mockFake());
jest.mock('../../src/models/Workspace', () => mockFake());
jest.mock('../../src/models/Membership', () => mockFake());
jest.mock('../../src/models/IdentityLink', () => mockFake());
jest.mock('../../src/models/AccountDeletion', () => require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['deletionId'] }] }));
jest.mock('../../src/services/appwriteService', () => ({
  appwriteService: { listAccountDocuments: jest.fn(), deleteAccountDocuments: jest.fn(), deleteAuthUser: jest.fn() }
}));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const fs = require('fs');
const path = require('path');
const express = require('express');
const User = require('../../src/models/User');
const AuditEvent = require('../../src/models/AuditEvent');
const AccountDeletion = require('../../src/models/AccountDeletion');
const Workspace = require('../../src/models/Workspace');
const Membership = require('../../src/models/Membership');
const IdentityLink = require('../../src/models/IdentityLink');
const Policy = require('../../src/models/Policy');
const { appwriteService } = require('../../src/services/appwriteService');
const { signSessionToken } = require('../../src/services/sessionTokens');
const accountData = require('../../src/services/accountDataService');
const accountRouter = require('../../src/routes/accountData');
const captureBuffer = require('../../src/services/networkCaptureBuffer');

const model = name => require(`../../src/models/${name}`);
const account = (id, email, extra = {}) => ({
  _id: id, email, role: 'user', isActive: true, isLocked: () => false, activity: {}, save: jest.fn(),
  passwordHash: 'bcrypt-hash-not-for-export', security: { twoFactorEnabled: false, twoFactorSecret: 'totp-secret-not-for-export', recoveryTokens: ['r1'] },
  ...extra
});
const ALICE = '507f1f77bcf86cd799439011';
const BOB = '507f1f77bcf86cd799439012';
let users;

let base;
let server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', accountRouter);
  app.use('/api/memory', require('../../src/routes/memory'));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));

// Alice and Bob each have one record in every store, plus their workspace,
// membership and sign-in identity.
async function seed() {
  for (const store of accountData.STORES) {
    const Model = model(store.model);
    Model.reset();
    for (const id of [ALICE, BOB]) {
      const owner = store.key === 'workspace' ? { workspaceId: `ws-${id}` } : { [store.field]: id };
      await Model.create({ ...owner, label: `${store.name} of ${id}`, emb: [0.1], publicKey: 'pk', codeHash: 'hash', signature: 'sig' });
    }
  }
  for (const Model of [AuditEvent, AccountDeletion, Workspace, Membership, IdentityLink, Policy]) Model.reset();
  for (const id of [ALICE, BOB]) {
    await Workspace.create({ _id: `ws-${id}`, kind: 'personal', name: 'Personal', ownerUserId: id });
    await Membership.create({ workspaceId: `ws-${id}`, userId: id, role: 'owner', status: 'active' });
    await IdentityLink.create({ userId: id, provider: 'appwrite', subject: `aw-${id}` });
    await AuditEvent.create({ workspaceId: `ws-${id}`, scope: 'workspace', action: 'auth.login', createdAt: new Date() });
  }
  await Policy.create({ policyId: 'p-1', name: 'Block on high risk', createdBy: ALICE, updatedBy: BOB });
  for (const id of [ALICE, BOB]) { captureBuffer.forget(id); captureBuffer.push(id, [{ id: `flow-${id}`, host: 'bank.example' }]); }
}

beforeEach(async () => {
  users = [account(ALICE, 'alice@example.com', { appwriteUserId: 'aw-alice' }), account(BOB, 'bob@example.com')];
  User.findById.mockImplementation(async id => users.find(u => u._id === String(id)) || null);
  User.deleteOne.mockImplementation(async ({ _id }) => {
    const before = users.length;
    users = users.filter(u => u._id !== String(_id));
    return { deletedCount: before - users.length };
  });
  appwriteService.listAccountDocuments.mockResolvedValue({ alerts: { documents: [{ $id: 'a1', user_id: ALICE }], truncated: false } });
  appwriteService.deleteAccountDocuments.mockResolvedValue({ alerts: { removed: 1 }, users: { removed: 1 } });
  appwriteService.deleteAuthUser.mockResolvedValue({ removed: 1 });
  for (const limiter of Object.values(accountRouter.limiters)) {
    for (const key of [`account:${ALICE}`, `account:${BOB}`, '127.0.0.1', '::ffff:127.0.0.1', '::1']) limiter.resetKey(key);
  }
  await seed();
});

async function call(method, url, { as, body } = {}) {
  const response = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(as ? { Authorization: `Bearer ${signSessionToken(as)}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
const alice = () => users.find(u => u._id === ALICE) || account(ALICE, 'alice@example.com');
const bob = () => users.find(u => u._id === BOB);
const left = (store, id) => model(store.model).docs.filter(doc => String(store.key === 'workspace' ? doc.workspaceId : doc[store.field]) === (store.key === 'workspace' ? `ws-${id}` : id)).length;

describe('the list of stores', () => {
  test('every model is either an account store or listed as not personal, with a reason', () => {
    const files = fs.readdirSync(path.join(__dirname, '..', '..', 'src', 'models')).filter(f => f.endsWith('.js') && f !== 'index.js').map(f => f.replace(/\.js$/, ''));
    const placed = [...accountData.STORES.map(store => store.model), ...Object.keys(accountData.NOT_PERSONAL)];
    expect(files.filter(name => !placed.includes(name))).toEqual([]);
    expect(placed.filter(name => !files.includes(name))).toEqual([]);
    for (const reason of Object.values(accountData.NOT_PERSONAL)) expect(reason.length).toBeGreaterThan(10);
  });
});

describe('export', () => {
  test('holds the account\'s own records from every store, and none of another account\'s', async () => {
    const response = await call('GET', '/api/v1/me/export', { as: alice() });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toMatch(/^attachment; filename="cyberforge-export-/);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const data = response.body.data;
    expect(data.format).toBe('cyberforge-account-export-v1');
    expect(data.account).toMatchObject({ id: ALICE, email: 'alice@example.com' });
    for (const store of accountData.STORES) {
      expect(data.stores[store.name].records).toHaveLength(1);
      expect(data.stores[store.name].records[0].label).toBe(`${store.name} of ${ALICE}`);
    }
    expect(data.audit_events.records).toHaveLength(1);
    expect(data.identities).toEqual([expect.objectContaining({ provider: 'appwrite', subject: `aw-${ALICE}` })]);
    expect(data.appwrite.alerts.documents).toHaveLength(1);
    expect(data.network_capture_buffer).toEqual([{ id: `flow-${ALICE}`, host: 'bank.example' }]);
    expect(appwriteService.listAccountDocuments).toHaveBeenCalledWith(ALICE, 'aw-alice', expect.any(Object));

    const text = JSON.stringify(data);
    expect(text).not.toContain(BOB);
    for (const secret of ['bcrypt-hash-not-for-export', 'totp-secret-not-for-export', 'passwordHash', 'recoveryTokens']) expect(text).not.toContain(secret);
    expect(data.stores.devices.records[0].publicKey).toBeUndefined();
    expect(data.stores.device_enrollments.records[0].codeHash).toBeUndefined();
    expect(data.stores.device_commands.records[0].signature).toBeUndefined();
    expect(data.stores.synced_memories.records[0].emb).toBeUndefined();
    expect(AuditEvent.docs.some(e => e.action === 'account.export' && e.workspaceId === `ws-${ALICE}`)).toBe(true);
  });

  test('still answers when Appwrite cannot be reached, and says so', async () => {
    appwriteService.listAccountDocuments.mockRejectedValue(new Error('connect ETIMEDOUT'));
    const response = await call('GET', '/api/v1/me/export', { as: alice() });
    expect(response.status).toBe(200);
    expect(response.body.data.appwrite.error).toMatch(/not reachable/);
  });

  test('needs a session, and is limited to five an hour per account', async () => {
    expect((await call('GET', '/api/v1/me/export')).status).toBe(401);
    for (let i = 0; i < 5; i++) expect((await call('GET', '/api/v1/me/export', { as: alice() })).status).toBe(200);
    expect((await call('GET', '/api/v1/me/export', { as: alice() })).status).toBe(429);
    expect((await call('GET', '/api/v1/me/export', { as: bob() })).status).toBe(200);
  });
});

describe('deleting data, keeping the account', () => {
  test('each scope removes only its own stores, and only this account\'s records', async () => {
    const memory = await call('DELETE', '/api/v1/me/data?scope=memory', { as: alice() });
    expect(memory.status).toBe(200);
    expect(memory.body.data).toMatchObject({ scope: 'memory', complete: true, results: { synced_memories: { removed: 1 } } });
    for (const store of accountData.STORES) {
      expect(left(store, ALICE)).toBe(store.scope === 'memory' ? 0 : 1);
      expect(left(store, BOB)).toBe(1);
    }

    const scans = await call('DELETE', '/api/v1/me/data?scope=scans', { as: alice() });
    expect(Object.keys(scans.body.data.results).sort()).toEqual(['alert_decisions', 'analyses', 'finding_exceptions', 'response_actions', 'sandbox_scans', 'threats']);
    for (const store of accountData.STORES.filter(s => s.scope === 'scans')) expect(left(store, ALICE)).toBe(0);
    expect(appwriteService.deleteAccountDocuments).not.toHaveBeenCalled();
    expect(users.map(u => u._id)).toContain(ALICE);
    expect(AuditEvent.docs.filter(e => e.action === 'account.data_delete')).toHaveLength(2);
  });

  test('scope=all also removes the Appwrite documents, but not the sign-in record', async () => {
    const all = await call('DELETE', '/api/v1/me/data?scope=all', { as: alice() });
    expect(all.status).toBe(200);
    for (const store of accountData.STORES) expect(left(store, ALICE)).toBe(0);
    expect(appwriteService.deleteAccountDocuments).toHaveBeenCalledWith(ALICE, null);
    expect(appwriteService.deleteAuthUser).not.toHaveBeenCalled();
    expect(all.body.data.results['appwrite.alerts']).toEqual({ removed: 1 });
  });

  test('an unknown scope is refused and nothing is removed', async () => {
    const response = await call('DELETE', '/api/v1/me/data?scope=everything', { as: alice() });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_SCOPE');
    for (const store of accountData.STORES) expect(left(store, ALICE)).toBe(1);
  });
});

describe('deleting the account', () => {
  test('without the email typed as confirmation, nothing happens', async () => {
    for (const confirm of [undefined, '', 'bob@example.com']) {
      const response = await call('POST', '/api/v1/me/delete-account', { as: alice(), body: { confirm } });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('CONFIRMATION_REQUIRED');
    }
    expect(AccountDeletion.docs).toHaveLength(0);
    for (const store of accountData.STORES) expect(left(store, ALICE)).toBe(1);
  });

  test('removes every store, Appwrite and the account; leaves the other account; gives a public receipt', async () => {
    const session = alice();
    const response = await call('POST', '/api/v1/me/delete-account', { as: session, body: { confirm: ' Alice@Example.com ' } });
    expect(response.status).toBe(200);
    const receipt = response.body.data;
    expect(receipt.state).toBe('completed');
    expect(receipt.failed).toEqual([]);
    expect(receipt.deletionId).toMatch(/^del_[A-Za-z0-9_-]{24}$/);

    for (const store of accountData.STORES) {
      expect(left(store, ALICE)).toBe(0);
      expect(left(store, BOB)).toBe(1);
      expect(receipt.results[store.name]).toEqual({ removed: 1 });
    }
    expect(appwriteService.deleteAccountDocuments).toHaveBeenCalledWith(ALICE, 'aw-alice');
    expect(appwriteService.deleteAuthUser).toHaveBeenCalledWith('aw-alice');
    expect(Membership.docs.map(m => m.userId)).toEqual([BOB]);
    expect(IdentityLink.docs.map(l => l.userId)).toEqual([BOB]);
    expect(Workspace.docs.map(w => w._id)).toEqual([`ws-${BOB}`]);
    expect(users.map(u => u._id)).toEqual([BOB]);
    expect(Policy.docs[0]).toMatchObject({ createdBy: 'deleted-account', updatedBy: BOB });
    expect(receipt.results.network_capture_buffer).toEqual({ removed: 1 });
    expect(captureBuffer.get(ALICE)).toEqual([]);
    expect(captureBuffer.get(BOB)).toHaveLength(1);

    // the receipt holds no email address, and says what is kept
    const stored = JSON.stringify(AccountDeletion.docs[0]);
    expect(stored).not.toMatch(/alice@example\.com/i);
    expect(AccountDeletion.docs[0].emailHash).toBe(accountData.emailHash('alice@example.com'));
    expect(receipt.kept.join(' ')).toMatch(/90-day retention/);

    // the audit trail stays: the workspace's events, and a platform event for the deletion
    expect(AuditEvent.docs.some(e => e.workspaceId === `ws-${ALICE}` && e.action === 'auth.login')).toBe(true);
    expect(AuditEvent.docs.find(e => e.action === 'account.delete')).toMatchObject({ scope: 'platform', workspaceId: null, outcome: 'success' });

    // the old session no longer works; the receipt is readable without one
    expect((await call('GET', '/api/v1/me/export', { as: session })).status).toBe(401);
    const read = await call('GET', `/api/v1/account-deletions/${receipt.deletionId}`);
    expect(read.status).toBe(200);
    expect(read.body.data).toMatchObject({ deletionId: receipt.deletionId, state: 'completed' });
  });

  test('when a store fails, the receipt is partial, the account is kept, and asking again finishes', async () => {
    appwriteService.deleteAccountDocuments.mockResolvedValueOnce({ alerts: { removed: 0, error: 'timeout' } });
    const first = await call('POST', '/api/v1/me/delete-account', { as: alice(), body: { confirm: 'alice@example.com' } });
    expect(first.status).toBe(207);
    expect(first.body.data.state).toBe('partial');
    expect(first.body.data.failed).toEqual(expect.arrayContaining(['appwrite.alerts', 'account']));
    expect(users.map(u => u._id)).toContain(ALICE);
    expect(Membership.docs.some(m => m.userId === ALICE)).toBe(true);
    expect(AuditEvent.docs.find(e => e.action === 'account.delete').outcome).toBe('warning');

    const second = await call('POST', '/api/v1/me/delete-account', { as: alice(), body: { confirm: 'alice@example.com' } });
    expect(second.status).toBe(200);
    expect(second.body.data.state).toBe('completed');
    expect(users.map(u => u._id)).toEqual([BOB]);
    expect((await call('GET', `/api/v1/account-deletions/${first.body.data.deletionId}`)).body.data.state).toBe('partial');
  });

  test('a receipt ID that is malformed or unknown answers 404', async () => {
    expect((await call('GET', '/api/v1/account-deletions/anything')).status).toBe(404);
    expect((await call('GET', `/api/v1/account-deletions/del_${'A'.repeat(24)}`)).status).toBe(404);
  });
});

describe('synced memory', () => {
  test('is kept in the workspace store; saving an ID again replaces that entry', async () => {
    model('SyncedMemory').reset();
    await call('POST', '/api/memory/save', { as: alice(), body: { id: 'm-1', text: 'first version', kind: 'semantic' } });
    await call('POST', '/api/memory/save', { as: alice(), body: { id: 'm-1', text: 'second version', kind: 'semantic' } });
    const docs = model('SyncedMemory').docs;
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ workspaceId: `ws-${ALICE}`, memoryId: 'm-1', text: 'second version', createdBy: ALICE });
    const listed = await call('GET', '/api/memory', { as: alice() });
    expect(listed.body.data).toMatchObject({ total: 1, semantic: 1, retentionDays: 365 });
    expect(listed.body.data.memories[0]).toEqual(expect.objectContaining({ id: 'm-1', text: 'second version' }));
    const found = await call('POST', '/api/memory/search', { as: alice(), body: { query: 'second version' } });
    expect(found.body.data.results[0].id).toBe('m-1');
    expect((await call('GET', '/api/memory', { as: bob() })).body.data.total).toBe(0);
  });
});
