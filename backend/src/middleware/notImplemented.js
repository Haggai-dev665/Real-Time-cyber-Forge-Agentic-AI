const { CAPABILITY_UNAVAILABLE } = require('../services/mlCapabilities');

/**
 * Handler for a route that has nothing behind it: answers 501 with the reason,
 * in the same shape as an unavailable ML capability.
 *
 * It replaces handlers that reported a scan as running, a setting as saved or a
 * result as found when nothing had been done. Put it after `auth`, so a caller
 * without a session is still told 401 and learns nothing about the route.
 */
const notCarriedOut = reason => (req, res) =>
  res.status(501).json({ success: false, code: CAPABILITY_UNAVAILABLE, message: reason });

module.exports = { notCarriedOut };
