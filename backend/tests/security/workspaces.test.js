// Every account has one personal workspace; access to a workspace comes from an
// active membership; an outside identity belongs to one account and is never
// matched by email address (SEC-01, B05, B10; plan section 4.2).
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/models/User', () => require('../helpers/fakeCollection').fakeCollection({
  unique: [{ fields: ['email'] }, { fields: ['firebaseUid'] }],
  methods: { isLocked: () => false }
}));
jest.mock('../../src/models/Workspace', () => require('../helpers/fakeCollection').fakeCollection({
  unique: [{ fields: ['ownerUserId'], where: doc => doc.kind === 'personal' }]
}));
jest.mock('../../src/models/Membership', () => require('../helpers/fakeCollection').fakeCollection({
  unique: [{ fields: ['workspaceId', 'userId'] }]
}));
jest.mock('../../src/models/IdentityLink', () => require('../helpers/fakeCollection').fakeCollection({
  unique: [{ fields: ['provider', 'subject'] }]
}));
jest.mock('../../src/models/MigrationRecord', () => require('../helpers/fakeCollection').fakeCollection({
  unique: [{ fields: ['migrationId'] }]
}));

const express = require('express');
const User = require('../../src/models/User');
const Workspace = require('../../src/models/Workspace');
const Membership = require('../../src/models/Membership');
const IdentityLink = require('../../src/models/IdentityLink');
const MigrationRecord = require('../../src/models/MigrationRecord');
const {
  ensurePersonalWorkspace, activeMembership, linkIdentity, userIdForIdentity, IdentityConflictError
} = require('../../src/services/workspaceService');
const { requireWorkspace } = require('../../src/middleware/workspace');
const { auth } = require('../../src/middleware/auth');
const { runMigrations, loadMigrations, migrationStatus } = require('../../src/migrations/runner');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { serve } = require('../helpers/http');

const account = fields => User.create({ isActive: true, role: 'user', activity: {}, ...fields });
const same = (a, b) => String(a) === String(b);

