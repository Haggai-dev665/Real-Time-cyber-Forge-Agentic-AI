jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/models/Analysis', () => ({ find: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../../src/models/Threat', () => ({ find: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../../src/services/threatService', () => ({ detectThreats: jest.fn(), getThreatStats: jest.fn() }));

const express = require('express');
const User = require('../../src/models/User');
const Analysis = require('../../src/models/Analysis');
const Threat = require('../../src/models/Threat');
const { getThreatStats } = require('../../src/services/threatService');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { serve } = require('../helpers/http');

let client;
const user = {
  _id: '507f1f77bcf86cd799439011', email: 'member@example.com', role: 'user', isActive: true,
  isLocked: () => false, activity: {}, save: jest.fn()
};
const endpoints = ['/api/analysis/stats', '/api/analysis/history', '/api/threats', '/api/threats/stats'];

beforeAll(async () => {
  const app = express();
  app.use('/api/analysis', require('../../src/routes/analysis'));
  app.use('/api/threats', require('../../src/routes/threats'));
  client = await serve(app);
});
afterAll(() => client.close());
beforeEach(() => {
  User.findById.mockResolvedValue(user);
  // no populate: the model has no `threats` path, and Mongoose 8 refuses to populate one (16.67)
  Analysis.find.mockReturnValue({ sort: () => ({ skip: () => ({ limit: async () => [] }) }) });
  Analysis.countDocuments.mockResolvedValue(0);
  Threat.find.mockReturnValue({ sort: () => ({ skip: () => ({ limit: async () => [] }) }) });
  Threat.countDocuments.mockResolvedValue(0);
  getThreatStats.mockResolvedValue({ total_threats: 0 });
});

describe.each(endpoints)('User-Agent does not authenticate %s (B01/F25)', endpoint => {
  test.each(['cyber-forge-desktop', 'Electron/99.0', 'Mozilla/5.0'])('rejects unauthenticated %s', async userAgent => {
    const response = await client.request(endpoint, { headers: { 'User-Agent': userAgent } });
    expect(response.status).toBe(401);
    expect(Analysis.find).not.toHaveBeenCalled();
    expect(Threat.find).not.toHaveBeenCalled();
    expect(getThreatStats).not.toHaveBeenCalled();
  });

  test('a desktop User-Agent cannot rescue an invalid token', async () => {
    const response = await client.request(endpoint, {
      headers: { 'User-Agent': 'cyber-forge-desktop Electron', Authorization: 'Bearer forged' }
    });
    expect(response.status).toBe(401);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('a valid member session still reaches the route', async () => {
    const response = await client.request(endpoint, { headers: { Authorization: `Bearer ${signSessionToken(user)}` } });
    expect(response.status).toBe(200);
    expect(User.findById).toHaveBeenCalledWith(user._id);
  });
});

test('analysis history ignores a caller-supplied owner and scopes both rows and counts', async () => {
  const response = await client.request('/api/analysis/history?userId=507f1f77bcf86cd799439012', {
    headers: { Authorization: `Bearer ${signSessionToken(user)}` }
  });
  expect(response.status).toBe(200);
  expect(Analysis.find).toHaveBeenCalledWith({ user: user._id });
  expect(Analysis.countDocuments).toHaveBeenCalledWith({ user: user._id });

  // Cast against the actual persisted schema: an unknown owner field must not
  // disappear if Mongoose strictQuery is enabled during deployment.
  const ActualAnalysis = jest.requireActual('../../src/models/Analysis');
  const persistedQuery = ActualAnalysis.find(Analysis.find.mock.calls[0][0]).setOptions({ strictQuery: true });
  const filter = persistedQuery.cast(ActualAnalysis);
  expect(String(filter.user)).toBe(user._id);
});

test('threat stats receive the verified owner', async () => {
  await client.request('/api/threats/stats?userId=507f1f77bcf86cd799439012', {
    headers: { Authorization: `Bearer ${signSessionToken(user)}` }
  });
  expect(getThreatStats).toHaveBeenCalledWith(user._id);
});

test('analysis statistics are counted from the signed-in account\'s own records', async () => {
  Analysis.countDocuments.mockReset();
  Analysis.countDocuments
    .mockResolvedValueOnce(12).mockResolvedValueOnce(9).mockResolvedValueOnce(2).mockResolvedValueOnce(3);
  const response = await client.request('/api/analysis/stats', { headers: { Authorization: `Bearer ${signSessionToken(user)}` } });
  expect(response.body).toEqual({
    success: true,
    data: { total_analyses: 12, completed_analyses: 9, pending_analyses: 2, high_risk_found: 3 }
  });
  expect(Analysis.countDocuments).toHaveBeenCalledTimes(4);
  for (const [filter] of Analysis.countDocuments.mock.calls) {
    expect(String(filter.user)).toBe(String(user._id));
  }
});
