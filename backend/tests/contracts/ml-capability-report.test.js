// V2-ML02: the ML service describes what it can do, versioned and honestly,
// and the backend passes that on without assuming readiness.
jest.mock('../../src/middleware/verifiedUser', () => ({
  verifiedUser: (req, res, next) => {
    if (req.headers.authorization !== 'Bearer test') return res.status(401).json({ success: false, message: 'Access denied.' });
    req.user = { userId: 'user-1', role: 'user' };
    next();
  }
}));

const fs = require('fs');
const path = require('path');
const express = require('express');
const { serve } = require('../helpers/http');

const APP = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'ml-services', 'hf_space_deploy', 'app.py'), 'utf8');

describe('the ML service', () => {
  test('serves no dataset route that claims work it does not do', () => {
    expect(APP).not.toMatch(/@api\.post\("\/api\/datasets\/process"\)/);
    expect(APP).not.toMatch(/"status": "processed"/);
  });

  test('labels every reasoning-text answer, and says a task was not carried out', () => {
    const handler = route => {
      const start = APP.indexOf(`("${route}")`);
      expect({ route, found: start >= 0 }).toEqual({ route, found: true });
      return APP.slice(start).split(/\n@api\./)[0];
    };
    for (const route of ['/analyze', '/scan-threats', '/api/analysis/network', '/api/browser/analyze', '/api/threat-feeds/analyze']) {
      expect({ route, labelled: /return as_reasoning_text\(result\)/.test(handler(route)) }).toEqual({ route, labelled: true });
    }
    expect(handler('/api/ai/execute-task')).toContain('return as_reasoning_text(result, executed=False)');
    expect(handler('/api/insights/generate')).toMatch(/"result_kind": labelled\["result_kind"\]/);
    expect(APP).toMatch(/out\["result_kind"\] = "reasoning_text"/);
  });

  test('reports its capabilities under a versioned schema, behind the service key', () => {
    expect(APP).toContain('CAPABILITIES_SCHEMA = "cyberforge.ml.capabilities.v1"');
    expect(APP).toMatch(/@api\.get\("\/api\/v2\/capabilities"\)\nasync def api_v2_capabilities\(\):\n[^\n]*\n\s+return capability_report\(\)/);
    expect(APP).toMatch(/^PUBLIC_PATHS = \{"\/", "\/health"\}$/m);
    // The same version the health check states.
    const version = APP.match(/^SERVICE_VERSION = "([^"]+)"$/m)[1];
    expect(APP).toContain(`"version": "${version}"`);
    for (const kind of ['"trained_model"', '"transformer"', '"heuristic"', '"reference_list"', '"language_model"']) expect(APP).toContain(`"kind": ${kind}`);
    expect(APP).toMatch(/"separate_from_inference": False/);
  });
});

