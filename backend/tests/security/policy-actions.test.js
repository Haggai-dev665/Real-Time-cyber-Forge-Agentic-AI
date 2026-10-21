// A policy that fires records what it asked for and what then happened. Nothing
// is reported as done unless something did it and said how that was checked
// (SEC-06, finding F13, B08). Policies and responses are kept in the database,
// and each response in the workspace whose event fired it (B10.4).
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/services/realtimeBus', () => ({ emit: jest.fn() }));
// The audit trail has its own suite (audit-events.test.js); here it records nothing.
jest.mock('../../src/services/auditLogService', () => ({
  record: jest.fn(async () => ({})), getActionCatalog: () => ({}), AUDIT_ACTIONS: {}
}));
jest.mock('../../src/models/User', () => require('../helpers/fakeCollection').fakeCollection({ methods: { isLocked: () => false } }));
jest.mock('../../src/models/Workspace', () => require('../helpers/fakeCollection').fakeCollection({
  unique: [{ fields: ['ownerUserId'], where: doc => doc.kind === 'personal' }]
}));
jest.mock('../../src/models/Membership', () => require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['workspaceId', 'userId'] }] }));
jest.mock('../../src/models/Policy', () => require('../helpers/fakeCollection').fakeCollection({
  unique: [{ fields: ['policyId'] }, { fields: ['defaultKey'] }]
}));
jest.mock('../../src/models/ResponseAction', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['actionId'] }] }),
  { STATUSES: ['proposed', 'applied', 'failed', 'unsupported'], RETENTION_DAYS: 90 }
));

const fs = require('fs');
const path = require('path');
const express = require('express');
const User = require('../../src/models/User');
const Workspace = require('../../src/models/Workspace');
const Membership = require('../../src/models/Membership');
const Policy = require('../../src/models/Policy');
const ResponseAction = require('../../src/models/ResponseAction');
const realtimeBus = require('../../src/services/realtimeBus');
const { PolicyEngineService, policyEngineService, DEFAULT_POLICIES } = require('../../src/services/policyEngineService');
const { ensurePersonalWorkspace } = require('../../src/services/workspaceService');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { serve } = require('../helpers/http');

const policy = (type, name = `test ${type}`) => ({
  name, trigger: { metric: 'risk_score', operator: '>=', threshold: 10 }, action: { type }
});
let alice;
let bob;
const principalOf = user => ({ userId: String(user._id), workspaceId: String(user.defaultWorkspaceId) });
const fire = async (engine, nodeId = 'node-1', who = alice) =>
  (await engine.evaluate({ nodeId, ...principalOf(who), metrics: { risk_score: 50 } })).triggered;

async function engineWith(...types) {
  const engine = new PolicyEngineService({ seedDefaults: false });
  for (const type of types) await engine.createPolicy(policy(type), 'tester');
  return engine;
}

beforeEach(async () => {
  for (const model of [User, Workspace, Membership, Policy, ResponseAction]) model.reset();
  jest.restoreAllMocks();
  alice = await User.create({ email: 'alice@example.org', role: 'user', isActive: true, activity: {} });
  bob = await User.create({ email: 'bob@example.org', role: 'user', isActive: true, activity: {} });
  await ensurePersonalWorkspace(alice);
  await ensurePersonalWorkspace(bob);
});

