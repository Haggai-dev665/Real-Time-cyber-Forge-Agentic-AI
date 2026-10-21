/**
 * A canonical form of a value, so the same record always gives the same hash:
 * object keys sorted, undefined left out, dates as ISO strings, ObjectIds as
 * their hex. Used for evidence fingerprints, audit event content hashes and
 * signed manifests.
 */
const crypto = require('crypto');

function canonical(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (value._bsontype === 'ObjectId' || value._bsontype === 'ObjectID') return String(value);
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (Array.isArray(value)) return value.map(item => (item === undefined ? null : canonical(item)));
  const out = {};
  for (const key of Object.keys(value).sort()) {
    const item = canonical(value[key]);
    if (item !== undefined) out[key] = item;
  }
  return out;
}

const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const hashOf = value => sha256(JSON.stringify(canonical(value)));

module.exports = { canonical, sha256, hashOf };
