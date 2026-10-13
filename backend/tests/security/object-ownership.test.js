// Authentication says who is asking; these tests check what each account can
// reach. Two ordinary accounts, an analyst and an administrator use the real
// routes, the real session check and the real in-memory stores (B03.2c).
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/services/redis', () => ({
  isReady: () => false, get: jest.fn(async () => null), set: jest.fn(async () => true), del: jest.fn(async () => true)
}));
jest.mock('../../src/services/vectorDatabase', () => ({}));
jest.mock('../../src/services/cyberforgeMLService', () => ({
  cyberforgeML: {
    analyzeUrl: jest.fn(),
    classifyUrlPhishing: jest.fn(),
    detectDga: jest.fn(),
    predict: jest.fn()
  }
}));
jest.mock('../../src/services/WebScraperAPIService', () => ({
  webScraperAPIService: {
    scrapeWebsite: jest.fn(),
    status: () => ({ available: false, reason: 'not configured in tests' })
  }
}));
jest.mock('../../src/services/llmFallbackChain', () => ({ llmFallbackChain: { explainThreat: jest.fn() } }));
jest.mock('../../src/services/mlServiceClient', () => require('../helpers/stub').anything());
jest.mock('../../src/services/realtimeBus', () => require('../helpers/stub').anything());
jest.mock('../../src/services/websocket', () => require('../helpers/stub').anything());
jest.mock('../../src/services/otx', () => ({
  startPolling: jest.fn(), stopPolling: jest.fn(), getIndicatorDetails: jest.fn(),
  apiKey: 'otx-key-ending-9f3c', pollingInterval: null, lastPulseTimestamp: null
}));
jest.mock('../../src/services/appwriteService', () => ({
  appwriteService: {
    getAgent: jest.fn(), getTask: jest.fn(), createAgentTask: jest.fn(), createAlert: jest.fn(), listAlerts: jest.fn(),
    createBrowserIntelligenceSnapshot: jest.fn(), getLatestBrowserIntelligence: jest.fn()
  }
}));
jest.mock('../../src/agent/CyberforgeAgent', () => {
  let started = 0;
  return {
    CyberforgeAgent: jest.fn().mockImplementation(config => ({
      userId: config.userId, agentId: `agent-${++started}`, deviceId: 'device', state: 'idle', isRunning: true, metadata: {},
      start: jest.fn(async () => {}), stop: jest.fn(async () => {})
    }))
  };
});

const express = require('express');
const User = require('../../src/models/User');
const { cyberforgeML } = require('../../src/services/cyberforgeMLService');
const { webScraperAPIService } = require('../../src/services/WebScraperAPIService');
const { llmFallbackChain } = require('../../src/services/llmFallbackChain');
const { appwriteService } = require('../../src/services/appwriteService');
const otxService = require('../../src/services/otx');
const { agentManager } = require('../../src/agent/AgentManager');
const { sandboxAnalysisService } = require('../../src/services/sandboxAnalysisService');
const { memoryService } = require('../../src/services/memoryService');
const { distributedIntelligenceService } = require('../../src/services/distributedIntelligenceService');
const { policyEngineService } = require('../../src/services/policyEngineService');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { serve } = require('../helpers/http');

const account = (id, role, email) => ({
  _id: id, email, role, isActive: true, isLocked: () => false, activity: {}, save: jest.fn()
});
const alice = account('507f1f77bcf86cd799439011', 'user', 'alice@example.com');
const bob = account('507f1f77bcf86cd799439012', 'user', 'bob@example.com');
const analyst = account('507f1f77bcf86cd799439013', 'analyst', 'analyst@example.com');
const admin = account('507f1f77bcf86cd799439014', 'admin', 'admin@example.com');
const accounts = [alice, bob, analyst, admin];

let client;
let consoleError;
const as = (user, path, options = {}) => client.request(path, {
  ...options, headers: { Authorization: `Bearer ${signSessionToken(user)}` }
});

