/**
 * AI Analysis Routes
 * Provides endpoints for AI-powered security analysis
 */

const express = require('express');
const { body, query } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const AIAnalysisService = require('../services/ai/AIAnalysisService');
const ThreatMonitoringService = require('../services/ai/ThreatMonitoringService');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Initialize services
const aiAnalysisService = new AIAnalysisService();
const threatMonitoringService = new ThreatMonitoringService();

// Start threat monitoring
threatMonitoringService.startMonitoring();

// Rate limiting for AI analysis routes
const aiAnalysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 analysis requests per windowMs
  message: {
    success: false,
    message: 'Too many analysis requests, please try again later'
  }
});

// Validation rules
const urlAnalysisValidation = [
  body('url')
    .isURL()
    .withMessage('Please provide a valid URL'),
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object')
];

const fileAnalysisValidation = [
  body('filename')
    .notEmpty()
    .withMessage('Filename is required'),
  body('hash')
    .isLength({ min: 32, max: 64 })
    .withMessage('File hash must be between 32-64 characters'),
  body('size')
    .isInt({ min: 1 })
    .withMessage('File size must be a positive integer')
];

/**
 * @route   POST /api/ai/analyze/url
 * @desc    Analyze URL for threats
 * @access  Private
 */
router.post('/analyze/url', 
  auth, 
  aiAnalysisLimiter, 
  urlAnalysisValidation,
  async (req, res) => {
    try {
      const { url, context } = req.body;
      
      const result = await aiAnalysisService.analyzeUrl(
        url, 
        req.user.userId, 
        {
          ...context,
          source: 'api',
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        }
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            analysis_id: result.analysis._id,
            results: result.results,
            url: url
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error('URL analysis route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during URL analysis'
      });
    }
  }
);

/**
 * @route   POST /api/ai/analyze/file
 * @desc    Analyze file for malware
 * @access  Private
 */
router.post('/analyze/file',
  auth,
  aiAnalysisLimiter,
  fileAnalysisValidation,
  async (req, res) => {
    try {
      const { filename, hash, size, type, content } = req.body;
      
      const fileData = {
        filename,
        hash,
        size,
        type,
        content
      };

      const result = await aiAnalysisService.analyzeFile(
        fileData,
        req.user.userId,
        {
          source: 'api',
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        }
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            analysis_id: result.analysis._id,
            results: result.results,
            filename: filename
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error('File analysis route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during file analysis'
      });
    }
  }
);

/**
 * @route   POST /api/ai/analyze/network
 * @desc    Analyze network traffic patterns
 * @access  Private (Analyst or Admin only)
 */
router.post('/analyze/network',
  auth,
  authorize('analyst', 'admin'),
  aiAnalysisLimiter,
  async (req, res) => {
    try {
      const { networkData } = req.body;

      if (!networkData) {
        return res.status(400).json({
          success: false,
          message: 'Network data is required'
        });
      }

      const result = await aiAnalysisService.analyzeNetworkTraffic(
        networkData,
        req.user.userId
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            analysis_id: result.analysis._id,
            results: result.results
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error('Network analysis route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during network analysis'
      });
    }
  }
);

/**
 * @route   GET /api/ai/analysis/history
 * @desc    Get user's analysis history
 * @access  Private
 */
router.get('/analysis/history',
  auth,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      
      const result = await aiAnalysisService.getAnalysisHistory(
        req.user.userId,
        limit
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            analyses: result.analyses,
            count: result.analyses.length
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error('Analysis history route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   GET /api/ai/threats/summary
 * @desc    Get threat summary
 * @access  Private
 */
router.get('/threats/summary',
  auth,
  [
    query('timeframe')
      .optional()
      .isIn(['1h', '24h', '7d', '30d'])
      .withMessage('Timeframe must be one of: 1h, 24h, 7d, 30d')
  ],
  async (req, res) => {
    try {
      const timeframe = req.query.timeframe || '24h';
      
      const result = await aiAnalysisService.getThreatSummary(timeframe);

      if (result.success) {
        res.json({
          success: true,
          data: result.summary
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error
        });
      }

    } catch (error) {
      console.error('Threat summary route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   GET /api/ai/monitoring/status
 * @desc    Get real-time monitoring status
 * @access  Private (Analyst or Admin only)
 */
router.get('/monitoring/status',
  auth,
  authorize('analyst', 'admin'),
  async (req, res) => {
    try {
      const status = threatMonitoringService.getStatus();
      
      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Monitoring status route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   POST /api/ai/monitoring/start
 * @desc    Start real-time monitoring
 * @access  Private (Admin only)
 */
router.post('/monitoring/start',
  auth,
  authorize('admin'),
  async (req, res) => {
    try {
      threatMonitoringService.startMonitoring();
      
      res.json({
        success: true,
        message: 'Real-time monitoring started'
      });

    } catch (error) {
      console.error('Start monitoring route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   POST /api/ai/monitoring/stop
 * @desc    Stop real-time monitoring
 * @access  Private (Admin only)
 */
router.post('/monitoring/stop',
  auth,
  authorize('admin'),
  async (req, res) => {
    try {
      threatMonitoringService.stopMonitoring();
      
      res.json({
        success: true,
        message: 'Real-time monitoring stopped'
      });

    } catch (error) {
      console.error('Stop monitoring route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * @route   GET /api/ai/models/status
 * @desc    Get AI models status
 * @access  Private (Analyst or Admin only)
 */
router.get('/models/status',
  auth,
  authorize('analyst', 'admin'),
  async (req, res) => {
    try {
      // In production, this would check actual model status
      const modelsStatus = {
        threat_detection: {
          status: 'active',
          version: '1.0.0',
          accuracy: 0.94,
          last_updated: '2024-01-15T10:30:00Z'
        },
        malware_analysis: {
          status: 'active',
          version: '1.2.0',
          accuracy: 0.97,
          last_updated: '2024-01-20T14:15:00Z'
        },
        phishing_detection: {
          status: 'active',
          version: '1.1.0',
          accuracy: 0.92,
          last_updated: '2024-01-18T09:45:00Z'
        },
        network_analysis: {
          status: 'active',
          version: '1.0.1',
          accuracy: 0.89,
          last_updated: '2024-01-22T16:20:00Z'
        }
      };

      res.json({
        success: true,
        data: {
          models: modelsStatus,
          overall_status: 'healthy',
          total_models: Object.keys(modelsStatus).length
        }
      });

    } catch (error) {
      console.error('Models status route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Export the threat monitoring service for WebSocket integration
router.threatMonitoringService = threatMonitoringService;

module.exports = router;