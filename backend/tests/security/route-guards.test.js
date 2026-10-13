jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/services/appwriteService', () => ({ appwriteService: { listAlerts: jest.fn(async () => []) } }));
jest.mock('../../src/agent/AgentManager', () => require('../helpers/stub').anything());
jest.mock('../../src/services/WebScraperAPIService', () => require('../helpers/stub').anything());
jest.mock('../../src/services/mlServiceClient', () => require('../helpers/stub').anything());
jest.mock('../../src/services/realtimeBus', () => require('../helpers/stub').anything());
jest.mock('../../src/services/agentOrchestrator', () => require('../helpers/stub').anything());
jest.mock('../../src/services/memoryService', () => require('../helpers/stub').anything());
jest.mock('../../src/services/sandboxAnalysisService', () => require('../helpers/stub').anything());
jest.mock('../../src/services/cyberforgeMLService', () => require('../helpers/stub').anything());
jest.mock('../../src/services/otx', () => require('../helpers/stub').anything());
jest.mock('../../src/services/websocket', () => require('../helpers/stub').anything());
jest.mock('../../src/services/policyEngineService', () => ({ policyEngineService: { evaluate: jest.fn(() => ({ triggered: [] })) } }));
jest.mock('../../src/services/distributedIntelligenceService', () => ({
  distributedIntelligenceService: { registerNode: jest.fn(() => ({ success: true, nodeId: 'node-1' })) }
}));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const fs = require('fs');
const path = require('path');
const express = require('express');
const User = require('../../src/models/User');
const { appwriteService } = require('../../src/services/appwriteService');
const { distributedIntelligenceService } = require('../../src/services/distributedIntelligenceService');
const { policyEngineService } = require('../../src/services/policyEngineService');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { bindVerifiedUser } = require('../../src/middleware/verifiedUser');
const { serve } = require('../helpers/http');

const routesDirectory = path.join(__dirname, '..', '..', 'src', 'routes');
const ROUTE = /^router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]*)['"`]/gm;

// The seven route groups that had no authentication at all (finding F03).
const GUARDED = {
  agentRoutes: '/api/agent',
  memory: '/api/memory',
  orchestrator: '/api/orchestrator',
  sandbox: '/api/sandbox',
  mlRoutes: '/api/cyberforge-ml',
  otx: '/api/otx',
  'browser-intelligence': '/api/browser-intelligence'
};

function routesIn(file) {
  const source = fs.readFileSync(path.join(routesDirectory, `${file}.js`), 'utf8');
  return [...source.matchAll(ROUTE)].map(match => ({ method: match[1].toUpperCase(), path: match[2] }));
}

const guardedRoutes = Object.entries(GUARDED).flatMap(([file, prefix]) => routesIn(file).map(route => ({
  method: route.method,
  url: `${prefix}${route.path === '/' ? '' : route.path}`.replace(/:[A-Za-z]+\??/g, 'x')
})));

const member = {
  _id: '507f1f77bcf86cd799439011', email: 'member@example.com', role: 'user', isActive: true,
  isLocked: () => false, activity: {}, save: jest.fn()
};
const otherAccount = '507f1f77bcf86cd799439012';
const session = () => ({ Authorization: `Bearer ${signSessionToken(member)}` });

let client;
let consoleError;

beforeAll(async () => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const app = express();
  app.use(express.json());
  for (const [file, prefix] of Object.entries(GUARDED)) app.use(prefix, require(`../../src/routes/${file}`));
  app.use('/api/policy', require('../../src/routes/policy'));
  app.use('/api/distributed', require('../../src/routes/distributed'));
  client = await serve(app);
});
afterAll(async () => {
  consoleError.mockRestore();
  await client.close();
});
beforeEach(() => User.findById.mockResolvedValue(member));

test('the seven formerly open route groups define the 59 routes this suite covers', () => {
  expect(guardedRoutes).toHaveLength(59);
});

