/**
 * One URL analysed by the ML service, as a versioned record (V2-ML02,
 * schema cyberforge.ml.analysis.v1).
 *
 * The address is redacted before it leaves the backend (utils/redactUrl). The
 * service's record is checked and trimmed: a verdict it does not recognise is
 * "unknown", a score is a raw score, and a probability is passed on only if
 * the service gives one (none is calibrated yet). When the service is older or
 * does not answer, the result says so; nothing is invented in its place.
 */
const axios = require('axios');
const { getMLServiceUrl } = require('../config/ml.config');
const { redactUrl } = require('../utils/redactUrl');

const SCHEMA = 'cyberforge.ml.analysis.v1';
const VERDICTS = new Set(['threat', 'benign', 'unknown']);
const ENGINES = new Set(['trained_model', 'heuristic']);
const MAX_URL = 2048;

class AnalysisError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : null);
const number = value => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const strings = (list, max, count) => (Array.isArray(list) ? list.filter(v => typeof v === 'string').slice(0, count).map(v => v.slice(0, max)) : []);

/** The address to analyse: http(s), at most 2,048 characters, redacted. */
function targetOf(input) {
  const raw = typeof input === 'string' ? input.trim() : '';
  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    throw new AnalysisError(400, 'URL_INVALID', 'Give a full http:// or https:// address.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || raw.length > MAX_URL) {
    throw new AnalysisError(400, 'URL_INVALID', `Give an http:// or https:// address of at most ${MAX_URL} characters.`);
  }
  const redacted = redactUrl(raw);
  return { target: redacted, redacted: redacted !== raw };
}

function detectorOf(entry) {
  if (!entry || typeof entry !== 'object' || !text(entry.id, 60)) return null;
  return {
    id: text(entry.id, 60),
    engine: ENGINES.has(entry.engine) ? entry.engine : 'unknown',
    verdict: VERDICTS.has(entry.verdict) ? entry.verdict : 'unknown',
    rawScore: number(entry.raw_score),
    calibratedProbability: number(entry.calibrated_probability),
    trainedAt: text(entry.trained_at, 40),
    decisionThreshold: number(entry.decision_threshold),
    featureSet: text(entry.feature_set, 60),
    missingFeatures: strings(entry.missing_features, 60, 60)
  };
}

function recordOf(analysis, redacted) {
  const coverage = analysis.coverage && typeof analysis.coverage === 'object' ? analysis.coverage : {};
  return {
    schema: SCHEMA,
    analysisId: text(analysis.analysis_id, 64),
    task: text(analysis.task, 20),
    target: text(analysis.target, MAX_URL + 200),
    targetRedacted: redacted,
    verdict: VERDICTS.has(analysis.verdict) ? analysis.verdict : 'unknown',
    verdictReason: text(analysis.verdict_reason, 300),
    policy: text(analysis.policy, 60),
    coverage: {
      detectors: number(coverage.detectors),
      trainedModelsAnswered: number(coverage.trained_models_answered),
      heuristicEstimates: number(coverage.heuristic_estimates),
      // A count from ML service versions before the flag became true/false.
      reputationListLoaded: coverage.reputation_list_loaded === true || (number(coverage.reputation_list_loaded) || 0) > 0,
      reputationListSize: number(coverage.reputation_list_size) ?? (typeof coverage.reputation_list_loaded === 'number' ? coverage.reputation_list_loaded : null)
    },
    detectors: (Array.isArray(analysis.detectors) ? analysis.detectors : []).slice(0, 20).map(detectorOf).filter(Boolean),
    serviceVersion: text(analysis.service_version, 40),
    durationMs: number(analysis.duration_ms),
    warnings: strings(analysis.warnings, 300, 20)
  };
}

/** Analyse one URL. Throws AnalysisError with a status, code and reason. */
async function analyzeUrl(input, { timeoutMs = 60000 } = {}) {
  const { target, redacted } = targetOf(input);
  let response;
  try {
    response = await axios.post(`${getMLServiceUrl()}/analyze-url`, { url: target }, { timeout: timeoutMs, validateStatus: () => true });
  } catch (_) {
    throw new AnalysisError(503, 'ML_UNAVAILABLE', 'The ML service did not answer.');
  }
  const body = response.data;
  if (response.status === 401 || response.status === 503) {
    throw new AnalysisError(503, 'ML_UNAVAILABLE', 'The ML service refused the request (service key).');
  }
  if (response.status === 413 || response.status === 400) {
    throw new AnalysisError(400, 'URL_INVALID', 'The ML service refused the address.');
  }
  if (response.status !== 200 || !body || typeof body !== 'object') {
    throw new AnalysisError(503, 'ML_UNAVAILABLE', `The ML service answered HTTP ${response.status}.`);
  }
  if (!body.analysis || body.analysis.schema !== SCHEMA) {
    throw new AnalysisError(503, 'ML_RESULT_UNVERSIONED', `The ML service answered without a ${SCHEMA} record (an older version is deployed).`);
  }
  return recordOf(body.analysis, redacted);
}

module.exports = { analyzeUrl, AnalysisError, SCHEMA, targetOf };
