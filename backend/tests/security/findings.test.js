// DET-02: findings deduplicated by account, category and target, with a
// recurrence count; a workflow whose steps are checked, kept and audited;
// severity independent of workflow; false-positive feedback that changes one
// finding only.
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/services/workspaceService', () => ({
  ensurePersonalWorkspace: jest.fn(async user => `ws-${user._id}`),
  workspaceIdFor: jest.fn(async principal => (principal && principal.userId ? (principal.workspaceId || `ws-${principal.userId}`) : null)),
  activeMembership: jest.fn(async (workspaceId, userId) => (workspaceId === `ws-${userId}` ? { role: 'owner' } : null))
}));
jest.mock('../../src/models/Threat', () => require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['threatId'] }] }));
jest.mock('../../src/models/FindingException', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['exceptionId'] }] }),
  { MAX_DAYS: 90, SEVERITIES: ['low', 'medium', 'high', 'critical'] }
));
jest.mock('../../src/models/Device', () => require('../helpers/fakeCollection').fakeCollection());
jest.mock('../../src/models/SandboxScan', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['scanId'] }] }),
  { VERDICTS: ['clean', 'suspicious', 'malicious', 'unknown'], RETENTION_DAYS: 90 }
));
jest.mock('../../src/services/cyberforgeMLService', () => ({ cyberforgeML: {} }));
jest.mock('../../src/models/AuditEvent', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection(),
  { OUTCOMES: ['success', 'failure', 'warning'], RETENTION_DAYS: 90 }
));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const express = require('express');
const User = require('../../src/models/User');
const Threat = require('../../src/models/Threat');
const AuditEvent = require('../../src/models/AuditEvent');
const FindingException = require('../../src/models/FindingException');
const Device = require('../../src/models/Device');
const SandboxScan = require('../../src/models/SandboxScan');
const { sandboxAnalysisService } = require('../../src/services/sandboxAnalysisService');
const findings = require('../../src/services/findingService');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { serve } = require('../helpers/http');

const account = id => ({ _id: id, email: `${id}@example.com`, role: 'user', isActive: true, isLocked: () => false, activity: {}, save: jest.fn() });
const alice = account('507f1f77bcf86cd799439011');
const bob = account('507f1f77bcf86cd799439012');
const fields = (over = {}) => ({ type: 'phishing', severity: 'medium', description: 'credential form', detection: { method: 'ml_model', confidence: 0.8 }, ...over });

let client;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/threats', require('../../src/routes/threats'));
  app.use('/api/v1', require('../../src/routes/findingExceptions'));
  client = await serve(app);
});
afterAll(() => client.close());
beforeEach(() => {
  Threat.reset(); AuditEvent.reset(); FindingException.reset(); Device.reset(); SandboxScan.reset();
  User.findById.mockImplementation(async id => [alice, bob].find(u => u._id === String(id)) || null);
});
const put = (user, path, body) => client.request(path, { method: 'PUT', body, headers: { Authorization: `Bearer ${signSessionToken(user)}` } });

describe('one finding per thing found', () => {
  test('the same target seen again raises the count instead of adding a finding', async () => {
    const first = await findings.recordFinding(alice._id, fields(), 'https://www.Login-Example.com/verify?session=abc');
    const again = await findings.recordFinding(alice._id, fields({ severity: 'high' }), 'https://login-example.com/verify?session=xyz');
    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(Threat.docs).toHaveLength(1);
    expect(Threat.docs[0]).toMatchObject({ occurrences: 2, severity: 'high' }); // the worst severity seen is kept
    expect(Threat.docs[0].timeline.map(t => t.event)).toEqual(['Found', 'Seen again']);
  });

  test('a different category, target or account is a different finding', async () => {
    await findings.recordFinding(alice._id, fields(), 'login-example.com/verify');
    await findings.recordFinding(alice._id, fields({ type: 'malware' }), 'login-example.com/verify');
    await findings.recordFinding(alice._id, fields(), 'login-example.com/other');
    await findings.recordFinding(bob._id, fields(), 'login-example.com/verify');
    expect(Threat.docs).toHaveLength(4);
  });

  test('after a day, or once closed, the target is a new finding that names the earlier one', async () => {
    const { threat } = await findings.recordFinding(alice._id, fields(), 'login-example.com');
    Threat.docs[0].lastSeenAt = new Date(Date.now() - findings.DEDUP_WINDOW_MS - 1000);
    const later = await findings.recordFinding(alice._id, fields(), 'login-example.com');
    expect(later.created).toBe(true);
    expect(later.threat.recurrenceOf).toBe(threat.threatId);

    await findings.transition({ userId: alice._id }, later.threat.threatId, 'resolve', 'fixed');
    const third = await findings.recordFinding(alice._id, fields(), 'login-example.com');
    expect(third.created).toBe(true);
    expect(third.threat.recurrenceOf).toBe(later.threat.threatId);
    expect(third.threat.timeline[0].event).toBe('Found again after it was resolved');
    // the resolved finding keeps its own history unchanged
    expect(Threat.docs.find(t => t.threatId === later.threat.threatId)).toMatchObject({ status: 'resolved', occurrences: 1 });
  });

  test('addresses are compared without "www.", the query string or letter case', () => {
    expect(findings.normalizeTarget('https://WWW.Example.com/Path/?a=1#x')).toBe('example.com/path');
    expect(findings.normalizeTarget('example.com/path')).toBe('example.com/path');
    expect(findings.normalizeTarget('44D88612FEA8A8F36DE82E1278ABB02F')).toBe('44d88612fea8a8f36de82e1278abb02f');
  });
});

