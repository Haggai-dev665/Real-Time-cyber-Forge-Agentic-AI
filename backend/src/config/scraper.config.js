const DEFAULT_SCRAPER_URL = 'https://webscrapper.live';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * Where the rendered-page scanner lives, and whether it may be used.
 *
 * The scanner is an external provider, so its transport must be HTTPS
 * (SEC-04, finding F19). A plain-HTTP address is not upgraded and not used:
 * the scanner is reported unavailable, and scans say their page evidence is
 * missing. Loopback is exempt so the contract tests can imitate the provider.
 *
 * Never throws and never echoes the configured value, which can contain
 * credentials.
 */
function getScraperConfig(env = process.env) {
  const apiKey = typeof env.WEBSCRAPER_API_KEY === 'string' ? env.WEBSCRAPER_API_KEY.trim() : '';
  const configured = env.WEBSCRAPER_API_URL;
  const unavailable = reason => ({ available: false, reason, baseUrl: null, apiKey: '' });

  let url;
  try {
    url = new URL(configured === undefined || configured === '' ? DEFAULT_SCRAPER_URL : String(configured).trim());
  } catch (_) {
    return unavailable('WEBSCRAPER_API_URL is not a valid URL');
  }
  if (url.username || url.password) return unavailable('WEBSCRAPER_API_URL must not contain credentials');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))) {
    return unavailable('WEBSCRAPER_API_URL must use HTTPS');
  }
  if (!apiKey) return unavailable('WEBSCRAPER_API_KEY is not set');

  // Earlier configuration pointed at the scrape endpoint itself; accept it as a base.
  const path = url.pathname.replace(/\/api\/(scrape|v1\/scans)\/?$/, '').replace(/\/+$/, '');
  return { available: true, reason: null, baseUrl: `${url.origin}${path}`, apiKey };
}

module.exports = { getScraperConfig, DEFAULT_SCRAPER_URL };
