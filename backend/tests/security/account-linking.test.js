// Signing in with Google selects the account that Google identity is linked
// to. An email address never selects an account (SEC-01, B05).
//
// Before this, the code exchange signed the caller in to whatever account had
// the same address. An account created with a password by one person could be
// entered, and shared from then on, by another signing in with Google.
jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/services/appwriteService', () => ({ appwriteService: { services: {}, initialize: jest.fn() } }));
jest.mock('../../src/models/User', () => require('../helpers/fakeCollection').fakeCollection({
  unique: [{ fields: ['email'] }, { fields: ['firebaseUid'] }],
  methods: { isLocked() { return Boolean(this.locked); } }
}));
jest.mock('../../src/models/Workspace', () => require('../helpers/fakeCollection').fakeCollection({
  unique: [{ fields: ['ownerUserId'], where: doc => doc.kind === 'personal' }]
}));
jest.mock('../../src/models/Membership', () => require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['workspaceId', 'userId'] }] }));
jest.mock('../../src/models/IdentityLink', () => require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['provider', 'subject'] }] }));
jest.mock('../../src/models/AuditEvent', () => Object.assign(require('../helpers/fakeCollection').fakeCollection(), { OUTCOMES: ['success', 'failure', 'warning'], RETENTION_DAYS: 90 }));

const axios = require('axios');
const User = require('../../src/models/User');
const Workspace = require('../../src/models/Workspace');
const Membership = require('../../src/models/Membership');
const IdentityLink = require('../../src/models/IdentityLink');
const AuditEvent = require('../../src/models/AuditEvent');
const authController = require('../../src/controllers/authController');
const { verifySessionToken } = require('../../src/services/sessionTokens');

const same = (a, b) => String(a) === String(b);

/** Sign in with a Google account: `sub` is Google's ID for it, `email` its address. */
async function googleSignIn({ sub, email, verified = true, name = 'Pat Example' }) {
  axios.post.mockResolvedValue({ data: { access_token: 'google-access-token', id_token: 'google-id-token' } });
  axios.get.mockResolvedValue({ data: { id: sub, email, verified_email: verified, name, given_name: 'Pat', family_name: 'Example', picture: 'https://example.org/p.png' } });
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await authController.exchangeGoogleToken({ body: { code: 'authorization-code', redirect_uri: 'http://127.0.0.1:53124/callback', code_verifier: 'v'.repeat(43) } }, res);
  const token = res.body && res.body.data && res.body.data.token;
  return { status: res.statusCode, body: res.body, signedInAs: token ? verifySessionToken(token).userId : null };
}

const localAccount = email => User.create({ email, passwordHash: 'bcrypt-hash-of-a-password', provider: 'local', role: 'user', isActive: true, firstName: 'Local', lastName: 'Owner' });

