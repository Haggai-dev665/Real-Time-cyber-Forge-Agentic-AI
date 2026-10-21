/**
 * What the ML service can do right now (V2-ML02), as it reports itself at
 * /api/v2/capabilities (schema cyberforge.ml.capabilities.v1).
 *
 * The backend passes the report on, checked and trimmed, so clients (the
 * desktop, the CLI, the MCP server) learn each capability's kind, readiness
 * and limits from one place, without the ML service key. When the service
 * does not answer, or answers with something else, the report says it is
 * unavailable and why; readiness is never assumed.
 */
const axios = require('axios');
const { getMLServiceUrl } = require('../config/ml.config');

const SCHEMA = 'cyberforge.ml.capabilities.v1';
const KINDS = new Set(['trained_model', 'transformer', 'heuristic', 'reference_list', 'language_model']);
const READINESS = new Set(['ready', 'loading', 'not_loaded', 'failed', 'unavailable']);

const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : null);
const number = value => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const strings = (list, max, count) => (Array.isArray(list) ? list.filter(v => typeof v === 'string').slice(0, count).map(v => v.slice(0, max)) : []);

function limitsOf(limits) {
  if (!limits || typeof limits !== 'object' || Array.isArray(limits)) return {};
  return Object.fromEntries(Object.entries(limits).slice(0, 12).filter(([, v]) => number(v) !== null).map(([k, v]) => [k.slice(0, 40), v]));
}

function capabilityOf(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id, 60);
  if (!id) return null;
  return {
    id,
    kind: KINDS.has(entry.kind) ? entry.kind : 'unknown',
    readiness: READINESS.has(entry.readiness) ? entry.readiness : 'unknown',
    reason: text(entry.reason, 300),
    model: text(entry.model, 200),
    trainedAt: text(entry.trained_at, 40),
    featureCount: number(entry.feature_count),
    decisionThreshold: number(entry.decision_threshold),
    answersWithoutModel: text(entry.answers_without_model, 40),
    resultKind: text(entry.result_kind, 40),
    routes: strings(entry.routes, 80, 16),
    limits: limitsOf(entry.limits)
  };
}

/** The report, or `{ available: false, reason }`. */
async function fetchReport({ timeoutMs = 10000 } = {}) {
  let response;
  try {
    response = await axios.get(`${getMLServiceUrl()}/api/v2/capabilities`, { timeout: timeoutMs, validateStatus: () => true });
  } catch (_) {
    return { available: false, reason: 'The ML service did not answer.' };
  }
  const body = response.data;
  if (response.status === 404) return { available: false, reason: 'The ML service does not report its capabilities (an older version is deployed).' };
  if (response.status === 401) return { available: false, reason: 'The ML service refused the backend\'s service key.' };
  if (response.status === 503 && body && body.code === 'SERVICE_KEY_NOT_CONFIGURED') return { available: false, reason: 'The ML service has no service key configured.' };
  if (response.status !== 200 || !body || body.schema !== SCHEMA || !Array.isArray(body.capabilities)) {
    return { available: false, reason: `The ML service answered HTTP ${response.status} without a ${SCHEMA} report.` };
  }
  const training = body.training && typeof body.training === 'object' ? body.training : {};
  return {
    available: true,
    schema: SCHEMA,
    serviceVersion: text(body.service_version, 40),
    operational: body.operational && typeof body.operational === 'object' ? {
      scope: 'service process since startup',
      activeRequests: number(body.operational.active_requests),
      completedRequests: number(body.operational.completed_requests),
      failedRequests: number(body.operational.failed_requests),
      meanRequestMs: number(body.operational.mean_request_ms),
      uptimeSeconds: number(body.operational.uptime_seconds)
    } : null,
    generatedAt: text(body.generated_at, 40),
    capabilities: body.capabilities.slice(0, 40).map(capabilityOf).filter(Boolean),
    limits: limitsOf(body.limits),
    notOffered: (Array.isArray(body.not_offered) ? body.not_offered : []).slice(0, 12)
      .map(item => ({ what: text(item && item.what, 80), note: text(item && item.note, 300) }))
      .filter(item => item.what),
    training: {
      who: text(training.who, 120),
      separateFromInference: training.separate_from_inference === true,
      note: text(training.note, 300)
    }
  };
}

module.exports = { fetchReport, SCHEMA };
