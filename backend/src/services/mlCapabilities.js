const { getMLServiceUrl } = require('../config/ml.config');

/**
 * Routes the deployed ML service provides. This mirrors
 * ml-services/hf_space_deploy/app.py; tests/contracts/ml-capabilities.test.js
 * fails when the two drift apart.
 */
const SUPPORTED_ML_ROUTES = [
  ['GET', '/health'],
  ['GET', '/models'],
  ['POST', '/analyze'],
  ['POST', '/analyze-url'],
  ['POST', '/scan-threats'],
  ['POST', '/api/insights/generate'],
  ['POST', '/api/models/predict'],
  ['GET', '/api/models/list'],
  ['POST', '/api/analysis/network'],
  ['POST', '/api/ai/execute-task'],
  ['POST', '/api/browser/analyze'],
  ['POST', '/api/threat-feeds/analyze'],
  ['POST', '/api/v2/url-classify'],
  ['POST', '/api/v2/dga-detect'],
  ['POST', '/api/v2/security-chat'],
  ['POST', '/api/v2/chat'],
  ['GET', '/api/v2/status'],
  ['GET', '/api/v2/capabilities'],
  ['POST', '/api/v2/batch-analyze'],
  ['GET', '/api/v2/explain/:modelName'],
  ['POST', '/api/v2/ioc-scan'],
  ['POST', '/api/v2/url-enrich']
];

/**
 * Calls the backend still contains for endpoints no deployed ML service has.
 * They belong to the undeployed FastAPI service under ml-services/app and are
 * refused before any network request. Remove an entry only together with the
 * call, or after the endpoint exists and is added to SUPPORTED_ML_ROUTES.
 */
const RETIRED_ML_ROUTES = [
  ['POST', '/analyze/url'],
  ['POST', '/analyze/file'],
  ['POST', '/analyze/network'],
  ['POST', '/api/batch/process'],
  ['GET', '/api/training/datasets'],
  ['GET', '/api/training/datasets/:datasetId'],
  ['POST', '/api/training/datasets/download'],
  ['GET', '/api/training/models'],
  ['GET', '/api/training/models/:modelId'],
  ['GET', '/api/training/models/:modelId/metrics'],
  ['POST', '/api/training/train'],
  ['GET', '/api/training/status/:jobId'],
  ['GET', '/api/training/history'],
  ['POST', '/api/training/evaluate'],
  ['POST', '/api/training/predict'],
  ['POST', '/api/training/predict/batch'],
  ['POST', '/api/training/detect/malware'],
  ['POST', '/api/training/detect/phishing'],
  ['POST', '/api/training/detect/intrusion'],
  ['POST', '/api/training/detect/anomaly'],
  ['GET', '/api/threat-map'],
  ['GET', '/api/agent/learning'],
  ['GET', '/api/models'],
  ['POST', '/api/agent/task'],
  ['POST', '/api/models/train'],
  ['GET', '/api/agent/threats'],
  ['POST', '/api/scan/ai-enhanced'],
  ['GET', '/api/agent/status'],
  ['POST', '/api/recommendations']
];

const CAPABILITY_UNAVAILABLE = 'CAPABILITY_UNAVAILABLE';
const UNAVAILABLE_PREFIX = 'ML capability unavailable:';

const toPattern = route => new RegExp(`^${route.replace(/:[A-Za-z]+/g, '[^/]+')}$`);
const supported = SUPPORTED_ML_ROUTES.map(([method, route]) => ({ method, pattern: toPattern(route) }));

/** Path of an ML request relative to the configured service, without query. */
function mlPath(url) {
  let path = String(url || '');
  const base = getMLServiceUrl();
  if (path.startsWith(base)) path = path.slice(base.length);
  path = path.split(/[?#]/)[0].replace(/\/+$/, '');
  return path.startsWith('/') ? path : `/${path}`;
}

function isMLRouteSupported(method, url) {
  const verb = String(method || 'GET').toUpperCase();
  const path = mlPath(url);
  return supported.some(route => route.method === verb && route.pattern.test(path));
}

class MLCapabilityUnavailableError extends Error {
  constructor(method, url) {
    super(`${UNAVAILABLE_PREFIX} ${String(method).toUpperCase()} ${mlPath(url)} is not provided by the configured ML service.`);
    this.name = 'MLCapabilityUnavailableError';
    this.code = CAPABILITY_UNAVAILABLE;
    this.status = 501;
  }
}

/** A failure result for an unsupported call, or null when the call may proceed. */
function unavailableMLResult(method, url) {
  if (isMLRouteSupported(method, url)) return null;
  const error = new MLCapabilityUnavailableError(method, url);
  return { success: false, error: error.message, code: error.code };
}

/** Refuse unsupported requests on an axios instance before they reach the network. */
function guardMLClient(axiosInstance) {
  axiosInstance.interceptors.request.use(config => {
    if (!isMLRouteSupported(config.method, config.url)) {
      throw new MLCapabilityUnavailableError(config.method, config.url);
    }
    return config;
  });
  return axiosInstance;
}

/** True for an error, a client result, or a message produced by an unsupported call. */
function isMLCapabilityUnavailable(value) {
  if (!value) return false;
  if (typeof value === 'string') return value.startsWith(UNAVAILABLE_PREFIX);
  return value.code === CAPABILITY_UNAVAILABLE ||
    isMLCapabilityUnavailable(value.error) || isMLCapabilityUnavailable(value.message);
}

function sendUnavailable(res, message) {
  return res.status(501).json({ success: false, code: CAPABILITY_UNAVAILABLE, message });
}

/**
 * Route guard: answers 501 and returns false when the ML endpoint a handler
 * depends on does not exist, so the handler cannot substitute placeholder data.
 */
function requireMLCapability(res, method, url) {
  const unavailable = unavailableMLResult(method, url);
  if (!unavailable) return true;
  sendUnavailable(res, unavailable.error);
  return false;
}

/**
 * Router middleware: when a handler reports a failure that came from an
 * unsupported ML call, send 501 with the shared error code instead of the
 * handler's generic 500.
 */
function reportUnavailableMLCapability(req, res, next) {
  const json = res.json.bind(res);
  res.json = body => {
    if (body && body.success === false && !body.code && isMLCapabilityUnavailable(body)) {
      res.status(501);
      return json({ ...body, code: CAPABILITY_UNAVAILABLE });
    }
    return json(body);
  };
  next();
}

module.exports = {
  SUPPORTED_ML_ROUTES,
  RETIRED_ML_ROUTES,
  CAPABILITY_UNAVAILABLE,
  MLCapabilityUnavailableError,
  isMLRouteSupported,
  isMLCapabilityUnavailable,
  unavailableMLResult,
  guardMLClient,
  requireMLCapability,
  reportUnavailableMLCapability
};
