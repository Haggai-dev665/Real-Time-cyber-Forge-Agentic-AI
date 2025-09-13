/**
 * Domain Intelligence Routes
 * Advanced domain analysis and intelligence gathering endpoints
 */

const express = require('express');
const { body, query } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const DomainIntelligenceService = require('../services/DomainIntelligenceService');
const ThreatIntelligenceService = require('../services/ThreatIntelligenceService');
const rateLimit = require('express-rate-limit');
const { validationResult } = require('express-validator');

const router = express.Router();

// Initialize services
const domainIntelService = new DomainIntelligenceService();
const threatIntelService = new ThreatIntelligenceService();

// Rate limiting for domain analysis routes
const domainAnalysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 domain analysis requests per windowMs
  message: {
    success: false,
    message: 'Too many domain analysis requests, please try again later'
  }
});

/**
 * @route   POST /api/domain-intel/analyze
 * @desc    Analyze a domain for security intelligence
 * @access  Private
 */
router.post('/analyze', [
  auth,
  domainAnalysisLimiter,
  body('domain').isLength({ min: 3 }).withMessage('Domain is required'),
  body('options.checkSubdomains').optional().isBoolean(),
  body('options.checkCertificates').optional().isBoolean(),
  body('options.checkDnsRecords').optional().isBoolean(),
  body('options.checkReputation').optional().isBoolean(),
  body('options.checkTechnologies').optional().isBoolean()
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
    
    // Validate domain format
    if (!domainIntelService.isValidDomain(domain)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid domain format'
      });
    }

    const analysis = await domainIntelService.analyzeDomain(domain, {
      checkSubdomains: options.checkSubdomains !== false,
      checkCertificates: options.checkCertificates !== false,
      checkDnsRecords: options.checkDnsRecords !== false,
      checkReputation: options.checkReputation !== false,
      checkTechnologies: options.checkTechnologies !== false,
      includeScreenshots: false,
      userId: req.user.id
    });

    res.json({
      success: true,
      analysis: analysis
    });

  } catch (error) {
    console.error('Error analyzing domain:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze domain'
    });
  }
});

/**
 * @route   POST /api/domain-intel/deep-scan
 * @desc    Perform comprehensive deep scan of a domain
 * @access  Private
 */
router.post('/deep-scan', [
  auth,
  domainAnalysisLimiter,
  body('domain').isLength({ min: 3 }).withMessage('Domain is required'),
  body('depth').optional().isIn(['basic', 'standard', 'comprehensive']),
  body('includeScreenshots').optional().isBoolean(),
  body('scanPorts').optional().isBoolean(),
  body('analyzeContent').optional().isBoolean(),
  body('checkVulnerabilities').optional().isBoolean()
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

    const { 
      domain, 
      depth = 'comprehensive',
      includeScreenshots = true,
      scanPorts = true,
      analyzeContent = true,
      checkVulnerabilities = true
    } = req.body;
    
    if (!domainIntelService.isValidDomain(domain)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid domain format'
      });
    }

    const scan = await domainIntelService.performDeepScan(domain, {
      depth,
      includeScreenshots,
      scanPorts,
      analyzeContent,
      checkVulnerabilities,
      userId: req.user.id
    });

    res.json({
      success: true,
      scan: scan
    });

  } catch (error) {
    console.error('Error performing deep scan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform deep scan'
    });
  }
});

/**
 * @route   GET /api/domain-intel/watched
 * @desc    Get list of watched domains
 * @access  Private
 */
router.get('/watched', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, riskLevel } = req.query;
    
    const watchedDomains = await domainIntelService.getWatchedDomains({
      userId: req.user.id,
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      riskLevel
    });

    res.json({
      success: true,
      domains: watchedDomains.data,
      pagination: {
        current: watchedDomains.page,
        total: watchedDomains.totalPages,
        count: watchedDomains.count
      }
    });

  } catch (error) {
    console.error('Error fetching watched domains:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch watched domains'
    });
  }
});

/**
 * @route   POST /api/domain-intel/watch
 * @desc    Add domain to watch list
 * @access  Private
 */
router.post('/watch', [
  auth,
  body('domain').isLength({ min: 3 }).withMessage('Domain is required'),
  body('monitoringOptions.checkInterval').optional().isInt({ min: 300 }),
  body('monitoringOptions.alertThreshold').optional().isInt({ min: 1, max: 100 })
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

    const { domain, monitoringOptions = {} } = req.body;
    
    if (!domainIntelService.isValidDomain(domain)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid domain format'
      });
    }

    const watchItem = await domainIntelService.addDomainToWatch(domain, {
      userId: req.user.id,
      checkInterval: monitoringOptions.checkInterval || 3600, // 1 hour default
      alertThreshold: monitoringOptions.alertThreshold || 70,
      monitorSubdomains: monitoringOptions.monitorSubdomains !== false,
      monitorCertificates: monitoringOptions.monitorCertificates !== false,
      monitorContent: monitoringOptions.monitorContent !== false
    });

    res.json({
      success: true,
      watchItem: watchItem,
      message: 'Domain added to watch list successfully'
    });

  } catch (error) {
    console.error('Error adding domain to watch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add domain to watch list'
    });
  }
});

/**
 * @route   DELETE /api/domain-intel/watch/:domainId
 * @desc    Remove domain from watch list
 * @access  Private
 */