beforeAll(async () => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const app = express();
  app.use(express.json());
  app.use('/api/agent', require('../../src/routes/agentRoutes'));
  app.use('/api/sandbox', require('../../src/routes/sandbox'));
  app.use('/api/orchestrator', require('../../src/routes/orchestrator'));
  app.use('/api/otx', require('../../src/routes/otx'));
  app.use('/api/distributed', require('../../src/routes/distributed'));
  app.use('/api/policy', require('../../src/routes/policy'));
  app.use('/api/audit', require('../../src/routes/audit'));
  app.use('/api/memory', require('../../src/routes/memory'));
  app.use('/api/browser-intelligence', require('../../src/routes/browser-intelligence'));
  client = await serve(app);
});
afterAll(async () => {
  consoleError.mockRestore();
  await client.close();
});
beforeEach(() => {
  User.findById.mockImplementation(async id => accounts.find(user => user._id === String(id)) || null);
  cyberforgeML.analyzeUrl.mockResolvedValue({
    aggregate: { recommended_action: 'warn', overall_risk_level: 'medium', blended_threat_score: 0.5 },
    features_analyzed: { has_ip_address: true, is_https: false }
  });
  cyberforgeML.classifyUrlPhishing.mockResolvedValue({ is_threat: true, confidence: 0.9, threat_score: 0.9, prediction: 'phishing' });
  cyberforgeML.detectDga.mockResolvedValue({ is_threat: false, confidence: 0.8, threat_score: 0.1, prediction: 'legit' });
  webScraperAPIService.scrapeWebsite.mockResolvedValue({ success: false, error_code: 'SCRAPER_NOT_CONFIGURED', error: 'not configured in tests' });
  llmFallbackChain.explainThreat.mockResolvedValue({ text: 'summary', source: 'test' });
  appwriteService.createAlert.mockResolvedValue({});
});

describe('sandbox scans', () => {
  let scanId;

  test('a scan is stored for the account that ran it, whatever owner the request names', async () => {
    const response = await as(alice, '/api/sandbox/analyze/url', {
      method: 'POST', body: { url: 'http://198.51.100.7/login', userId: bob._id, metadata: { ownerId: bob._id } }
    });
    expect(response.status).toBe(200);
    scanId = response.body.scan.id;
    expect(sandboxAnalysisService.scans.get(scanId).ownerId).toBe(alice._id);
  });

  test('another account cannot read it, and is told only that it was not found', async () => {
    expect((await as(bob, `/api/sandbox/scan/${scanId}`)).status).toBe(404);
    expect((await as(bob, '/api/sandbox/scan/no-such-scan')).status).toBe(404);
    const own = await as(alice, `/api/sandbox/scan/${scanId}`);
    expect(own.status).toBe(200);
    expect(own.body.scan.target).toBe('http://198.51.100.7/login');
  });

  test('another account cannot delete it', async () => {
    expect((await as(bob, `/api/sandbox/scan/${scanId}`, { method: 'DELETE' })).status).toBe(404);
    expect(sandboxAnalysisService.scans.has(scanId)).toBe(true);
  });

  test('history, indicators and the technique heatmap cover only the caller\'s scans', async () => {
    const mine = await as(alice, '/api/sandbox/history');
    expect(mine.body.total).toBe(1);
    expect((await as(alice, '/api/sandbox/iocs')).body.count).toBeGreaterThan(0);

    const theirs = await as(bob, '/api/sandbox/history');
    expect(theirs.body).toMatchObject({ total: 0, scans: [] });
    expect((await as(bob, '/api/sandbox/iocs')).body).toMatchObject({ count: 0, iocs: [] });
    expect((await as(bob, '/api/sandbox/mitre/heatmap')).body).toMatchObject({ count: 0, techniques: [] });
  });

  test('a scan stored without an owner is visible to nobody', () => {
    sandboxAnalysisService._store({ id: 'legacy', type: 'url', target: 'x', iocs: [], mitre: { techniques: [] } });
    expect(sandboxAnalysisService.getScan('legacy', alice._id)).toBeNull();
    expect(sandboxAnalysisService.getScan('legacy', undefined)).toBeNull();
    expect(sandboxAnalysisService.listHistory({}).total).toBe(0);
    sandboxAnalysisService.scans.delete('legacy');
    sandboxAnalysisService.scanOrder.splice(sandboxAnalysisService.scanOrder.indexOf('legacy'), 1);
  });

  test('the owner can delete it', async () => {
    expect((await as(alice, `/api/sandbox/scan/${scanId}`, { method: 'DELETE' })).status).toBe(200);
    expect(sandboxAnalysisService.scans.has(scanId)).toBe(false);
  });
});

