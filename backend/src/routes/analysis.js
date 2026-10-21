/**
 * Analysis routes for security analysis endpoints
 */

const express = require('express');
const { query } = require('express-validator');
const { getAnalysis, getUserAnalyses, deleteAnalysis } = require('../controllers/analysisController');
const { auth } = require('../middleware/auth');
const { notCarriedOut } = require('../middleware/notImplemented');
const Analysis = require('../models/Analysis');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get analysis statistics
router.get('/stats', 
  auth,
  asyncHandler(async (req, res) => {
    try {
      // Counted from this account's stored analyses (the owner is in `user`).
      // These five figures used to be fixed zeros whatever was stored.
      const owner = { user: req.user.userId };
      const [total, completed, pending, highRisk] = await Promise.all([
        Analysis.countDocuments(owner),
        Analysis.countDocuments({ ...owner, status: 'completed' }),
        Analysis.countDocuments({ ...owner, status: { $in: ['pending', 'processing'] } }),
        // results.risk_score runs from 0 to 10 in this model
        Analysis.countDocuments({ ...owner, 'results.risk_score': { $gte: 7 } })
      ]);
      const stats = {
        total_analyses: total,
        completed_analyses: completed,
        pending_analyses: pending,
        high_risk_found: highRisk
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get analysis statistics'
      });
    }
  })
);

// Get user analyses with pagination
router.get('/history', 
  auth,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed']),
    query('analysisType').optional().isString(),
    query('priority').optional().isIn(['low', 'medium', 'high', 'critical'])
  ],
  asyncHandler(getUserAnalyses)
);

// Creating analyses here is retired (16.67): the handler wrote fields the model
// does not have, so every save failed, and then called an ML endpoint that does
// not exist. The scan routes below are the ones that analyse an address.
const CREATE_RETIRED = 'Creating analyses here is not available. Scan an address with POST /api/sandbox/analyze/url or POST /api/agent/scan-url.';
router.post('/url', auth, notCarriedOut(CREATE_RETIRED));

// Get specific analysis
router.get('/:analysisId',
  auth,
  asyncHandler(getAnalysis)
);

// Delete analysis
router.delete('/:analysisId',
  auth,
  asyncHandler(deleteAnalysis)
);

// Bulk creation is retired with single creation (16.67).
router.post('/bulk', auth, notCarriedOut(CREATE_RETIRED));

module.exports = router;
