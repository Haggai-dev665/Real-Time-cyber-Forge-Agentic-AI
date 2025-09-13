/**
 * Web Scraping Routes
 * Advanced web scraping endpoints for cybersecurity intelligence
 */

const express = require('express');
const { body, query } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const WebScrapingService = require('../services/WebScrapingService');
const ThreatIntelligenceService = require('../services/ThreatIntelligenceService');
const rateLimit = require('express-rate-limit');
const { validationResult } = require('express-validator');

const router = express.Router();

// Initialize services
const webScrapingService = new WebScrapingService();
const threatIntelService = new ThreatIntelligenceService();

// Rate limiting for scraping routes
const scrapingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 scraping requests per windowMs
  message: {
    success: false,
    message: 'Too many scraping requests, please try again later'
  }
});

/**
 * @route   GET /api/scraping/tasks
 * @desc    Get active scraping tasks
 * @access  Private
 */
router.get('/tasks', auth, async (req, res) => {
  try {
    const tasks = await webScrapingService.getActiveTasks();
    res.json({
      success: true,
      tasks: tasks
    });
  } catch (error) {
    console.error('Error fetching scraping tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scraping tasks'
    });
  }
});

/**
 * @route   POST /api/scraping/domain
 * @desc    Start domain scraping task
 * @access  Private
 */
router.post('/domain', [
  auth,
  scrapingLimiter,
  body('domain').isLength({ min: 3 }).withMessage('Domain is required'),
  body('options.depth').optional().isInt({ min: 1, max: 10 }).withMessage('Depth must be between 1 and 10'),
  body('options.followSubdomains').optional().isBoolean(),
  body('options.extractEmails').optional().isBoolean(),
  body('options.extractPhoneNumbers').optional().isBoolean(),
  body('options.checkSecurity').optional().isBoolean()
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { domain, options = {} } = req.body;
    
    // Start domain scraping task
    const task = await webScrapingService.startDomainScraping({
      domain,
      options: {
        depth: options.depth || 3,
        followSubdomains: options.followSubdomains || true,
        extractEmails: options.extractEmails || true,
        extractPhoneNumbers: options.extractPhoneNumbers || true,
        checkSecurity: options.checkSecurity || true,
        userAgent: 'CyberForge-SecurityBot/1.0',
        timeout: 30000,
        maxConcurrent: 5
      },
      userId: req.user.id
    });

    res.json({
      success: true,
      task: task,
      message: 'Domain scraping task started successfully'
    });

  } catch (error) {
    console.error('Error starting domain scraping:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start domain scraping'
    });
  }
});

/**
 * @route   POST /api/scraping/social-media
 * @desc    Start social media scraping
 * @access  Private
 */
router.post('/social-media', [
  auth,
  scrapingLimiter,
  body('platforms').isArray().withMessage('Platforms must be an array'),
  body('keywords').isArray().withMessage('Keywords must be an array'),
  body('options.maxResults').optional().isInt({ min: 10, max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { platforms, keywords, options = {} } = req.body;
    
    const task = await webScrapingService.startSocialMediaScraping({
      platforms,
      keywords,
      options: {
        maxResults: options.maxResults || 100,
        timeRange: options.timeRange || '24h',
        language: options.language || 'en',
        includeSentiment: true,
        filterThreats: true
      },
      userId: req.user.id
    });

    res.json({
      success: true,
      task: task,
      message: 'Social media scraping started'
    });

  } catch (error) {
    console.error('Error starting social media scraping:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start social media scraping'
    });
  }
});

/**
 * @route   POST /api/scraping/deep-web
 * @desc    Start deep web scraping with proxy rotation
 * @access  Private
 */
