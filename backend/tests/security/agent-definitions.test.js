// Agent definitions (AGT-01, AGT-02, AGT-03) through the real routes, session
// check and workspace repository.
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/services/workspaceService', () => ({
  ensurePersonalWorkspace: jest.fn(async user => `ws-${user._id}`),
  workspaceIdFor: jest.fn(async principal => (principal && principal.userId ? (principal.workspaceId || `ws-${principal.userId}`) : null)),
  activeMembership: jest.fn(async (workspaceId, userId) => (workspaceId === `ws-${userId}` ? { role: 'owner' } : null))
}));
jest.mock('../../src/models/Agent', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['agentId'] }, { fields: ['workspaceId', 'idempotencyKey'] }] }),
  { STATES: ['draft', 'ready', 'active', 'paused', 'archived'] }
));
jest.mock('../../src/models/Device', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['deviceId'] }] }),
  { KINDS: ['endpoint'], PLATFORMS: ['windows'], STATES: ['pending_approval', 'active', 'revoked', 'inventory'] }
));
jest.mock('../../src/models/AuditEvent', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection(),
  { OUTCOMES: ['success', 'failure', 'warning'], RETENTION_DAYS: 90 }
));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const express = require('express');
const User = require('../../src/models/User');
const Agent = require('../../src/models/Agent');
const Device = require('../../src/models/Device');
const AuditEvent = require('../../src/models/AuditEvent');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { serve } = require('../helpers/http');

const account = (id, email) => ({ _id: id, email, role: 'user', isActive: true, isLocked: () => false, activity: {}, save: jest.fn() });
const alice = account('507f1f77bcf86cd799439011', 'alice@example.com');
const bob = account('507f1f77bcf86cd799439012', 'bob@example.com');

let client;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', require('../../src/routes/agentsV1'));
  client = await serve(app);
});
afterAll(() => client.close());
let keys = 0;
beforeEach(() => {
  Agent.reset(); Device.reset(); AuditEvent.reset();
  User.findById.mockImplementation(async id => [alice, bob].find(u => u._id === String(id)) || null);
});

const as = (user, path, options = {}) => client.request(path, { ...options, headers: { Authorization: `Bearer ${signSessionToken(user)}` } });
const create = (user, body) => as(user, '/api/v1/agents', { method: 'POST', body: { idempotencyKey: `create-key-${++keys}`, ...body } });
const patch = (user, agent, body) => as(user, `/api/v1/agents/${agent.agentId}`, { method: 'PATCH', body: { expectedVersion: agent.version, ...body } });
const act = (user, agent, action) => as(user, `/api/v1/agents/${agent.agentId}/${action}`, { method: 'POST' });
const device = (owner, fields = {}) => Device.create({
  deviceId: `dev-${Math.random().toString(36).slice(2)}`, workspaceId: `ws-${owner._id}`, kind: 'endpoint', platform: 'windows',
  displayName: 'Laptop', state: 'active', capabilities: { advertised: ['hosts_blocking'], enabled: [], confirmed: {} }, createdBy: owner._id, ...fields
});

test('the catalogue lists what can run, and says why the rest cannot', async () => {
  const { templates } = (await as(alice, '/api/v1/agent-templates')).body.data;
  expect(templates.filter(t => t.available).map(t => t.id)).toEqual(['url_analyst', 'device_health']);
  for (const t of templates.filter(t => !t.available)) expect(t.reason).toMatch(/\w/);
  expect(templates.find(t => t.id === 'url_analyst').tools.map(t => t.id)).toEqual(['url_classify', 'ioc_extract']);
  expect((await create(alice, { templateId: 'policy_response', name: 'x' })).body.code).toBe('TEMPLATE_UNAVAILABLE');
});

test('two accounts can each have an agent called "Default" without sharing anything', async () => {
  const a = (await create(alice, { templateId: 'device_health', name: 'Default' })).body.data;
  const b = (await create(bob, { templateId: 'device_health', name: 'Default' })).body.data;
  expect(a.agentId).not.toBe(b.agentId);
  expect((await as(alice, '/api/v1/agents')).body.data.agents.map(x => x.agentId)).toEqual([a.agentId]);
  expect((await as(bob, `/api/v1/agents/${a.agentId}`)).status).toBe(404);
  expect((await patch(bob, a, { name: 'mine' })).status).toBe(404);
  expect((await act(bob, a, 'archive')).status).toBe(404);
});

