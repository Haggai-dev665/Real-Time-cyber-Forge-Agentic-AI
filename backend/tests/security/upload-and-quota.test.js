// Uploads are bounded and their names, types and metadata are treated as
// untrusted; analyses are limited per workspace, by count and by how many run
// at once (SEC-04).
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/services/workspaceService', () => ({
  ensurePersonalWorkspace: jest.fn(async user => `ws-${user._id}`),
  workspaceIdFor: jest.fn(async principal => (principal && principal.userId ? (principal.workspaceId || `ws-${principal.userId}`) : null)),
  activeMembership: jest.fn(async (workspaceId, userId) => (workspaceId === `ws-${userId}` ? { role: 'owner' } : null))
}));
jest.mock('../../src/models/SandboxScan', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection({ unique: [{ fields: ['scanId'] }] }),
  { VERDICTS: ['clean', 'suspicious', 'malicious', 'unknown'], RETENTION_DAYS: 90 }
));
jest.mock('../../src/models/AuditEvent', () => Object.assign(
  require('../helpers/fakeCollection').fakeCollection(),
  { OUTCOMES: ['success', 'failure', 'warning'], RETENTION_DAYS: 90 }
));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../src/services/redis', () => ({
  isReady: () => false, get: jest.fn(async () => null), set: jest.fn(async () => true), del: jest.fn(async () => true)
}));
jest.mock('../../src/services/cyberforgeMLService', () => ({
  cyberforgeML: { analyzeUrl: jest.fn(), predict: jest.fn() }
}));

const express = require('express');
const User = require('../../src/models/User');
const { cyberforgeML } = require('../../src/services/cyberforgeMLService');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { analysisQuota } = require('../../src/middleware/analysisQuota');
const { safeFilename, boundedMetadata, detectType, describeContent } = require('../../src/services/uploadPolicy');
const { serve } = require('../helpers/http');

const MZ = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 0x90)]);
const PDF = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\n');
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);

describe('file names are untrusted text', () => {
  test.each([
    ['../../etc/passwd', 'passwd'],
    ['C:\\Users\\victim\\invoice.pdf', 'invoice.pdf'],
    ['invoice\u202Efdp.exe', 'invoicefdp.exe'],
    ['report\u0000.pdf\r\n', 'report.pdf'],
    ['  .hidden  ', 'hidden'],
    ['', 'unnamed'],
    [null, 'unnamed'],
    ['\u200B\u2066', 'unnamed']
  ])('%j becomes %j', (raw, clean) => {
    expect(safeFilename(raw)).toBe(clean);
  });

  test('a long name is cut to 200 characters and keeps its extension', () => {
    const name = safeFilename(`${'a'.repeat(500)}.exe`);
    expect(name).toHaveLength(200);
    expect(name.endsWith('.exe')).toBe(true);
  });
});

describe('metadata is a small flat object', () => {
  test('strings, numbers and booleans are kept; nesting, operators and extra keys are dropped', () => {
    const raw = { source: 'email', size: 3, flagged: true, nested: { a: 1 }, list: [1], $where: 'x', 'a.b': 1, note: 'x'.repeat(900) };
    for (let i = 0; i < 30; i += 1) raw[`k${i}`] = i;
    const { metadata, dropped, invalid } = boundedMetadata(JSON.stringify(raw));
    expect(invalid).toBe(false);
    expect(Object.keys(metadata)).toHaveLength(20);
    expect(metadata).toMatchObject({ source: 'email', size: 3, flagged: true });
    expect(metadata.note).toHaveLength(500);
    expect(metadata).not.toHaveProperty('nested');
    expect(metadata).not.toHaveProperty('$where');
    expect(metadata).not.toHaveProperty('a.b');
    expect(dropped).toBeGreaterThan(10);
  });

  test.each(['not json', '[1,2]', '"text"', '5'])('%s is refused', raw => {
    expect(boundedMetadata(raw).invalid).toBe(true);
  });

  test('nothing sent is an empty object', () => {
    expect(boundedMetadata(undefined)).toEqual({ metadata: {}, dropped: 0, invalid: false });
  });
});

describe('the type is read from the content', () => {
  test.each([
    ['pe', MZ], ['elf', Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1])], ['pdf', PDF], ['zip', ZIP],
    ['gzip', Buffer.from([0x1f, 0x8b, 8, 0])], ['script', Buffer.from('#!/bin/sh\nrm -rf /\n')],
    ['text', Buffer.from('plain words\n')], ['binary', Buffer.from([0, 1, 2, 3, 250, 0, 7])], ['empty', Buffer.alloc(0)]
  ])('recognises %s content', (type, buffer) => {
    expect(detectType(buffer).type).toBe(type);
  });

  test('an executable named as a document is reported as disguised', () => {
    const { detected, findings } = describeContent('invoice.pdf', MZ, 'application/pdf');
    expect(detected.type).toBe('pe');
    expect(findings).toEqual([expect.stringMatching(/named \.pdf but its content is a Windows executable.*disguised/)]);
  });

  test('an executable sent with an image type is reported', () => {
    expect(describeContent('photo', MZ, 'image/png').findings).toEqual([
      expect.stringMatching(/no extension/), expect.stringMatching(/sent as image\/png/)
    ]);
  });

  test('an archive is reported as not unpacked; a matching name raises nothing else', () => {
    expect(describeContent('bundle.docx', ZIP).findings).toEqual([expect.stringMatching(/not unpacked or analysed/)]);
    expect(describeContent('paper.pdf', PDF).findings).toEqual([]);
  });
});

