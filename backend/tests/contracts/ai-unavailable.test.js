// The AI analysis routes whose ML endpoints are retired answer 501 with the
// shared code, like every other retired capability, not a generic 500 (16.68).
// the router starts monitoring when it loads; the stand-in starts no timers
jest.mock('../../src/services/ai/ThreatMonitoringService', () => jest.fn().mockImplementation(() => ({ startMonitoring: jest.fn() })));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/middleware/auth', () => {
  const auth = (req, res, next) => {
    if (!req.headers.authorization) return res.status(401).json({ success: false, message: 'Access denied.' });
    req.user = { userId: 'alice', workspaceId: 'ws-alice', role: 'user' };
    next();
  };
  return { auth, authorize: () => (req, res, next) => next() };
});

const express = require('express');
const { serve } = require('../helpers/http');
const { CAPABILITY_UNAVAILABLE } = require('../../src/services/mlCapabilities');
const { analysisQuota } = require('../../src/middleware/analysisQuota');

let server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/ai', require('../../src/routes/ai'));
  server = await serve(app);
});
afterAll(() => server.close());
beforeEach(() => analysisQuota.reset());

test.each([
  ['/api/ai/analyze/url', { url: 'https://example.com/login' }],
  ['/api/ai/analyze/network', { networkData: { connections: [] } }]
])('%s answers 501 with the shared code when its ML endpoint is retired', async (route, body) => {
  const response = await server.request(route, { method: 'POST', body, headers: { Authorization: 'Bearer x' } });
  expect(response.status).toBe(501);
  expect(response.body).toMatchObject({ success: false, code: CAPABILITY_UNAVAILABLE });
  expect(response.body.message).toMatch(/^ML capability unavailable:/);
});
