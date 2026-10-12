/**
 * Threat detection routes
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { detectThreats, getThreatStats } = require('../services/threatService');
const Threat = require('../models/Threat');
const { ownedThreatFilter } = require('../services/threatOwnership');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  next();
};
const threatIdValidation = param('threatId').isString().isLength({ min: 1, max: 128 });
const statusFilter = status => {
  if (status === 'active') return { $in: ['detected', 'investigating', 'confirmed'] };
  if (status === 'resolved') return { $in: ['resolved', 'mitigated', 'false_positive'] };
  return status;
};

// Get all threats for user
router.get('/',
  auth,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('status').optional().isIn(['active', 'resolved', 'dismissed', 'detected', 'investigating', 'confirmed', 'mitigated', 'false_positive']),
    query('type').optional().isString().isLength({ max: 100 })
  ],
  validate,
  asyncHandler(async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        severity,
        status = 'active',
        type
      } = req.query;

      // Get real threat data from DB
      const query = ownedThreatFilter(req.user.userId);
      if (severity) query.severity = severity;
      if (status) query.status = statusFilter(status);
      if (type) query.type = type;

      const totalCount = await Threat.countDocuments(query);
      const threats = await Threat.find(query)
        .sort({ 'detection.timestamp': -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
        
      const totalPages = Math.ceil(totalCount / limit);
      
      res.json({
        success: true,
        data: {
          threats,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get threats'
      });
    }
  })
);

// Get threat statistics
router.get('/stats',
  auth,
  asyncHandler(async (req, res) => {
    try {
      const stats = await getThreatStats(req.user.userId);
      if (!stats) throw new Error('Threat statistics unavailable');
      
      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get threat statistics'
      });
    }
  })
);

// Initiate threat scan
router.post('/scan',
  auth,
  [
    body('urls').optional().isArray(),
    body('urls.*').isURL().withMessage('All URLs must be valid'),
    body('scanType').optional().isIn(['quick', 'deep', 'comprehensive']),
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

      const { urls = [], scanType = 'quick', priority = 'medium' } = req.body;

      // If no URLs provided, perform general threat scan
      if (urls.length === 0) {
        urls.push('general_scan');
      }

      const scanResults = [];
      
      for (const url of urls) {
        const result = await detectThreats({
          url,
          scanType,
          userId: req.user.userId
        });
        scanResults.push(result);
      }

      res.json({
        success: true,
        message: 'Threat scan completed',
        data: {
          scanId: `scan_${Date.now()}`,
          results: scanResults,
          summary: {
            urls_scanned: urls.length,
            threats_found: scanResults.reduce((total, result) => total + result.threats.length, 0),
            avg_risk_score: scanResults.reduce((total, result) => total + result.riskScore, 0) / scanResults.length
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Threat scan failed'
      });
    }
  })
);

// Get specific threat details
router.get('/:threatId',
  auth,
  threatIdValidation,
  validate,
  asyncHandler(async (req, res) => {
    try {
      const { threatId } = req.params;

      const threat = await Threat.findOne(ownedThreatFilter(req.user.userId, threatId));
      if (!threat) return res.status(404).json({ success: false, message: 'Threat not found' });

      res.json({
        success: true,
        data: { threat }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get threat details'
      });
    }
  })
);

// Dismiss/resolve threat
router.put('/:threatId/dismiss',
  auth,
  threatIdValidation,
  [
    body('reason').optional().isString().isLength({ max: 1000 }),
    body('notes').optional().isString().isLength({ max: 4000 })
  ],
  validate,
  asyncHandler(async (req, res) => {
    try {
      const { threatId } = req.params;
      const { reason, notes } = req.body;

      const timestamp = new Date();
      const threat = await Threat.findOneAndUpdate(
        ownedThreatFilter(req.user.userId, threatId),
        {
          $set: { status: 'dismissed' },
          $push: { timeline: { timestamp, event: 'Threat dismissed by user', details: JSON.stringify({ reason, notes }), user: req.user.userId } }
        },
        { new: true, runValidators: true }
      );
      if (!threat) return res.status(404).json({ success: false, message: 'Threat not found' });
      res.json({
        success: true,
        message: 'Threat dismissed successfully',
        data: {
          threatId,
          status: 'dismissed',
          dismissed_at: timestamp.toISOString(),
          reason,
          notes
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to dismiss threat'
      });
    }
  })
);

// Mark threat as resolved
router.put('/:threatId/resolve',
  auth,
  threatIdValidation,
  [
    body('resolution').optional().isString().isLength({ max: 1000 }),
    body('notes').optional().isString().isLength({ max: 4000 })
  ],
  validate,
  asyncHandler(async (req, res) => {
    try {
      const { threatId } = req.params;
      const { resolution, notes } = req.body;

      const timestamp = new Date();
      const threat = await Threat.findOneAndUpdate(
        ownedThreatFilter(req.user.userId, threatId),
        {
          $set: { status: 'resolved' },
          $push: { timeline: { timestamp, event: 'Threat resolved by user', details: JSON.stringify({ resolution, notes }), user: req.user.userId } }
        },
        { new: true, runValidators: true }
      );
      if (!threat) return res.status(404).json({ success: false, message: 'Threat not found' });
      res.json({
        success: true,
        message: 'Threat resolved successfully',
        data: {
          threatId,
          status: 'resolved',
          resolved_at: timestamp.toISOString(),
          resolution,
          notes
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to resolve threat'
      });
    }
  })
);

module.exports = router;
