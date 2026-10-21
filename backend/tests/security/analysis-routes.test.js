// Stored analyses are listed, read and deleted by their owner (the model's
// `user` field), and the broken create routes are retired (16.67).
jest.mock('../../src/models/Analysis', () => ({
  find: jest.fn(), countDocuments: jest.fn(), findOne: jest.fn(), findOneAndDelete: jest.fn()
}));
jest.mock('../../src/middleware/auth', () => {
  const auth = (req, res, next) => {
    const who = req.headers.authorization;
    if (!who) return res.status(401).json({ success: false, message: 'Access denied.' });
    req.user = { userId: who.replace('Bearer ', ''), role: 'user' };
    next();
  };
  return { auth, authorize: () => (req, res, next) => next() };
});

const express = require('express');
const Analysis = require('../../src/models/Analysis');
const { serve } = require('../helpers/http');
const { CAPABILITY_UNAVAILABLE } = require('../../src/services/mlCapabilities');

const alice = { Authorization: 'Bearer alice' };
const OBJECT_ID = '507f1f77bcf86cd799439011';
const stored = {
  _id: OBJECT_ID, analysisId: 'analysis_1', type: 'url', target: { value: 'https://phish.example/login' },
  status: 'completed', source: 'api', results: { risk_score: 8 }, createdAt: new Date('2026-10-15'), processing: { completed_at: new Date('2026-10-15') }
};
// a query that has no `populate`: calling it would throw, as Mongoose 8 does for a path not in the schema
const query = rows => {
  const q = { sort: jest.fn(() => q), skip: jest.fn(() => q), limit: jest.fn(async () => rows) };
  return q;
};

let server;
let consoleError;
beforeAll(async () => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const app = express();
  app.use(express.json());
  app.use('/api/analysis', require('../../src/routes/analysis'));
  server = await serve(app);
});
afterAll(async () => {
  consoleError.mockRestore();
  await server.close();
});

test('the history lists only the caller\'s analyses, with known filters and sort fields only', async () => {
  const q = query([stored]);
  Analysis.find.mockReturnValue(q);
  Analysis.countDocuments.mockResolvedValue(1);
  const response = await server.request('/api/analysis/history?type=url&status=completed&sortBy=password&sortOrder=asc&analysisType=nonsense', { headers: alice });
  expect(response.status).toBe(200);
  expect(Analysis.find).toHaveBeenCalledWith({ user: 'alice', status: 'completed', type: 'url' });
  expect(q.sort).toHaveBeenCalledWith({ createdAt: 1 });
  expect(response.body.data.analyses).toEqual([expect.objectContaining({
    analysisId: 'analysis_1', type: 'url', target: 'https://phish.example/login', status: 'completed'
  })]);
  expect(response.body.data.pagination).toMatchObject({ totalCount: 1, totalPages: 1 });
});

test('one analysis is found only among the caller\'s, by its analysis ID or database ID', async () => {
  Analysis.findOne.mockResolvedValueOnce(stored);
  const found = await server.request(`/api/analysis/${OBJECT_ID}`, { headers: alice });
  expect(found.status).toBe(200);
  expect(Analysis.findOne).toHaveBeenLastCalledWith({ user: 'alice', $or: [{ _id: OBJECT_ID }, { analysisId: OBJECT_ID }] });
  expect(found.body.data.analysis.target).toBe('https://phish.example/login');

  Analysis.findOne.mockResolvedValueOnce(null);
  const other = await server.request('/api/analysis/analysis_of_bob', { headers: alice });
  expect(other.status).toBe(404);
  expect(Analysis.findOne).toHaveBeenLastCalledWith({ user: 'alice', $or: [{ analysisId: 'analysis_of_bob' }] });
});

test('only the caller\'s analysis can be deleted', async () => {
  Analysis.findOneAndDelete.mockResolvedValueOnce(null);
  const response = await server.request('/api/analysis/analysis_of_bob', { method: 'DELETE', headers: alice });
  expect(response.status).toBe(404);
  expect(Analysis.findOneAndDelete).toHaveBeenCalledWith({ user: 'alice', $or: [{ analysisId: 'analysis_of_bob' }] });
});

test('creating analyses here is retired and names the routes that scan', async () => {
  for (const [route, body] of [['/api/analysis/url', { url: 'https://example.com' }], ['/api/analysis/bulk', { urls: ['https://example.com'] }]]) {
    const response = await server.request(route, { method: 'POST', body, headers: alice });
    expect(response.status).toBe(501);
    expect(response.body).toMatchObject({ success: false, code: CAPABILITY_UNAVAILABLE });
    expect(response.body.message).toMatch(/\/api\/sandbox\/analyze\/url/);
    expect((await server.request(route, { method: 'POST', body })).status).toBe(401);
  }
});