describe('what a fired policy reports', () => {
  test('an action type that nothing carries out is "unsupported", with the reason, and never applied', async () => {
    for (const type of ['soft_block', 'session_restrict', 'weight_boost', 'agent_task', 'alert_escalate']) {
      Policy.reset();
      const [action] = await fire(await engineWith(type));
      expect(action).toMatchObject({ actionType: type, status: 'unsupported' });
      expect(action.reason).toMatch(/nothing was done/i);
      expect(action).not.toHaveProperty('receipt');
    }
  });

  test('the one built-in action that is real, the log entry, is applied with a full receipt', async () => {
    const engine = await engineWith('log_response');
    const [action] = await fire(engine);
    expect(action.status).toBe('applied');
    expect(action.receipt).toEqual({
      executor: 'response-log',
      target: `response log entry ${action.actionId}`,
      appliedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      verification: 'entry read back from the response log'
    });
    const [stored] = (await engine.getResponseLog(principalOf(alice))).log;
    expect(stored).toMatchObject({ actionId: action.actionId, status: 'applied', receipt: action.receipt });
  });

  test('an executor that cannot do it leaves the action "failed" with the reason', async () => {
    const engine = await engineWith('soft_block');
    engine.registerExecutor('soft_block', { name: 'firewall', run: () => { throw new Error('the firewall did not answer'); } });
    const [action] = await fire(engine);
    expect(action).toMatchObject({ status: 'failed', reason: 'the firewall did not answer', executor: 'firewall' });
    expect(action).not.toHaveProperty('receipt');
  });

  test.each([
    ['nothing', () => undefined],
    ['no target', () => ({ verification: 'checked' })],
    ['no verification', () => ({ target: 'node-1' })],
    ['a bare "true"', () => true],
    ['a promise of nothing', async () => undefined]
  ])('an executor that returns %s has not applied anything', async (label, run) => {
    const engine = await engineWith('soft_block');
    engine.registerExecutor('soft_block', { name: 'careless', run });
    const [action] = await fire(engine);
    expect(action.status).toBe('failed');
    expect(action.reason).toMatch(/no receipt/);
  });

  test('a registered executor is given the action and its receipt is recorded', async () => {
    const engine = await engineWith('session_restrict');
    const run = jest.fn(async action => ({ target: `node ${action.nodeId}`, verification: 'limit read back from the node' }));
    engine.registerExecutor('session_restrict', { name: 'node-agent', run });
    const [action] = await fire(engine, 'node-7');
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'session_restrict', nodeId: 'node-7', userId: String(alice._id) }));
    expect(action).toMatchObject({ status: 'applied', receipt: { executor: 'node-agent', target: 'node node-7', verification: 'limit read back from the node' } });
  });

  test('an executor must name itself and be for a known action type', () => {
    const engine = new PolicyEngineService({ seedDefaults: false });
    expect(() => engine.registerExecutor('launch_missiles', { name: 'x', run: () => ({}) })).toThrow(/Unknown action type/);
    expect(() => engine.registerExecutor('soft_block', { run: () => ({}) })).toThrow(/name and a run function/);
    expect(() => engine.registerExecutor('soft_block', { name: 'x' })).toThrow(/name and a run function/);
  });

  test('statistics separate what was applied from what was not', async () => {
    const engine = await engineWith('log_response', 'soft_block', 'agent_task');
    await fire(engine);
    expect(await engine.getStats(principalOf(alice))).toMatchObject({
      totalResponseActions: 3,
      responseActionsByStatus: { applied: 1, unsupported: 2 },
      supportedActionTypes: ['log_response']
    });
  });

  test('the list of action types says which ones are supported', () => {
    const types = new PolicyEngineService({ seedDefaults: false }).getActionTypes();
    expect(types.log_response).toMatchObject({ label: 'Log Response', supported: true });
    expect(types.soft_block).toMatchObject({ supported: false });
    expect(Object.values(types).every(type => typeof type.supported === 'boolean')).toBe(true);
  });

  test('no response is ever given the old "executed" status', async () => {
    const engine = await engineWith('log_response', 'soft_block', 'notify_soc');
    const statuses = (await fire(engine)).map(action => action.status);
    expect(statuses).not.toContain('executed');
    expect(statuses.every(status => ['applied', 'failed', 'unsupported'].includes(status))).toBe(true);
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'services', 'policyEngineService.js'), 'utf8');
    expect(source).not.toMatch(/status:\s*'executed'/);
  });
});

describe('where policies and responses are kept', () => {
  test('policies and responses outlive the engine that made them, as they outlive a restart', async () => {
    const before = await engineWith('log_response');
    const [action] = await fire(before);
    const afterRestart = new PolicyEngineService({ seedDefaults: false });
    expect((await afterRestart.listPolicies()).policies.map(p => p.name)).toEqual(['test log_response']);
    expect((await afterRestart.getResponseLog(principalOf(alice))).log.map(entry => entry.actionId)).toEqual([action.actionId]);
    const [stored] = (await afterRestart.listPolicies()).policies;
    expect(stored).toMatchObject({ triggerCount: 1, lastTriggered: expect.any(String) });
  });

  test('a response is kept in the workspace whose event fired it, and only that workspace sees it', async () => {
    const engine = await engineWith('log_response');
    await fire(engine, 'node-a', alice);
    await fire(engine, 'node-b', bob);
    const mine = await engine.getResponseLog(principalOf(alice));
    const theirs = await engine.getResponseLog(principalOf(bob));
    expect(mine.log.map(e => e.nodeId)).toEqual(['node-a']);
    expect(theirs.log.map(e => e.nodeId)).toEqual(['node-b']);
    expect(mine.log[0].workspaceId).toBe(String(alice.defaultWorkspaceId));
    expect((await engine.getPlatformResponseLog()).total).toBe(2);
    expect((await engine.getStats(principalOf(alice))).totalResponseActions).toBe(1);
    expect((await engine.getStats(null)).totalResponseActions).toBe(2);
  });

  test('a response that cannot be recorded is not carried out', async () => {
    const engine = await engineWith('notify_soc');
    const run = jest.fn(() => ({ target: 't', verification: 'v' }));
    engine.registerExecutor('notify_soc', { name: 'live-feed', run });
    jest.spyOn(ResponseAction, 'create').mockRejectedValueOnce(new Error('database unavailable'));
    const [action] = await fire(engine);
    expect(action).toMatchObject({ status: 'failed', reason: 'The response could not be recorded; nothing was done.' });
    expect(run).not.toHaveBeenCalled();
  });

  test("the built-in policies are created once, and an administrator's change to one is kept", async () => {
    const first = new PolicyEngineService();
    expect((await first.listPolicies()).total).toBe(DEFAULT_POLICIES.length);
    const highRisk = (await first.listPolicies()).policies.find(p => p.name === 'High Risk Score Alert');
    await first.updatePolicy(highRisk.id, { enabled: false }, 'admin-1');

    const second = new PolicyEngineService(); // the next process start
    const policies = (await second.listPolicies()).policies;
    expect(policies).toHaveLength(DEFAULT_POLICIES.length);
    expect(policies.find(p => p.name === 'High Risk Score Alert').enabled).toBe(false);
    expect(await second.deletePolicy(highRisk.id, 'admin-1')).toEqual({ success: false, error: 'Cannot delete default policies' });
  });

  test('a change is checked as strictly as a new policy', async () => {
    const engine = await engineWith('log_response');
    const [existing] = (await engine.listPolicies()).policies;
    expect(await engine.updatePolicy(existing.id, { trigger: { metric: 'nonsense', operator: '>=', threshold: 1 } })).toMatchObject({ success: false });
    expect(await engine.updatePolicy(existing.id, { action: { type: 'launch_missiles' } })).toMatchObject({ success: false });
    expect(await engine.updatePolicy(existing.id, { trigger: { metric: 'risk_score', operator: '>=', threshold: 'high' } })).toMatchObject({ success: false });
    expect(await engine.updatePolicy('no-such-policy', { enabled: false })).toEqual({ success: false, error: 'Policy not found' });
  });

  test('cooldowns still stop the same node firing the same policy twice in a row', async () => {
    const engine = await engineWith('log_response');
    expect(await fire(engine)).toHaveLength(1);
    expect(await fire(engine)).toHaveLength(0);
    expect(await fire(engine, 'node-1', bob)).toHaveLength(1); // another account's cooldown is its own
  });
});