describe('the workflow', () => {
  test('steps are checked against the current state, kept in the timeline and audited; severity does not change', async () => {
    const { threat } = await findings.recordFinding(alice._id, fields({ severity: 'critical' }), 'login-example.com');
    const path = `/api/threats/${threat.threatId}/state`;
    let r = await put(alice, path, { action: 'acknowledge', note: 'looking' });
    expect(r.body.data).toMatchObject({ status: 'acknowledged', severity: 'critical' });
    r = await put(alice, path, { action: 'investigate' });
    expect(r.body.data.status).toBe('investigating');
    expect(String(Threat.docs[0].analysis.analyst_assigned)).toBe(alice._id);
    r = await put(alice, path, { action: 'acknowledge' });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('TRANSITION_NOT_ALLOWED');
    r = await put(alice, path, { action: 'false_positive', note: 'internal test page' });
    expect(r.body.data).toMatchObject({ status: 'false_positive', severity: 'critical' });
    r = await put(alice, path, { action: 'reopen' });
    expect(r.body.data.status).toBe('acknowledged');
    expect(Threat.docs[0].timeline.map(t => t.event)).toEqual(['Found', 'detected → acknowledged', 'acknowledged → investigating', 'investigating → false_positive', 'false_positive → acknowledged']);
    expect(AuditEvent.docs.filter(e => e.action === 'finding.state_change').map(e => e.details.to)).toEqual(['acknowledged', 'investigating', 'false_positive', 'acknowledged']);
  });

  test('another account\'s finding is not found, and unknown actions are refused', async () => {
    const { threat } = await findings.recordFinding(alice._id, fields(), 'login-example.com');
    expect((await put(bob, `/api/threats/${threat.threatId}/state`, { action: 'resolve' })).status).toBe(404);
    expect((await put(alice, `/api/threats/${threat.threatId}/state`, { action: 'delete' })).body.code).toBe('ACTION_INVALID');
    expect(Threat.docs[0].status).toBe('detected');
  });

  test('a false positive changes that finding only, not another account\'s detection of the same target', async () => {
    const mine = (await findings.recordFinding(alice._id, fields(), 'login-example.com')).threat;
    await findings.transition({ userId: alice._id }, mine.threatId, 'false_positive', 'mine is a test page');
    const theirs = await findings.recordFinding(bob._id, fields(), 'login-example.com');
    expect(theirs.created).toBe(true);
    expect(theirs.threat).toMatchObject({ status: 'detected', recurrenceOf: null });
  });

  test('a client cannot report a finding event as if the server had seen it', async () => {
    const app = express(); app.use(express.json()); app.use('/api/audit', require('../../src/routes/audit'));
    const audit = await serve(app);
    const r = await audit.request('/api/audit/log', { method: 'POST', body: { action: 'finding.state_change', resource: 'x' }, headers: { Authorization: `Bearer ${signSessionToken(alice)}` } });
    expect(r.status).toBe(400);
    await audit.close();
  });
});

