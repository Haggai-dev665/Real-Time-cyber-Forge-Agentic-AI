// The rendered-page scanner (WebScraper.live, API v1) is an external provider.
// These tests pin the contract between it and this backend, against a loopback
// server that imitates it. `fixtures/scraper-v1-scan.json` is a real response
// recorded by the scanner's own test suite (web-scrapper:
// backend/tests/fixtures/v1-scan-example.json), which fails there if the
// scanner's response stops having that shape.
//
// The rule under test (SEC-06, UX-03, finding F19): a scanner that is missing,
// unreachable, slow or refusing must surface as missing coverage and an
// unknown verdict. It must never surface as a clean page.
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/services/appwriteService', () => ({ appwriteService: { createAlert: jest.fn(async () => ({})) } }));
jest.mock('../../src/agent/AgentManager', () => require('../helpers/stub').anything());
jest.mock('../../src/services/mlServiceClient', () => {
  // The two calls that reach the ML service are stand-ins; the description of a
  // missing explanation is the real one.
  const { mlServiceClient: actual } = jest.requireActual('../../src/services/mlServiceClient');
  return { mlServiceClient: { classifyThreat: jest.fn(), getExplanation: jest.fn(), unavailableExplanation: actual.unavailableExplanation } };
});
jest.mock('../../src/services/realtimeBus', () => ({ emit: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

// The service module builds a singleton when loaded and warns that it is not
// configured; that is expected here, so the warning is captured, not printed.
const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

const express = require('express');
const net = require('net');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { getScraperConfig } = require('../../src/config/scraper.config');
const { WebScraperAPIService } = require('../../src/services/WebScraperAPIService');
const { serve } = require('../helpers/http');
const recorded = require('./fixtures/scraper-v1-scan.json');

const KEY = 'sk-contract-test-key-0000000000000000';
const clone = value => JSON.parse(JSON.stringify(value));
const completed = (changes = {}) => ({ ...clone(recorded), data: { ...clone(recorded.data), ...changes } });
const envelopeError = (code, message) => ({ success: false, data: null, error: { code, message } });

// ── A loopback imitation of the scanner ──────────────────────────────────────
let provider;
let calls;
let onCreate;
let onGet;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.post('/api/v1/scans', (req, res) => {
    calls.push({ method: 'POST', path: req.path, key: req.get('x-api-key'), body: req.body });
    onCreate(req, res);
  });
  app.get('/api/v1/scans/:id', (req, res) => {
    calls.push({ method: 'GET', path: req.path, key: req.get('x-api-key') });
    onGet(req, res);
  });
  provider = await serve(app);
});
afterAll(async () => {
  warn.mockRestore();
  await provider.close();
});
beforeEach(() => {
  calls = [];
  onCreate = (req, res) => res.status(200).json(completed());
  onGet = (req, res) => res.status(200).json(completed());
});

const client = (env = {}) => new WebScraperAPIService({ WEBSCRAPER_API_URL: provider.url, WEBSCRAPER_API_KEY: KEY, ...env });
const TARGET = 'https://login.example.test/account';

/** Nothing about a result may read as a clean page. */
function expectNoCleanClaim(service, result) {
  const analysis = service.formatForAIAnalysis(result);
  expect(result.success).toBe(false);
  expect(result.data).toBeNull();
  expect(result.coverage.rendered_page.status).toMatch(/^(failed|skipped)$/);
  expect(result.coverage.rendered_page.reason).toEqual(expect.any(String));
  expect(analysis.evidence_status).toBe('unavailable');
  expect(analysis.risk_score).toBeNull();
  expect(analysis.risk_level).toBe('unknown');
  expect(analysis.security_summary).toBeNull();
  expect(analysis.signals).toEqual([]);
  expect(analysis.coverage_gaps.length).toBeGreaterThan(0);
  const context = service.generateAIContext(analysis);
  expect(context).toContain('Coverage: UNAVAILABLE');
  // The only mention of safety is the statement that none was established.
  expect(context).toContain('nothing here indicates it is safe');
  expect(context.replace('nothing here indicates it is safe', '')).not.toMatch(/\/100|No signals were raised|\bclean\b|\bsafe\b|\bbenign\b/i);
  return analysis;
}

describe('configuration', () => {
  test('defaults to HTTPS, and the old scrape-endpoint URL is read as a base', () => {
    expect(getScraperConfig({ WEBSCRAPER_API_KEY: KEY })).toEqual({ available: true, reason: null, baseUrl: 'https://webscrapper.live', apiKey: KEY });
    expect(getScraperConfig({ WEBSCRAPER_API_URL: 'https://webscrapper.live/api/scrape', WEBSCRAPER_API_KEY: KEY }).baseUrl).toBe('https://webscrapper.live');
    expect(getScraperConfig({ WEBSCRAPER_API_URL: 'https://scanner.example.test/prefix/api/v1/scans/', WEBSCRAPER_API_KEY: KEY }).baseUrl).toBe('https://scanner.example.test/prefix');
    expect(getScraperConfig({ WEBSCRAPER_API_URL: 'http://127.0.0.1:8080', WEBSCRAPER_API_KEY: KEY }).baseUrl).toBe('http://127.0.0.1:8080');
  });

  test.each([
    ['plain HTTP to an external host', { WEBSCRAPER_API_URL: 'http://webscrapper.live/api/scrape', WEBSCRAPER_API_KEY: KEY }, 'must use HTTPS'],
    ['another scheme', { WEBSCRAPER_API_URL: 'ftp://webscrapper.live', WEBSCRAPER_API_KEY: KEY }, 'must use HTTPS'],
    ['credentials in the URL', { WEBSCRAPER_API_URL: 'https://user:hunter2@scanner.example.test', WEBSCRAPER_API_KEY: KEY }, 'must not contain credentials'],
    ['a value that is not a URL', { WEBSCRAPER_API_URL: 'scanner hunter2', WEBSCRAPER_API_KEY: KEY }, 'not a valid URL'],
    ['no API key', { WEBSCRAPER_API_URL: 'https://webscrapper.live' }, 'WEBSCRAPER_API_KEY is not set']
  ])('%s makes the scanner unavailable instead of falling back', async (label, env, reason) => {
    const config = getScraperConfig(env);
    expect(config).toEqual({ available: false, reason: expect.stringContaining(reason), baseUrl: null, apiKey: '' });
    expect(config.reason).not.toContain('hunter2');

    const service = new WebScraperAPIService(env);
    expect(service.status()).toEqual({ available: false, reason: config.reason });
    const result = await service.scrapeWebsite(TARGET);
    expect(result).toMatchObject({ status: 'unavailable', error_code: 'SCRAPER_NOT_CONFIGURED' });
    expectNoCleanClaim(service, result);
    // Nothing was sent anywhere, and the warning does not echo the setting.
    expect(calls).toEqual([]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('hunter2');
  });
});

describe('request', () => {
  test('creates a fast scan with wait_seconds, authenticated by header, within a budget that fits a 30-second router', async () => {
    const result = await client().scrapeWebsite(TARGET);
    expect(result.success).toBe(true);
    expect(calls).toEqual([{ method: 'POST', path: '/api/v1/scans', key: KEY, body: { url: TARGET, profile: 'fast', wait_seconds: 15, fresh: false } }]);
  });

  test('wait_seconds never exceeds what the budget allows', async () => {
    await client().scrapeWebsite(TARGET, { budgetMs: 8000 });
    await client().scrapeWebsite(TARGET, { budgetMs: 60000, waitSeconds: 60 });
    expect(calls[0].body.wait_seconds).toBe(5);
    // The budget is capped below the router limit whatever the caller asks.
    expect(calls[1].body.wait_seconds).toBe(25);
  });
});

describe('a completed scan', () => {
  test('is read from the envelope: evidence arrives, where it used to arrive empty', async () => {
    const result = await client().scrapeWebsite(TARGET);
    expect(result).toMatchObject({ success: true, status: 'completed', url: TARGET, scan_id: recorded.data.scan_id, error: null });
    const data = result.data;
    expect(data.signals).toEqual(recorded.data.signals);
    expect(data.coverage).toEqual(recorded.data.coverage);
    expect(data.ai_context).toBe(recorded.data.ai_context);
    expect(data.result.forms[0]).toMatchObject({ password: true, action_cross_site: true });
    // The older field names existing consumers read are filled from that evidence.
    expect(data.network_requests.length).toBe(recorded.data.result.network.requests.length);
    expect(data.network_requests.length).toBeGreaterThan(0);
    expect(data.network_requests[0]).toEqual(expect.objectContaining({ url: expect.any(String), status: 200, contentType: 'document' }));
    expect(data.security_report).toEqual({
      url: recorded.data.result.page.final_url,
      is_https: false,
      mixed_content: false,
      missing_security_headers: ['Strict-Transport-Security', 'Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy'],
      insecure_cookies: true,
      csp: null
    });
    expect(data.performance_metrics).toMatchObject({
      total_load_time_ms: recorded.data.result.timing.load_ms,
      dom_ready_time_ms: recorded.data.result.timing.dom_content_loaded_ms,
      cumulative_layout_shift: recorded.data.result.timing.cumulative_layout_shift
    });
    expect(Object.keys(data.response_headers).length).toBeGreaterThan(0);
    expect(data.scraped_at).toBe(recorded.data.finished_at);
  });

  test('passes signals, coverage and ai_context through to the analysis and the prompt context', async () => {
    const service = client();
    const analysis = service.formatForAIAnalysis(await service.scrapeWebsite(TARGET));
    expect(analysis.evidence_status).toBe('complete');
    expect(analysis.signals).toEqual(recorded.data.signals);
    expect(analysis.coverage).toEqual(recorded.data.coverage);
    expect(analysis.ai_context).toBe(recorded.data.ai_context);
    expect(analysis.coverage_gaps).toEqual(['favicon_brand_match: no reference set of brand favicon hashes is available']);
    expect(analysis.security_summary).toMatchObject({ is_https: false, has_mixed_content: false, has_insecure_cookies: true, external_domains_count: 1 });
    expect(analysis.forms).toHaveLength(1);
    expect(analysis.registrable_domain).toBe('bank.test');

    const context = service.generateAIContext(analysis);
    expect(context).toContain('Coverage: complete');
    expect(context).toContain(recorded.data.ai_context);
    expect(context).toContain('Evidence score (heuristic summary of the signals, not a probability): 100/100');
  });

  test('the evidence score is the documented heuristic over signal severities', () => {
    const service = client();
    const signal = (severity, id = `s_${severity}`) => ({ id, severity, title: id, evidence: {} });
    expect(service.evidenceScore([], true)).toBe(0);
    expect(service.evidenceScore([signal('info'), signal('info')], true)).toBe(0);
    expect(service.evidenceScore([signal('low')], true)).toBe(3);
    expect(service.evidenceScore(Array.from({ length: 9 }, () => signal('low')), true)).toBe(12);
    expect(service.evidenceScore([signal('medium')], true)).toBe(12);
    expect(service.evidenceScore([signal('high')], true)).toBe(30);
    expect(service.evidenceScore([signal('high'), signal('high'), signal('high'), signal('medium')], true)).toBe(72);
    // Three high, three medium and five low in the recorded phishing page: capped at 100.
    expect(service.evidenceScore(recorded.data.signals, true)).toBe(100);
    // A page that was not observed has no score; a blocked redirect is still evidence.
    expect(service.evidenceScore([signal('medium', 'page_not_loaded')], false)).toBeNull();
    expect(service.evidenceScore([signal('medium', 'page_not_loaded'), signal('high', 'redirect_to_blocked_target')], false)).toBe(30);
    expect(service.getRiskLevel(null)).toBe('unknown');
    expect(service.getRiskLevel(0)).toBe('minimal');
    expect(service.getRiskLevel(72)).toBe('critical');
  });

  test('a cached result is labelled with its age', async () => {
    onCreate = (req, res) => res.status(200).json(completed({ cache: { hit: true, age_seconds: 240 } }));
    const service = client();
    const analysis = service.formatForAIAnalysis(await service.scrapeWebsite(TARGET));
    expect(analysis.cache).toEqual({ hit: true, age_seconds: 240 });
    expect(service.generateAIContext(analysis)).toContain('(cached result, 240s old)');
  });

  test('a page that did not load is a scan with no page evidence, not a clean page', async () => {
    const scan = completed();
    scan.data.result.page = { ...scan.data.result.page, loaded: false, final_url: null, status: null, load_error: 'the host name did not resolve', title: null };
    scan.data.signals = [{ id: 'page_not_loaded', severity: 'medium', title: 'The page could not be loaded, so page evidence is missing', evidence: { reason: 'the host name did not resolve' } }];
    scan.data.coverage = { navigation: { status: 'failed', reason: 'the host name did not resolve' }, forms: { status: 'skipped', reason: 'the page did not load' } };
    scan.data.result.security_headers = null;
    scan.data.result.cookies = [];
    onCreate = (req, res) => res.status(200).json(scan);

    const service = client();
    const result = await service.scrapeWebsite(TARGET);
    expect(result.success).toBe(true);
    expect(result.data.security_report).toMatchObject({ is_https: null, mixed_content: null, insecure_cookies: null });
    const analysis = service.formatForAIAnalysis(result);
    expect(analysis).toMatchObject({ evidence_status: 'unavailable', risk_score: null, risk_level: 'unknown' });
    expect(analysis.coverage_gaps).toEqual(['navigation: the host name did not resolve', 'forms: the page did not load']);
    expect(service.generateAIContext(analysis)).toContain('Coverage: UNAVAILABLE');
  });

  test('a failed core check makes the evidence partial; a missing favicon does not', async () => {
    const service = client();
    const withGap = (name, entry) => {
      const scan = completed();
      scan.data.coverage[name] = entry;
      onCreate = (req, res) => res.status(200).json(scan);
      return service.scrapeWebsite(TARGET).then(result => service.formatForAIAnalysis(result));
    };
    const scripts = await withGap('scripts', { status: 'failed', reason: 'timed out' });
    expect(scripts.evidence_status).toBe('partial');
    expect(scripts.coverage_gaps).toContain('scripts: timed out');
    expect(service.generateAIContext(scripts)).toContain('Coverage: PARTIAL');

    const favicon = await withGap('favicon_hash', { status: 'failed', reason: 'no icon could be fetched' });
    expect(favicon.evidence_status).toBe('complete');
    expect(favicon.coverage_gaps).toContain('favicon_hash: no icon could be fetched');

    onCreate = (req, res) => res.status(200).json(completed({ partial: true }));
    expect(service.formatForAIAnalysis(await service.scrapeWebsite(TARGET)).evidence_status).toBe('partial');
  });
});

describe('polling', () => {
  test('a 202 is polled until the scan completes', async () => {
    let polls = 0;
    onCreate = (req, res) => res.status(202).json(completed({ status: 'running', result: null, signals: [], coverage: {}, ai_context: null }));
    onGet = (req, res) => res.status(200).json(++polls < 2 ? completed({ status: 'running', result: null, signals: [], coverage: {}, ai_context: null }) : completed());
    const result = await client().scrapeWebsite(TARGET, { budgetMs: 9000, waitSeconds: 0 });
    expect(result).toMatchObject({ success: true, status: 'completed' });
    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual(['POST /api/v1/scans', `GET /api/v1/scans/${recorded.data.scan_id}`, `GET /api/v1/scans/${recorded.data.scan_id}`]);
    expect(calls[1].key).toBe(KEY);
  });

  test('a scan still running when the budget ends is reported as pending, with its id', async () => {
    const running = completed({ status: 'running', result: null, signals: [], coverage: {}, ai_context: null });
    onCreate = (req, res) => res.status(202).json(running);
    onGet = (req, res) => res.status(200).json(running);
    const service = client();
    const started = Date.now();
    const result = await service.scrapeWebsite(TARGET, { budgetMs: 3000, waitSeconds: 0 });
    expect(Date.now() - started).toBeLessThan(4000);
    expect(result).toMatchObject({ status: 'pending', error_code: 'SCAN_PENDING', scan_id: recorded.data.scan_id });
    expectNoCleanClaim(service, result);
  });
});

describe('provider failures', () => {
  test.each([
    ['the browser is not running', 503, 'CAPABILITY_UNAVAILABLE', 'unavailable'],
    ['the scan queue is full', 503, 'QUEUE_FULL', 'unavailable'],
    ['the key is over its hourly limit', 429, 'RATE_LIMITED', 'unavailable'],
    ['the monthly quota is used up', 429, 'QUOTA_EXCEEDED', 'unavailable'],
    ['the key is rejected', 401, 'UNAUTHENTICATED', 'unavailable'],
    ['the provider fails internally', 500, 'INTERNAL_ERROR', 'unavailable'],
    ['the destination is refused', 422, 'TARGET_NOT_ALLOWED', 'refused']
  ])('%s (%i %s) is reported with the provider’s code', async (label, status, code, expected) => {
    onCreate = (req, res) => res.status(status).json(envelopeError(code, `provider said ${code}`));
    const service = client();
    const result = await service.scrapeWebsite(TARGET);
    expect(result).toMatchObject({ status: expected, error_code: code });
    expect(result.coverage.rendered_page.status).toBe(expected === 'refused' ? 'skipped' : 'failed');
    expectNoCleanClaim(service, result);
  });

  test.each([
    ['a scan that timed out', 'SCAN_TIMEOUT'],
    ['a scan interrupted by a restart', 'SCAN_INTERRUPTED']
  ])('%s is a failed scan, not an empty success', async (label, code) => {
    onCreate = (req, res) => res.status(200).json(completed({ status: 'failed', result: null, signals: [], coverage: {}, ai_context: null, error: { code, message: 'The scan did not finish' } }));
    const service = client();
    const result = await service.scrapeWebsite(TARGET);
    expect(result).toMatchObject({ status: 'failed', error_code: code, scan_id: recorded.data.scan_id });
    expectNoCleanClaim(service, result);
  });

  test.each([
    ['the pre-v1 response, with fields at the top level', 200, { success: true, title: 'Example', network_requests: [], security_report: { is_https: true, mixed_content: false, missing_security_headers: [] } }],
    ['the pre-v1 envelope, without a scan', 200, { success: true, data: { title: 'Example', security_report: { is_https: true } }, error: null }],
    ['a completed scan without a result', 200, completed({ result: null })],
    ['a completed scan without coverage', 200, completed({ coverage: undefined })],
    ['an HTML error page', 502, '<html><body>Bad gateway</body></html>'],
    ['an empty body', 200, '']
  ])('%s is a contract mismatch, never read as "nothing found"', async (label, status, body) => {
    onCreate = (req, res) => (typeof body === 'string' ? res.status(status).type('html').send(body) : res.status(status).json(body));
    const service = client();
    const result = await service.scrapeWebsite(TARGET);
    expect(result).toMatchObject({ status: 'unavailable', error_code: 'SCRAPER_CONTRACT_MISMATCH' });
    expectNoCleanClaim(service, result);
  });

  test('a provider that never answers is given up on within the budget', async () => {
    onCreate = () => { /* accept the request and say nothing */ };
    const service = client();
    const started = Date.now();
    const result = await service.scrapeWebsite(TARGET, { budgetMs: 1500 });
    expect(Date.now() - started).toBeLessThan(3000);
    expect(result).toMatchObject({ status: 'unavailable', error_code: 'SCRAPER_TIMEOUT' });
    expectNoCleanClaim(service, result);
  });

  test('an unreachable provider is reported without the address or key', async () => {
    const closed = await new Promise(resolve => {
      const probe = net.createServer().listen(0, '127.0.0.1', () => {
        const { port } = probe.address();
        probe.close(() => resolve(port));
      });
    });
    const service = new WebScraperAPIService({ WEBSCRAPER_API_URL: `http://127.0.0.1:${closed}`, WEBSCRAPER_API_KEY: KEY });
    const result = await service.scrapeWebsite(TARGET);
    expect(result).toMatchObject({ status: 'unavailable', error_code: 'SCRAPER_UNREACHABLE', error: 'the scanner could not be reached' });
    expect(JSON.stringify(result)).not.toContain(String(closed));
    expect(JSON.stringify(result)).not.toContain(KEY);
    expectNoCleanClaim(service, result);
  });

  test('the provider is never followed to another address', async () => {
    onCreate = (req, res) => res.redirect(307, 'http://127.0.0.1:1/api/v1/scans');
    const service = client();
    const result = await service.scrapeWebsite(TARGET);
    expect(result).toMatchObject({ status: 'unavailable', error_code: 'SCRAPER_CONTRACT_MISMATCH' });
    expect(calls).toHaveLength(1);
  });
});

// ── The desktop's URL scan, end to end through the real route ────────────────
const member = {
  _id: '507f1f77bcf86cd799439011', email: 'member@example.com', role: 'user', isActive: true,
  isLocked: () => false, activity: {}, save: jest.fn()
};

describe('POST /api/agent/scan-url', () => {
  let api;
  // The route and the modules it uses, loaded together after the scanner's
  // address is known: the route's scanner client reads its settings on load.
  let mlServiceClient;
  let realtimeBus;
  let appwriteService;
  let User;
  const scanUrl = body => api.request('/api/agent/scan-url', { method: 'POST', headers: { Authorization: `Bearer ${signSessionToken(member)}` }, body });

  beforeAll(async () => {
    // The route uses the module's singleton, which reads its settings when loaded.
    process.env.WEBSCRAPER_API_URL = provider.url;
    process.env.WEBSCRAPER_API_KEY = KEY;
    const app = express();
    app.use(express.json());
    jest.isolateModules(() => {
      app.use('/api/agent', require('../../src/routes/agentRoutes'));
      ({ mlServiceClient } = require('../../src/services/mlServiceClient'));
      realtimeBus = require('../../src/services/realtimeBus');
      ({ appwriteService } = require('../../src/services/appwriteService'));
      User = require('../../src/models/User');
    });
    api = await serve(app);
  });
  afterAll(async () => {
    delete process.env.WEBSCRAPER_API_URL;
    delete process.env.WEBSCRAPER_API_KEY;
    await api.close();
  });
  beforeEach(() => {
    User.findById.mockResolvedValue(member);
    realtimeBus.emit.mockClear();
    mlServiceClient.classifyThreat.mockReset().mockResolvedValue({ riskScore: 12, confidence: 0.9, category: 'benign', indicators: [], modelPredictions: {} });
    mlServiceClient.getExplanation.mockReset().mockResolvedValue({ summary: 'summary', fullAnalysis: '', recommendations: [], technicalDetails: '', geminiRiskScore: 0, geminiConfidence: 0, modelUsed: 'test' });
  });

  test('with page evidence: signals, coverage and the scanner’s context reach the response and the classifier', async () => {
    const response = await scanUrl({ url: TARGET, browser: 'chrome' });
    expect(response.status).toBe(200);
    const data = response.body.data;
    expect(data).toMatchObject({ scraperSuccess: true, scraperError: null, evidenceStatus: 'complete', scanId: recorded.data.scan_id, evidenceScore: 100, riskLevel: 'critical' });
    expect(data.signals.map(signal => signal.id)).toEqual(recorded.data.signals.map(signal => signal.id));
    expect(data.coverage.navigation).toEqual({ status: 'completed', reason: null });
    expect(data.forms[0]).toMatchObject({ password: true, action_cross_site: true });
    expect(data.formattedReport).toContain(recorded.data.ai_context);
    // Fields the desktop already reads keep their names and are now filled.
    expect(data.missingHeaders).toHaveLength(5);
    expect(data.externalDomains).toEqual(recorded.data.result.network.third_party_domains);
    expect(data.securitySummary).toMatchObject({ is_https: false, has_insecure_cookies: true });

    const [analysis] = mlServiceClient.classifyThreat.mock.calls[0];
    expect(analysis).toMatchObject({ url: TARGET, risk_score: 100, evidence_status: 'complete', ai_context: recorded.data.ai_context });
    expect(analysis.signals).toHaveLength(recorded.data.signals.length);
  });

  test('a low model score is "safe" only when the page was observed', async () => {
    const scan = completed({ signals: [] });
    onCreate = (req, res) => res.status(200).json(scan);
    const observed = await scanUrl({ url: TARGET });
    expect(observed.body.data).toMatchObject({ verdict: 'safe', evidenceStatus: 'complete', riskScore: 12, evidenceScore: 0 });
    expect(realtimeBus.emit).toHaveBeenCalledWith('scan:update', expect.objectContaining({ verdict: 'safe' }));
  });

  test.each([
    ['is unavailable', (req, res) => res.status(503).json(envelopeError('CAPABILITY_UNAVAILABLE', 'The browser is not running')), 'CAPABILITY_UNAVAILABLE'],
    ['refuses the destination', (req, res) => res.status(422).json(envelopeError('TARGET_NOT_ALLOWED', 'This destination is not allowed')), 'TARGET_NOT_ALLOWED'],
    ['answers in the old format', (req, res) => res.status(200).json({ success: true, title: 'x', security_report: { is_https: true } }), 'SCRAPER_CONTRACT_MISMATCH']
  ])('when the scanner %s, the scan still runs the URL models and reports an unknown verdict with the gap', async (label, handler, code) => {
    onCreate = handler;
    const response = await scanUrl({ url: TARGET });
    expect(response.status).toBe(200);
    const data = response.body.data;
    expect(data).toMatchObject({ scraperSuccess: false, scraperErrorCode: code, evidenceStatus: 'unavailable', verdict: 'unknown', evidenceScore: null, riskLevel: 'unknown', riskScore: 12, securitySummary: null, signals: [] });
    expect(data.scraperError).toEqual(expect.any(String));
    expect(data.coverage.rendered_page.status).toMatch(/^(failed|skipped)$/);
    expect(data.coverageGaps).toHaveLength(1);
    expect(data.formattedReport).toContain('Coverage: UNAVAILABLE');
    // The URL models were still consulted, with no page score to lean on.
    expect(mlServiceClient.classifyThreat).toHaveBeenCalledTimes(1);
    expect(mlServiceClient.classifyThreat.mock.calls[0][0]).toMatchObject({ risk_score: null, evidence_status: 'unavailable' });
    // No "safe" reaches the live dashboard either.
    expect(realtimeBus.emit).toHaveBeenCalledWith('scan:update', expect.objectContaining({ verdict: 'unknown' }));
    expect(JSON.stringify(response.body)).not.toMatch(/"verdict":"safe"|"category":"unreachable"/);
  });

  test('a high model score is still reported when the scanner is unavailable', async () => {
    onCreate = (req, res) => res.status(503).json(envelopeError('CAPABILITY_UNAVAILABLE', 'The browser is not running'));
    mlServiceClient.classifyThreat.mockResolvedValue({ riskScore: 85, confidence: 0.9, category: 'phishing', indicators: [], modelPredictions: {} });
    const response = await scanUrl({ url: TARGET });
    expect(response.body.data).toMatchObject({ verdict: 'malicious', evidenceStatus: 'unavailable', scraperSuccess: false });
  });

  // The hosting platform ends a request after 30 seconds and the chat model can
  // take that long by itself, so a scan must not wait for it without limit.
  describe('time budget', () => {
    const slowExplanation = (ms, value) => () => new Promise(resolve => setTimeout(() => resolve(value), ms));
    const explanation = { available: true, summary: 'late but real', fullAnalysis: 'analysis', recommendations: ['block it'], modelUsed: 'test-model' };
    afterEach(() => { delete process.env.SCAN_BUDGET_MS; });

    test('an explanation that arrives in time is part of the response', async () => {
      const response = await scanUrl({ url: TARGET });
      expect(response.body.data).toMatchObject({ explanationStatus: 'complete', summary: 'summary' });
      expect(realtimeBus.emit).not.toHaveBeenCalledWith('scan:explanation', expect.anything());
    });

    test('a slow explanation does not hold the scan: the result returns, and the explanation follows on the owner\'s live feed', async () => {
      process.env.SCAN_BUDGET_MS = '4000';
      mlServiceClient.classifyThreat.mockResolvedValue({ riskScore: 85, confidence: 0.9, category: 'phishing', indicators: [], modelPredictions: {} });
      mlServiceClient.getExplanation.mockImplementation(slowExplanation(3200, explanation));

      const started = Date.now();
      const response = await scanUrl({ url: TARGET });
      expect(Date.now() - started).toBeLessThan(3200);
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ explanationStatus: 'pending', riskScore: 85, verdict: 'malicious', recommendations: [] });
      expect(response.body.data.summary).toMatch(/still being written/);
      expect(realtimeBus.emit).not.toHaveBeenCalledWith('scan:explanation', expect.anything());

      await new Promise(resolve => setTimeout(resolve, 1500));
      expect(realtimeBus.emit).toHaveBeenCalledWith('scan:explanation', expect.objectContaining({
        userId: member._id, url: TARGET, summary: 'late but real', recommendations: ['block it']
      }));
    });

    test('a failed explanation does not fail the scan', async () => {
      mlServiceClient.classifyThreat.mockResolvedValue({ riskScore: 85, confidence: 0.9, category: 'phishing', indicators: [], modelPredictions: {} });
      mlServiceClient.getExplanation.mockRejectedValue(new Error('chat model unavailable'));
      const response = await scanUrl({ url: TARGET });
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ explanationStatus: 'unavailable', riskScore: 85, verdict: 'malicious' });
      expect(response.body.data.summary).toMatch(/No explanation/);
    });

    test('the alert text does not carry the placeholder for a missing explanation', async () => {
      appwriteService.createAlert.mockClear();
      mlServiceClient.classifyThreat.mockResolvedValue({ riskScore: 85, confidence: 0.9, category: 'phishing', indicators: [], modelPredictions: {} });
      mlServiceClient.getExplanation.mockRejectedValue(new Error('chat model unavailable'));
      await scanUrl({ url: TARGET });
      const descriptions = appwriteService.createAlert.mock.calls.map(([alert]) => alert.description);
      expect(descriptions.length).toBeGreaterThan(0);
      for (const description of descriptions) expect(description).not.toMatch(/No explanation|still being written/);
    });

    test('a batch that runs out of time says which URLs were not scanned', async () => {
      process.env.SCAN_BUDGET_MS = '2600';
      // A scanner that takes longer than each URL's share of the budget.
      onCreate = (req, res) => setTimeout(() => res.status(200).json(completed({ signals: [] })), 1400);
      const started = Date.now();
      const response = await api.request('/api/agent/scan-url/batch', {
        method: 'POST', headers: { Authorization: `Bearer ${signSessionToken(member)}` },
        body: { urls: ['https://a.example.test/', 'https://b.example.test/', 'https://c.example.test/', 'https://d.example.test/'], concurrency: 1 }
      });
      expect(Date.now() - started).toBeLessThan(4500);
      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(4);
      const scanned = response.body.results.filter(result => result.success);
      const skipped = response.body.results.filter(result => !result.success);
      expect(scanned.length).toBeGreaterThan(0);
      expect(skipped.length).toBeGreaterThan(0);
      // What was scanned says its page evidence is incomplete; nothing is called safe.
      for (const result of scanned) expect(result.data).toMatchObject({ scraperSuccess: false, verdict: 'unknown' });
      for (const result of skipped) expect(result.error).toMatch(/ran out of time/);
      await new Promise(resolve => setTimeout(resolve, 1600));
    }, 15000);

    test('a batch with time to spare scans every URL and does not wait for explanations it has no time for', async () => {
      process.env.SCAN_BUDGET_MS = '2600';
      onCreate = (req, res) => res.status(200).json(completed({ signals: [] }));
      mlServiceClient.getExplanation.mockImplementation(slowExplanation(5000, explanation));
      const response = await api.request('/api/agent/scan-url/batch', {
        method: 'POST', headers: { Authorization: `Bearer ${signSessionToken(member)}` },
        body: { urls: ['https://a.example.test/', 'https://b.example.test/', 'https://c.example.test/'], concurrency: 1 }
      });
      expect(response.body.results.map(result => result.success)).toEqual([true, true, true]);
      for (const result of response.body.results) {
        expect(result.data).toMatchObject({ verdict: 'safe', scraperSuccess: true });
        expect(['pending', 'unavailable']).toContain(result.data.explanationStatus);
      }
    });
  });

  test('the batch route reports the same gap per URL', async () => {
    onCreate = (req, res) => (req.body.url.includes('down')
      ? res.status(503).json(envelopeError('CAPABILITY_UNAVAILABLE', 'The browser is not running'))
      : res.status(200).json(completed({ signals: [] })));
    const response = await api.request('/api/agent/scan-url/batch', {
      method: 'POST', headers: { Authorization: `Bearer ${signSessionToken(member)}` },
      body: { urls: ['https://up.example.test/', 'https://down.example.test/'], concurrency: 1 }
    });
    expect(response.status).toBe(200);
    const [up, down] = response.body.results;
    expect(up.data).toMatchObject({ verdict: 'safe', scraperSuccess: true, evidenceStatus: 'complete' });
    expect(down).toMatchObject({ success: true, data: { verdict: 'unknown', scraperSuccess: false, evidenceStatus: 'unavailable', riskLevel: 'unknown' } });
    expect(down.data.coverageGaps).toHaveLength(1);
  });
});
