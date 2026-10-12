const { auth } = require('./auth');

/**
 * Makes the session the only source of identity. Any userId sent in the query
 * or JSON body is replaced with the verified one, so a handler that reads
 * `req.query.userId` or `req.body.userId` cannot be asked to act for another
 * account.
 */
function bindVerifiedUser(req, res, next) {
  const userId = String(req.user.userId);
  req.query.userId = userId;
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) req.body.userId = userId;
  next();
}

/** Router guard: require a signed-in user, then bind their identity to the request. */
const verifiedUser = [auth, bindVerifiedUser];

module.exports = { verifiedUser, bindVerifiedUser };
