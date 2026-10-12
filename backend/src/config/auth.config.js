/** Signing configuration is mandatory in every environment, including tests. */
function getJwtSecret(env = process.env) {
  const secret = env.JWT_SECRET;
  if (
    typeof secret !== 'string' ||
    secret.trim() !== secret ||
    Buffer.byteLength(secret, 'utf8') < 32 ||
    /cyber-forge-secret-key|your[-_ ]|change[-_ ]?me|placeholder|example|replace[-_ ]?me/i.test(secret)
  ) {
    throw new Error('JWT_SECRET must be a generated secret of at least 32 bytes; defaults and placeholders are not allowed.');
  }
  return secret;
}

module.exports = { getJwtSecret };