describe('orchestrator reports and browsing sessions', () => {
  test('a report and its session are recorded for the account that ran the analysis', async () => {
    const response = await as(alice, '/api/orchestrator/analyze', {
      method: 'POST', body: { url: 'http://198.51.100.7/login', sessionId: 'tab-1', userId: bob._id }
    });
    expect(response.status).toBe(200);
    expect(response.body.report.userId).toBe(alice._id);

    const recent = await as(alice, '/api/orchestrator/recent');
    expect(recent.body.reports).toHaveLength(1);
    expect(recent.body.reports[0]).toMatchObject({ url: 'http://198.51.100.7/login', sessionId: 'tab-1' });
    expect(recent.body.reports[0]).not.toHaveProperty('ownerId');
  });

  test('another account sees none of it: not the reports, the statistics or the filtered list', async () => {
    expect((await as(bob, '/api/orchestrator/recent')).body.reports).toEqual([]);
    expect((await as(bob, '/api/orchestrator/reports/filter?sessionId=tab-1')).body).toMatchObject({ count: 0, reports: [] });
    expect((await as(bob, '/api/orchestrator/stats')).body.stats).toMatchObject({ totalReports: 0, verdictBreakdown: {} });
    expect((await as(alice, '/api/orchestrator/stats')).body.stats.totalReports).toBe(1);
    expect((await as(alice, '/api/orchestrator/reports/filter?sessionId=tab-1')).body.count).toBe(1);
  });

  test('the same session ID under another account is a different, empty session', async () => {
    const mine = await as(alice, '/api/orchestrator/memory/session/tab-1');
    expect(mine.status).toBe(200);
    expect(mine.body.session.urls.map(entry => entry.url)).toEqual(['http://198.51.100.7/login']);

    expect((await as(bob, '/api/orchestrator/memory/session/tab-1')).status).toBe(404);
    const summary = await as(bob, '/api/orchestrator/session/tab-1/summary');
    expect(summary.body).toMatchObject({ totalReports: 0, memory: null, topThreats: [], stats: { urls: 0 } });
    expect((await as(alice, '/api/orchestrator/session/tab-1/summary')).body.totalReports).toBe(1);
  });

  test('a session cannot be reached by putting an account ID in the session name', async () => {
    expect((await as(bob, `/api/orchestrator/memory/session/${encodeURIComponent(`${alice._id}:tab-1`)}`)).status).toBe(404);
    memoryService.recordUrlInSession('shared', { url: 'http://a.example/', verdict: 'clean', host: 'a.example' });
    expect(memoryService.getSession('shared', bob._id)).toBeNull();
    expect(memoryService.getSession(':shared', bob._id)).toBeNull();
  });
});

