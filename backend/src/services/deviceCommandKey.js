/**
 * The server's key for signing device commands (DEV-05).
 *
 * DEVICE_COMMAND_KEY holds a 32-byte Ed25519 seed in base64. The public half
 * is given to a device when it claims an enrollment code, and the device
 * refuses any command not signed by it. Without the setting, commands are not
 * available (the routes answer 501) and claims carry no key.
 *
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
const crypto = require('crypto');

const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/** { publicKey, sign(message) }, or null when no valid key is configured. */
function commandSigner(env = process.env) {
  const seed = typeof env.DEVICE_COMMAND_KEY === 'string' ? Buffer.from(env.DEVICE_COMMAND_KEY.trim(), 'base64') : Buffer.alloc(0);
  if (seed.length !== 32) return null;
  const privateKey = crypto.createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]), format: 'der', type: 'pkcs8' });
  const publicKey = crypto.createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(12).toString('base64');
  return { publicKey, sign: message => crypto.sign(null, Buffer.from(message, 'utf8'), privateKey).toString('base64') };
}

module.exports = { commandSigner };
