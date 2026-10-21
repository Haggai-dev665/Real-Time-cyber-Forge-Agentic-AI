jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/models/Threat', () => {
  const Threat = jest.fn();
  Threat.find = jest.fn();
  Threat.findOne = jest.fn();
  Threat.findOneAndUpdate = jest.fn();
  Threat.countDocuments = jest.fn();
  return Threat;
});
jest.mock('../../src/services/cyberforgeMLService', () => ({ cyberforgeML: {} }));
// a finding looks for an exception in the account's workspace (DET-02); none here
jest.mock('../../src/services/workspaceService', () => ({
  ensurePersonalWorkspace: jest.fn(async user => `ws-${user._id}`),
  workspaceIdFor: jest.fn(async principal => (principal && principal.userId ? `ws-${principal.userId}` : null)),
  activeMembership: jest.fn(async () => ({ role: 'owner' }))
}));
jest.mock('../../src/models/FindingException', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection(), { MAX_DAYS: 90, SEVERITIES: ['low', 'medium', 'high', 'critical'] }
));

const express = require('express');
const User = require('../../src/models/User');
const Threat = require('../../src/models/Threat');
const { getThreatStats } = require('../../src/services/threatService');
const { ownedThreatFilter } = require('../../src/services/threatOwnership');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { serve } = require('../helpers/http');

const userA = { _id: '507f1f77bcf86cd799439011', email: 'a@example.com', role: 'user', isActive: true, activity: {}, isLocked: () => false, save: jest.fn() };
const userB = { ...userA, _id: '507f1f77bcf86cd799439012', email: 'b@example.com' };
let records;
let client;
let errors;

function matches(record, filter) {
  return Object.entries(filter).every(([field, expected]) =>
    expected?.$in ? expected.$in.includes(record[field]) : record[field] === expected
  );
}
const headers = user => ({ Authorization: `Bearer ${signSessionToken(user)}` });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/threats', require('../../src/routes/threats'));
  client = await serve(app);
  errors = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(async () => { await client.close(); errors.mockRestore(); });
beforeEach(() => {
  records = [
    { _id: '607f1f77bcf86cd799439011', threatId: 'threat_A', user: userA._id, status: 'detected', severity: 'high', description: 'A-private', detection: { timestamp: '2026-10-12T12:00:00Z' }, timeline: [] },
    { _id: '607f1f77bcf86cd799439012', threatId: 'threat_B', user: userB._id, status: 'detected', severity: 'critical', description: 'B-private', detection: { timestamp: '2026-10-12T12:30:00Z' }, timeline: [] },
    { _id: '607f1f77bcf86cd799439013', threatId: 'threat_legacy', status: 'detected', severity: 'high', description: 'legacy-private', timeline: [] }
  ];
  User.findById.mockImplementation(async id => id === userA._id ? userA : id === userB._id ? userB : null);
  Threat.countDocuments.mockImplementation(async filter => records.filter(record => matches(record, filter)).length);
  Threat.find.mockImplementation(filter => ({ sort: () => ({ skip: offset => ({ limit: async count => records.filter(record => matches(record, filter)).slice(offset, offset + count) }) }) }));
  Threat.findOne.mockImplementation(filter => {
    const result = records.find(record => matches(record, filter)) || null;
    return { then: (...args) => Promise.resolve(result).then(...args), sort: async () => result };
  });
  Threat.findOneAndUpdate.mockImplementation(async (filter, update) => {
    const record = records.find(item => matches(item, filter));
    if (!record) return null;
    Object.assign(record, update.$set);
    record.timeline.push(update.$push.timeline);
    return record;
  });
});

test.each([userA, userB])('list and counts only include the authenticated owner $email', async user => {
  const response = await client.request(`/api/threats?userId=${user === userA ? userB._id : userA._id}`, { headers: headers(user) });
  expect(response.status).toBe(200);
  expect(response.body.data.pagination.totalCount).toBe(1);
  expect(response.body.data.threats.map(record => record.user)).toEqual([user._id]);
  for (const [filter] of Threat.find.mock.calls) expect(filter.user).toBe(user._id);
});

test('owner filters survive strict Mongoose schema casting and new unowned threats fail validation', async () => {
  const ActualThreat = jest.requireActual('../../src/models/Threat');
  const query = ActualThreat.find(ownedThreatFilter(userA._id, records[0]._id)).setOptions({ strictQuery: true });
  const filter = query.cast(ActualThreat);
  expect(String(filter.user)).toBe(userA._id);
  expect(String(filter._id)).toBe(records[0]._id);
  const unowned = new ActualThreat({ type: 'phishing', severity: 'high', description: 'Test', detection: { method: 'ml_model', confidence: 0.9 } });
  await expect(unowned.validate()).rejects.toThrow('user');
});