describe('agents and agent tasks', () => {
  test('two accounts each get their own agent of the same name', async () => {
    const first = await as(alice, '/api/agent/start', { method: 'POST', body: { agentName: 'default' } });
    const second = await as(bob, '/api/agent/start', { method: 'POST', body: { agentName: 'default', userId: alice._id } });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.agentId).not.toBe(first.body.data.agentId);
    expect(agentManager.getAgent('default', bob._id).userId).toBe(bob._id);
  });

  test('status and the agent list describe only the caller\'s agents', async () => {
    await as(alice, '/api/agent/start', { method: 'POST', body: { agentName: 'night-watch' } });
    expect((await as(bob, '/api/agent/status/night-watch')).body.data).toEqual({ exists: false });
    expect((await as(alice, '/api/agent/status/night-watch')).body.data.exists).toBe(true);
    expect((await as(bob, '/api/agent/list')).body.data.agents.map(agent => agent.name)).toEqual(['default']);
    expect((await as(alice, '/api/agent/list')).body.data.agents.map(agent => agent.name).sort()).toEqual(['default', 'night-watch']);
  });

  test('stopping an agent by name does not stop another account\'s agent of that name', async () => {
    const theirs = agentManager.getAgent('night-watch', alice._id);
    expect((await as(bob, '/api/agent/stop', { method: 'POST', body: { agentName: 'night-watch' } })).status).toBe(200);
    expect(theirs.stop).not.toHaveBeenCalled();
    expect(agentManager.getAgent('night-watch', alice._id)).toBe(theirs);

    await as(alice, '/api/agent/stop', { method: 'POST', body: { agentName: 'night-watch' } });
    expect(theirs.stop).toHaveBeenCalledTimes(1);
    expect(agentManager.getAgent('night-watch', alice._id)).toBeUndefined();
  });

  test('shutdown stops every account\'s agents', async () => {
    const running = [agentManager.getAgent('default', alice._id), agentManager.getAgent('default', bob._id)];
    await agentManager.stopAllAgents();
    for (const agent of running) expect(agent.stop).toHaveBeenCalledTimes(1);
    expect(agentManager.listAgents(alice._id)).toEqual([]);
    expect(agentManager.listAgents(bob._id)).toEqual([]);
  });

  test('a task is read only by the account it belongs to', async () => {
    appwriteService.getTask.mockResolvedValue({ $id: 'task-1', status: 'pending', user_id: alice._id });
    expect((await as(alice, '/api/agent/task/task-1')).status).toBe(200);
    const foreign = await as(bob, '/api/agent/task/task-1');
    expect(foreign.status).toBe(404);
    expect(JSON.stringify(foreign.body)).not.toContain('pending');

    appwriteService.getTask.mockRejectedValue(Object.assign(new Error('Document not found'), { code: 404 }));
    const missing = await as(bob, '/api/agent/task/task-2');
    expect({ status: missing.status, body: missing.body }).toEqual({ status: foreign.status, body: foreign.body });
  });

  test('a task cannot be queued for another account\'s agent', async () => {
    appwriteService.getAgent.mockResolvedValue({ $id: 'agent-a', user_id: alice._id });
    appwriteService.createAgentTask.mockResolvedValue({ $id: 'task-9', status: 'pending' });
    const body = { agentId: 'agent-a', taskType: 'scan', targetUrl: 'https://example.com' };

    expect((await as(bob, '/api/agent/task/create', { method: 'POST', body })).status).toBe(404);
    expect(appwriteService.createAgentTask).not.toHaveBeenCalled();

    expect((await as(alice, '/api/agent/task/create', { method: 'POST', body: { ...body, userId: bob._id } })).status).toBe(200);
    expect(appwriteService.createAgentTask).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'agent-a', userId: alice._id }));
  });
});

describe('threat-feed polling', () => {
  test.each(['start-polling', 'stop-polling'])('%s is refused to users and analysts', async route => {
    for (const user of [alice, analyst]) {
      expect((await as(user, `/api/otx/${route}`, { method: 'POST', body: {} })).status).toBe(403);
    }
    expect(otxService.startPolling).not.toHaveBeenCalled();
    expect(otxService.stopPolling).not.toHaveBeenCalled();
  });

  test('an administrator can start and stop polling', async () => {
    expect((await as(admin, '/api/otx/start-polling', { method: 'POST', body: { interval: 60000 } })).status).toBe(200);
    expect(otxService.startPolling).toHaveBeenCalledWith(60000);
    expect((await as(admin, '/api/otx/stop-polling', { method: 'POST', body: {} })).status).toBe(200);
    expect(otxService.stopPolling).toHaveBeenCalledTimes(1);
  });

  test('the statistics say whether a key is configured without showing any of it', async () => {
    const response = await as(alice, '/api/otx/stats');
    expect(response.body.data.apiKey).toBe('configured');
    expect(JSON.stringify(response.body)).not.toContain('9f3c');
  });
});

