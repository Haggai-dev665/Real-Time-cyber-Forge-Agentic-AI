/**
 * The signed-in account's own data (SEC-07). Mounted at /api/v1.
 *
 *   GET    /me/export               everything kept about the account, as JSON
 *   DELETE /me/data?scope=…         memory | scans | agents | devices | all; the account stays
 *   POST   /me/delete-account       { confirm: "<the account's email>" }; returns the receipt
 *   GET    /account-deletions/:id   the receipt, without a session (the account is gone by
 *                                   then); the ID is 144 random bits and the receipt
 *                                   holds no personal data
 *
 * Each is limited per account (the receipt per address), and recorded in the
 * audit trail.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifiedUser } = require('../middleware/verifiedUser');
const { requireWorkspace } = require('../middleware/workspace');
const accountData = require('../services/accountDataService');

const router = express.Router();

const perAccount = (max, windowMinutes) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => `account:${req.user && req.user.userId}`,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many requests for this account; try again later.' }
});
const exportLimiter = perAccount(5, 60);
const deleteLimiter = perAccount(10, 60);
const receiptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many requests from this address; try again later.' }
});

const handle = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof accountData.AccountDataError) {
      return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    }
    console.error('[account-data]', error);
    return res.status(500).json({ success: false, message: 'Account data request failed' });
  }
};

router.get('/me/export', verifiedUser, requireWorkspace, exportLimiter, handle(async (req, res) => {
  const data = await accountData.exportAccount(req.user, req);
  res.setHeader('Content-Disposition', `attachment; filename="cyberforge-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data });
}));

router.delete('/me/data', verifiedUser, requireWorkspace, deleteLimiter, handle(async (req, res) => {
  res.json({ success: true, data: await accountData.deleteData(req.user, String(req.query.scope || ''), req) });
}));

router.post('/me/delete-account', verifiedUser, requireWorkspace, deleteLimiter, handle(async (req, res) => {
  const receipt = await accountData.deleteAccount(req.user, req.body || {}, req);
  res.status(receipt.state === 'completed' ? 200 : 207).json({ success: receipt.state === 'completed', data: receipt });
}));

router.get('/account-deletions/:deletionId', receiptLimiter, handle(async (req, res) => {
  const receipt = await accountData.getReceipt(req.params.deletionId);
  if (!receipt) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'No deletion receipt with that ID' });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data: receipt });
}));

module.exports = router;
module.exports.limiters = { exportLimiter, deleteLimiter, receiptLimiter };
