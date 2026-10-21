jest.mock('../../src/services/realtimeBus', () => ({ emit: jest.fn() }));
// The audit trail is kept in the database, each event in its workspace or at
// platform level; the server records what it sees change; client reports are
// marked as such; and nothing in the application can rewrite an event (SEC-08, B10.4).
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/models/User', () => require('../helpers/fakeCollection').fakeCollection({
  unique: [{ fields: ['email'] }], methods: { isLocked: () => false }
}));
jest.mock('../../src/models/Workspace', () => require('../helpers/fakeCollection').fakeCollection({
  unique: [{ fields: ['ownerUserId'], where: doc => doc.kind === 'personal' }]
}));
jest.mock('../../src/models/Membership', () => require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['workspaceId', 'userId'] }] }));
jest.mock('../../src/models/IdentityLink', () => require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['provider', 'subject'] }] }));
jest.mock('../../src/models/AuditEvent', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection(),
  { OUTCOMES: ['success', 'failure', 'warning'], RETENTION_DAYS: 90 }
));

const express = require('express');
const mongoose = require('mongoose');
const User = require('../../src/models/User');
const Workspace = require('../../src/models/Workspace');
const Membership = require('../../src/models/Membership');
const AuditEvent = require('../../src/models/AuditEvent');
const audit = require('../../src/services/auditLogService');
const { ensurePersonalWorkspace } = require('../../src/services/workspaceService');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { serve } = require('../helpers/http');

let client;
const people = {};
const as = (who, route, options = {}) => client.request(route, {
  ...options, headers: { Authorization: `Bearer ${signSessionToken(people[who])}`, ...(options.headers || {}) }
});
const principal = who => ({ userId: people[who]._id, workspaceId: String(people[who].defaultWorkspaceId) });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/audit', require('../../src/routes/audit'));
  client = await serve(app);
});
afterAll(() => client.close());

beforeEach(async () => {
  for (const model of [User, Workspace, Membership, AuditEvent]) model.reset();
  for (const [name, role] of [['alice', 'user'], ['bob', 'user'], ['analyst', 'analyst'], ['admin', 'admin']]) {
    people[name] = await User.create({ email: `${name}@example.org`, role, isActive: true, activity: {} });
    await ensurePersonalWorkspace(people[name]);
  }
});