test.each(['threat_B', '607f1f77bcf86cd799439012', 'threat_legacy', 'missing'])('foreign/unmapped/missing threat %s is unavailable for reads and writes', async id => {
  expect((await client.request(`/api/threats/${id}`, { headers: headers(userA) })).status).toBe(404);
  for (const action of ['dismiss', 'resolve']) {
    const response = await client.request(`/api/threats/${id}/${action}`, {
      method: 'PUT', headers: headers(userA), body: { userId: userB._id, notes: 'forged ownership' }
    });
    expect(response.status).toBe(404);
  }
  expect(records[1].status).toBe('detected');
  expect(records[2].status).toBe('detected');
  expect(records.every(record => record.timeline.length === 0)).toBe(true);
});

test.each(['threat_A', '607f1f77bcf86cd799439011'])('the owner can read an existing threat by %s', async id => {
  const response = await client.request(`/api/threats/${id}`, { headers: headers(userA) });
  expect(response.status).toBe(200);
  expect(response.body.data.threat.description).toBe('A-private');
});

test.each(['dismiss', 'resolve'])('%s acknowledges only an owner-scoped stored update and records the actor', async action => {
  const response = await client.request(`/api/threats/threat_A/${action}`, {
    method: 'PUT', headers: headers(userA), body: { notes: 'Reviewed evidence', userId: userB._id }
  });
  expect(response.status).toBe(200);
  const expectedStatus = action === 'dismiss' ? 'dismissed' : 'resolved';
  expect(records[0].status).toBe(expectedStatus);
  expect(records[0].timeline[0].user).toBe(userA._id);
  expect(Threat.findOneAndUpdate).toHaveBeenCalledWith(
    { user: userA._id, threatId: 'threat_A' }, expect.any(Object), { new: true, runValidators: true }
  );
  expect((await client.request('/api/threats/threat_A', { headers: headers(userA) })).body.data.threat.status).toBe(expectedStatus);
});

test('database update failures cannot be reported as successful responses', async () => {
  Threat.findOneAndUpdate.mockRejectedValueOnce(new Error('database unavailable'));
  const response = await client.request('/api/threats/threat_A/resolve', { method: 'PUT', headers: headers(userA), body: {} });
  expect(response.status).toBe(500);
  expect(response.body.success).toBe(false);
  expect(records[0].status).toBe('detected');
});

test.each(['/api/threats?limit=100000', '/api/threats?page=-1', '/api/threats?status[$ne]=detected'])('invalid filters are rejected before querying %s', async route => {
  const response = await client.request(route, { headers: headers(userA) });
  expect(response.status).toBe(400);
  expect(Threat.find).not.toHaveBeenCalled();
  expect(Threat.countDocuments).not.toHaveBeenCalled();
});

test('malformed status-update input cannot reach the database', async () => {
  const response = await client.request('/api/threats/threat_A/dismiss', {
    method: 'PUT', headers: headers(userA), body: { notes: { $ne: null } }
  });
  expect(response.status).toBe(400);
  expect(Threat.findOneAndUpdate).not.toHaveBeenCalled();
});

test('stats counts and most recent threat are scoped, including an empty result', async () => {
  const response = await client.request(`/api/threats/stats?userId=${userB._id}`, { headers: headers(userA) });
  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({ total_threats: 1, active_threats: 1, high_severity: 1, last_scan: records[0].detection.timestamp });
  for (const [filter] of Threat.countDocuments.mock.calls) expect(filter.user).toBe(userA._id);
  records = [];
  expect(await getThreatStats(userA._id)).toMatchObject({ total_threats: 0, last_scan: null });
});

test('stats fail closed on missing owners or database failure instead of fabricating healthy zeroes', async () => {
  await expect(getThreatStats()).rejects.toThrow('verified threat owner');
  expect(Threat.countDocuments).not.toHaveBeenCalled();
  Threat.countDocuments.mockRejectedValueOnce(new Error('database unavailable'));
  const response = await client.request('/api/threats/stats', { headers: headers(userA) });
  expect(response.status).toBe(500);
  expect(response.body.success).toBe(false);
});

test('new analysis-derived threats inherit the persisted analysis owner', async () => {
  const AIAnalysisService = require('../../src/services/ai/AIAnalysisService');
  const saved = { save: jest.fn(), addTimelineEvent: jest.fn() };
  Threat.mockImplementation(() => saved);
  // no open or earlier finding for this target (findingService, DET-02)
  Threat.findOneAndUpdate.mockResolvedValue(null);
  Threat.find.mockReturnValue({ lean: async () => [] });
  const analysis = { _id: 'analysis', user: userA._id, type: 'url', target: { value: 'https://example.com' } };
  const results = { risk_score: 8, threat_types: ['phishing'], confidence: 0.9 };
  const service = new AIAnalysisService();
  await service.createThreatFromAnalysis(analysis, results);
  expect(Threat).toHaveBeenCalledWith(expect.objectContaining({ user: userA._id }));
  Threat.mockClear();
  await expect(service.createThreatFromAnalysis({ ...analysis, user: undefined }, results)).rejects.toThrow('verified threat owner');
  expect(Threat).not.toHaveBeenCalled();
});