router.post('/deep-web', [
  auth,
  scrapingLimiter,
  body('targets').isArray().withMessage('Targets must be an array'),
  body('searchTerms').isArray().withMessage('Search terms must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { targets, searchTerms, options = {} } = req.body;
    
    const task = await webScrapingService.startDeepWebScraping({
      targets,
      searchTerms,
      options: {
        useProxyRotation: true,
        useTor: options.useTor || false,
        maxDepth: options.maxDepth || 5,
        respectRobots: false,
        stealthMode: true,
        delayBetweenRequests: 2000
      },
      userId: req.user.id
    });

    res.json({
      success: true,
      task: task,
      message: 'Deep web scraping initiated with proxy rotation'
    });

  } catch (error) {
    console.error('Error starting deep web scraping:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start deep web scraping'
    });
  }
});

/**
 * @route   POST /api/scraping/api-discovery
 * @desc    Start API endpoint discovery
 * @access  Private
 */
router.post('/api-discovery', [
  auth,
  scrapingLimiter,
  body('domain').isLength({ min: 3 }).withMessage('Domain is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { domain, options = {} } = req.body;
    
    const task = await webScrapingService.startAPIDiscovery({
      domain,
      options: {
        scanCommonPaths: true,
        checkDocumentation: true,
        testEndpoints: true,
        checkAuthentication: true,
        scanForVulnerabilities: true,
        commonApiPaths: [
          '/api', '/v1', '/v2', '/graphql', '/swagger',
          '/openapi', '/docs', '/api-docs', '/rest'
        ]
      },
      userId: req.user.id
    });

    res.json({
      success: true,
      task: task,
      message: 'API discovery scan initiated'
    });

  } catch (error) {
    console.error('Error starting API discovery:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start API discovery'
    });
  }
});

/**
 * @route   GET /api/scraping/results/:taskId
 * @desc    Get scraping results for a specific task
 * @access  Private
 */
router.get('/results/:taskId', auth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { page = 1, limit = 50, filter } = req.query;
    
    const results = await webScrapingService.getTaskResults(taskId, {
      page: parseInt(page),
      limit: parseInt(limit),
      filter
    });

    res.json({
      success: true,
      results: results.data,
      pagination: {
        current: results.page,
        total: results.totalPages,
        count: results.count
      }
    });

  } catch (error) {
    console.error('Error fetching scraping results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scraping results'
    });
  }
});

/**
 * @route   POST /api/scraping/stop/:taskId
 * @desc    Stop a running scraping task
 * @access  Private
 */
router.post('/stop/:taskId', auth, async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const result = await webScrapingService.stopTask(taskId, req.user.id);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Scraping task stopped successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('Error stopping scraping task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop scraping task'
    });
  }
});

/**
 * @route   GET /api/scraping/statistics
 * @desc    Get scraping statistics
 * @access  Private
 */
router.get('/statistics', auth, async (req, res) => {
  try {
    const stats = await webScrapingService.getStatistics(req.user.id);
    
    res.json({
      success: true,
      statistics: stats
    });

  } catch (error) {
    console.error('Error fetching scraping statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

/**
 * @route   POST /api/scraping/export
 * @desc    Export scraping results
 * @access  Private
 */
router.post('/export', [
  auth,
  body('taskIds').isArray().withMessage('Task IDs must be an array'),
  body('format').isIn(['json', 'csv', 'xml']).withMessage('Format must be json, csv, or xml')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { taskIds, format, includeMetadata = true } = req.body;
    
    const exportData = await webScrapingService.exportResults({
      taskIds,
      format,
      includeMetadata,
      userId: req.user.id
    });

    res.setHeader('Content-Type', webScrapingService.getContentType(format));
    res.setHeader('Content-Disposition', `attachment; filename="scraping-results.${format}"`);
    res.send(exportData);

  } catch (error) {
    console.error('Error exporting scraping results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export results'
    });
  }
});

/**
 * @route   POST /api/scraping/analyze-threats
 * @desc    Analyze scraped data for threat indicators
 * @access  Private
 */
router.post('/analyze-threats', [
  auth,
  body('data').isArray().withMessage('Data must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { data } = req.body;
    
    const threatAnalysis = await threatIntelService.analyzeScrapedData(data);
    
    res.json({
      success: true,
      analysis: threatAnalysis
    });

  } catch (error) {
    console.error('Error analyzing threats in scraped data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze threats'
    });
  }
});

module.exports = router;