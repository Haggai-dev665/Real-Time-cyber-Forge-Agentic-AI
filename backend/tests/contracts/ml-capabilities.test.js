jest.mock('../../src/models', () => ({ Analysis: jest.fn(), Threat: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../src/agent/AgentManager', () => ({ agentManager: {} }));
jest.mock('../../src/middleware/auth', () => {
  // Stand-in for the JWT middleware: these tests are about what happens after it.
  const auth = (req, res, next) => {
    if (!req.headers.authorization) return res.status(401).json({ success: false, message: 'Access denied.' });
    req.user = { userId: 'user-1', role: 'user' };
    next();
  };
  return { auth, authorize: () => (req, res, next) => next() };
});

const fs = require('fs');
const path = require('path');
const express = require('express');
const { serve } = require('../helpers/http');
const {
  SUPPORTED_ML_ROUTES,
  RETIRED_ML_ROUTES,
  CAPABILITY_UNAVAILABLE,
  isMLRouteSupported,
  isMLCapabilityUnavailable,
  unavailableMLResult,
  reportUnavailableMLCapability
} = require('../../src/services/mlCapabilities');

const repoRoot = path.join(__dirname, '..', '..', '..');
const sourceRoot = path.join(__dirname, '..', '..', 'src');
const key = ([method, route]) => `${method} ${route.replace(/:[A-Za-z]+|\{[A-Za-z_]+\}|\$\{[A-Za-z_]+\}/g, ':param')}`;
const authorized = { Authorization: 'Bearer test' };

// A loopback ML service that records every request it receives.
async function mlFixture() {
  const app = express();
  const calls = [];
  app.use(express.json());
  app.use((req, res) => {
    calls.push(`${req.method} ${req.path}`);
    res.json({ status: 'ok', available: true });
  });
  const server = await serve(app);
  return { ...server, calls };
}

let fixture;
let log;
let errorLog;

beforeAll(async () => {
  fixture = await mlFixture();
  process.env.ML_SERVICE_URL = fixture.url;
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
  errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(() => { fixture.calls.length = 0; });

afterAll(async () => {
  delete process.env.ML_SERVICE_URL;
  log.mockRestore();
  errorLog.mockRestore();
  await fixture.close();
});

test('the supported manifest matches the routes the deployed ML service defines', () => {
  const service = fs.readFileSync(path.join(repoRoot, 'ml-services', 'hf_space_deploy', 'app.py'), 'utf8');
  const all = [...service.matchAll(/^@api\.(get|post|put|delete)\("([^"]+)"\)/gm)]
    .map(match => key([match[1].toUpperCase(), match[2]]));
  // Model training is maintenance by the Space's owner, with the owner's own
  // Hugging Face token. The backend has no such token and must never call it.
  const ownerOnly = all.filter(route => route.includes(' /api/admin/'));
  const defined = all.filter(route => !ownerOnly.includes(route));
  expect(defined.length).toBeGreaterThan(0);
  expect(SUPPORTED_ML_ROUTES.map(key).sort()).toEqual([...new Set(defined)].sort());
  expect(ownerOnly.sort()).toEqual(['GET /api/admin/train/status', 'POST /api/admin/train']);
  expect(SUPPORTED_ML_ROUTES.map(key).filter(route => route.includes('/api/admin/'))).toEqual([]);
});

test('the ML service refuses its owner-only routes to anyone but the owner', () => {
  const service = fs.readFileSync(path.join(repoRoot, 'ml-services', 'hf_space_deploy', 'app.py'), 'utf8');
  for (const handler of ['api_admin_train', 'api_admin_train_status']) {
    const start = service.indexOf(`async def ${handler}(`);
    const body = service.slice(start, service.indexOf('\n\n\n', start));
    expect(start).toBeGreaterThan(0);
    expect(body).toContain('owner_token');
    expect(body).toContain('status_code=403');
  }
});

test('every unsupported ML call left in the backend is listed as retired, and nothing else is', () => {
  const read = file => fs.readFileSync(path.join(sourceRoot, file), 'utf8');
  const referenced = [
    ...[...read('services/mlService.js').matchAll(/axiosInstance\.(get|post|put|delete)\(\s*[`'"]([^`'"]+)/g)],
    ...[...read('services/ai/AIAnalysisService.js').matchAll(/axios\.(get|post|put|delete)\(`\$\{this\.mlServiceUrl\}([^`]+)`/g)]
  ].map(match => [match[1].toUpperCase(), match[2]]);
  expect(referenced.length).toBeGreaterThan(30);

  const unsupported = referenced
    .filter(([method, route]) => !isMLRouteSupported(method, route.replace(/\$\{[A-Za-z_]+\}/g, 'value')))
    .map(key);
  expect([...new Set(unsupported)].sort()).toEqual(RETIRED_ML_ROUTES.map(key).sort());
  expect(RETIRED_ML_ROUTES.filter(([method, route]) => isMLRouteSupported(method, route))).toEqual([]);
});

test('route matching handles parameters, query strings, method and the configured base URL', () => {
  expect(isMLRouteSupported('get', '/api/v2/explain/phishing_detection')).toBe(true);
  expect(isMLRouteSupported('GET', '/api/v2/explain/a/b')).toBe(false);
  expect(isMLRouteSupported('POST', '/analyze-url?source=test')).toBe(true);
  expect(isMLRouteSupported('GET', '/analyze-url')).toBe(false);
  expect(isMLRouteSupported('POST', `${fixture.url}/analyze-url/`)).toBe(true);
  expect(isMLRouteSupported('POST', '/analyze/url')).toBe(false);
  expect(unavailableMLResult('POST', '/analyze')).toBeNull();
  expect(unavailableMLResult('GET', '/api/training/models/7')).toEqual({
    success: false,
    code: CAPABILITY_UNAVAILABLE,
    error: 'ML capability unavailable: GET /api/training/models/7 is not provided by the configured ML service.'
  });
});

test('the ML client sends supported calls and refuses retired ones without any network request', async () => {
  const { MLService } = require('../../src/services/mlService');
  const client = new MLService();

  expect((await client.checkHealth()).available).toBe(true);
  expect((await client.analyzeWebsite('https://example.com')).success).toBe(true);
  expect(fixture.calls).toEqual(['GET /health', 'POST /analyze-url']);

  fixture.calls.length = 0;
  for (const result of [
    await client.getDatasets(),
    await client.getTrainingStatus('job-1'),
    await client.detectPhishing({ url: 'https://example.com' }),
    await client.getThreatMap(),
    await client.getAgentStatus()
  ]) {
    expect(result.success === false || result.available === false || isMLCapabilityUnavailable(result)).toBe(true);
  }
  expect(isMLCapabilityUnavailable(await client.getDatasets())).toBe(true);
  expect(fixture.calls).toEqual([]);
});

test('retired analysis calls fail before an analysis record is created', async () => {
  const { Analysis } = require('../../src/models');
  const AIAnalysisService = require('../../src/services/ai/AIAnalysisService');
  const service = new AIAnalysisService();

  for (const result of [
    await service.analyzeUrl('https://example.com', 'user-1'),
    await service.analyzeFile({ filename: 'a.bin', hash: 'abc', content: '' }, 'user-1'),
    await service.analyzeNetworkTraffic({ packets: [] }, 'user-1')
  ]) {
    expect(result).toMatchObject({ success: false, code: CAPABILITY_UNAVAILABLE });
  }
  expect(Analysis).not.toHaveBeenCalled();
  expect(fixture.calls).toEqual([]);
});

test('ML training routes answer 501 with the shared code, after authentication', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/ml', require('../../src/routes/ml-training'));
  const server = await serve(app);
  try {
    expect((await server.request('/api/ml/datasets')).status).toBe(401);

    for (const [route, options] of [
      ['/api/ml/datasets', {}],
      ['/api/ml/models', {}],
      ['/api/ml/train/status/job-1', {}],
      ['/api/ml/train/history', {}],
      ['/api/ml/metrics/model-1', {}]
    ]) {
      const response = await server.request(route, { ...options, headers: authorized });
      expect({ route, status: response.status, code: response.body.code, success: response.body.success })
        .toEqual({ route, status: 501, code: CAPABILITY_UNAVAILABLE, success: false });
      expect(response.body.message).toContain('is not provided by the configured ML service');
    }
    expect(fixture.calls).toEqual([]);
  } finally {
    await server.close();
  }
});

test('routes built on retired ML endpoints report the gap instead of placeholder data', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', require('../../src/routes/child-pages'));
  const server = await serve(app);
  try {
    expect((await server.request('/api/ai/models')).status).toBe(401);

    for (const [route, method, body] of [
      ['/api/ai/agent/threats', 'GET'],
      ['/api/ai/agent/learning', 'GET'],
      ['/api/ai/models', 'GET'],
      ['/api/ai/agent/tasks', 'POST', { type: 'scan', target: 'https://example.com' }],
      ['/api/ai/models/training', 'POST', { modelId: '1' }]
    ]) {
      const response = await server.request(route, { method, body, headers: authorized });
      expect({ route, status: response.status, code: response.body.code, success: response.body.success })
        .toEqual({ route, status: 501, code: CAPABILITY_UNAVAILABLE, success: false });
      expect(response.body.data).toBeUndefined();
    }
    expect(fixture.calls).toEqual([]);
  } finally {
    await server.close();
  }
});

test('only failures caused by a missing ML capability are rewritten', async () => {
  const app = express();
  app.use(reportUnavailableMLCapability);
  app.get('/ok', (req, res) => res.json({ success: true, data: [1] }));
  app.get('/upstream', (req, res) => res.status(500).json({ success: false, message: 'connect ECONNREFUSED' }));
  app.get('/validation', (req, res) => res.status(400).json({ success: false, message: 'Validation errors' }));
  app.get('/retired', (req, res) => res.status(500).json({
    success: false,
    message: unavailableMLResult('POST', '/api/training/train').error
  }));
  const server = await serve(app);
  try {
    expect(await server.request('/ok')).toEqual({ status: 200, body: { success: true, data: [1] } });
    expect((await server.request('/upstream')).status).toBe(500);
    expect((await server.request('/upstream')).body.code).toBeUndefined();
    expect((await server.request('/validation')).status).toBe(400);
    const retired = await server.request('/retired');
    expect(retired.status).toBe(501);
    expect(retired.body.code).toBe(CAPABILITY_UNAVAILABLE);
  } finally {
    await server.close();
  }
});
