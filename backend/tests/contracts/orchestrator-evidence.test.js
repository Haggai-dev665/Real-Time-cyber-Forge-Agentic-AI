// The orchestrator's report must rest on what the rendered-page scan observed,
// and must say when it observed nothing. A scanner that is down is a gap in
// coverage; it is never a reason to call a page clean (SEC-06).
jest.mock('../../src/services/cyberforgeMLService', () => ({
  cyberforgeML: { classifyUrlPhishing: jest.fn(), detectDga: jest.fn() }
}));
jest.mock('../../src/services/memoryService', () => ({
  memoryService: {
    getDomainMemory: jest.fn(async () => null),
    sessionStats: jest.fn(() => ({})),
    findSimilarVisits: jest.fn(async () => []),
    domainHistoryMultiplier: jest.fn(() => 1),
    recordDomainVisit: jest.fn(async () => {}),
    recordUrlInSession: jest.fn(),
    storeVisitVector: jest.fn(async () => {})
  }
}));
jest.mock('../../src/services/llmFallbackChain', () => ({ llmFallbackChain: { explainThreat: jest.fn(async () => ({ text: 'summary', source: 'test' })) } }));
jest.mock('../../src/services/appwriteService', () => ({ appwriteService: { createAlert: jest.fn(async () => ({})) } }));
jest.mock('../../src/services/otx', () => ({ getIndicatorDetails: jest.fn(async () => ({ pulse_info: { count: 0 } })) }));

const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

const express = require('express');
const { serve } = require('../helpers/http');
const recorded = require('./fixtures/scraper-v1-scan.json');

const clone = value => JSON.parse(JSON.stringify(value));
const TARGET = 'https://login.example.test/account';

let provider;
let respond;
let orchestrator;
let cyberforgeML;
let llmFallbackChain;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.post('/api/v1/scans', (req, res) => respond(req, res));
  provider = await serve(app);

  process.env.WEBSCRAPER_API_URL = provider.url;
  process.env.WEBSCRAPER_API_KEY = 'sk-contract-test-key-0000000000000000';
  jest.isolateModules(() => {
    orchestrator = new (require('../../src/services/agentOrchestrator').AgentOrchestrator)();
    ({ cyberforgeML } = require('../../src/services/cyberforgeMLService'));
    ({ llmFallbackChain } = require('../../src/services/llmFallbackChain'));
  });
});
afterAll(async () => {
  delete process.env.WEBSCRAPER_API_URL;
  delete process.env.WEBSCRAPER_API_KEY;
  warn.mockRestore();
  await provider.close();
});
beforeEach(() => {
  respond = (req, res) => res.status(200).json(clone(recorded));
  // The URL models find nothing wrong with the address itself.
  cyberforgeML.classifyUrlPhishing.mockResolvedValue({ is_threat: false, confidence: 90, threat_score: 0.05, prediction: 'benign', inference_source: 'test' });
  cyberforgeML.detectDga.mockResolvedValue({ is_threat: false, confidence: 90, threat_score: 0.02, features: {} });
  llmFallbackChain.explainThreat.mockResolvedValue({ text: 'summary', source: 'test' });
});

test('a phishing page is reported from the scan’s evidence, although its URL looks benign', async () => {
  const report = await orchestrator.analyze({ url: TARGET, sessionId: null, userId: null });

  expect(report.evidenceStatus).toBe('complete');
  expect(report.coverage).toMatchObject({ rendered_page: 'complete', reason: null, agents_failed: [] });
  expect(['suspicious', 'malicious']).toContain(report.verdict);
  expect(report.riskScore).toBeGreaterThanOrEqual(35);
  expect(report.signals.map(signal => signal.id)).toEqual(expect.arrayContaining(['credential_form_cross_origin', 'brand_domain_mismatch']));
  // Findings are the scanner's own observations.
  expect(report.findings).toEqual(expect.arrayContaining([
    'A form collecting credentials submits to a different site',
    'Password input on non-HTTPS page',
    'Credential form submits to a different site'
  ]));
  expect(report.scraperSummary).toMatchObject({ scanId: recorded.data.scan_id, isHttps: false, evidenceScore: 100 });

  // The behavioural agent reads structured forms, not strings in HTML.
  expect(report.agents.behavioral.result).toMatchObject({ forms: 1, passwordFields: 1, credentialForms: 1, cookies: 2 });
  // Indicators found by the scan reach the IOC list, labelled with where they
  // were seen: the form's target is in the page (the scanner never submits it),
  // the hidden frame's host was actually requested.
  expect(report.iocs).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'domain', value: 'collector.evil.test', source: 'page-scan:page' }),
    expect.objectContaining({ type: 'domain', value: 'tracker.evil.test', source: 'page-scan:request' })
  ]));
  // The explanation is asked about those findings, not about nothing.
  expect(llmFallbackChain.explainThreat.mock.calls[0][0].findings.length).toBeGreaterThan(3);
});

