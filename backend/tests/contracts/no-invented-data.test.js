// A route answers with what was measured or stored, or says it cannot. It does
// not report a scan as running, a setting as saved, or an alert as raised when
// nothing happened (UX-03, finding F13, B08).
jest.mock('../../src/models', () => ({ Analysis: jest.fn(), Threat: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../src/agent/AgentManager', () => ({ agentManager: { getAgentStatus: jest.fn(() => ({ exists: false })) } }));
jest.mock('../../src/services/mlService', () => ({ mlService: { checkHealth: jest.fn(async () => ({ available: true })) } }));
jest.mock('../../src/middleware/auth', () => {
  // Stand-in for the JWT middleware: these tests are about what happens after it.
  const auth = (req, res, next) => {
    const who = req.headers.authorization;
    if (!who) return res.status(401).json({ success: false, message: 'Access denied.' });
    req.user = { userId: who.replace('Bearer ', ''), role: 'user', email: req.headers['x-test-email'] };
    next();
  };
  return { auth, authorize: () => (req, res, next) => next() };
});

const fs = require('fs');
const path = require('path');
const express = require('express');
const { serve } = require('../helpers/http');
const { agentManager } = require('../../src/agent/AgentManager');
const { mlService } = require('../../src/services/mlService');
const { CAPABILITY_UNAVAILABLE } = require('../../src/services/mlCapabilities');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'routes', 'child-pages.js'), 'utf8');
const alice = { Authorization: 'Bearer alice' };
let server;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  // mounted as server.js mounts them: the threats router first
  app.use('/api/threats', require('../../src/routes/threats'));
  app.use('/api', require('../../src/routes/child-pages'));
  server = await serve(app);
});
afterAll(() => server.close());

test('routes with nothing behind them answer 501 with a reason and no data', async () => {
  for (const [method, route, body] of [
    ['GET', '/api/scan/passive'],
    ['PUT', '/api/scan/passive', { enabled: true }],
    ['GET', '/api/scan/active'],
    ['POST', '/api/scan/active', { target: 'https://example.com' }],
    ['POST', '/api/scan/active/scan-1/stop'],
    ['GET', '/api/scan/stealth/config'],
    ['PUT', '/api/scan/stealth/config', { delay: 5 }],
    ['POST', '/api/scan/stealth', { target: 'https://example.com' }],
    ['GET', '/api/scan/aggressive/config'],
    ['POST', '/api/scan/aggressive', { target: 'https://example.com', confirm: true }],
    ['POST', '/api/ai/agent/threats/threat-1/action', { action: 'confirm' }],
    ['GET', '/api/ai/agent/settings'],
    ['PUT', '/api/ai/agent/settings', { autoAnalysis: false }],
    ['PUT', '/api/ai/models/1', { enabled: false }],
    ['GET', '/api/ai/models/config'],
    ['POST', '/api/team/members/invite', { email: 'someone@example.com' }]
  ]) {
    expect((await server.request(route, { method, body })).status).toBe(401);
    const response = await server.request(route, { method, body, headers: alice });
    expect({ route, method, status: response.status, code: response.body.code, success: response.body.success })
      .toEqual({ route, method, status: 501, code: CAPABILITY_UNAVAILABLE, success: false });
    expect(response.body.message).toMatch(/not |no |cannot /i);
    expect(response.body.data).toBeUndefined();
  }
});

test('a scan that was never started cannot be listed as running or completed', async () => {
  await server.request('/api/scan/active', { method: 'POST', body: { target: 'https://example.com' }, headers: alice });
  await new Promise(resolve => setTimeout(resolve, 50));
  expect((await server.request('/api/scan/active', { headers: alice })).status).toBe(501);
  expect(source).not.toMatch(/simulateScanProgress/);
  expect(source).not.toMatch(/childStores[.]scans[.]set/);
});

test('an account with no alerts gets an empty list, not samples', async () => {
  const alerts = await server.request('/api/alerts', { headers: alice });
  expect(alerts.body).toEqual({ success: true, data: { alerts: [] } });
});

test('threat feeds and the threat map are retired where callers actually reach them (16.67)', async () => {
  // GET used to be read as a threat ID; POST, PUT and DELETE reached handlers that let
  // any account change or delete another account's feed
  for (const [method, route] of [
    ['GET', '/api/threats/feeds'], ['POST', '/api/threats/feeds'], ['PUT', '/api/threats/feeds/feed-of-bob'],
    ['DELETE', '/api/threats/feeds/feed-of-bob'], ['GET', '/api/threats/map']
  ]) {
    const body = method === 'GET' || method === 'DELETE' ? undefined : { name: 'x', userId: 'bob' };
    const response = await server.request(route, { method, body, headers: alice });
    expect({ method, route, status: response.status, code: response.body.code, data: response.body.data })
      .toEqual({ method, route, status: 501, code: CAPABILITY_UNAVAILABLE, data: undefined });
    expect((await server.request(route, { method, body })).status).toBe(401);
  }
  expect(source).not.toMatch(/threatFeeds|threats\/feeds|threats\/map/);
});

