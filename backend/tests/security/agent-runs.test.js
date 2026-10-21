// Agent runs and approvals (AGT-04, AGT-05): one worker authority with leases and
// fencing, budgets, pause and cancel that stop the work, schedules without
// duplicates, and proposals that become device commands only on approval.
process.env.DEVICE_COMMAND_KEY = Buffer.alloc(32, 9).toString('base64');
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/services/workspaceService', () => ({
  ensurePersonalWorkspace: jest.fn(async user => `ws-${user._id}`),
  workspaceIdFor: jest.fn(async principal => (principal && principal.userId ? (principal.workspaceId || `ws-${principal.userId}`) : null)),
  activeMembership: jest.fn(async (workspaceId, userId) => (workspaceId === `ws-${userId}` ? { role: 'owner' } : null))
}));
const fake = (unique, extra = {}) => Object.assign(require('../helpers/fakeCollection').fakeCollection({ unique }), extra);
jest.mock('../../src/models/Agent', () => fake([{ fields: ['agentId'] }, { fields: ['workspaceId', 'idempotencyKey'] }], { STATES: ['draft', 'ready', 'active', 'paused', 'archived'] }));
jest.mock('../../src/models/AgentRun', () => fake([{ fields: ['runId'] }, { fields: ['workspaceId', 'idempotencyKey'] }], { STATES: [] }));
jest.mock('../../src/models/AgentAction', () => fake([{ fields: ['actionId'] }], { STATES: ['proposed', 'approved', 'rejected', 'expired'] }));
jest.mock('../../src/models/Device', () => fake([{ fields: ['deviceId'] }], { KINDS: ['endpoint'], PLATFORMS: ['windows'], STATES: ['pending_approval', 'active', 'revoked', 'inventory'] }));
jest.mock('../../src/models/DeviceCommand', () => fake([{ fields: ['commandId'] }, { fields: ['workspaceId', 'idempotencyKey'] }], { TYPES: ['block_domain', 'unblock_domain'], STATES: [] }));
jest.mock('../../src/models/AuditEvent', () => fake([], { OUTCOMES: ['success', 'failure', 'warning'], RETENTION_DAYS: 90 }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/services/cyberforgeMLService', () => ({ cyberforgeML: { analyzeUrl: jest.fn() } }));
jest.mock('../../src/services/sandboxAnalysisService', () => ({
  sandboxAnalysisService: { extractIOCsFromUrl: jest.fn(url => [{ type: 'domain', value: new URL(url).hostname }]) }
}));

const express = require('express');
const User = require('../../src/models/User');
const Agent = require('../../src/models/Agent');
const AgentRun = require('../../src/models/AgentRun');
const AgentAction = require('../../src/models/AgentAction');
const Device = require('../../src/models/Device');
const DeviceCommand = require('../../src/models/DeviceCommand');
const AuditEvent = require('../../src/models/AuditEvent');
const { cyberforgeML } = require('../../src/services/cyberforgeMLService');
const worker = require('../../src/services/agentRunService');
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
let n = 0;
beforeEach(() => {
  for (const m of [Agent, AgentRun, AgentAction, Device, DeviceCommand, AuditEvent]) m.reset();
  User.findById.mockImplementation(async id => [alice, bob].find(u => u._id === String(id)) || null);
  cyberforgeML.analyzeUrl.mockReset();
  cyberforgeML.analyzeUrl.mockImplementation(async url => ({ url, aggregate: url.includes('phish')
    ? { recommended_action: 'block', blended_threat_score: 0.97, models_answered: 3 }
    : { recommended_action: 'allow', blended_threat_score: 0.03, models_answered: 3 } }));
});

const as = (user, path, options = {}) => client.request(path, { ...options, headers: { Authorization: `Bearer ${signSessionToken(user)}` } });
const post = (user, path, body = {}) => as(user, path, { method: 'POST', body });
const key = () => `key-${++n}-${Date.now()}`;
const laptop = (owner = alice, fields = {}) => Device.create({
  deviceId: `dev-${++n}`, workspaceId: `ws-${owner._id}`, kind: 'endpoint', platform: 'windows', displayName: 'Laptop', state: 'active',
  capabilities: { advertised: ['hosts_blocking'], enabled: [], confirmed: { hosts_blocking: 'ok' } }, lastSeenAt: new Date(), createdBy: owner._id, ...fields
});
async function activeAgent(user, templateId, config) {
  let agent = (await post(user, '/api/v1/agents', { templateId, name: 'Agent', idempotencyKey: key(), config })).body.data;
  agent = (await post(user, `/api/v1/agents/${agent.agentId}/validate`)).body.data;
  agent = (await post(user, `/api/v1/agents/${agent.agentId}/activate`)).body.data;
  expect(agent.state).toBe('active');
  return agent;
}
const run = (user, agent, idempotencyKey = key()) => post(user, `/api/v1/agents/${agent.agentId}/runs`, { idempotencyKey });
const getRun = (user, runId) => as(user, `/api/v1/runs/${runId}`).then(r => r.body.data);

test('a run carries out the definition\'s steps and records them; the same request twice is one run', async () => {
  const agent = await activeAgent(alice, 'url_analyst', { targets: ['https://phish.example/login', 'example.org'] });
  const first = await run(alice, agent, 'run-key-0001');
  const again = await run(alice, agent, 'run-key-0001');
  expect([first.status, again.status]).toEqual([201, 200]);
  expect(AgentRun.docs).toHaveLength(1);

  await worker.tick();
  const done = await getRun(alice, first.body.data.runId);
  expect(done.state).toBe('completed');
  expect(done.steps.map(s => `${s.tool}:${s.input.target}:${s.status}`)).toEqual([
    'url_classify:https://phish.example/login:completed', 'ioc_extract:https://phish.example/login:completed',
    'url_classify:example.org:completed', 'ioc_extract:example.org:completed'
  ]);
  expect(done.findings.filter(f => f.kind === 'url_verdict').map(f => f.verdict)).toEqual(['malicious', 'clean']);
  expect(done.outcome).toBe('4 of 4 steps completed; 4 findings');
  expect(AgentAction.docs).toHaveLength(0); // observe mode proposes nothing
});

test('no model answering is a failed step, never a clean verdict', async () => {
  cyberforgeML.analyzeUrl.mockResolvedValue({ aggregate: { recommended_action: 'unknown', blended_threat_score: null, models_answered: 0 } });
  const agent = await activeAgent(alice, 'url_analyst', { targets: ['example.org'] });
  const { runId } = (await run(alice, agent)).body.data;
  await worker.tick();
  const done = await getRun(alice, runId);
  expect(done.state).toBe('partial');
  expect(done.steps[0]).toMatchObject({ tool: 'url_classify', status: 'failed', summary: 'no URL model answered, so there is no verdict' });
  expect(done.findings.some(f => f.kind === 'url_verdict')).toBe(false);
});

test('budgets end a run as partial, with the reason, instead of hiding the gap', async () => {
  const agent = await activeAgent(alice, 'url_analyst', { targets: ['a.example', 'b.example'], budget: { maxSteps: 1 } });
  const { runId } = (await run(alice, agent)).body.data;
  await worker.tick();
  const done = await getRun(alice, runId);
  expect(done.state).toBe('partial');
  expect(done.steps.filter(s => s.status === 'skipped').every(s => s.summary === 'the step budget (1) was reached')).toBe(true);
  expect(done.steps.filter(s => s.status === 'completed')).toHaveLength(1);
});

test('pausing an agent stops its work: queued runs do not start, and a running one stops at the next step', async () => {
  const agent = await activeAgent(alice, 'url_analyst', { targets: ['a.example', 'b.example'] });
  const queued = (await run(alice, agent)).body.data;
  await post(alice, `/api/v1/agents/${agent.agentId}/pause`);
  await worker.tick();
  expect(await getRun(alice, queued.runId)).toMatchObject({ state: 'cancelled', outcome: 'The agent is paused; nothing was run.' });
  expect(cyberforgeML.analyzeUrl).not.toHaveBeenCalled();

  await post(alice, `/api/v1/agents/${agent.agentId}/resume`);
  const running = (await run(alice, agent)).body.data;
  cyberforgeML.analyzeUrl.mockImplementationOnce(async () => {
    Agent.docs.find(a => a.agentId === agent.agentId).state = 'paused'; // paused while the first step runs
    return { aggregate: { recommended_action: 'allow', blended_threat_score: 0.1, models_answered: 3 } };
  });
  await worker.tick();
  const stopped = await getRun(alice, running.runId);
  expect(stopped.state).toBe('partial');
  expect(stopped.steps.filter(s => s.status === 'skipped').map(s => s.summary)).toEqual(Array(3).fill('the agent was paused during the run'));
});

test('cancel: a queued run is cancelled at once, a running one at its next step', async () => {
  const agent = await activeAgent(alice, 'url_analyst', { targets: ['a.example', 'b.example'] });
  const queued = (await run(alice, agent)).body.data;
  expect((await post(alice, `/api/v1/runs/${queued.runId}/cancel`)).body.data).toMatchObject({ state: 'cancelled', outcome: 'cancelled before it started' });
  expect((await post(bob, `/api/v1/runs/${queued.runId}/cancel`)).status).toBe(404);

  const second = (await run(alice, agent)).body.data;
  cyberforgeML.analyzeUrl.mockImplementationOnce(async () => {
    AgentRun.docs.find(r => r.runId === second.runId).cancelRequested = true;
    return { aggregate: { recommended_action: 'allow', blended_threat_score: 0.1, models_answered: 3 } };
  });
  await worker.tick();
  expect(await getRun(alice, second.runId)).toMatchObject({ state: 'cancelled' });
  expect((await post(alice, `/api/v1/runs/${second.runId}/cancel`)).body.code).toBe('RUN_FINISHED');
});

test('a worker that lost its lease cannot write to the run; an abandoned run is retried once, then failed', async () => {
  const agent = await activeAgent(alice, 'url_analyst', { targets: ['a.example'] });
  const { runId } = (await run(alice, agent)).body.data;
  // a copy, as a real database returns: the stand-in hands out the stored object itself
  const first = JSON.parse(JSON.stringify(await worker.claimNext()));
  AgentRun.docs[0].lease.expiresAt = new Date(Date.now() - 1000); // the first worker stalls past its lease
  expect(await worker.recoverExpiredLeases()).toBe(1);
  const second = await worker.claimNext();
  expect(second.lease.token).not.toBe(first.lease.token);
  expect(await worker.execute(first)).toBeNull(); // fenced out
  expect(AgentRun.docs[0].state).toBe('leased');
  expect(AgentRun.docs[0].steps || []).toEqual([]); // nothing written by the fenced-out worker
  await worker.execute(second);
  expect(await getRun(alice, runId)).toMatchObject({ state: 'completed', attempts: 2 });

  const other = (await run(alice, agent)).body.data;
  await worker.claimNext();
  const doc = AgentRun.docs.find(r => r.runId === other.runId);
  doc.attempts = 2; doc.lease.expiresAt = new Date(Date.now() - 1000);
  await worker.recoverExpiredLeases();
  expect(await getRun(alice, other.runId)).toMatchObject({ state: 'failed', outcome: 'The worker running it stopped; tried 2 times.' });
});

test('an interval schedule makes one run per slot, however often it is checked', async () => {
  await activeAgent(alice, 'device_health', { schedule: { kind: 'interval', everyMinutes: 60 } });
  const now = Date.now();
  expect(await worker.scheduleDue(now)).toBe(1);
  expect(await worker.scheduleDue(now + 1000)).toBe(0);
  expect(await worker.scheduleDue(now + 60 * 60 * 1000)).toBe(1);
  expect(AgentRun.docs.map(r => r.trigger)).toEqual(['schedule', 'schedule']);
});

test('the device health monitor reports devices that are not online with full coverage', async () => {
  await laptop(alice, { displayName: 'Desk', capabilities: { advertised: ['hosts_blocking'], enabled: [], confirmed: { hosts_blocking: 'denied' } } });
  await laptop(alice, { displayName: 'Old', lastSeenAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) });
  await laptop(alice, { displayName: 'Fine' });
  await laptop(bob, { displayName: 'Not mine', state: 'revoked' });
  const agent = await activeAgent(alice, 'device_health', {});
  const { runId } = (await run(alice, agent)).body.data;
  await worker.tick();
  const done = await getRun(alice, runId);
  expect(done.findings.map(f => `${f.displayName}:${f.connection}:${f.coverage}`).sort()).toEqual(['Desk:online:degraded', 'Old:offline:full']);
});

describe('proposals (assist mode)', () => {
  async function proposing() {
    const device = await laptop(alice);
    const agent = await activeAgent(alice, 'url_analyst', { mode: 'assist', proposals: ['block_domain'], deviceIds: [device.deviceId], targets: ['https://phish.example/login', 'example.org'] });
    const { runId } = (await run(alice, agent)).body.data;
    await worker.tick();
    const done = await getRun(alice, runId);
    return { agent, device, done, action: AgentAction.docs.find(a => a.runId === runId) };
  }

  test('a malicious verdict becomes a proposal for each assigned device, and nothing happens until a member approves it', async () => {
    const { done, action, device } = await proposing();
    expect(done.outcome).toMatch(/1 proposal awaiting approval/);
    expect(action).toMatchObject({ type: 'block_domain', domain: 'phish.example', deviceId: device.deviceId, state: 'proposed' });
    expect(DeviceCommand.docs).toHaveLength(0);
    expect((await as(bob, '/api/v1/actions')).body.data.actions).toEqual([]);
    expect((await post(bob, `/api/v1/actions/${action.actionId}/approve`)).status).toBe(404);

    const approved = (await post(alice, `/api/v1/actions/${action.actionId}/approve`)).body.data;
    expect(approved).toMatchObject({ state: 'approved', outcome: { state: 'queued', receipt: null } });
    expect(DeviceCommand.docs).toHaveLength(1);
    expect(DeviceCommand.docs[0]).toMatchObject({ type: 'block_domain', domain: 'phish.example', deviceId: device.deviceId });
    expect((await post(alice, `/api/v1/actions/${action.actionId}/approve`)).body.code).toBe('ACTION_DECIDED');
    expect(DeviceCommand.docs).toHaveLength(1);

    // the outcome is the device's receipt
    Object.assign(DeviceCommand.docs[0], { state: 'applied', receipt: { status: 'applied', executor: 'hosts_file', detail: 'enforced', at: new Date() } });
    const listed = (await as(alice, '/api/v1/actions')).body.data.actions[0];
    expect(listed.outcome).toMatchObject({ state: 'applied', receipt: { status: 'applied' } });
  });

  test('a proposal is refused once stale: the agent changed, the proposal expired, or the device was revoked', async () => {
    const first = await proposing();
    await as(alice, `/api/v1/agents/${first.agent.agentId}`, { method: 'PATCH', body: { expectedVersion: first.agent.version, config: { objective: 'edited' } } });
    expect((await post(alice, `/api/v1/actions/${first.action.actionId}/approve`)).body.code).toBe('ACTION_STALE');

    const second = await proposing();
    AgentAction.docs.find(a => a.actionId === second.action.actionId).expiresAt = new Date(Date.now() - 1000);
    expect((await post(alice, `/api/v1/actions/${second.action.actionId}/approve`)).body.code).toBe('ACTION_EXPIRED');

    const third = await proposing();
    Device.docs.find(d => d.deviceId === third.device.deviceId).state = 'revoked';
    expect((await post(alice, `/api/v1/actions/${third.action.actionId}/approve`)).body.code).toBe('DEVICE_NOT_ACTIVE');
    expect(DeviceCommand.docs).toHaveLength(0);
  });

  test('a member can reject a proposal; a rejected one cannot then be approved', async () => {
    const { action } = await proposing();
    expect((await post(alice, `/api/v1/actions/${action.actionId}/reject`)).body.data.state).toBe('rejected');
    expect((await post(alice, `/api/v1/actions/${action.actionId}/approve`)).body.code).toBe('ACTION_DECIDED');
  });
});

test('pause-all stops every active agent in the workspace and no other', async () => {
  const mine = await activeAgent(alice, 'device_health', {});
  const theirs = await activeAgent(bob, 'device_health', {});
  const result = (await post(alice, '/api/v1/agents/pause-all')).body.data;
  expect(result).toMatchObject({ paused: 1, agentIds: [mine.agentId] });
  expect(Agent.docs.find(a => a.agentId === theirs.agentId).state).toBe('active');
  expect((await run(alice, mine)).body.code).toBe('AGENT_NOT_ACTIVE');
});

// ── AGT-07: retry failed checks, and search ─────────────────────────────────
describe('retrying failed checks', () => {
  async function partialRun() {
    const agent = await activeAgent(alice, 'url_analyst', { targets: ['a.example', 'down.example'] });
    cyberforgeML.analyzeUrl.mockImplementation(async url => ({ url, aggregate: url.includes('down')
      ? { models_answered: 0 }
      : { recommended_action: 'allow', blended_threat_score: 0.03, models_answered: 3 } }));
    const { runId } = (await run(alice, agent)).body.data;
    await worker.tick();
    const done = await getRun(alice, runId);
    expect(done.state).toBe('partial');
    expect(done.retryableSteps).toBe(1);
    return { agent, runId };
  }

  test('repeats only the failed steps, once per request, and says which run it repeats', async () => {
    const { runId } = await partialRun();
    cyberforgeML.analyzeUrl.mockImplementation(async url => ({ url, aggregate: { recommended_action: 'allow', blended_threat_score: 0.02, models_answered: 3 } }));
    const k = key();
    const first = await post(alice, `/api/v1/runs/${runId}/retry`, { idempotencyKey: k });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ trigger: 'retry', retryOf: runId, state: 'queued' });
    const again = await post(alice, `/api/v1/runs/${runId}/retry`, { idempotencyKey: k });
    expect(again.status).toBe(200);
    expect(again.body.data.runId).toBe(first.body.data.runId);

    cyberforgeML.analyzeUrl.mockClear();
    await worker.tick();
    const retried = await getRun(alice, first.body.data.runId);
    expect(retried.state).toBe('completed');
    expect(retried.steps.map(s => [s.tool, s.input.target])).toEqual([['url_classify', 'down.example']]);
    expect(cyberforgeML.analyzeUrl).toHaveBeenCalledTimes(1);
    expect(AuditEvent.docs.some(e => e.action === 'agent.run_retry' && e.details.retryOf === runId)).toBe(true);
  });

  test('is refused for a run with nothing to retry, another account\'s run, or a changed agent', async () => {
    const { agent, runId } = await partialRun();
    const good = await activeAgent(alice, 'url_analyst', { targets: ['a.example'] });
    cyberforgeML.analyzeUrl.mockImplementation(async url => ({ url, aggregate: { recommended_action: 'allow', blended_threat_score: 0.02, models_answered: 3 } }));
    const ok = (await run(alice, good)).body.data;
    await worker.tick();
    expect((await post(alice, `/api/v1/runs/${ok.runId}/retry`, { idempotencyKey: key() })).body.code).toBe('RUN_NOT_RETRYABLE');
    expect((await post(bob, `/api/v1/runs/${runId}/retry`, { idempotencyKey: key() })).status).toBe(404);
    Agent.docs.find(a => a.agentId === agent.agentId).version += 1;
    expect((await post(alice, `/api/v1/runs/${runId}/retry`, { idempotencyKey: key() })).body.code).toBe('AGENT_CHANGED');
  });

  test('a retry runs only steps still in the definition\'s plan, whatever its record says', async () => {
    const { runId } = await partialRun();
    const { runId: retryId } = (await post(alice, `/api/v1/runs/${runId}/retry`, { idempotencyKey: key() })).body.data;
    // a tampered record asks for a step the definition does not have
    AgentRun.docs.find(r => r.runId === retryId).onlySteps.push({ tool: 'device_status', input: { deviceIds: [] } });
    await worker.tick();
    const retried = await getRun(alice, retryId);
    expect(retried.steps.map(s => s.tool)).toEqual(['url_classify']);
  });
});