test('a page with nothing to report is "clean" only because it was observed', async () => {
  respond = (req, res) => {
    const scan = clone(recorded);
    scan.data.signals = [];
    scan.data.result.forms = [];
    scan.data.result.page.final_url = 'https://login.example.test/account';
    res.status(200).json(scan);
  };
  const report = await orchestrator.analyze({ url: TARGET, sessionId: null, userId: null });
  expect(report).toMatchObject({ verdict: 'clean', evidenceStatus: 'complete' });
  expect(report.riskScore).toBeLessThan(15);
});

test.each([
  ['is unavailable', (req, res) => res.status(503).json({ success: false, data: null, error: { code: 'CAPABILITY_UNAVAILABLE', message: 'The browser is not running' } }), 'CAPABILITY_UNAVAILABLE'],
  ['answers in a format this backend does not know', (req, res) => res.status(200).json({ success: true, title: 'Welcome', security_report: { is_https: true } }), 'SCRAPER_CONTRACT_MISMATCH']
])('when the scanner %s, the verdict is unknown and the report says what is missing', async (label, handler, code) => {
  respond = handler;
  const report = await orchestrator.analyze({ url: TARGET, sessionId: null, userId: null });

  expect(report.verdict).toBe('unknown');
  expect(report.evidenceStatus).toBe('unavailable');
  expect(report.coverage.rendered_page).toBe('unavailable');
  expect(report.coverage.reason).toContain(code);
  expect(report.coverage.agents_failed).toEqual(expect.arrayContaining(['web_scraper', 'behavioral']));
  expect(report.agentSummary.web_scraper.status).toBe('failed');
  expect(report.scraperSummary).toBeNull();
  expect(report.signals).toEqual([]);
  expect(report.findings.some(finding => finding.startsWith('Page evidence unavailable'))).toBe(true);
  expect(JSON.stringify(report.verdict)).not.toMatch(/clean/);
});

test('a page that could not be loaded is also unknown, with the reason', async () => {
  respond = (req, res) => {
    const scan = clone(recorded);
    scan.data.result.page = { ...scan.data.result.page, loaded: false, final_url: null, status: null, load_error: 'the host name did not resolve' };
    scan.data.signals = [{ id: 'page_not_loaded', severity: 'medium', title: 'The page could not be loaded, so page evidence is missing', evidence: {} }];
    scan.data.coverage = { navigation: { status: 'failed', reason: 'the host name did not resolve' } };
    scan.data.result.forms = [];
    scan.data.result.security_headers = null;
    res.status(200).json(scan);
  };
  const report = await orchestrator.analyze({ url: TARGET, sessionId: null, userId: null });
  expect(report).toMatchObject({ verdict: 'unknown', evidenceStatus: 'unavailable' });
  expect(report.coverage.reason).toBe('the host name did not resolve');
  expect(report.scraperSummary.isHttps).toBeUndefined();
});

test('strong evidence from the URL models still decides when the page was not observed', async () => {
  respond = (req, res) => res.status(503).json({ success: false, data: null, error: { code: 'CAPABILITY_UNAVAILABLE', message: 'x' } });
  cyberforgeML.classifyUrlPhishing.mockResolvedValue({ is_threat: true, confidence: 97, threat_score: 0.97, prediction: 'phishing', inference_source: 'test' });
  cyberforgeML.detectDga.mockResolvedValue({ is_threat: true, confidence: 90, threat_score: 0.9, features: {} });
  const report = await orchestrator.analyze({ url: TARGET, sessionId: null, userId: null });
  expect(report.verdict).toBe('suspicious');
  expect(report.evidenceStatus).toBe('unavailable');
});