test.each(guardedRoutes)('$method $url rejects a request with no session', async ({ method, url }) => {
  const response = await client.request(url, { method, body: method === 'GET' ? undefined : { userId: otherAccount } });
  expect(response.status).toBe(401);
  expect(User.findById).not.toHaveBeenCalled();
});

test.each(guardedRoutes.filter((route, index) => index % 6 === 0))(
  '$method $url rejects a forged token even with a desktop User-Agent', async ({ method, url }) => {
    const response = await client.request(url, {
      method, headers: { Authorization: 'Bearer forged', 'User-Agent': 'cyber-forge-desktop/1.0' }
    });
    expect(response.status).toBe(401);
  });

// Routes in files that also hold public routes, guarded one by one (B03.2b).
const INDIVIDUALLY_GUARDED = [
  { method: 'POST', url: '/api/policy/evaluate' },
  { method: 'POST', url: '/api/distributed/nodes/register' },
  { method: 'POST', url: '/api/distributed/telemetry/sync' },
  { method: 'GET', url: '/api/distributed/metrics/global' },
  { method: 'GET', url: '/api/distributed/metrics/stats' },
  { method: 'GET', url: '/api/distributed/weights' }
];

test.each(INDIVIDUALLY_GUARDED)('$method $url rejects a request with no session', async ({ method, url }) => {
  const response = await client.request(url, {
    method, body: method === 'GET' ? undefined : { nodeId: 'node-1', metrics: {}, nonce: 'n', sequenceId: 1 }
  });
  expect(response.status).toBe(401);
  expect(policyEngineService.evaluate).not.toHaveBeenCalled();
  expect(distributedIntelligenceService.registerNode).not.toHaveBeenCalled();
});

test('public routes in those two files are not behind the session check', async () => {
  // Their services are stubbed here, so only the absence of a 401 is meaningful.
  for (const route of ['/api/distributed/health', '/api/policy/meta']) {
    const response = await fetch(`${client.url}${route}`);
    expect({ route, unauthorized: response.status === 401 }).toEqual({ route, unauthorized: false });
  }
});

test('a node is registered to the signed-in account, not to a header the caller chooses', async () => {
  const response = await client.request('/api/distributed/nodes/register', {
    method: 'POST', body: { nodeId: 'node-1' },
    headers: { ...session(), 'x-node-id': otherAccount }
  });
  expect(response.status).toBe(200);
  expect(distributedIntelligenceService.registerNode).toHaveBeenCalledWith({ nodeId: 'node-1' }, member._id);
});

test('policy evaluation runs for a signed-in user', async () => {
  const response = await client.request('/api/policy/evaluate', {
    method: 'POST', headers: session(), body: { nodeId: 'node-1', metrics: { riskScore: 10 } }
  });
  expect(response.status).toBe(200);
  expect(policyEngineService.evaluate).toHaveBeenCalledTimes(1);
});

test('alerts are listed for the signed-in account, whatever userId the caller sends', async () => {
  const response = await client.request(`/api/agent/alerts?userId=${otherAccount}&limit=5`, { headers: session() });
  expect(response.status).toBe(200);
  expect(appwriteService.listAlerts).toHaveBeenCalledTimes(1);
  expect(appwriteService.listAlerts).toHaveBeenCalledWith(member._id, { limit: 5 });
});

test('memory is saved and read under the signed-in account, not the one named in the request', async () => {
  const saved = await client.request('/api/memory/save', {
    method: 'POST', headers: session(),
    body: { userId: otherAccount, id: 'm-1', text: 'credential form on a look-alike domain', kind: 'note' }
  });
  expect(saved.status).toBe(200);

  // The owner still sees it even when the request names another account ...
  const own = await client.request(`/api/memory?userId=${otherAccount}`, { headers: session() });
  expect(own.status).toBe(200);
  expect(JSON.stringify(own.body)).toContain('credential form on a look-alike domain');

  // ... and that other account, signed in as itself, does not.
  const other = { ...member, _id: otherAccount, email: 'other@example.com' };
  User.findById.mockImplementation(async id => (String(id) === otherAccount ? other : member));
  const foreign = await client.request(`/api/memory?userId=${member._id}`, {
    headers: { Authorization: `Bearer ${signSessionToken(other)}` }
  });
  expect(foreign.status).toBe(200);
  expect(JSON.stringify(foreign.body)).not.toContain('credential form on a look-alike domain');
});