describe('recording', () => {
  test('an event is kept in the actor\'s workspace, with who, what, how it went and where it came from', async () => {
    const req = { headers: { 'x-request-id': 'heroku-request-1' }, ip: '203.0.113.9' };
    const event = await audit.record({ principal: principal('alice'), action: 'auth.login', resource: 'account', details: { method: 'password' }, req });
    expect(event).toMatchObject({
      scope: 'workspace', workspaceId: principal('alice').workspaceId, actorType: 'user', actorUserId: String(people.alice._id),
      action: 'auth.login', resource: 'account', outcome: 'success', origin: 'server', correlationId: 'heroku-request-1', ipAddress: '203.0.113.9'
    });
  });

  test('a platform event belongs to no workspace, and the system can be its actor', async () => {
    const event = await audit.record({ platform: true, action: 'system.startup', resource: 'server' });
    expect(event).toMatchObject({ scope: 'platform', workspaceId: null, actorType: 'system', actorUserId: null });
  });

  test('an account with no workspace on the request is given its own; with none to be had, nothing is recorded', async () => {
    const found = await audit.record({ principal: { userId: people.alice._id, workspaceId: null }, action: 'auth.login', resource: 'account' });
    expect(String(found.workspaceId)).toBe(String(people.alice.defaultWorkspaceId));
    AuditEvent.reset();
    expect(await audit.record({ principal: { userId: '0000000000000000000000ff', workspaceId: null }, action: 'auth.login', resource: 'account' })).toBeNull();
    expect(await audit.record({ principal: null, action: 'auth.login', resource: 'account' })).toBeNull();
    jest.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('database unavailable'));
    expect(await audit.record({ principal: principal('alice'), action: 'auth.login', resource: 'account' })).toBeNull();
    expect(AuditEvent.docs).toHaveLength(0);
  });

  test('details are kept small and carry no credentials', () => {
    const cleaned = audit.boundedDetails({
      method: 'password', password: 'hunter2', token: 'eyJ…', apiKey: 'k', code: 'oauth-code', key: 'k2',
      nested: { authorization: 'Bearer x', note: 'fine' }, long: 'x'.repeat(2000)
    });
    expect(cleaned).toMatchObject({ method: 'password', password: '[redacted]', token: '[redacted]', apiKey: '[redacted]', code: '[redacted]', key: '[redacted]', nested: { authorization: '[redacted]', note: 'fine' } });
    expect(cleaned.long.length).toBeLessThanOrEqual(501);
    const huge = audit.boundedDetails(Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`field${i}`, 'y'.repeat(400)])));
    expect(huge.truncated).toBe(true);
  });

  test('a correlation ID is taken from the platform\'s request ID only when it is well formed', () => {
    expect(audit.correlationOf({ headers: { 'x-request-id': 'abc-123' } })).toBe('abc-123');
    expect(audit.correlationOf({ headers: { 'x-request-id': 'bad id <script>' } })).toMatch(/^[0-9a-f-]{36}$/);
    expect(audit.correlationOf({ headers: {} })).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('reading', () => {
  beforeEach(async () => {
    await audit.record({ principal: principal('alice'), action: 'auth.login', resource: 'account' });
    await audit.record({ principal: principal('alice'), action: 'auth.login', resource: 'account', outcome: 'failure' });
    await audit.record({ principal: principal('alice'), action: 'policy.triggered', resource: 'node n1', outcome: 'warning' });
    await audit.record({ principal: principal('bob'), action: 'auth.login', resource: 'account' });
    await audit.record({ principal: principal('analyst'), platform: true, action: 'policy.create', resource: 'policy p1' });
  });

  test('a member reads their own workspace\'s events and no one else\'s', async () => {
    const mine = await as('alice', '/api/audit/logs');
    expect(mine.status).toBe(200);
    expect(mine.body).toMatchObject({ scope: 'workspace', total: 3 });
    expect(mine.body.entries.every(e => e.actor.userId === String(people.alice._id))).toBe(true);
    expect((await as('bob', '/api/audit/logs')).body.total).toBe(1);
  });

  test('naming another workspace in the request changes nothing', async () => {
    const bobs = String(people.bob.defaultWorkspaceId);
    const response = await as('alice', `/api/audit/logs?workspaceId=${bobs}&userId=${people.bob._id}`);
    expect(response.body.total).toBe(3);
    expect(response.body.entries.some(e => e.actor.userId === String(people.bob._id))).toBe(false);
  });

  test('filters narrow the caller\'s events and cannot widen them', async () => {
    expect((await as('alice', '/api/audit/logs?outcome=failure')).body.total).toBe(1);
    expect((await as('alice', '/api/audit/logs?action=auth.')).body.total).toBe(2);
    expect((await as('alice', '/api/audit/logs?action=policy.triggered')).body.total).toBe(1);
    expect((await as('alice', '/api/audit/logs?action=.*')).body.total).toBe(3); // not a valid filter: ignored
    expect((await as('alice', '/api/audit/logs?since=2999-01-01')).body.total).toBe(0);
    expect((await as('alice', '/api/audit/logs?limit=1')).body).toMatchObject({ total: 3, hasMore: true });
  });

  test('the platform view is for administrators only, and holds everything', async () => {
    expect((await as('alice', '/api/audit/logs?scope=platform')).status).toBe(403);
    expect((await as('analyst', '/api/audit/logs?scope=platform')).status).toBe(403);
    const all = await as('admin', '/api/audit/logs?scope=platform');
    expect(all.status).toBe(200);
    expect(all.body).toMatchObject({ scope: 'platform', total: 5 });
    expect(all.body.entries.find(e => e.action === 'policy.create').scope).toBe('platform');
  });

  test('statistics: the caller\'s workspace for a member, the platform for an administrator', async () => {
    const own = await as('alice', '/api/audit/stats');
    expect(own.body.data.last24h).toEqual({ total: 3, success: 1, failure: 1, warning: 1 });
    expect(own.body.data.topUsers).toBeUndefined();
    expect((await as('analyst', '/api/audit/stats?scope=platform')).status).toBe(403);
    const platform = await as('admin', '/api/audit/stats?scope=platform');
    expect(platform.body.data.last24h.total).toBe(5);
    expect(platform.body.data.topUsers[0]).toEqual({ userId: String(people.alice._id), count: 3 });
  });

  test('no session, no trail', async () => {
    expect((await client.request('/api/audit/logs')).status).toBe(401);
    expect((await client.request('/api/audit/stats')).status).toBe(401);
  });
});

describe('client reports', () => {
  test('are kept in the caller\'s workspace, marked as reported by a client, with the session as the actor', async () => {
    const response = await as('alice', '/api/audit/log', {
      method: 'POST', body: { action: 'soc.alert_ack', resource: 'alert 7', details: { note: 'seen', token: 'x' }, userId: String(people.bob._id), workspaceId: String(people.bob.defaultWorkspaceId) }
    });
    expect(response.status).toBe(201);
    expect(response.body.entry).toMatchObject({ action: 'soc.alert_ack', origin: 'client' });
    expect(AuditEvent.docs[0]).toMatchObject({ origin: 'client', actorUserId: String(people.alice._id), workspaceId: String(people.alice.defaultWorkspaceId) });
    expect(AuditEvent.docs[0].details.token).toBe('[redacted]');
  });

  test('cannot claim to be something the server records', async () => {
    for (const action of ['auth.login', 'policy.delete', 'system.startup']) {
      expect((await as('alice', '/api/audit/log', { method: 'POST', body: { action } })).status).toBe(400);
    }
    for (const action of [undefined, 'login', 'Auth.Login', 'a.b c', 'x'.repeat(70) + '.y']) {
      expect((await as('alice', '/api/audit/log', { method: 'POST', body: { action } })).status).toBe(400);
    }
    expect(AuditEvent.docs).toHaveLength(0);
  });
});

describe('nothing rewrites an event', () => {
  test('there is no route that changes or deletes one', async () => {
    const event = await audit.record({ principal: principal('alice'), action: 'auth.login', resource: 'account' });
    const headers = { Authorization: `Bearer ${signSessionToken(people.admin)}`, 'Content-Type': 'application/json' };
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      for (const route of [`/api/audit/logs/${event._id}`, '/api/audit/logs', `/api/audit/log/${event._id}`]) {
        expect((await fetch(client.url + route, { method, headers, body: '{}' })).status).toBe(404);
      }
    }
    expect(AuditEvent.docs).toHaveLength(1);
  });

  test('the model refuses every update and delete, before anything reaches the database', async () => {
    const Real = jest.requireActual('../../src/models/AuditEvent');
    expect(mongoose.connection.readyState).toBe(0); // not connected: a refusal cannot be the database's
    const attempts = [
      () => Real.updateOne({}, { $set: { outcome: 'success' } }),
      () => Real.updateMany({}, { $set: { outcome: 'success' } }),
      () => Real.findOneAndUpdate({}, { $set: { outcome: 'success' } }),
      () => Real.replaceOne({}, {}),
      () => Real.deleteOne({}),
      () => Real.deleteMany({}),
      () => Real.findOneAndDelete({})
    ];
    for (const attempt of attempts) {
      await expect(Promise.race([attempt(), new Promise((_, reject) => setTimeout(() => reject(new Error('reached the database')), 2000))]))
        .rejects.toThrow('Audit events cannot be changed or deleted through the application');
    }
    const loaded = Real.hydrate({ _id: new mongoose.Types.ObjectId(), scope: 'workspace', actorType: 'user', action: 'auth.login', resource: 'account', outcome: 'success', origin: 'server', createdAt: new Date() });
    await expect(loaded.save()).rejects.toThrow('cannot be changed');
  });

  test('events expire after the retention period, by a database index', () => {
    const Real = jest.requireActual('../../src/models/AuditEvent');
    const ttl = Real.schema.indexes().find(([fields, options]) => fields.createdAt === 1 && options.expireAfterSeconds);
    expect(ttl[1].expireAfterSeconds).toBe(90 * 24 * 60 * 60);
    expect(Real.RETENTION_DAYS).toBe(90);
  });
});


test('console invalidation follows persisted server changes and contains no record details',async()=>{
 const emit=require('../../src/services/realtimeBus').emit;emit.mockClear();
 await audit.record({principal:principal('alice'),action:'device.approve',resource:'private-device-id',details:{note:'private'}});
 expect(emit).toHaveBeenCalledTimes(1);
 expect(emit).toHaveBeenCalledWith('console:changed',{userId:String(people.alice._id),category:'device'});
 emit.mockClear();
 await audit.record({principal:principal('alice'),action:'device.approve',resource:'device',origin:'client'});
 await audit.record({principal:principal('alice'),action:'device.approve',resource:'device',outcome:'failure'});
 jest.spyOn(AuditEvent,'create').mockRejectedValueOnce(new Error('database unavailable'));
 await audit.record({principal:principal('alice'),action:'device.approve',resource:'device'});
 expect(emit).not.toHaveBeenCalled();
});