beforeEach(() => {
  for (const model of [User, Workspace, Membership, IdentityLink, AuditEvent]) model.reset();
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('a first Google sign-in creates an account, links it, and gives it a workspace', async () => {
  const result = await googleSignIn({ sub: 'google-111', email: 'pat@example.org' });
  expect(result.status).toBe(200);
  expect(User.docs).toHaveLength(1);
  expect(User.docs[0]).toMatchObject({ email: 'pat@example.org', role: 'user', provider: 'google.com' });
  expect(User.docs[0].passwordHash).toBeUndefined();
  expect(same(result.signedInAs, User.docs[0]._id)).toBe(true);
  expect(IdentityLink.docs).toHaveLength(1);
  expect(IdentityLink.docs[0]).toMatchObject({ provider: 'google', subject: 'google-111', source: 'sign-in' });
  expect(Workspace.docs).toHaveLength(1);
  expect(Membership.docs[0]).toMatchObject({ role: 'owner', status: 'active' });
});

test('the same Google account signs in to the same account, even after its address changes', async () => {
  const first = await googleSignIn({ sub: 'google-111', email: 'pat@example.org' });
  const later = await googleSignIn({ sub: 'google-111', email: 'pat.renamed@example.org' });
  expect(later.status).toBe(200);
  expect(later.signedInAs).toBe(first.signedInAs);
  expect(User.docs).toHaveLength(1);
  expect(IdentityLink.docs).toHaveLength(1);
});

test('a Google sign-in does not enter an account that someone gave a password', async () => {
  const victimOrAttacker = await localAccount('pat@example.org');
  const result = await googleSignIn({ sub: 'google-111', email: 'pat@example.org' });
  expect(result.status).toBe(409);
  expect(result.body).toMatchObject({ success: false, code: 'ACCOUNT_EXISTS' });
  expect(result.signedInAs).toBeNull();
  expect(JSON.stringify(result.body)).not.toMatch(/token/i);
  // nothing was linked, created or changed
  expect(IdentityLink.docs).toHaveLength(0);
  expect(User.docs).toHaveLength(1);
  expect(victimOrAttacker.provider).toBe('local');
  expect(victimOrAttacker.photoURL).toBeUndefined();
});

test('a different Google account with the same address does not get an account that is already linked', async () => {
  const first = await googleSignIn({ sub: 'google-111', email: 'pat@example.org' });
  // an address can pass to another person; a second Google identity presents it
  const second = await googleSignIn({ sub: 'google-222', email: 'pat@example.org' });
  expect(second.status).toBe(409);
  expect(second.body.code).toBe('ACCOUNT_EXISTS');
  expect(second.signedInAs).toBeNull();
  expect(IdentityLink.docs.map(link => link.subject)).toEqual(['google-111']);
  // and the first one still works
  expect((await googleSignIn({ sub: 'google-111', email: 'pat@example.org' })).signedInAs).toBe(first.signedInAs);
});

test('an account made by an earlier provider sign-in, with no password, is linked on its next Google sign-in', async () => {
  const earlier = await User.create({ email: 'pat@example.org', firebaseUid: 'firebase-9', provider: 'google.com', role: 'user', isActive: true, firstName: 'Pat', lastName: 'Example' });
  const result = await googleSignIn({ sub: 'google-111', email: 'pat@example.org' });
  expect(result.status).toBe(200);
  expect(same(result.signedInAs, earlier._id)).toBe(true);
  expect(User.docs).toHaveLength(1);
  expect(IdentityLink.docs[0]).toMatchObject({ provider: 'google', subject: 'google-111' });
});

test('an address Google has not verified is refused before any account is looked up', async () => {
  await localAccount('pat@example.org');
  const lookups = jest.spyOn(User, 'findOne');
  const result = await googleSignIn({ sub: 'google-111', email: 'pat@example.org', verified: false });
  expect(result.status).toBe(401);
  expect(result.signedInAs).toBeNull();
  expect(lookups).not.toHaveBeenCalled();
  expect(IdentityLink.docs).toHaveLength(0);
});

test('a deactivated or locked account is not signed in through its link', async () => {
  const first = await googleSignIn({ sub: 'google-111', email: 'pat@example.org' });
  User.docs[0].isActive = false;
  expect((await googleSignIn({ sub: 'google-111', email: 'pat@example.org' })).status).toBe(401);
  User.docs[0].isActive = true;
  User.docs[0].locked = true;
  const locked = await googleSignIn({ sub: 'google-111', email: 'pat@example.org' });
  expect(locked.status).toBe(401);
  expect(locked.signedInAs).toBeNull();
  expect(first.signedInAs).not.toBeNull();
});

test('a link to an account that no longer exists signs nobody in and creates nothing', async () => {
  await googleSignIn({ sub: 'google-111', email: 'pat@example.org' });
  User.reset();
  const result = await googleSignIn({ sub: 'google-111', email: 'pat@example.org' });
  expect(result.status).toBe(401);
  expect(User.docs).toHaveLength(0);
});

test('the source keeps no way to select an account by address alone', () => {
  const source = require('fs').readFileSync(require.resolve('../../src/controllers/authController'), 'utf8');
  const exchange = source.slice(source.indexOf('async exchangeGoogleToken('));
  expect(exchange).toMatch(/userIdForIdentity\('google', googleUser\.id\)/);
  expect(exchange).not.toMatch(/googleId/);
  // the one lookup by address is followed at once by the password check
  expect(exchange).toMatch(/findOne\(\{ email: googleUser\.email \}\)\.select\('\+passwordHash'\);\s*if \(sameAddress && sameAddress\.passwordHash\) \{/);
});

test("each Google sign-in is recorded in the account's workspace; a refusal records nothing to anyone's workspace", async () => {
  const first = await googleSignIn({ sub: 'google-111', email: 'pat@example.org' });
  expect(AuditEvent.docs).toHaveLength(1);
  expect(AuditEvent.docs[0]).toMatchObject({
    scope: 'workspace', action: 'auth.login', outcome: 'success', origin: 'server', actorUserId: first.signedInAs,
    workspaceId: String(Workspace.docs[0]._id), details: { method: 'google' }
  });
  await localAccount('someone@example.org');
  await googleSignIn({ sub: 'google-222', email: 'someone@example.org' });
  expect(AuditEvent.docs).toHaveLength(1);
});