describe('exceptions', () => {
  const post = (user, path, body) => client.request(path, { method: 'POST', body, headers: { Authorization: `Bearer ${signSessionToken(user)}` } });
  const get = (user, path) => client.request(path, { headers: { Authorization: `Bearer ${signSessionToken(user)}` } });
  const except = (user, body = {}) => post(user, '/api/v1/finding-exceptions', { type: 'phishing', target: 'https://www.intranet-test.example/login', reason: 'our own staging sign-in page', expiresInDays: 30, ...body });

  test('a covered detection is recorded as excepted, counted, and kept out of the open list', async () => {
    const made = await except(alice);
    expect(made.status).toBe(201);
    expect(made.body.data).toMatchObject({ target: 'intranet-test.example/login', maxSeverity: 'medium', state: 'active' });
    const first = await findings.recordFinding(alice._id, fields(), 'https://intranet-test.example/login?next=1');
    const again = await findings.recordFinding(alice._id, fields({ severity: 'low' }), 'intranet-test.example/login');
    expect(first).toMatchObject({ created: true, excepted: true });
    expect(again).toMatchObject({ created: false, excepted: true });
    expect(Threat.docs).toHaveLength(1);
    expect(Threat.docs[0]).toMatchObject({ status: 'excepted', exceptionId: made.body.data.exceptionId, occurrences: 2 });
    expect(FindingException.docs[0].matches).toBe(2);
    const active = (await get(alice, '/api/threats?status=active')).body.data.threats;
    expect(active).toEqual([]);
    expect(AuditEvent.docs.some(e => e.action === 'finding.exception_create')).toBe(true);
  });

  test('a more severe detection is not covered, and says why', async () => {
    await except(alice);
    const { threat, excepted } = await findings.recordFinding(alice._id, fields({ severity: 'critical' }), 'intranet-test.example/login');
    expect(excepted).toBeUndefined();
    expect(threat.status).toBe('detected');
    expect(threat.timeline[0].details).toMatch(/did not apply: severity critical is above the medium it covers/);
  });

  test('an expired or revoked exception covers nothing, and another account is never covered', async () => {
    const made = (await except(alice)).body.data;
    expect((await findings.recordFinding(bob._id, fields(), 'intranet-test.example/login')).threat.status).toBe('detected');

    FindingException.docs[0].expiresAt = new Date(Date.now() - 1000);
    expect((await findings.recordFinding(alice._id, fields({ type: 'phishing' }), 'intranet-test.example/login')).threat.status).toBe('detected');

    FindingException.docs[0].expiresAt = new Date(Date.now() + 86400000);
    const revoked = await client.request(`/api/v1/finding-exceptions/${made.exceptionId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${signSessionToken(alice)}` } });
    expect(revoked.body.data.state).toBe('revoked');
    expect(AuditEvent.docs.some(e => e.action === 'finding.exception_revoke')).toBe(true);
    Threat.reset();
    expect((await findings.recordFinding(alice._id, fields(), 'intranet-test.example/login')).threat.status).toBe('detected');
    const listed = (await get(alice, '/api/v1/finding-exceptions')).body.data.exceptions;
    expect(listed.map(e => e.state)).toEqual(['revoked']);
    expect((await get(bob, '/api/v1/finding-exceptions')).body.data.exceptions).toEqual([]);
  });

  test('an exception needs a reason and an expiry of at most 90 days', async () => {
    expect((await except(alice, { reason: '' })).body.code).toBe('EXCEPTION_INVALID');
    expect((await except(alice, { expiresInDays: 91 })).body.code).toBe('EXCEPTION_INVALID');
    expect((await except(alice, { expiresInDays: undefined })).body.code).toBe('EXCEPTION_INVALID');
    expect(FindingException.docs).toHaveLength(0);
  });

  test('made from a finding, it takes the finding\'s category, target and severity', async () => {
    const { threat } = await findings.recordFinding(alice._id, fields({ severity: 'high', source: { url: 'https://intranet-test.example/login' } }), 'https://intranet-test.example/login');
    const made = await post(alice, `/api/threats/${threat.threatId}/exception`, { reason: 'staging page', expiresInDays: 7 });
    expect(made.status).toBe(201);
    expect(made.body.data).toMatchObject({ type: 'phishing', target: 'intranet-test.example/login', maxSeverity: 'high' });
    expect((await post(bob, `/api/threats/${threat.threatId}/exception`, { reason: 'x', expiresInDays: 7 })).status).toBe(404);
  });

  test('each listed finding says why it matters and what to do next', async () => {
    await findings.recordFinding(alice._id, fields(), 'login-example.com');
    const listed = (await get(alice, '/api/threats?status=active')).body.data.threats;
    expect(listed[0].guidance).toMatchObject({ whyItMatters: expect.stringMatching(/imitates a sign-in/), nextStep: expect.stringMatching(/change that password/), occurrences: 1 });
  });
});

