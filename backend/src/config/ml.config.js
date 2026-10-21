const DEFAULT_ML_SERVICE_URL = 'https://che237-cyberforge.hf.space';
const SERVICE_KEY_HEADER = 'X-CyberForge-Service-Key';

/** One ML destination for every backend client, including transformer calls. */
function getMLServiceUrl(env = process.env) {
  const configured = env.ML_SERVICE_URL;
  if (configured === undefined) return DEFAULT_ML_SERVICE_URL;

  try {
    if (typeof configured !== 'string' || !configured.trim()) throw new Error();
    const url = new URL(configured.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error();
    }
    return url.toString().replace(/\/+$/, '');
  } catch (_) {
    // Never echo the configured value: malformed input can contain credentials.
    throw new Error('ML_SERVICE_URL must be an HTTP(S) base URL without credentials, query parameters or a fragment.');
  }
}

/**
 * The key the ML service requires on every call except its health check, or ''
 * when none is configured (the service then refuses those calls with 503).
 */
function getMLServiceKey(env = process.env) {
  const configured = env.ML_SERVICE_KEY;
  if (configured === undefined || configured === '') return '';
  if (typeof configured !== 'string' || !/^[A-Za-z0-9._~-]{32,256}$/.test(configured.trim())) {
    // Never echo the configured value.
    throw new Error('ML_SERVICE_KEY must be 32 to 256 letters, digits or . _ ~ - characters.');
  }
  return configured.trim();
}

/** The full URL a request config will reach. */
function requestUrl(config) {
  const url = String(config.url || '');
  if (/^https?:\/\//i.test(url)) return url;
  const base = String(config.baseURL || '').replace(/\/+$/, '');
  return base ? `${base}/${url.replace(/^\/+/, '')}` : url;
}

/** True when a URL is on the configured ML service, not merely sharing its prefix. */
function isMLServiceRequest(url, base = getMLServiceUrl()) {
  return url === base || url.startsWith(`${base}/`) || url.startsWith(`${base}?`);
}

/**
 * Send the service key on an axios instance's requests to the ML service, and
 * on no others. Applied to the shared axios instance below and to each
 * instance an ML client creates.
 */
function attachMLServiceKey(instance) {
  if (!instance || !instance.interceptors || !instance.interceptors.request) return instance;
  instance.interceptors.request.use(config => {
    const key = getMLServiceKey();
    if (!key || !isMLServiceRequest(requestUrl(config))) return config;
    if (config.headers && typeof config.headers.set === 'function') config.headers.set(SERVICE_KEY_HEADER, key);
    else config.headers = { ...(config.headers || {}), [SERVICE_KEY_HEADER]: key };
    return config;
  });
  return instance;
}

attachMLServiceKey(require('axios'));

module.exports = { getMLServiceUrl, getMLServiceKey, attachMLServiceKey, isMLServiceRequest, SERVICE_KEY_HEADER };