describe('through the API', () => {
  let client;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/policy', require('../../src/routes/policy'));
    client = await serve(app);
  });
  afterAll(() => client.close());
  beforeEach(async () => {
    policyEngineService.seedDefaults = false;
    policyEngineService._forget();
    policyEngineService.evaluationCache.clear();
    await policyEngineService.createPolicy(policy('notify_soc', 'notify on risk'), 'tester');
  });
  const as = user => ({ Authorization: `Bearer ${signSessionToken(user)}` });
  const evaluate = (nodeId, user = alice) => client.request('/api/policy/evaluate', {
    method: 'POST', headers: as(user), body: { nodeId, metrics: { risk_score: 80 } }
  });

  test("\"Notify SOC\" is applied when the notification is published to that account's live feed", async () => {
    realtimeBus.emit.mockReturnValue({ id: 'run-42', type: 'alert:new' });
    const response = await evaluate('node-a');
    const [action] = response.body.data.triggered;
    expect(realtimeBus.emit).toHaveBeenCalledWith('alert:new', expect.objectContaining({ userId: String(alice._id), source: 'policy', nodeId: 'node-a', actionId: action.actionId }));
    expect(action).toMatchObject({
      status: 'applied',
      receipt: { executor: 'live-feed', target: `live feed of account ${alice._id}`, verification: 'published as event run-42' }
    });
  });

  test('"Notify SOC" is failed, not applied, when nothing was published', async () => {
    realtimeBus.emit.mockReturnValue(null);
    const [action] = (await evaluate('node-b')).body.data.triggered;
    expect(action).toMatchObject({ status: 'failed', reason: 'the notification was not published', executor: 'live-feed' });
    expect(action).not.toHaveProperty('receipt');
  });

  test("the response log is the caller's workspace's; the platform view is for administrators", async () => {
    realtimeBus.emit.mockReturnValue({ id: 'e' });
    await evaluate('node-a', alice);
    await evaluate('node-b', bob);
    const mine = await client.request('/api/policy/response-log', { headers: as(alice) });
    expect(mine.body).toMatchObject({ scope: 'workspace', total: 1 });
    expect(mine.body.log[0].nodeId).toBe('node-a');
    expect((await client.request('/api/policy/response-log?scope=platform', { headers: as(alice) })).status).toBe(403);
    const admin = await User.create({ email: 'admin@example.org', role: 'admin', isActive: true, activity: {} });
    await ensurePersonalWorkspace(admin);
    const everything = await client.request('/api/policy/response-log?scope=platform', { headers: as(admin) });
    expect(everything.body).toMatchObject({ scope: 'platform', total: 2 });
  });

  test('the public description of action types marks what this deployment can do', async () => {
    const meta = await client.request('/api/policy/meta');
    expect(meta.body.data.actionTypes.notify_soc.supported).toBe(true);
    expect(meta.body.data.actionTypes.log_response.supported).toBe(true);
    expect(meta.body.data.actionTypes.soft_block.supported).toBe(false);
  });
});