beforeEach(() => {
  for (const model of [User, Workspace, Membership, IdentityLink, MigrationRecord]) model.reset();
  jest.restoreAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('a personal workspace', () => {
  test('is created once, with an owner membership and a pointer on the account', async () => {
    const alice = await account({ email: 'alice@example.org' });
    const workspaceId = await ensurePersonalWorkspace(alice);
    expect(Workspace.docs).toHaveLength(1);
    expect(Workspace.docs[0]).toMatchObject({ kind: 'personal', name: 'Personal workspace' });
    expect(same(Workspace.docs[0].ownerUserId, alice._id)).toBe(true);
    expect(Membership.docs).toHaveLength(1);
    expect(Membership.docs[0]).toMatchObject({ role: 'owner', status: 'active' });
    expect(same(alice.defaultWorkspaceId, workspaceId)).toBe(true);

    // asked again, nothing more is made
    expect(same(await ensurePersonalWorkspace(alice), workspaceId)).toBe(true);
    expect(Workspace.docs).toHaveLength(1);
    expect(Membership.docs).toHaveLength(1);
  });

  test('is one per account: two accounts get two, and neither is a member of the other\'s', async () => {
    const alice = await account({ email: 'alice@example.org' });
    const bob = await account({ email: 'bob@example.org' });
    const a = await ensurePersonalWorkspace(alice);
    const b = await ensurePersonalWorkspace(bob);
    expect(same(a, b)).toBe(false);
    expect(await activeMembership(a, bob._id)).toBeNull();
    expect(await activeMembership(b, alice._id)).toBeNull();
    expect((await activeMembership(a, alice._id)).role).toBe('owner');
  });

  test('survives two requests creating it at the same moment', async () => {
    const alice = await account({ email: 'alice@example.org' });
    const winner = await Workspace.create({ ownerUserId: alice._id, kind: 'personal', name: 'Personal workspace' });
    // this caller looked before the other one wrote
    jest.spyOn(Workspace, 'findOne').mockReturnValueOnce(Promise.resolve(null));
    expect(same(await ensurePersonalWorkspace(alice), winner._id)).toBe(true);
    expect(Workspace.docs).toHaveLength(1);
  });

  test('has its membership and pointer repaired if either is missing', async () => {
    const alice = await account({ email: 'alice@example.org' });
    const workspaceId = await ensurePersonalWorkspace(alice);
    Membership.reset();
    alice.defaultWorkspaceId = undefined;
    await ensurePersonalWorkspace(alice);
    expect(Membership.docs).toHaveLength(1);
    expect(same(alice.defaultWorkspaceId, workspaceId)).toBe(true);
  });

  test('a suspended membership is not access', async () => {
    const alice = await account({ email: 'alice@example.org' });
    const workspaceId = await ensurePersonalWorkspace(alice);
    Membership.docs[0].status = 'suspended';
    expect(await activeMembership(workspaceId, alice._id)).toBeNull();
    expect(await activeMembership(null, alice._id)).toBeNull();
  });
});

describe('an outside identity', () => {
  test('belongs to the account it was linked to, and linking it again changes nothing', async () => {
    const alice = await account({ email: 'alice@example.org' });
    await linkIdentity(alice._id, 'google', 'google-subject-1', 'sign-in');
    await linkIdentity(alice._id, 'google', 'google-subject-1', 'sign-in');
    expect(IdentityLink.docs).toHaveLength(1);
    expect(same(await userIdForIdentity('google', 'google-subject-1'), alice._id)).toBe(true);
    expect(await userIdForIdentity('google', 'someone-else')).toBeNull();
    expect(await userIdForIdentity('google', '')).toBeNull();
  });

  test('cannot be moved to, or shared with, another account', async () => {
    const alice = await account({ email: 'alice@example.org' });
    const mallory = await account({ email: 'mallory@example.org' });
    await linkIdentity(alice._id, 'google', 'google-subject-1', 'sign-in');
    await expect(linkIdentity(mallory._id, 'google', 'google-subject-1', 'sign-in')).rejects.toBeInstanceOf(IdentityConflictError);
    expect(same(await userIdForIdentity('google', 'google-subject-1'), alice._id)).toBe(true);
  });

  test('the same subject at two providers is two identities', async () => {
    const alice = await account({ email: 'alice@example.org' });
    const bob = await account({ email: 'bob@example.org' });
    await linkIdentity(alice._id, 'google', 'abc', 'sign-in');
    await linkIdentity(bob._id, 'firebase', 'abc', 'sign-in');
    expect(same(await userIdForIdentity('firebase', 'abc'), bob._id)).toBe(true);
  });
});

describe('the workspace on a request', () => {
  let client;
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.post('/scoped', auth, requireWorkspace, (req, res) => res.json({
      principal: { workspaceId: req.user.workspaceId, workspaceRole: req.user.workspaceRole },
      query: req.query.workspaceId,
      body: req.body.workspaceId
    }));
    app.get('/whoami', auth, (req, res) => res.json({ workspaceId: req.user.workspaceId }));
    client = await serve(app);
  });
  afterAll(() => client.close());

  // session tokens carry a 24-hex account ID, as real ones do
  const session = user => ({ Authorization: `Bearer ${signSessionToken(user)}` });

  test('is the caller\'s own, whatever the request names', async () => {
    const alice = await account({ email: 'alice@example.org' });
    const bob = await account({ email: 'bob@example.org' });
    const mine = String(await ensurePersonalWorkspace(alice));
    const theirs = String(await ensurePersonalWorkspace(bob));
    const response = await client.request(`/scoped?workspaceId=${theirs}`, {
      method: 'POST', headers: { ...session(alice), 'X-Workspace-Id': theirs }, body: { workspaceId: theirs }
    });
    expect(response.body).toEqual({ principal: { workspaceId: mine, workspaceRole: 'owner' }, query: mine, body: mine });
  });

  test('an account from before workspaces existed is given one on first use', async () => {
    const legacy = await account({ email: 'legacy@example.org' });
    expect((await client.request('/whoami', { headers: session(legacy) })).body).toEqual({ workspaceId: null });
    const response = await client.request('/scoped', { method: 'POST', headers: session(legacy), body: {} });
    expect(response.status).toBe(200);
    expect(Workspace.docs).toHaveLength(1);
    expect(response.body.principal.workspaceId).toBe(String(Workspace.docs[0]._id));
    expect((await client.request('/whoami', { headers: session(legacy) })).body).toEqual({ workspaceId: String(Workspace.docs[0]._id) });
  });

  test('a suspended member is refused', async () => {
    const alice = await account({ email: 'alice@example.org' });
    await ensurePersonalWorkspace(alice);
    Membership.docs[0].status = 'suspended';
    const response = await client.request('/scoped', { method: 'POST', headers: session(alice), body: {} });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  test('no session, no workspace', async () => {
    expect((await client.request('/scoped', { method: 'POST', body: {} })).status).toBe(401);
  });
});

describe('the migration that gives existing accounts a workspace', () => {
  const seed = async () => {
    const alice = await account({ email: 'alice@example.org', appwriteUserId: 'aw-alice' });
    const bob = await account({ email: 'bob@example.org', appwriteUserId: 'aw-bob', firebaseUid: 'fb-bob' });
    const carol = await account({ email: 'carol@example.org' });
    return { alice, bob, carol };
  };

  test('a dry run reports what it would do and changes nothing', async () => {
    await seed();
    const [result] = await runMigrations({ apply: false });
    expect(result).toMatchObject({
      id: '001-personal-workspaces', state: 'would apply',
      summary: { accounts: 3, workspaces: { created: 3, alreadyPresent: 0 }, identityLinks: { created: 3, alreadyPresent: 0 }, setAside: [] }
    });
    expect(Workspace.docs).toHaveLength(0);
    expect(Membership.docs).toHaveLength(0);
    expect(IdentityLink.docs).toHaveLength(0);
    expect(MigrationRecord.docs).toHaveLength(0);
    expect(User.docs.every(user => user.defaultWorkspaceId === undefined)).toBe(true);
  });

  test('applied, every account has a workspace, a membership and its identities, and it is recorded', async () => {
    const { alice, bob } = await seed();
    const [result] = await runMigrations({ apply: true });
    expect(result.state).toBe('applied');
    expect(result.summary.check).toEqual({ accounts: 3, personalWorkspaces: 3, ownerMemberships: 3 });
    expect(User.docs.every(user => user.defaultWorkspaceId)).toBe(true);
    expect(same(await userIdForIdentity('appwrite', 'aw-alice'), alice._id)).toBe(true);
    expect(same(await userIdForIdentity('firebase', 'fb-bob'), bob._id)).toBe(true);
    expect(IdentityLink.docs.every(link => link.source === 'migration')).toBe(true);
    expect(MigrationRecord.docs).toHaveLength(1);
    expect(MigrationRecord.docs[0].summary.accounts).toBe(3);

    // a second run finds it in the ledger and does nothing
    const [again] = await runMigrations({ apply: true });
    expect(again.state).toBe('already applied');
    expect(Workspace.docs).toHaveLength(3);
    expect(MigrationRecord.docs).toHaveLength(1);
    expect((await migrationStatus())[0].appliedAt).toBeInstanceOf(Date);
  });

  test('an account that already has its workspace is counted, not duplicated', async () => {
    const { alice } = await seed();
    await ensurePersonalWorkspace(alice);
    await linkIdentity(alice._id, 'appwrite', 'aw-alice', 'registration');
    const [result] = await runMigrations({ apply: true });
    expect(result.summary.workspaces).toEqual({ created: 2, alreadyPresent: 1 });
    expect(result.summary.identityLinks).toEqual({ created: 2, alreadyPresent: 1 });
    expect(Workspace.docs).toHaveLength(3);
  });

  test('an identity held by two accounts is given to neither, and both are reported', async () => {
    const first = await account({ email: 'first@example.org', appwriteUserId: 'aw-shared' });
    const second = await account({ email: 'second@example.org', appwriteUserId: 'aw-shared' });
    const [result] = await runMigrations({ apply: true });
    expect(await userIdForIdentity('appwrite', 'aw-shared')).toBeNull();
    expect(result.summary.setAside.map(entry => entry.userId).sort()).toEqual([String(first._id), String(second._id)].sort());
    expect(result.summary.setAside[0]).toMatchObject({ provider: 'appwrite', reason: 'more than one account holds this identity' });
    // their workspaces are still theirs
    expect(Workspace.docs).toHaveLength(2);
  });

  test('an identity already linked to another account is not taken from it', async () => {
    const holder = await account({ email: 'holder@example.org' });
    const claimant = await account({ email: 'claimant@example.org', firebaseUid: 'fb-1' });
    await linkIdentity(holder._id, 'firebase', 'fb-1', 'sign-in');
    const [result] = await runMigrations({ apply: true });
    expect(same(await userIdForIdentity('firebase', 'fb-1'), holder._id)).toBe(true);
    expect(result.summary.setAside).toEqual([{ userId: String(claimant._id), provider: 'firebase', reason: 'the identity is already linked to another account' }]);
  });

  test('a migration that fails is not recorded, and runs again next time', async () => {
    const failing = [{ id: '900-fails', description: 'fails', up: jest.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue({ done: true }) }];
    await expect(runMigrations({ apply: true, migrations: failing })).rejects.toThrow('disk full');
    expect(MigrationRecord.docs).toHaveLength(0);
    const [retried] = await runMigrations({ apply: true, migrations: failing });
    expect(retried.state).toBe('applied');
    expect(MigrationRecord.docs).toHaveLength(1);
  });

  test('migration files are numbered, named for their ID and in order', () => {
    const migrations = loadMigrations();
    expect(migrations.map(migration => migration.id)).toEqual([...migrations.map(migration => migration.id)].sort());
    expect(migrations[0].id).toBe('001-personal-workspaces');
    for (const migration of migrations) expect(migration.file).toBe(`${migration.id}.js`);
  });
});