describe('distributed nodes', () => {
  const node = { nodeId: 'node-alice', deviceFingerprint: 'fp-1', hostname: 'alice-laptop' };
  const telemetry = (nonce, nodeId = node.nodeId) => ({ nodeId, nonce, sequenceId: 1, metrics: { totalAlerts: 2 } });

  test('a node ID registered to one account cannot be re-registered by another', async () => {
    expect((await as(alice, '/api/distributed/nodes/register', { method: 'POST', body: node })).status).toBe(200);
    const takeover = await as(bob, '/api/distributed/nodes/register', { method: 'POST', body: { ...node, hostname: 'bob-laptop' } });
    expect(takeover.status).toBe(400);
    expect(distributedIntelligenceService.nodes.get(node.nodeId)).toMatchObject({ userId: alice._id, hostname: 'alice-laptop' });
    expect((await as(alice, '/api/distributed/nodes/register', { method: 'POST', body: node })).body.message).toBe('Node updated');
  });

  test('telemetry is accepted only from the node\'s owner', async () => {
    const foreign = await as(bob, '/api/distributed/telemetry/sync', { method: 'POST', body: telemetry('n-1') });
    const unknown = await as(bob, '/api/distributed/telemetry/sync', { method: 'POST', body: telemetry('n-2', 'no-such-node') });
    expect(foreign.status).toBe(400);
    expect(foreign.body).toEqual(unknown.body);
    expect(distributedIntelligenceService.telemetryStore.has(node.nodeId)).toBe(false);

    expect((await as(alice, '/api/distributed/telemetry/sync', { method: 'POST', body: telemetry('n-3') })).status).toBe(200);
    expect(distributedIntelligenceService.telemetryStore.get(node.nodeId)).toHaveLength(1);
  });

  test('a node\'s telemetry is read by its owner and administrators only', async () => {
    expect((await as(bob, `/api/distributed/telemetry/${node.nodeId}`)).status).toBe(404);
    expect((await as(analyst, `/api/distributed/telemetry/${node.nodeId}`)).status).toBe(404);
    expect((await as(alice, `/api/distributed/telemetry/${node.nodeId}`)).body.data.total).toBe(1);
    expect((await as(admin, `/api/distributed/telemetry/${node.nodeId}`)).body.data.total).toBe(1);
  });

  test('each account lists its own nodes; the full list and node broadcast are for administrators', async () => {
    expect((await as(alice, '/api/distributed/nodes')).body.data.total).toBe(1);
    expect((await as(bob, '/api/distributed/nodes')).body.data.total).toBe(0);
    for (const route of ['/api/distributed/nodes/all', '/api/distributed/broadcast/nodes']) {
      expect((await as(bob, route)).status).toBe(403);
      expect((await as(analyst, route)).status).toBe(403);
      expect((await as(admin, route)).status).toBe(200);
    }
  });

  test('cross-node correlations are for analysts and administrators', async () => {
    expect((await as(bob, '/api/distributed/correlations')).status).toBe(403);
    expect((await as(analyst, '/api/distributed/correlations')).status).toBe(200);
  });

  test('only an administrator can change the global risk weights', async () => {
    const before = distributedIntelligenceService.getRiskWeightTable().global;
    for (const user of [alice, analyst]) {
      expect((await as(user, '/api/distributed/weights', { method: 'PUT', body: { global: 9 } })).status).toBe(403);
    }
    expect(distributedIntelligenceService.getRiskWeightTable().global).toBe(before);
    expect((await as(alice, '/api/distributed/weights')).status).toBe(200);

    expect((await as(admin, '/api/distributed/weights', { method: 'PUT', body: { global: 2 } })).body.data.global).toBe(2);
    await as(admin, '/api/distributed/weights', { method: 'PUT', body: { global: before } });
  });
});

