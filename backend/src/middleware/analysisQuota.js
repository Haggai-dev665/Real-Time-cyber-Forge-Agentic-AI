/**
 * Limits on expensive analysis, per workspace (SEC-04).
 *
 * The server-wide limit counts requests per IP address. That does not bound
 * one account using many addresses, and it lets one heavy account use up the
 * allowance of everyone behind the same address. These limits are per
 * workspace (the signed-in account's own) and count analyses, not requests:
 *
 *   - at most ANALYSIS_QUOTA analyses in any ANALYSIS_WINDOW_MS (a batch of
 *     ten URLs counts as ten);
 *   - at most ANALYSIS_CONCURRENCY analyses running at once.
 *
 * Over either limit, the request is refused with 429, the code
 * QUOTA_EXCEEDED and a Retry-After header; nothing is started.
 *
 * Kept in this process's memory. The deployment runs one web process; with
 * more, these would move to Redis.
 */

const DEFAULTS = { quota: 60, windowMs: 10 * 60 * 1000, concurrency: 3 };

function settings(env = process.env) {
  const positive = (value, fallback) => {
    const n = parseInt(value, 10);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  };
  return {
    quota: positive(env.ANALYSIS_QUOTA, DEFAULTS.quota),
    windowMs: positive(env.ANALYSIS_WINDOW_MS, DEFAULTS.windowMs),
    concurrency: positive(env.ANALYSIS_CONCURRENCY, DEFAULTS.concurrency)
  };
}

const usage = new Map(); // scope → { starts: [time, …] (one per analysis), running }

function scopeOf(req) {
  return req.user && (req.user.workspaceId || req.user.userId) ? String(req.user.workspaceId || req.user.userId) : null;
}

/**
 * @param {(req) => number} [weightOf] - how many analyses a request is (default 1)
 */
function analysisQuota(weightOf = () => 1) {
  return function checkQuota(req, res, next) {
    const scope = scopeOf(req);
    if (!scope) return res.status(401).json({ success: false, message: 'Access denied. User not authenticated.' });
    const { quota, windowMs, concurrency } = settings();
    const now = Date.now();
    const entry = usage.get(scope) || { starts: [], running: 0 };
    entry.starts = entry.starts.filter(time => now - time < windowMs);
    const weight = Math.max(1, Math.floor(Number(weightOf(req)) || 1));

    const refuse = (retryAfterMs, message) => {
      usage.set(scope, entry);
      res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
      return res.status(429).json({ success: false, code: 'QUOTA_EXCEEDED', message, limits: { quota, windowMinutes: Math.round(windowMs / 60000), concurrency } });
    };
    if (entry.running >= concurrency) {
      return refuse(5000, `At most ${concurrency} analyses can run at once for an account. Retry when one finishes.`);
    }
    if (entry.starts.length + weight > quota) {
      const freeAt = entry.starts.length ? entry.starts[0] + windowMs - now : windowMs;
      return refuse(freeAt, `At most ${quota} analyses per ${Math.round(windowMs / 60000)} minutes for an account.`);
    }

    for (let i = 0; i < weight; i += 1) entry.starts.push(now);
    entry.running += 1;
    usage.set(scope, entry);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      entry.running = Math.max(0, entry.running - 1);
    };
    res.on('finish', release);
    res.on('close', release);
    return next();
  };
}

/** For tests: forget every count. */
analysisQuota.reset = () => usage.clear();

module.exports = { analysisQuota, settings };
