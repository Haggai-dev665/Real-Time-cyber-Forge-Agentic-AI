const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/auth.config');

const MAX_REFRESH_AGE_SECONDS = 7 * 24 * 60 * 60;

function signSessionToken(user) {
  return jwt.sign(
    { userId: String(user._id), email: user.email, role: user.role },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '24h' }
  );
}

function verifySessionToken(token, { forRefresh = false } = {}) {
  const decoded = jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    ignoreExpiration: forRefresh
  });
  const now = Date.now() / 1000;
  if (
    !decoded || typeof decoded !== 'object' ||
    typeof decoded.userId !== 'string' || !/^[a-f\d]{24}$/i.test(decoded.userId) ||
    !Number.isFinite(decoded.iat) || !Number.isFinite(decoded.exp) ||
    decoded.iat > now || decoded.exp <= decoded.iat ||
    (forRefresh && now - decoded.iat > MAX_REFRESH_AGE_SECONDS)
  ) {
    throw new jwt.JsonWebTokenError('Invalid session claims');
  }
  return decoded;
}

module.exports = { signSessionToken, verifySessionToken };