describe('policy responses and audit statistics', () => {
  const event = { nodeId: 'shared-node-name', metrics: { risk_score: 99 } };

  test('one account evaluating a node name does not suppress another account\'s policies for it', async () => {
    const first = await as(alice, '/api/policy/evaluate', { method: 'POST', body: event });
    expect(first.body.data.triggered.length).toBeGreaterThan(0);

    const second = await as(bob, '/api/policy/evaluate', { method: 'POST', body: event });
    expect(second.body.data.triggered.length).toBe(first.body.data.triggered.length);

    // The same account, straight away, is inside its own suppression window.
    expect((await as(alice, '/api/policy/evaluate', { method: 'POST', body: event })).body.data.triggered).toEqual([]);
  });

  test('the response log shows a user their own responses, and analysts every response', async () => {
    const everything = policyEngineService.getResponseLog({}).total;
    const mine = await as(alice, '/api/policy/response-log');
    const theirs = await as(bob, '/api/policy/response-log');
    expect(mine.body.total).toBeGreaterThan(0);
    expect(mine.body.log.every(entry => entry.userId === alice._id)).toBe(true);
    expect(theirs.body.log.every(entry => entry.userId === bob._id)).toBe(true);
    expect(mine.body.total + theirs.body.total).toBe(everything);

    expect((await as(analyst, '/api/policy/response-log')).body.total).toBe(everything);
    expect((await as(admin, '/api/policy/response-log')).body.total).toBe(everything);
  });

  test('audit statistics, which name the most active users, need the analyst role', async () => {
    expect((await as(alice, '/api/audit/stats')).status).toBe(403);
    expect((await as(analyst, '/api/audit/stats')).status).toBe(200);
  });
});

describe('memories and browser intelligence', () => {
  test('saving under an ID that another account uses does not replace the other memory', async () => {
    await as(alice, '/api/memory/save', { method: 'POST', body: { id: 'm-1', text: 'alice saw a look-alike login page' } });
    await as(bob, '/api/memory/save', { method: 'POST', body: { id: 'm-1', text: 'overwritten by bob', userId: alice._id } });

    const mine = JSON.stringify((await as(alice, '/api/memory')).body);
    expect(mine).toContain('alice saw a look-alike login page');
    expect(mine).not.toContain('overwritten by bob');
    expect(JSON.stringify((await as(bob, '/api/memory')).body)).toContain('overwritten by bob');
  });

  test('a behavioural alert and a session snapshot are stored under the sender, not a user_id in the body', async () => {
    appwriteService.createAlert.mockResolvedValue({ $id: 'alert-1' });
    appwriteService.createBrowserIntelligenceSnapshot.mockResolvedValue({ $id: 'snapshot-1' });

    await as(bob, '/api/browser-intelligence/alert', {
      method: 'POST', body: { alert_id: 'a-1', reason: 'credential form', risk_score: 80, user_id: alice._id }
    });
    expect(appwriteService.createAlert).toHaveBeenCalledWith(expect.objectContaining({ userId: bob._id }));

    await as(bob, '/api/browser-intelligence/session', { method: 'POST', body: { sessions: [], user_id: alice._id } });
    expect(appwriteService.createBrowserIntelligenceSnapshot).toHaveBeenCalledWith(expect.objectContaining({ user_id: bob._id }));
  });

  test('the snapshot is fetched for the signed-in account', async () => {
    appwriteService.getLatestBrowserIntelligence.mockResolvedValue(null);
    expect((await as(bob, `/api/browser-intelligence/snapshot?userId=${alice._id}`)).status).toBe(200);
    expect(appwriteService.getLatestBrowserIntelligence).toHaveBeenCalledTimes(1);
    expect(String(appwriteService.getLatestBrowserIntelligence.mock.calls[0][0])).toBe(bob._id);
  });
});
