/**
 * Threat detection routes
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { detectThreats, getThreatStats } = require('../services/threatService');

const router = express.Router();

// Get all threats for user
router.get('/',
  // Optional auth - allow desktop apps to access basic threats
  (req, res, next) => {
    const userAgent = req.get('User-Agent') || '';
    const isDesktopApp = userAgent.includes('cyber-forge-desktop') || userAgent.includes('Electron');
    
    if (isDesktopApp) {
      // Skip auth for desktop app
      req.isDesktopApp = true;
      return next();
    } else {
      // Require auth for web/mobile
      return auth(req, res, next);
    }
  },
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('status').optional().isIn(['active', 'resolved', 'dismissed']),
    query('type').optional().isString()
  ],
  asyncHandler(async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        severity,
        status = 'active',
        type
      } = req.query;

      // Mock threat data for now
      const threats = [];
      
      res.json({
        success: true,
        data: {
          threats,
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalCount: 0,
            hasNext: false,
            hasPrev: false
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
  // Optional auth - allow desktop apps to access basic stats
  (req, res, next) => {
    const userAgent = req.get('User-Agent') || '';
    const isDesktopApp = userAgent.includes('cyber-forge-desktop') || userAgent.includes('Electron');
    
    console.log('🔍 Threats Stats Auth Check:', { userAgent, isDesktopApp });
    
    if (isDesktopApp) {
      // Skip auth for desktop app
      req.isDesktopApp = true;
      console.log('✅ Desktop app detected, skipping auth');
      return next();
    } else {
      // Require auth for web/mobile
      console.log('🔐 Web/mobile client, requiring auth');
      return auth(req, res, next);
    }
  },
  asyncHandler(async (req, res) => {
    try {
      let stats;
      
      if (req.isDesktopApp) {
        // Return basic stats for desktop app
        stats = await getThreatStats();
      } else {
        // Return user-specific stats for authenticated users
        stats = await getThreatStats(req.user.userId);
      }
      
      res.json({
        success: true,
        data: stats || {
          total_threats: 0,
          active_threats: 0,
          resolved_threats: 0,
          high_severity: 0,
          last_scan: new Date().toISOString()
        }
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
  asyncHandler(async (req, res) => {
    try {
      const { threatId } = req.params;

      // Mock threat details
      const threat = {
        id: threatId,
        type: 'suspicious_url',
        severity: 'medium',
        description: 'Suspicious URL detected',
        url: 'https://example.com',
        status: 'active',
        created_at: new Date().toISOString(),
        recommendations: [
          'Avoid visiting this URL',
          'Run antivirus scan',
          'Check browser security settings'
        ]
      };

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
  [
    body('reason').optional().isString(),
    body('notes').optional().isString()
  ],
  asyncHandler(async (req, res) => {
    try {
      const { threatId } = req.params;
      const { reason, notes } = req.body;

      // Mock dismissal
      res.json({
        success: true,
        message: 'Threat dismissed successfully',
        data: {
          threatId,
          status: 'dismissed',
          dismissed_at: new Date().toISOString(),
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
  [
    body('resolution').optional().isString(),
    body('notes').optional().isString()
  ],
  asyncHandler(async (req, res) => {
    try {
      const { threatId } = req.params;
      const { resolution, notes } = req.body;

      // Mock resolution
      res.json({
        success: true,
        message: 'Threat resolved successfully',
        data: {
          threatId,
          status: 'resolved',
          resolved_at: new Date().toISOString(),
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
