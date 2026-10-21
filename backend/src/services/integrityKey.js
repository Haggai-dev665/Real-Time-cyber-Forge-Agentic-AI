/**
 * The server's key for signing audit checkpoints and evidence manifests (SEC-08).
 *
 * AUDIT_SIGNING_KEY holds a 32-byte Ed25519 seed in base64. It is a setting of
 * the server, never stored in the database, so someone who can write to the
 * database but not read the server's settings cannot produce a valid
 * signature. The public half is published with every signature, and anyone
 * can check a manifest with it.
 *
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Without the setting, nothing is signed and the integrity routes say so.
 */
const crypto = require('crypto');

const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/** { keyId, publicKey, sign(message) }, or null when no valid key is configured. */
function integritySigner(env = process.env) {
  const seed = typeof env.AUDIT_SIGNING_KEY === 'string' ? Buffer.from(env.AUDIT_SIGNING_KEY.trim(), 'base64') : Buffer.alloc(0);
  if (seed.length !== 32) return null;
  const privateKey = crypto.createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]), format: 'der', type: 'pkcs8' });
  const raw = crypto.createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(12);
  return {
    keyId: crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16),
    publicKey: raw.toString('base64'),
    sign: message => crypto.sign(null, Buffer.from(message, 'utf8'), privateKey).toString('base64')
  };
}

/** Whether `signature` is a valid signature of `message` by the raw Ed25519 public key `publicKey` (base64). */
function verifySignature(publicKey, message, signature) {
  try {
    const key = crypto.createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(publicKey, 'base64')]), format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(message, 'utf8'), key, Buffer.from(String(signature), 'base64'));
  } catch (_) {
    return false;
  }
}

module.exports = { integritySigner, verifySignature };