describe('GET /api/v1/ml/capabilities', () => {
  let ml;
  let answer;
  let api;

  beforeAll(async () => {
    const service = express();
    service.get('/api/v2/capabilities', (req, res) => answer(req, res));
    ml = await serve(service);
    process.env.ML_SERVICE_URL = ml.url;
    const app = express();
    app.use('/api/v1', require('../../src/routes/mlCapabilitiesV1'));
    api = await serve(app);
  });

  afterAll(async () => {
    delete process.env.ML_SERVICE_URL;
    await api.close();
    await ml.close();
  });

  const get = (headers = { Authorization: 'Bearer test' }) => api.request('/api/v1/ml/capabilities', { headers });

  test('needs a signed-in user', async () => {
    answer = (req, res) => res.json({});
    expect((await get({})).status).toBe(401);
  });

  test('passes the report on, checked: unknown kinds and readiness are marked unknown, text is trimmed', async () => {
    answer = (req, res) => res.json({
      schema: 'cyberforge.ml.capabilities.v1',
      service_version: '2.0.0',
      operational: { active_requests: 2, completed_requests: 9, failed_requests: 'unknown', mean_request_ms: 120.5, uptime_seconds: 100, secret: 'omit' },
      generated_at: '2026-10-17T00:00:00Z',
      capabilities: [
        { id: 'phishing_detection', kind: 'trained_model', readiness: 'ready', trained_at: '2026-10-13T00:00:00Z', feature_count: 39, decision_threshold: 0.71, routes: ['/analyze-url', 7] },
        { id: 'reasoning_llm', kind: 'language_model', readiness: 'loading', limits: { max_input_chars: 2400, bogus: 'x' } },
        { id: 'mystery', kind: 'oracle', readiness: 'perfect', reason: 'r'.repeat(1000) },
        { kind: 'trained_model' }
      ],
      limits: { max_body_bytes: 262144, batch_max_urls: 20 },
      not_offered: [{ what: 'network intrusion detection', note: 'reasoning text only' }],
      training: { who: 'the Space owner only', separate_from_inference: false, note: 'same process', routes: ['/api/admin/train'] }
    });
    const res = await get();
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toMatchObject({ available: true, schema: 'cyberforge.ml.capabilities.v1', serviceVersion: '2.0.0', source: 'ml_service' });
    expect(data.capabilities.map(c => c.id)).toEqual(['phishing_detection', 'reasoning_llm', 'mystery']);
    expect(data.capabilities[0]).toMatchObject({ kind: 'trained_model', readiness: 'ready', featureCount: 39, decisionThreshold: 0.71, routes: ['/analyze-url'] });
    expect(data.capabilities[1]).toMatchObject({ readiness: 'loading', limits: { max_input_chars: 2400 } });
    expect(data.capabilities[2]).toMatchObject({ kind: 'unknown', readiness: 'unknown' });
    expect(data.capabilities[2].reason).toHaveLength(300);
    expect(data.operational).toEqual({scope:'service process since startup',activeRequests:2,completedRequests:9,failedRequests:null,meanRequestMs:120.5,uptimeSeconds:100});
    expect(data.notOffered).toEqual([{ what: 'network intrusion detection', note: 'reasoning text only' }]);
    expect(data.training).toEqual({ who: 'the Space owner only', separateFromInference: false, note: 'same process' });
  });

  test.each([
    [(req, res) => res.status(404).json({ detail: 'Not Found' }), 'older version'],
    [(req, res) => res.status(401).json({ code: 'SERVICE_KEY_REQUIRED' }), 'refused the backend\'s service key'],
    [(req, res) => res.status(503).json({ code: 'SERVICE_KEY_NOT_CONFIGURED' }), 'no service key configured'],
    [(req, res) => res.json({ schema: 'something.else', capabilities: [] }), 'without a cyberforge.ml.capabilities.v1 report']
  ])('says why when the report is not available (%#)', async (handler, reason) => {
    answer = handler;
    const res = await get();
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ML_UNAVAILABLE');
    expect(res.body.message).toContain(reason);
    expect(res.body.data).toMatchObject({ available: false });
  });

  test('an ML service that does not answer is unavailable, not assumed ready', async () => {
    const saved = process.env.ML_SERVICE_URL;
    process.env.ML_SERVICE_URL = 'http://127.0.0.1:9';
    try {
      const res = await get();
      expect(res.status).toBe(503);
      expect(res.body.message).toBe('The ML service did not answer.');
    } finally {
      process.env.ML_SERVICE_URL = saved;
    }
  });
});

