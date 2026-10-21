// Captured network flows belong to the account that sent them. Another account
// cannot read them, cannot place flows in them, and is not sent them live
// (SEC-01/SEC-02; the capture part of the cross-account checklist item).
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/services/appwriteService', () => ({ appwriteService: { createPrivateDocument: jest.fn(async () => ({})) } }));
jest.mock('../../src/services/websocket', () => ({ wsManager: { broadcastToDesktops: jest.fn(), broadcastToMobiles: jest.fn() } }));

const express = require('express');
const User = require('../../src/models/User');
const { appwriteService } = require('../../src/services/appwriteService');
const { wsManager } = require('../../src/services/websocket');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { serve } = require('../helpers/http');

const account = id => ({ _id: id, role: 'user', isActive: true, activity: {}, isLocked: () => false, save: jest.fn() });
const alice = account('507f1f77bcf86cd799439011');
const bob = account('507f1f77bcf86cd799439012');
let client;
const as = (user, route, options = {}) => client.request(route, { ...options, headers: { Authorization: `Bearer ${signSessionToken(user)}` } });

beforeAll(async () => {
  User.findById.mockImplementation(async id => [alice, bob].find(user => user._id === String(id)) || null);
  const app = express();
  app.use(express.json());
  app.use('/api/network-capture', require('../../src/routes/network-capture'));
  client = await serve(app);
});
afterAll(() => client.close());

test('flows are kept for the account that sent them, whatever account the body names', async () => {
  const response = await as(alice, '/api/network-capture/ingest', {
    method: 'POST', body: { deviceId: 'alice-phone', userId: bob._id, flows: [{ id: 'flow-1', host: 'bank.example', userId: bob._id, user_id: bob._id }] }
  });
  expect(response.status).toBe(200);
  for (const call of appwriteService.createPrivateDocument.mock.calls) {
    expect(call[3].user_id).toBe(alice._id);
    expect(call[4]).toEqual([]); // no permission is granted to any client
  }
  // the live copy goes to the sender's own devices only
  for (const send of [wsManager.broadcastToDesktops, wsManager.broadcastToMobiles]) {
    expect(send).toHaveBeenCalled();
    for (const [, userId] of send.mock.calls) expect(userId).toBe(alice._id);
  }
});

test('another account reads none of them, whatever it asks for', async () => {
  for (const route of ['/api/network-capture', `/api/network-capture?userId=${alice._id}`, '/api/network-capture?host=bank']) {
    const theirs = await as(bob, route);
    expect(theirs.status).toBe(200);
    expect(theirs.body.data).toEqual({ flows: [], count: 0 });
  }
  const mine = await as(alice, '/api/network-capture');
  expect(mine.body.data.count).toBe(1);
  expect(mine.body.data.flows[0]).toMatchObject({ host: 'bank.example' });
});

test('without a session nothing is stored or read', async () => {
  expect((await client.request('/api/network-capture/ingest', { method: 'POST', body: { flows: [{ host: 'x' }] } })).status).toBe(401);
  expect((await client.request('/api/network-capture')).status).toBe(401);
});

test('credentials in a captured address are removed before it is stored, listed or sent on (SEC-07)', async () => {
  appwriteService.createPrivateDocument.mockClear();
  wsManager.broadcastToDesktops.mockClear();
  const url = 'https://bank.example/login/callback?code=4/0AfJohXk&state=s1&lang=en#access_token=ya29.secret';
  await as(alice, '/api/network-capture/ingest', { method: 'POST', body: { flows: [{ id: 'flow-2', host: 'bank.example', url }] } });
  const cleaned = 'https://bank.example/login/callback?code=[redacted]&state=[redacted]&lang=en#access_token=[redacted]';
  expect(appwriteService.createPrivateDocument.mock.calls[0][3].url).toBe(cleaned);
  expect(wsManager.broadcastToDesktops.mock.calls[0][0].data.flows[0].url).toBe(cleaned);
  const listed = (await as(alice, '/api/network-capture?host=bank')).body.data.flows;
  expect(listed.map(f => f.url)).toContain(cleaned);
  expect(JSON.stringify(listed)).not.toContain('ya29.secret');
});
