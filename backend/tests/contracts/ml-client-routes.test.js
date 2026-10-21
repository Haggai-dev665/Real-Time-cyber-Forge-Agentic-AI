// The backend's model client (services/cyberforgeMLService.js) calls only routes
// the ML service has, and a model that does not answer is reported as
// unavailable, never replaced by a local guess under the model's name (F27).
//
// This client was outside the ML contract test, which is how it went on
// posting to `/predict`, a route the service does not have: every call failed,
// and a rule of thumb answered for every model.
jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { isMLRouteSupported } = require('../../src/services/mlCapabilities');
const { cyberforgeML } = require('../../src/services/cyberforgeMLService');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'services', 'cyberforgeMLService.js'), 'utf8');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('every route the client calls exists on the ML service', () => {
  const direct = [...source.matchAll(/axios\.(get|post)\(`\$\{this\.hfSpaceUrl\}([^`$]*)`/g)].map(m => [m[1].toUpperCase(), m[2]]);
  const transformer = [...source.matchAll(/_callTransformerEndpoint\(\s*'([^']+)'/g)].map(m => ['POST', m[1]]);
  const calls = [...direct, ...transformer];
  expect(calls.length).toBeGreaterThan(5);
  expect(calls.filter(([method, route]) => !isMLRouteSupported(method, route))).toEqual([]);
  expect(source).not.toMatch(/hfSpaceUrl\}\/predict`/);
});

test('a prediction asks the service\'s model, sending the URL so it computes the features itself', async () => {
  axios.post.mockResolvedValue({ data: { model: 'phishing_detection', prediction: 1, prediction_label: 'threat', confidence: 0.91, threat_score: 0.91, inference_source: 'ml_model' } });
  const result = await cyberforgeML.predict('phishing_detection', { url_length: 40 }, false, 'http://198.51.100.7/login');
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/\/api\/models\/predict$/), { model_type: 'phishing_detection', url: 'http://198.51.100.7/login' }, expect.any(Object));
  expect(result).toMatchObject({ model: 'phishing_detection', available: true, is_threat: true, threat_score: 0.91, risk_level: 'critical', inference_source: 'ml_model' });
});

test('without a URL the features are sent by name, and the service\'s own label for its answer is kept', async () => {
  axios.post.mockResolvedValue({ data: { prediction: 0, threat_score: 0.12, inference_source: 'heuristic', missing_features: ['tld_length'] } });
  const result = await cyberforgeML.predict('malware_detection', { html_size: 10 });
  expect(axios.post.mock.calls[0][1]).toEqual({ model_type: 'malware_detection', input_data: { html_size: 10 } });
  expect(result).toMatchObject({ available: true, is_threat: false, inference_source: 'heuristic', missing_features: ['tld_length'] });
});

test.each([
  ['the request fails', () => axios.post.mockRejectedValue(new Error('Request failed with status code 503'))],
  ['the answer has no score', () => axios.post.mockResolvedValue({ data: { model: 'x' } })]
])('when %s the model is unavailable: no score, no local guess', async (label, arrange) => {
  arrange();
  const result = await cyberforgeML.predict('phishing_detection', {}, false, 'https://example.org/');
  expect(result).toMatchObject({ available: false, threat_score: null, risk_level: 'unknown', inference_source: 'unavailable', is_threat: false });
  expect(result.inference_source).not.toBe('local-heuristic');
});

test('a URL analysis with no model answering has no verdict, rather than a clean one', async () => {
  axios.post.mockRejectedValue(new Error('connect ECONNREFUSED'));
  const report = await cyberforgeML.analyzeUrl('http://198.51.100.7/login');
  expect(report.aggregate).toMatchObject({ overall_risk_level: 'unknown', recommended_action: 'unknown', blended_threat_score: null, models_answered: 0 });
  const { sandboxAnalysisService } = require('../../src/services/sandboxAnalysisService');
  expect(sandboxAnalysisService._verdict(report.aggregate)).toBe('unknown');
});

test('only the models that answered are counted in the verdict', async () => {
  axios.post.mockImplementation(async (url, body) => {
    if (body.model_type === 'phishing_detection') return { data: { prediction: 1, threat_score: 0.9, inference_source: 'ml_model' } };
    if (body.model_type === 'malware_detection') return { data: { prediction: 1, threat_score: 0.8, inference_source: 'ml_model' } };
    throw new Error('timeout');
  });
  const report = await cyberforgeML.analyzeUrl('http://198.51.100.7/login');
  expect(report.aggregate).toMatchObject({ models_answered: 2, model_consensus: '2/2', recommended_action: 'block' });
  expect(report.aggregate.average_threat_score).toBeCloseTo(0.85, 4);
  expect(report.model_predictions.anomaly_detection).toMatchObject({ available: false });
});