describe('searching runs', () => {
  test('by run ID, by device ID and by text, within the workspace only', async () => {
    const device = await laptop(alice, { lastSeenAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) });
    const health = await activeAgent(alice, 'device_health', { deviceIds: [device.deviceId] });
    const urls = await activeAgent(alice, 'url_analyst', { targets: ['shop.example'] });
    const h = (await run(alice, health)).body.data;
    const u = (await run(alice, urls)).body.data;
    await worker.tick();

    const byId = (await as(alice, `/api/v1/runs?q=${u.runId}`)).body.data;
    expect(byId.runs.map(r => r.runId)).toEqual([u.runId]);
    const byDevice = (await as(alice, `/api/v1/runs?deviceId=${device.deviceId}`)).body.data;
    expect(byDevice.runs.map(r => r.runId)).toEqual([h.runId]);
    const byText = (await as(alice, '/api/v1/runs?q=shop.example')).body.data;
    expect(byText.runs.map(r => r.runId)).toEqual([u.runId]);
    expect(byText.runs[0].agentName).toBe('Agent');
    expect(byText).toMatchObject({ total: 1, window: 200 });
    expect((await as(bob, `/api/v1/runs?q=${u.runId}`)).body.data.runs).toEqual([]);
    expect((await as(alice, '/api/v1/runs?state=failed')).body.data.runs).toEqual([]);
  });

  test('addresses in a run are shown with sign-in codes and tokens removed', async () => {
    const agent = await activeAgent(alice, 'url_analyst', { targets: ['https://bank.example/cb?code=SECRET123&lang=en'] });
    const { runId } = (await run(alice, agent)).body.data;
    await worker.tick();
    const shown = JSON.stringify(await getRun(alice, runId)) + JSON.stringify((await as(alice, '/api/v1/runs?q=bank.example')).body.data);
    expect(shown).not.toContain('SECRET123');
    expect(shown).toContain('code=[redacted]');
    // and it never left for analysis with the code in it
    expect(JSON.stringify(cyberforgeML.analyzeUrl.mock.calls)).not.toContain('SECRET123');
  });
});