router.delete('/watch/:domainId', auth, async (req, res) => {
  try {
    const { domainId } = req.params;
    
    const result = await domainIntelService.removeDomainFromWatch(domainId, req.user.id);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Domain removed from watch list'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Domain not found in watch list'
      });
    }

  } catch (error) {
    console.error('Error removing domain from watch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove domain from watch list'
    });
  }
});

/**
 * @route   GET /api/domain-intel/activity
 * @desc    Get recent domain intelligence activity
 * @access  Private
 */
router.get('/activity', auth, async (req, res) => {
  try {
    const { limit = 50, type } = req.query;
    
    const activities = await domainIntelService.getRecentActivity({
      userId: req.user.id,
      limit: parseInt(limit),
      type
    });

    res.json({
      success: true,
      activities: activities
    });

  } catch (error) {
    console.error('Error fetching domain activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch domain activity'
    });
  }
});

/**
 * @route   GET /api/domain-intel/statistics
 * @desc    Get domain intelligence statistics
 * @access  Private
 */
router.get('/statistics', auth, async (req, res) => {
  try {
    const stats = await domainIntelService.getStatistics(req.user.id);
    
    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('Error fetching domain statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

/**
 * @route   POST /api/domain-intel/bulk-analyze
 * @desc    Analyze multiple domains in bulk
 * @access  Private
 */
router.post('/bulk-analyze', [
  auth,
  domainAnalysisLimiter,
  body('domains').isArray({ min: 1, max: 100 }).withMessage('Domains must be an array (1-100 items)'),
  body('options.analysisDepth').optional().isIn(['basic', 'standard', 'comprehensive'])
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

    const { domains, options = {} } = req.body;
    
    // Validate all domains
    const invalidDomains = domains.filter(domain => !domainIntelService.isValidDomain(domain));
    if (invalidDomains.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid domain formats detected',
        invalidDomains: invalidDomains
      });
    }

    const bulkAnalysis = await domainIntelService.bulkAnalyzeDomains(domains, {
      analysisDepth: options.analysisDepth || 'standard',
      userId: req.user.id,
      maxConcurrent: 5
    });

    res.json({
      success: true,
      analysis: bulkAnalysis,
      message: `Bulk analysis completed for ${domains.length} domains`
    });

  } catch (error) {
    console.error('Error performing bulk domain analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk analysis'
    });
  }
});

/**
 * @route   POST /api/domain-intel/check-typosquatting
 * @desc    Check for typosquatting domains
 * @access  Private
 */
router.post('/check-typosquatting', [
  auth,
  body('domain').isLength({ min: 3 }).withMessage('Domain is required'),
  body('options.checkRegistered').optional().isBoolean(),
  body('options.checkSimilarity').optional().isBoolean()
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
    
    if (!domainIntelService.isValidDomain(domain)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid domain format'
      });
    }

    const typosquats = await domainIntelService.checkTyposquatting(domain, {
      checkRegistered: options.checkRegistered !== false,
      checkSimilarity: options.checkSimilarity !== false,
      similarityThreshold: options.similarityThreshold || 0.8,
      includeHomographs: options.includeHomographs !== false
    });

    res.json({
      success: true,
      typosquats: typosquats
    });

  } catch (error) {
    console.error('Error checking typosquatting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check typosquatting'
    });
  }
});

/**
 * @route   POST /api/domain-intel/check-phishing
 * @desc    Check domain for phishing indicators
 * @access  Private
 */
router.post('/check-phishing', [
  auth,
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

    const { domain } = req.body;
    
    if (!domainIntelService.isValidDomain(domain)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid domain format'
      });
    }

    const phishingCheck = await domainIntelService.checkPhishingIndicators(domain);

    res.json({
      success: true,
      phishingCheck: phishingCheck
    });

  } catch (error) {
    console.error('Error checking phishing indicators:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check phishing indicators'
    });
  }
});

/**
 * @route   GET /api/domain-intel/subdomains/:domain
 * @desc    Get subdomains for a domain
 * @access  Private
 */
router.get('/subdomains/:domain', [
  auth,
  domainAnalysisLimiter
], async (req, res) => {
  try {
    const { domain } = req.params;
    const { activeOnly = false, includeIP = true } = req.query;
    
    if (!domainIntelService.isValidDomain(domain)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid domain format'
      });
    }

    const subdomains = await domainIntelService.getSubdomains(domain, {
      activeOnly: activeOnly === 'true',
      includeIP: includeIP === 'true',
      timeout: 30000
    });

    res.json({
      success: true,
      subdomains: subdomains
    });

  } catch (error) {
    console.error('Error fetching subdomains:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subdomains'
    });
  }
});

/**
 * @route   POST /api/domain-intel/export
 * @desc    Export domain intelligence data
 * @access  Private
 */
router.post('/export', [
  auth,
  body('dataType').isIn(['analysis', 'watched', 'activity', 'all']).withMessage('Invalid data type'),
  body('format').isIn(['json', 'csv', 'pdf']).withMessage('Format must be json, csv, or pdf'),
  body('dateRange.from').optional().isISO8601(),
  body('dateRange.to').optional().isISO8601()
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

    const { dataType, format, dateRange, includeCharts = false } = req.body;
    
    const exportData = await domainIntelService.exportData({
      dataType,
      format,
      dateRange,
      includeCharts,
      userId: req.user.id
    });

    res.setHeader('Content-Type', domainIntelService.getContentType(format));
    res.setHeader('Content-Disposition', `attachment; filename="domain-intelligence.${format}"`);
    res.send(exportData);

  } catch (error) {
    console.error('Error exporting domain intelligence data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data'
    });
  }
});

module.exports = router;