describe('the ML service analysis record (cyberforge.ml.analysis.v1)', () => {
  const { spawnSync } = require('child_process');
  const python = ['python', 'python3'].find(c => spawnSync(c, ['--version']).status === 0);
  const run = () => {
    const result = spawnSync(python, ['-I', path.join(__dirname, '..', 'helpers', 'ml_analysis_harness.py'), path.join(__dirname, '..', '..', '..', 'ml-services', 'hf_space_deploy', 'app.py')], { encoding: 'utf8', timeout: 20000 });
    expect(result.stderr).toBe('');
    return JSON.parse(result.stdout);
  };

  test('/analyze-url carries the record beside its older fields', () => {
    expect(APP).toMatch(/"analysis": analysis_record\(url, predictions, started\),/);
    expect(APP).toContain('ANALYSIS_SCHEMA = "cyberforge.ml.analysis.v1"');
  });

  (python ? test : test.skip)('the verdict policy: trained models decide, rule-based estimates alone are unknown, scores are not probabilities', () => {
    const r = run();
    expect(r.all_trained_benign).toMatchObject({ schema: 'cyberforge.ml.analysis.v1', verdict: 'benign', policy: 'trained_models_v1', coverage: { trained_models_answered: 2, heuristic_estimates: 0 } });
    // the reputation list's state is true or false, and its size a number (the loader returns a count)
    expect(r.all_trained_benign.coverage).toMatchObject({ reputation_list_loaded: true, reputation_list_size: 300000 });
    expect(r.one_trained_flags).toMatchObject({ verdict: 'threat', verdict_reason: 'flagged by phishing_detection' });
    expect(r.heuristic_only).toMatchObject({ verdict: 'unknown', coverage: { trained_models_answered: 0, heuristic_estimates: 2 } });
    expect(r.heuristic_only.warnings.join(' ')).toMatch(/rule-based estimate.*features were missing[\s\S]*popularity list is not loaded/);
    expect(r.heuristic_flag_trained_benign.verdict).toBe('benign');
    expect(r.heuristic_flag_trained_benign.warnings[0]).toMatch(/^web_attack_detection: rule-based estimate/);
    expect(r.an_error).toMatchObject({ verdict: 'unknown' });
    expect(r.an_error.detectors[0].verdict).toBe('unknown');
    for (const record of Object.values(r)) {
      expect(record.analysis_id).toMatch(/^[0-9a-f]{32}$/);
      expect(record.warnings).toContain('scores are model outputs rescaled at each decision threshold, not calibrated probabilities');
      for (const detector of record.detectors) expect(detector.calibrated_probability).toBeNull();
    }
    // a trained model's record names its training and threshold; an estimate does not pretend to
    expect(r.one_trained_flags.detectors[0]).toMatchObject({ engine: 'trained_model', trained_at: '2026-10-13T00:00:00Z', decision_threshold: 0.71, feature_set: 'lexical_v2' });
    expect(r.heuristic_only.detectors[0]).toMatchObject({ engine: 'heuristic', trained_at: null, decision_threshold: null, missing_features: ['x'] });
  });
});

