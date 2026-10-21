const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifiedUser } = require('../middleware/verifiedUser');
const { requireWorkspace } = require('../middleware/workspace');
const { summary } = require('../services/consoleSummary');
const router = express.Router();
router.get('/console/summary', verifiedUser, requireWorkspace, rateLimit({ windowMs: 60000, max: 30, keyGenerator: req => String(req.user.userId), standardHeaders: true, legacyHeaders: false }), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try { res.json({ success: true, data: await summary(req.user) }); }
  catch (_) { res.status(503).json({ success: false, message: 'Console summary unavailable' }); }
});
module.exports = router;
