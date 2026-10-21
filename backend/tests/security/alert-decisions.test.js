// DET-02: a saved, audited workflow for agent alerts (kept in Appwrite, decided here).
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/services/workspaceService', () => ({
  ensurePersonalWorkspace: jest.fn(async user => `ws-${user._id}`),
  workspaceIdFor: jest.fn(async principal => (principal && principal.userId ? (principal.workspaceId || `ws-${principal.userId}`) : null)),
  activeMembership: jest.fn(async (workspaceId, userId) => (workspaceId === `ws-${userId}` ? { role: 'owner' } : null))
}));
jest.mock('../../src/models/AlertDecision', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['workspaceId', 'alertId'] }] }),
  { STATES: ['new', 'acknowledged', 'escalated', 'resolved', 'false_positive'] }
));
jest.mock('../../src/models/AuditEvent', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection(), { OUTCOMES: ['success', 'failure', 'warning'], RETENTION_DAYS: 90 }
));
jest.mock('../../src/services/appwriteService', () => ({ appwriteService: { listAlerts: jest.fn(), getAlertForUser: jest.fn() } }));
jest.mock('../../src/agent/AgentManager', () => require('../helpers/stub').anything());
jest.mock('../../src/services/WebScraperAPIService', () => require('../helpers/stub').anything());
jest.mock('../../src/services/mlServiceClient', () => require('../helpers/stub').anything());
jest.mock('../../src/services/realtimeBus', () => require('../helpers/stub').anything());
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const express = require('express');
const User = require('../../src/models/User');
const AlertDecision = require('../../src/models/AlertDecision');
const AuditEvent = require('../../src/models/AuditEvent');
const { appwriteService } = require('../../src/services/appwriteService');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { serve } = require('../helpers/http');

const account = id => ({ _id: id, email: `${id}@example.com`, role: 'user', isActive: true, isLocked: () => false, activity: {}, save: jest.fn() });
const alice = account('507f1f77bcf86cd799439011');
const bob = account('507f1f77bcf86cd799439012');
const ALERT = { $id: 'doc-1', alert_id: 'alert-1', user_id: alice._id, severity: 'high', description: 'credential form' };

let client;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/agent', require('../../src/routes/agentRoutes'));
  client = await serve(app);
});
afterAll(() => client.close());
beforeEach(() => {
  AlertDecision.reset(); AuditEvent.reset();
  User.findById.mockImplementation(async id => [alice, bob].find(u => u._id === String(id)) || null);
  appwriteService.getAlertForUser.mockImplementation(async (userId, alertId) => (userId === alice._id && ['alert-1', 'doc-1'].includes(alertId) ? ALERT : null));
  appwriteService.listAlerts.mockImplementation(async userId => (userId === alice._id ? [ALERT] : []));
});
const as = (user, path, options = {}) => client.request(path, { ...options, headers: { Authorization: `Bearer ${signSessionToken(user)}` } });
const act = (user, action, id = 'alert-1') => as(user, `/api/agent/alerts/${id}/state`, { method: 'PUT', body: { action, note: 'checked' } });

test('acknowledge, escalate and resolve are saved, checked against the state, and audited', async () => {
  expect((await act(alice, 'acknowledge')).body.data).toMatchObject({ workflowState: 'acknowledged', from: 'new' });
  const again = await act(alice, 'acknowledge');
  expect(again.status).toBe(409);
  expect(again.body.code).toBe('TRANSITION_NOT_ALLOWED');
  expect((await act(alice, 'escalate')).body.data.workflowState).toBe('escalated');
  expect((await act(alice, 'resolve')).body.data.workflowState).toBe('resolved');
  expect((await act(alice, 'reopen')).body.data.workflowState).toBe('acknowledged');
  expect(AlertDecision.docs[0].history.map(h => `${h.from}→${h.to}`)).toEqual(['new→acknowledged', 'acknowledged→escalated', 'escalated→resolved', 'resolved→acknowledged']);
  expect(AuditEvent.docs.filter(e => e.action === 'alert.state_change')).toHaveLength(4);
});

test('the listed alerts carry their decided state', async () => {
  await act(alice, 'escalate');
  const listed = (await as(alice, '/api/agent/alerts?limit=5')).body.data.alerts;
  expect(listed[0]).toMatchObject({ alert_id: 'alert-1', workflowState: 'escalated', lastDecision: expect.objectContaining({ to: 'escalated', note: 'checked' }) });
});

test('another account\'s alert cannot be decided on, and unknown actions or IDs are refused', async () => {
  expect((await act(bob, 'acknowledge')).status).toBe(404);
  expect((await act(alice, 'delete')).body.code).toBe('ACTION_INVALID');
  expect((await act(alice, 'acknowledge', 'x'.repeat(200))).body.code).toBe('ALERT_ID_INVALID');
  expect(AlertDecision.docs).toHaveLength(0);
});

test('a client cannot report an alert event as if the server had seen it', async () => {
  const app = express(); app.use(express.json()); app.use('/api/audit', require('../../src/routes/audit'));
  const audit = await serve(app);
  const r = await audit.request('/api/audit/log', { method: 'POST', body: { action: 'alert.state_change', resource: 'x' }, headers: { Authorization: `Bearer ${signSessionToken(alice)}` } });
  expect(r.status).toBe(400);
  await audit.close();
});