describe('incidents', () => {
  const get = (user, path) => client.request(path, { headers: { Authorization: `Bearer ${signSessionToken(user)}` } });
  const post = (user, path, body = {}) => client.request(path, { method: 'POST', body, headers: { Authorization: `Bearer ${signSessionToken(user)}` } });
  const at = (threat, ms) => { const d = Threat.docs.find(x => x.threatId === threat.threatId); d.firstSeenAt = new Date(ms); d.lastSeenAt = new Date(ms); };
  const src = url => ({ source: { url } });

  test('findings on one host form one incident with one timeline; another host, or a long gap, is another', async () => {
    const now = Date.now();
    const a1 = (await findings.recordFinding(alice._id, fields(src('https://evil.example/login')), 'https://evil.example/login')).threat;
    const a2 = (await findings.recordFinding(alice._id, fields({ type: 'malware', severity: 'high', ...src('https://evil.example/payload.exe') }), 'https://evil.example/payload.exe')).threat;
    const b1 = (await findings.recordFinding(alice._id, fields(src('https://other.example/')), 'https://other.example/')).threat;
    const old = (await findings.recordFinding(alice._id, fields({ type: 'suspicious_url', ...src('https://evil.example/old') }), 'https://evil.example/old')).threat;
    at(a1, now - 3600000); at(a2, now - 1800000); at(b1, now - 600000); at(old, now - 10 * 86400000);
    await Device.create({ deviceId: 'dev-1', workspaceId: `ws-${alice._id}`, kind: 'endpoint', displayName: 'Laptop', state: 'active', lastSeenAt: new Date(), capabilities: { advertised: [], confirmed: {} } });

    const { incidents } = (await get(alice, '/api/v1/incidents')).body.data;
    expect(incidents.map(i => [i.host, i.findings.length])).toEqual([['other.example', 1], ['evil.example', 2], ['evil.example', 1]]);
    const main = incidents[1];
    expect(main).toMatchObject({ state: 'open', severity: 'high', openFindings: 2 });
    expect(new Set(main.timeline.map(e => e.threatId))).toEqual(new Set([a1.threatId, a2.threatId]));
    expect(main.devices).toEqual([expect.objectContaining({ deviceId: 'dev-1', displayName: 'Laptop' })]);
    expect((await get(bob, '/api/v1/incidents')).body.data.incidents).toEqual([]);
  });

  test('resolving an incident resolves each open finding through the audited workflow, and keeps their history', async () => {
    await findings.recordFinding(alice._id, fields(src('https://evil.example/login')), 'https://evil.example/login');
    await findings.recordFinding(alice._id, fields({ type: 'malware', ...src('https://evil.example/x') }), 'https://evil.example/x');
    const { incidents } = (await get(alice, '/api/v1/incidents')).body.data;
    expect((await post(bob, `/api/v1/incidents/${incidents[0].incidentId}/resolve`)).status).toBe(404);
    const r = (await post(alice, `/api/v1/incidents/${incidents[0].incidentId}/resolve`, { note: 'blocked at the proxy' })).body.data;
    expect(r.resolved).toHaveLength(2);
    expect(Threat.docs.every(t => t.status === 'resolved')).toBe(true);
    expect(Threat.docs[0].timeline.slice(-1)[0].details).toMatch(/resolved with incident inc_.*: blocked at the proxy/);
    expect(AuditEvent.docs.filter(e => e.action === 'finding.state_change')).toHaveLength(2);
    const after = (await get(alice, '/api/v1/incidents')).body.data.incidents[0];
    expect(after).toMatchObject({ state: 'closed', openFindings: 0 });
  });
});

describe('incident evidence', () => {
  const get = (user, path) => client.request(path, { headers: { Authorization: `Bearer ${signSessionToken(user)}` } });
  const scan = (user, target) => sandboxAnalysisService._store({
    id: require('crypto').randomUUID(), type: 'url', target, verdict: 'malicious', mlReport: {}, iocs: [], mitre: { techniques: [] },
    findings: [], timeline: [], metadata: {}, durationMs: 5, createdAt: new Date().toISOString()
  }, { userId: user._id, workspaceId: `ws-${user._id}` });

  test('an incident lists the stored evidence about its host, and exports it with a signed manifest', async () => {
    process.env.AUDIT_SIGNING_KEY = Buffer.alloc(32, 3).toString('base64');
    await findings.recordFinding(alice._id, fields({ source: { url: 'https://evil.example/login' } }), 'https://evil.example/login');
    const mine = await scan(alice, 'https://www.evil.example/login?x=1');
    await scan(alice, 'https://other.example/');
    await scan(bob, 'https://evil.example/login');
    const incident = (await get(alice, '/api/v1/incidents')).body.data.incidents[0];
    expect(incident.evidence).toEqual([expect.objectContaining({ id: mine.id, kind: 'sandbox_scan', intact: true, evidenceHash: mine.integrity.evidenceHash })]);
    const exported = (await get(alice, `/api/v1/incidents/${incident.incidentId}/evidence`)).body.data;
    expect(exported.manifest.items.map(i => i.id)).toEqual([mine.id]);
    expect(exported.signature).toMatchObject({ keyId: expect.any(String), value: expect.any(String) });
    expect((await get(bob, `/api/v1/incidents/${incident.incidentId}/evidence`)).status).toBe(404);
    delete process.env.AUDIT_SIGNING_KEY;
  });
});