test('submitting the same create twice makes one definition', async () => {
  const body = { templateId: 'device_health', name: 'Health', idempotencyKey: 'same-key-0001' };
  const first = await create(alice, body);
  const again = await create(alice, body);
  expect([first.status, again.status]).toEqual([201, 200]);
  expect(again.body.data.agentId).toBe(first.body.data.agentId);
  expect(Agent.docs).toHaveLength(1);
});

test('a modified request cannot enable a tool, mode or proposal its template does not have', async () => {
  expect((await create(alice, { templateId: 'device_health', name: 'x', config: { tools: ['device_status', 'shell_exec'] } })).body.code).toBe('AGENT_TOOL_NOT_ALLOWED');
  expect((await create(alice, { templateId: 'device_health', name: 'x', config: { mode: 'assist' } })).body.code).toBe('AGENT_MODE_NOT_ALLOWED');
  expect((await create(alice, { templateId: 'url_analyst', name: 'x', config: { proposals: ['block_domain'] } })).body.code).toBe('AGENT_PROPOSAL_NOT_ALLOWED'); // observe mode
  expect((await create(alice, { templateId: 'url_analyst', name: 'x', config: { mode: 'assist', proposals: ['wipe_disk'] } })).body.code).toBe('AGENT_PROPOSAL_NOT_ALLOWED');
  expect((await create(alice, { templateId: 'url_analyst', name: 'x', config: { targets: ['file:///etc/passwd'] } })).body.code).toBe('AGENT_TARGETS_INVALID');
  expect((await create(alice, { templateId: 'url_analyst', name: 'x', config: { mode: 'guarded' } })).body.code).toBe('AGENT_MODE_NOT_ALLOWED');
  const made = (await create(alice, { templateId: 'url_analyst', name: 'ok' })).body.data;
  expect((await patch(alice, made, { config: { tools: ['url_classify', 'device_status'] } })).body.code).toBe('AGENT_TOOL_NOT_ALLOWED');
  expect(Agent.docs).toHaveLength(1);
});

test('create, validate, activate, pause, resume, clone and archive', async () => {
  let agent = (await create(alice, { templateId: 'url_analyst', name: 'Links' })).body.data;
  expect(agent).toMatchObject({ state: 'draft', version: 1 });
  const failed = (await act(alice, agent, 'validate')).body.data;
  expect(failed.validation).toMatchObject({ ok: false, errors: ['Add at least one address or domain to analyse.'] });
  expect((await act(alice, agent, 'activate')).body.code).toBe('AGENT_STATE_INVALID');

  agent = (await patch(alice, agent, { config: { targets: ['https://phish.example/login', 'example.org'] } })).body.data;
  expect(agent).toMatchObject({ state: 'ready', version: 2, validation: { ok: true, version: 2 } });
  agent = (await act(alice, agent, 'activate')).body.data;
  expect(agent.state).toBe('active');
  agent = (await act(alice, agent, 'pause')).body.data;
  expect(agent.state).toBe('paused');
  agent = (await act(alice, agent, 'resume')).body.data;
  expect(agent.state).toBe('active');

  const copy = (await as(alice, `/api/v1/agents/${agent.agentId}/clone`, { method: 'POST', body: { idempotencyKey: 'clone-key-0001' } })).body.data;
  expect(copy).toMatchObject({ state: 'draft', version: 1, name: 'Links (copy)', config: { targets: ['https://phish.example/login', 'example.org'] } });
  expect(copy.agentId).not.toBe(agent.agentId);

  agent = (await act(alice, agent, 'archive')).body.data;
  expect(agent.state).toBe('archived');
  expect((await patch(alice, agent, { name: 'again' })).body.code).toBe('AGENT_ARCHIVED');
  expect((await as(alice, '/api/v1/agents')).body.data.agents.map(a => a.agentId)).toEqual([copy.agentId]);
  expect(AuditEvent.docs.map(e => e.action)).toEqual(expect.arrayContaining(['agent.create', 'agent.update', 'agent.activate', 'agent.pause', 'agent.resume', 'agent.archive']));
});

