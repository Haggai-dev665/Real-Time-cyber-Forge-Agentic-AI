// DET-04: evidence reports from a fixed, signed snapshot, with what limits them.
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/services/workspaceService', () => ({
  ensurePersonalWorkspace: jest.fn(async user => `ws-${user._id}`),
  workspaceIdFor: jest.fn(async principal => (principal && principal.userId ? (principal.workspaceId || `ws-${principal.userId}`) : null)),
  activeMembership: jest.fn(async (workspaceId, userId) => (workspaceId === `ws-${userId}` ? { role: 'owner' } : null))
}));
const mockFake = (unique = []) => require('../helpers/fakeCollection').fakeCollection({ unique });
jest.mock('../../src/models/Threat', () => mockFake([{ fields: ['threatId'] }]));
jest.mock('../../src/models/FindingException', () => Object.assign(mockFake(), { MAX_DAYS: 90, SEVERITIES: ['low', 'medium', 'high', 'critical'] }));
jest.mock('../../src/models/Device', () => mockFake());
jest.mock('../../src/models/AgentRun', () => mockFake());
jest.mock('../../src/models/SandboxScan', () => Object.assign(mockFake([{ fields: ['scanId'] }]), { VERDICTS: ['clean', 'suspicious', 'malicious', 'unknown'], RETENTION_DAYS: 90 }));
jest.mock('../../src/models/AuditEvent', () => Object.assign(mockFake(), { OUTCOMES: ['success', 'failure', 'warning'], RETENTION_DAYS: 90 }));
jest.mock('../../src/services/cyberforgeMLService', () => ({ cyberforgeML: {} }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const crypto = require('crypto');
const express = require('express');
const User = require('../../src/models/User');
const Threat = require('../../src/models/Threat');
const Device = require('../../src/models/Device');
const AgentRun = require('../../src/models/AgentRun');
const SandboxScan = require('../../src/models/SandboxScan');
const AuditEvent = require('../../src/models/AuditEvent');
const findings = require('../../src/services/findingService');
const { sandboxAnalysisService } = require('../../src/services/sandboxAnalysisService');
const { verifySignature } = require('../../src/services/integrityKey');
const { hashOf } = require('../../src/utils/canonical');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { serve } = require('../helpers/http');

const account = id => ({ _id: id, email: `${id}@example.com`, role: 'user', isActive: true, isLocked: () => false, activity: {}, save: jest.fn() });
const alice = account('507f1f77bcf86cd799439011');
const bob = account('507f1f77bcf86cd799439012');
const ws = user => `ws-${user._id}`;

let client;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', require('../../src/routes/reports'));
  client = await serve(app);
});
afterAll(() => client.close());
beforeEach(() => {
  process.env.AUDIT_SIGNING_KEY = Buffer.alloc(32, 4).toString('base64');
  for (const m of [Threat, Device, AgentRun, SandboxScan, AuditEvent]) m.reset();
  User.findById.mockImplementation(async id => [alice, bob].find(u => u._id === String(id)) || null);
});
const get = (user, q = '') => client.request(`/api/v1/reports/evidence${q}`, { headers: { Authorization: `Bearer ${signSessionToken(user)}` } });
const finding = (user, url, over = {}) => findings.recordFinding(user._id, { type: 'phishing', severity: 'high', description: 'x', detection: { method: 'ml_model', confidence: 0.9, model_version: 'phish-v3' }, source: { url }, ...over }, url);
const scan = (user, target, verdict = 'malicious') => sandboxAnalysisService._store({
  id: crypto.randomUUID(), type: 'url', target, verdict, mlReport: {}, iocs: [], mitre: { techniques: [] }, findings: [], timeline: [], metadata: {}, durationMs: 5, createdAt: new Date().toISOString()
}, { userId: user._id, workspaceId: ws(user) });

test('a report holds the window\'s findings, incidents and evidence, linked by ID, and its limits', async () => {
  await finding(alice, 'https://evil.example/login');
  const old = (await finding(alice, 'https://older.example/')).threat;
  Threat.docs.find(t => t.threatId === old.threatId).lastSeenAt = new Date(Date.now() - 30 * 86400000);
  const ev = await scan(alice, 'https://evil.example/login');
  await scan(alice, 'https://unknown.example/', 'unknown');
  await AuditEvent.create({ scope: 'workspace', workspaceId: ws(alice), action: 'evidence.delete', resource: 'sandbox scan gone-1', details: { evidenceHash: 'h1' }, createdAt: new Date() });
  await AgentRun.create({ runId: 'r1', workspaceId: ws(alice), agentId: 'a1', state: 'partial', createdAt: new Date(),
    steps: [{ tool: 'url_classify', status: 'failed', summary: 'no URL model answered, so there is no verdict' }], findings: [{ engine: 'ml-service url models' }] });
  await Device.create({ deviceId: 'dev-1', workspaceId: ws(alice), kind: 'endpoint', displayName: 'Laptop', state: 'active', lastSeenAt: new Date(Date.now() - 2 * 86400000), capabilities: { advertised: [], confirmed: {} } });
  await finding(bob, 'https://evil.example/login');

  const r = await get(alice, '?tz=Europe/London');
  expect(r.status).toBe(200);
  const { report, snapshotHash, signature } = r.body.data;
  expect(report.window.tz).toBe('Europe/London');
  expect(report.findings.map(f => f.type)).toEqual(['phishing']);               // the 30-day-old one is outside the week
  expect(report.findings[0].evidenceIds).toEqual([ev.id]);
  expect(report.incidents.map(i => [i.host, i.evidenceIds])).toEqual([['evil.example', [ev.id]]]);
  expect(report.evidence).toHaveLength(2);
  expect(report.limits.deletedEvidence).toEqual([expect.objectContaining({ resource: 'sandbox scan gone-1', evidenceHash: 'h1' })]);
  expect(report.limits.scansWithoutVerdict).toHaveLength(1);
  expect(report.limits.providerFailures).toEqual([expect.objectContaining({ runId: 'r1', tool: 'url_classify' })]);
  expect(report.limits.devicesNotFullyCovered.map(d => d.deviceId)).toEqual(['dev-1']);
  expect(report.modelVersions).toEqual({ findings: ['phish-v3'], agentEngines: ['ml-service url models'] });
  expect(report.summary.join(' ')).toMatch(/1 finding in this period \(1 still open\), in 1 incident/);
  expect(report.summary.join(' ')).toMatch(/1 check could not run because a model or service did not answer/);
  // the snapshot is hashed and signed
  expect(snapshotHash).toBe(hashOf(report));
  expect(verifySignature(signature.publicKey, `cyberforge-evidence-report-v1\n${snapshotHash}`, signature.value)).toBe(true);
  expect(JSON.stringify(report)).not.toContain(bob._id);
  expect(AuditEvent.docs.some(e => e.action === 'report.generate' && e.details.snapshotHash === snapshotHash)).toBe(true);
});

test('the window and timezone are checked', async () => {
  expect((await get(alice, '?tz=Mars/Base')).body.code).toBe('TIMEZONE_INVALID');
  expect((await get(alice, '?from=2026-01-01&to=2026-12-31')).body.code).toBe('RANGE_INVALID');
  expect((await get(alice, '?from=2026-10-10&to=2026-10-01')).body.code).toBe('RANGE_INVALID');
});

test('with no device and nothing found, the report says so', async () => {
  const { report } = (await get(alice)).body.data;
  expect(report.summary).toEqual(expect.arrayContaining(['No enrolled device: nothing was watched on a device.', 'No check failed for want of a model or service.']));
  expect(report.findings).toEqual([]);
});