describe('POST /api/v1/ml/analyze-url', () => {
  let ml;
  let answer;
  let received;
  let api;
  const record = (overrides = {}) => ({
    url: 'x',
    aggregate: {},
    analysis: {
      schema: 'cyberforge.ml.analysis.v1', analysis_id: 'a'.repeat(32), task: 'url', target: received, verdict: 'threat',
      verdict_reason: 'flagged by phishing_detection', policy: 'trained_models_v1',
      coverage: { detectors: 2, trained_models_answered: 1, heuristic_estimates: 1, reputation_list_loaded: true },
      detectors: [
        { id: 'phishing_detection', engine: 'trained_model', verdict: 'threat', raw_score: 0.91, calibrated_probability: null, trained_at: '2026-10-13', decision_threshold: 0.71 },
        { id: 'web_attack_detection', engine: 'guess', verdict: 'maybe', raw_score: 'high', missing_features: ['a', 3] },
        { verdict: 'threat' }
      ],
      service_version: '2.0.0', duration_ms: 12.5, warnings: ['scores are not calibrated probabilities'],
      ...overrides
    }
  });

  beforeAll(async () => {
    const service = express();
    service.use(express.json());
    service.post('/analyze-url', (req, res) => { received = req.body.url; answer(req, res); });
    ml = await serve(service);
    process.env.ML_SERVICE_URL = ml.url;
    const app = express();
    app.use(express.json());
    app.use('/api/v1', require('../../src/routes/mlCapabilitiesV1'));
    api = await serve(app);
  });

  afterAll(async () => {
    delete process.env.ML_SERVICE_URL;
    await api.close();
    await ml.close();
  });

  beforeEach(() => { received = undefined; require('../../src/routes/mlCapabilitiesV1').analysisLimiter.resetKey('account:user-1'); });

  const post = (body, headers = { Authorization: 'Bearer test' }) => api.request('/api/v1/ml/analyze-url', { method: 'POST', headers, body });

  test('needs a signed-in user', async () => {
    answer = (req, res) => res.json(record());
    expect((await post({ url: 'https://example.com/' }, {})).status).toBe(401);
    expect(received).toBeUndefined();
  });

  test('redacts the address before sending it, and passes the record on checked', async () => {
    answer = (req, res) => res.json(record());
    const res = await post({ url: 'https://example.com/login?next=/home&token=s3cr3t-value' });
    expect(res.status).toBe(200);
    expect(received).toBe('https://example.com/login?next=/home&token=[redacted]');
    const data = res.body.data;
    expect(data).toMatchObject({ schema: 'cyberforge.ml.analysis.v1', verdict: 'threat', targetRedacted: true, target: received, policy: 'trained_models_v1' });
    expect(data.coverage).toEqual({ detectors: 2, trainedModelsAnswered: 1, heuristicEstimates: 1, reputationListLoaded: true, reputationListSize: null });
    expect(data.detectors).toHaveLength(2);
    expect(data.detectors[0]).toMatchObject({ id: 'phishing_detection', engine: 'trained_model', rawScore: 0.91, calibratedProbability: null, decisionThreshold: 0.71 });
    expect(data.detectors[1]).toMatchObject({ engine: 'unknown', verdict: 'unknown', rawScore: null, missingFeatures: ['a'] });
  });

  test('a reputation list reported as a count (the Space before the fix) still reads as loaded', async () => {
    answer = (req, res) => res.json(record({ coverage: { detectors: 4, trained_models_answered: 4, heuristic_estimates: 0, reputation_list_loaded: 300000 } }));
    expect((await post({ url: 'https://example.com/' })).body.data.coverage).toMatchObject({ reputationListLoaded: true, reputationListSize: 300000 });
    answer = (req, res) => res.json(record({ coverage: { reputation_list_loaded: 0 } }));
    expect((await post({ url: 'https://example.com/' })).body.data.coverage).toMatchObject({ reputationListLoaded: false, reputationListSize: 0 });
  });

  test('an unrecognised overall verdict is unknown, never a guess', async () => {
    answer = (req, res) => res.json(record({ verdict: 'probably fine' }));
    expect((await post({ url: 'https://example.com/' })).body.data.verdict).toBe('unknown');
  });

  test.each([undefined, '', 'example.com', 'ftp://example.com/', 'javascript:alert(1)', `https://example.com/${'a'.repeat(2100)}`])('refuses %p without calling the ML service', async url => {
    answer = (req, res) => res.json(record());
    const res = await post({ url });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('URL_INVALID');
    expect(received).toBeUndefined();
  });

  test('an older ML service without versioned results is reported, not translated', async () => {
    answer = (req, res) => res.json({ url: 'x', aggregate: { risk_score: 12 } });
    const res = await post({ url: 'https://example.com/' });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ML_RESULT_UNVERSIONED');
  });

  test('an ML service that refuses or does not answer is unavailable', async () => {
    answer = (req, res) => res.status(401).json({ code: 'SERVICE_KEY_REQUIRED' });
    expect((await post({ url: 'https://example.com/' })).body.code).toBe('ML_UNAVAILABLE');
    const saved = process.env.ML_SERVICE_URL;
    process.env.ML_SERVICE_URL = 'http://127.0.0.1:9';
    try {
      const res = await post({ url: 'https://example.com/' });
      expect(res.status).toBe(503);
      expect(res.body.message).toBe('The ML service did not answer.');
    } finally {
      process.env.ML_SERVICE_URL = saved;
    }
  });
});


test('HF request measurements handle failure and exclude status polling and training',()=>{
 const {spawnSync}=require('child_process');
 const result=spawnSync('python',['-I',path.join(__dirname,'../helpers/ml_operations_harness.py'),path.join(__dirname,'../../../ml-services/hf_space_deploy/app.py')],{encoding:'utf8',timeout:20000});
 expect(result.stderr).toBe('');expect(result.status).toBe(0);
 expect(result.stdout).toContain('ML operational counters passed');
});