test('an edit names the version it changes; a stale one is refused', async () => {
  const agent = (await create(alice, { templateId: 'device_health', name: 'Health' })).body.data;
  expect((await patch(alice, agent, { name: 'First' })).body.data.version).toBe(2);
  expect((await patch(alice, agent, { name: 'Second' })).body.code).toBe('AGENT_VERSION_CONFLICT'); // still says version 1
  expect((await as(alice, `/api/v1/agents/${agent.agentId}`)).body.data).toMatchObject({ name: 'First', version: 2 });
});

test('widening a running agent sends it back to ready; a change that does not widen keeps it running', async () => {
  const laptop = await device(alice);
  let agent = (await create(alice, { templateId: 'url_analyst', name: 'Links', config: { targets: ['example.org'] } })).body.data;
  agent = (await act(alice, agent, 'validate')).body.data;
  agent = (await act(alice, agent, 'activate')).body.data;

  agent = (await patch(alice, agent, { config: { objective: 'Check the links from the newsletter' } })).body.data;
  expect(agent).toMatchObject({ state: 'active', widened: false });

  agent = (await patch(alice, agent, { config: { mode: 'assist', proposals: ['block_domain'], deviceIds: [laptop.deviceId] } })).body.data;
  expect(agent).toMatchObject({ state: 'ready', widened: true, validation: { ok: true } });
  expect(agent.diff).toEqual({ proposals: { added: ['block_domain'], removed: [] }, deviceIds: { added: [laptop.deviceId], removed: [] }, mode: { from: 'observe', to: 'assist' } });
  expect(agent.history[0]).toMatchObject({ version: 3, diff: agent.diff }); // v1 created, v2 objective, v3 widened
  agent = (await act(alice, agent, 'activate')).body.data;
  expect(agent.state).toBe('active');

  // narrowing again keeps it running
  agent = (await patch(alice, agent, { config: { mode: 'observe', proposals: [], deviceIds: [] } })).body.data;
  expect(agent).toMatchObject({ state: 'active', widened: false });
});

test('validation checks the workspace as it is now: devices must be this workspace\'s, approved and capable', async () => {
  const mine = await device(alice);
  const theirs = await device(bob);
  const noHosts = await device(alice, { capabilities: { advertised: ['browser_history'], enabled: [], confirmed: {} } });
  const config = deviceIds => ({ mode: 'assist', proposals: ['block_domain'], targets: ['example.org'], deviceIds });

  const foreign = (await create(alice, { templateId: 'url_analyst', name: 'x', config: config([theirs.deviceId]) })).body.data;
  expect((await act(alice, foreign, 'validate')).body.data.validation.errors).toEqual([`Device ${theirs.deviceId} is not one of this workspace's devices.`]);
  const incapable = (await create(alice, { templateId: 'url_analyst', name: 'x', config: config([noHosts.deviceId]) })).body.data;
  expect((await act(alice, incapable, 'validate')).body.data.validation.errors[0]).toMatch(/does not offer hosts_blocking/);
  const noDevice = (await create(alice, { templateId: 'url_analyst', name: 'x', config: config([]) })).body.data;
  expect((await act(alice, noDevice, 'validate')).body.data.validation.errors).toEqual(['Proposals need at least one device they could be carried out on.']);

  let agent = (await create(alice, { templateId: 'url_analyst', name: 'ok', config: config([mine.deviceId]) })).body.data;
  agent = (await act(alice, agent, 'validate')).body.data;
  agent = (await act(alice, agent, 'activate')).body.data;
  agent = (await act(alice, agent, 'pause')).body.data;
  Device.docs.find(d => d.deviceId === mine.deviceId).state = 'revoked';
  const resumed = await act(alice, agent, 'resume');
  expect(resumed.body).toMatchObject({ code: 'AGENT_NOT_VALID', errors: ['Laptop is revoked; only approved devices can be assigned.'] });
  expect((await as(alice, `/api/v1/agents/${agent.agentId}`)).body.data.state).toBe('paused');
});