describe('the analysis quota', () => {
  const saved = {};
  let client;
  let gate;
  let openGate;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = req.get('x-user') ? { userId: req.get('x-user'), workspaceId: `ws-${req.get('x-user')}` } : null;
      next();
    });
    app.post('/one', analysisQuota(), (req, res) => res.json({ ok: true }));
    app.post('/batch', analysisQuota(req => req.body.urls.length), (req, res) => res.json({ ok: true }));
    app.post('/slow', analysisQuota(), async (req, res) => { await gate; res.json({ ok: true }); });
    client = await serve(app);
  });
  afterAll(() => client.close());
  beforeEach(() => {
    for (const key of ['ANALYSIS_QUOTA', 'ANALYSIS_WINDOW_MS', 'ANALYSIS_CONCURRENCY']) saved[key] = process.env[key];
    process.env.ANALYSIS_QUOTA = '5';
    process.env.ANALYSIS_CONCURRENCY = '2';
    analysisQuota.reset();
    gate = new Promise(resolve => { openGate = resolve; });
  });
  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  const post = (path, user, body = {}) => fetch(`${client.url}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { 'x-user': user } : {}) }, body: JSON.stringify(body)
  });

  test('the sixth analysis in the window is refused with 429 and Retry-After; another workspace is unaffected', async () => {
    for (let i = 0; i < 5; i += 1) expect((await post('/one', 'alice')).status).toBe(200);
    const refused = await post('/one', 'alice');
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await refused.json()).toMatchObject({ success: false, code: 'QUOTA_EXCEEDED', limits: { quota: 5, concurrency: 2 } });
    expect((await post('/one', 'bob')).status).toBe(200);
  });

  test('a batch counts once per URL, and one that would go over is refused whole', async () => {
    expect((await post('/batch', 'alice', { urls: ['a', 'b', 'c', 'd'] })).status).toBe(200);
    expect((await post('/batch', 'alice', { urls: ['e', 'f'] })).status).toBe(429);
    expect((await post('/one', 'alice')).status).toBe(200);
  });

  test('at most two run at once; a slot frees when one finishes', async () => {
    const first = post('/slow', 'alice');
    const second = post('/slow', 'alice');
    await new Promise(resolve => setTimeout(resolve, 50));
    const third = await post('/one', 'alice');
    expect(third.status).toBe(429);
    expect((await third.json()).message).toMatch(/at once/);
    openGate();
    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
    expect((await post('/one', 'alice')).status).toBe(200);
  });

  test('without a signed-in user nothing is counted and the request is refused', async () => {
    expect((await post('/one', null)).status).toBe(401);
  });
});

describe('the sandbox upload route', () => {
  const alice = { _id: '507f1f77bcf86cd799439011', email: 'alice@example.com', role: 'user', isActive: true, isLocked: () => false, activity: {}, save: jest.fn() };
  let client;
  let consoleError;

  beforeAll(async () => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const app = express();
    app.use(express.json());
    app.use('/api/sandbox', require('../../src/routes/sandbox'));
    client = await serve(app);
  });
  afterAll(async () => {
    consoleError.mockRestore();
    await client.close();
  });
  beforeEach(() => {
    analysisQuota.reset();
    User.findById.mockImplementation(async id => (String(id) === alice._id ? alice : null));
    cyberforgeML.predict.mockResolvedValue({ available: false, threat_score: null, risk_level: 'unknown', is_threat: false });
  });

  const upload = (parts) => {
    const form = new FormData();
    for (const [name, value, filename] of parts) {
      if (filename !== undefined) form.append(name, new Blob([value]), filename); else form.append(name, value);
    }
    return fetch(`${client.url}/api/sandbox/analyze/file`, {
      method: 'POST', headers: { Authorization: `Bearer ${signSessionToken(alice)}` }, body: form
    });
  };

  test('a disguised executable is stored under its cleaned name with the mismatch as a finding', async () => {
    const response = await upload([['file', MZ, '..\\..\\invoice\u202Efdp.pdf'], ['metadata', JSON.stringify({ source: 'mail', $gt: 1 })]]);
    expect(response.status).toBe(200);
    const { scan } = await response.json();
    expect(scan.target).toBe('invoicefdp.pdf');
    expect(scan.mlReport.detectedType).toBe('pe');
    expect(scan.findings).toEqual(expect.arrayContaining([expect.stringMatching(/disguised executable/)]));
    expect(scan.metadata).toEqual({ source: 'mail' });
    expect(scan.integrity).toMatchObject({ intact: true });
  });

  test('a second file in the same form is refused as JSON before analysis', async () => {
    const response = await upload([['file', PDF, 'a.pdf'], ['file', PDF, 'b.pdf']]);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'LIMIT_FILE_COUNT' });
    expect(cyberforgeML.predict).not.toHaveBeenCalled();
  });

  test('metadata that is not an object, or an empty file, is refused', async () => {
    expect((await upload([['file', PDF, 'a.pdf'], ['metadata', '[1,2]']])).status).toBe(400);
    expect((await upload([['file', Buffer.alloc(0), 'empty.txt']])).status).toBe(400);
    expect(cyberforgeML.predict).not.toHaveBeenCalled();
  });

  test('a file over the size limit is refused with 413', async () => {
    const response = await upload([['file', Buffer.alloc(25 * 1024 * 1024 + 1, 0x41), 'big.txt']]);
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: 'LIMIT_FILE_SIZE' });
  });
});
