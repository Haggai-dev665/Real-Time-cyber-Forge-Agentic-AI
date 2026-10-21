/**
 * The ML service through the backend (V2-ML02), mounted at /api/v1.
 *
 *   GET  /ml/capabilities      what it can do now
 *   POST /ml/analyze-url       { url } → one versioned analysis record
 *
 * Each capability's kind (trained model, transformer, heuristic, reference
 * list, language model), readiness and limits, as the ML service reports them
 * now, and what it does not offer. 503 ML_UNAVAILABLE, with the reason, when
 * the service cannot say.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifiedUser } = require('../middleware/verifiedUser');
const { fetchReport } = require('../services/mlCapabilityReport');
const analysis = require('../services/mlAnalysis');

const router = express.Router();

// The ML service answers one model request at a time on shared hardware.
const analysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => `account:${req.user && req.user.userId}`,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many analyses for this account; wait a minute.' }
});

router.get('/ml/capabilities', verifiedUser, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const checkedAt = new Date().toISOString();
  const report = await fetchReport();
  if (!report.available) {
    return res.status(503).json({ success: false, code: 'ML_UNAVAILABLE', message: report.reason, data: { available: false, checkedAt } });
  }
  res.json({ success: true, data: { ...report, source: 'ml_service', checkedAt } });
});

/**
 * The address is redacted before it is sent to the ML service, and the answer
 * is the versioned record: verdict (threat, benign or unknown), the reason,
 * each detector's engine, verdict and raw score, coverage and warnings.
 */
router.post('/ml/analyze-url', verifiedUser, analysisLimiter, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    res.json({ success: true, data: await analysis.analyzeUrl(req.body && req.body.url) });
  } catch (error) {
    if (error instanceof analysis.AnalysisError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    console.error('[ml analyze-url]', error.message);
    res.status(500).json({ success: false, message: 'The analysis could not be made' });
  }
});

module.exports = router;
module.exports.analysisLimiter = analysisLimiter; // tests reset it between cases
