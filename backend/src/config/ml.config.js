const DEFAULT_ML_SERVICE_URL = 'https://che237-cyberforge.hf.space';

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

module.exports = { getMLServiceUrl };
