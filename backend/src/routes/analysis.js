/**
 * Analysis routes for security analysis endpoints
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { 
  createAnalysis, 
  getAnalysis, 
  getUserAnalyses,
  getAnalysisStats,
  deleteAnalysis
} = require('../controllers/analysisController');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get analysis statistics
router.get('/stats', 
  auth,
  asyncHandler(async (req, res) => {
    try {
      // Mock stats for now
      const stats = {
        total_analyses: 0,
        completed_analyses: 0,
        pending_analyses: 0,
        high_risk_found: 0,
        last_analysis: null
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

// Create new analysis
router.post('/url',
  auth,
  [
    body('url').isURL().withMessage('Valid URL is required'),
    body('analysisType').optional().isString(),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('metadata').optional().isObject()
  ],
  asyncHandler(createAnalysis)
);

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

// Bulk analysis
router.post('/bulk',
  auth,
  [
    body('urls').isArray({ min: 1, max: 10 }).withMessage('URLs array required (max 10)'),
    body('urls.*').isURL().withMessage('All URLs must be valid'),
    body('analysisType').optional().isString(),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical'])
  ],
  asyncHandler(async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { urls, analysisType, priority } = req.body;
      const analysisPromises = urls.map(url => 
        createAnalysis({
          ...req,
          body: { url, analysisType, priority }
        }, res, true) // Pass true to indicate bulk operation
      );

      const results = await Promise.allSettled(analysisPromises);
      
      res.json({
        success: true,
        message: 'Bulk analysis initiated',
        data: {
          total: urls.length,
          results: results.map((result, index) => ({
            url: urls[index],
            status: result.status,
            ...(result.status === 'fulfilled' ? { data: result.value } : { error: result.reason })
          }))
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Bulk analysis failed'
      });
    }
  })
);

module.exports = router;
