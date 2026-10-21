/**
 * The most recent network captures per account, in the web process (newest
 * first, at most RING_MAX each). It is what GET /api/network-capture reads, so
 * the desktop and the phone share captures even without Appwrite; it is lost at
 * a restart. Account deletion and `DELETE /api/v1/me/data?scope=all` empty an
 * account's buffer (`forget`).
 */
const RING = new Map();
const RING_MAX = 1000;

function push(userId, records) {
  const next = records.concat(RING.get(userId) || []);
  if (next.length > RING_MAX) next.length = RING_MAX;
  RING.set(userId, next);
}

const get = userId => RING.get(userId) || [];

/** How many captures were dropped. */
function forget(userId) {
  const count = get(String(userId)).length;
  RING.delete(String(userId));
  return count;
}

module.exports = { push, get, forget, RING_MAX };