test('an alert that is not the caller\'s cannot be acknowledged or dismissed', async () => {
  for (const action of ['acknowledge', 'dismiss']) {
    const response = await server.request(`/api/alerts/no-such-alert/${action}`, { method: 'POST', headers: alice });
    expect({ action, status: response.status, success: response.body.success }).toEqual({ action, status: 404, success: false });
  }
  expect(source).toMatch(/alert\.userId !== req\.user\.userId/);
});

test('agent status reports what can be read back and nothing else', async () => {
  const stopped = await server.request('/api/ai/agent/status', { headers: alice });
  expect(stopped.body.data).toEqual({ running: false, agentState: 'not_started', mlAvailable: true, pendingTasks: 0, threatsDetected: 0 });
  expect(agentManager.getAgentStatus).toHaveBeenCalledWith('default', 'alice');

  // the ML service being up does not make the agent "running"
  agentManager.getAgentStatus.mockReturnValueOnce({ exists: true, isRunning: true, state: 'monitoring' });
  mlService.checkHealth.mockRejectedValueOnce(new Error('down'));
  const running = await server.request('/api/ai/agent/status', { headers: alice });
  expect(running.body.data).toMatchObject({ running: true, agentState: 'monitoring', mlAvailable: false });
  for (const invented of ['uptime', 'activeModels', 'activityLog', 'lastActivity']) {
    expect(running.body.data).not.toHaveProperty(invented);
  }
});

test('the team list holds the signed-in account only when its address is known', async () => {
  const known = await server.request('/api/team/members', { headers: { ...alice, 'x-test-email': 'alice@example.org' } });
  expect(known.body.data.members).toEqual([{ id: 'alice', name: 'You', email: 'alice@example.org', role: 'Owner', status: 'active' }]);
  const unknown = await server.request('/api/team/members', { headers: alice });
  expect(unknown.body.data.members).toEqual([]);
});

test('no sample figures are left in the file', () => {
  for (const invented of ['4h 23m', 'SQL Injection Detected', 'Brute Force Attack', '15234', 'user@example.com', 'Analyzed 5 requests', "'tor'"]) {
    expect(source).not.toContain(invented);
  }
});

describe('route groups whose service simulates its results', () => {
  let groups;
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/domain-intel', require('../../src/routes/domain-intelligence'));
    app.use('/api/threat-hunting', require('../../src/routes/threat-hunting'));
    app.use('/api/scraping', require('../../src/routes/web-scraping'));
    app.use('/api', require('../../src/routes/features'));
    groups = await serve(app);
  });
  afterAll(() => groups.close());

  test.each([
    ['POST', '/api/domain-intel/analyze', { domain: 'example.com' }],
    ['POST', '/api/domain-intel/check-phishing', { domain: 'example.com' }],
    ['GET', '/api/domain-intel/subdomains/example.com'],
    ['GET', '/api/domain-intel/statistics'],
    ['POST', '/api/threat-hunting/quick-hunt', { type: 'malware' }],
    ['POST', '/api/threat-hunting/analyze-ioc', { ioc: '203.0.113.9', type: 'auto' }],
    ['GET', '/api/threat-hunting/iocs'],
    ['GET', '/api/threat-hunting/intelligence-feed'],
    ['POST', '/api/scraping/domain', { domain: 'example.com' }],
    ['POST', '/api/scraping/deep-web', { keywords: ['x'] }],
    ['GET', '/api/scraping/tasks'],
    ['POST', '/api/requests/request-1/replay', {}],
    ['POST', '/api/automations/automation-1/run', {}],
    ['GET', '/api/automations/automation-1/logs'],
    ['POST', '/api/exports', { name: 'report', format: 'pdf' }],
    ['GET', '/api/exports/export-1/download']
  ])('%s %s needs a session, then answers 501 without a result', async (method, route, ...rest) => {
    // (a third named parameter would be taken for jest's `done` on rows without a body)
    const body = rest[0];
    expect((await groups.request(route, { method, body })).status).toBe(401);
    const response = await groups.request(route, { method, body, headers: alice });
    expect({ status: response.status, code: response.body.code, success: response.body.success })
      .toEqual({ status: 501, code: CAPABILITY_UNAVAILABLE, success: false });
    expect(response.body.message).toMatch(/not |no |nothing /i);
    expect(response.body.data).toBeUndefined();
  });

  test('every route of the three simulated groups is behind the same answer', () => {
    for (const file of ['domain-intelligence.js', 'threat-hunting.js', 'web-scraping.js']) {
      const text = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'routes', file), 'utf8');
      const gate = text.indexOf("router.use(auth, notCarriedOut(");
      const firstRoute = text.search(/router\.(get|post|put|delete)\(/);
      expect(gate).toBeGreaterThan(-1);
      expect(gate).toBeLessThan(firstRoute);
    }
  });
});