test('bindVerifiedUser replaces identity in the query and JSON body and leaves raw bodies alone', () => {
  const next = jest.fn();
  const request = { user: { userId: { toString: () => member._id } }, query: { userId: otherAccount, limit: '5' }, body: { userId: otherAccount, text: 'x' } };
  bindVerifiedUser(request, {}, next);
  expect(request.query).toEqual({ userId: member._id, limit: '5' });
  expect(request.body).toEqual({ userId: member._id, text: 'x' });

  const raw = { user: { userId: member._id }, query: {}, body: Buffer.from('raw') };
  bindVerifiedUser(raw, {}, next);
  expect(Buffer.isBuffer(raw.body)).toBe(true);
  expect(raw.body.userId).toBeUndefined();
  expect(next).toHaveBeenCalledTimes(2);
});

// ---------------------------------------------------------------------------
// Route inventory: every mounted route either has authentication in its chain
// or is on one of the two lists below. A new unauthenticated route fails here.
// /api/auth is excluded: signing in is public by nature and has its own suite.

const PUBLIC_BY_DESIGN = [
  'GET /api/ai/ml-health',
  'GET /api/audit/catalog',
  'GET /api/distributed/health',
  'GET /api/policy/meta',
  'GET /api/stream' // authenticates per event; see stream.test.js
];

// Every gap the first inventory found has been closed. Keep this empty: a route
// that genuinely must be public belongs in PUBLIC_BY_DESIGN with a reason.
const STILL_OPEN = [];

test('route inventory: no unauthenticated route exists outside the reviewed lists', () => {
  const server = fs.readFileSync(path.join(routesDirectory, '..', 'server.js'), 'utf8');
  const files = Object.fromEntries([...server.matchAll(/const (\w+) = require\('\.\/routes\/([\w-]+)'\)/g)].map(m => [m[1], m[2]]));
  const guard = /[,(\[]\s*(?:auth|optionalAuth|adminOnly|analystOrAdmin|verifiedUser)\s*[,)\]]|\bauthorize\(/;
  const unauthenticated = [];
  let total = 0;

  for (const [, prefix, variable] of server.matchAll(/this\.app\.use\('([^']+)',\s*(\w+)\)/g)) {
    if (!files[variable] || prefix === '/api/auth') continue;
    const source = fs.readFileSync(path.join(routesDirectory, `${files[variable]}.js`), 'utf8');
    const routerGuard = source.search(/^router\.use\((?:verifiedUser|auth)\)/m);
    for (const match of source.matchAll(ROUTE)) {
      total += 1;
      const rest = source.slice(match.index + match[0].length - 1, match.index + 1500);
      const handler = rest.search(/(?:async\s*)?\(\s*_?req\b|asyncHandler\(/);
      const chain = rest.slice(0, handler < 0 ? 200 : handler);
      if ((routerGuard >= 0 && routerGuard < match.index) || guard.test(chain)) continue;
      unauthenticated.push(`${match[1].toUpperCase()} ${prefix.replace(/\/$/, '')}/${match[2].replace(/^\//, '')}`.replace(/\/$/, ''));
    }
  }

  expect(total).toBeGreaterThan(280);
  expect(unauthenticated.sort()).toEqual([...PUBLIC_BY_DESIGN.map(route => route.split(' //')[0]), ...STILL_OPEN].sort());
});
