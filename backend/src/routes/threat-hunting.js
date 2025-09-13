/**
 * Threat Hunting Routes
 * Advanced threat hunting and analysis endpoints
 */

const express = require('express');
const { body, query } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const ThreatHuntingService = require('../services/ThreatHuntingService');
const IOCAnalysisService = require('../services/IOCAnalysisService');
const MITREAttackService = require('../services/MITREAttackService');
const rateLimit = require('express-rate-limit');
const { validationResult } = require('express-validator');

const router = express.Router();

// Initialize services
const threatHuntingService = new ThreatHuntingService();
const iocAnalysisService = new IOCAnalysisService();
const mitreAttackService = new MITREAttackService();

// Rate limiting for threat hunting routes
const huntingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // limit each IP to 25 hunting requests per windowMs
  message: {
    success: false,
    message: 'Too many threat hunting requests, please try again later'
  }
});

/**
 * @route   GET /api/threat-hunting/hunts
 * @desc    Get active hunting operations
 * @access  Private
 */
router.get('/hunts', auth, async (req, res) => {
  try {
    const { status, type, priority, limit = 50 } = req.query;
    
    const hunts = await threatHuntingService.getActiveHunts({
      userId: req.user.id,
      status,
      type,
      priority,
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      hunts: hunts
    });

  } catch (error) {
    console.error('Error fetching threat hunts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch threat hunts'
    });
  }
});

/**
 * @route   POST /api/threat-hunting/quick-hunt
 * @desc    Start a quick threat hunt
 * @access  Private
 */
router.post('/quick-hunt', [
  auth,
  huntingLimiter,
  body('type').isIn([
    'suspicious-processes', 
    'network-anomalies', 
    'lateral-movement', 
    'persistence-mechanisms',
    'data-exfiltration',
    'privilege-escalation'
  ]).withMessage('Invalid hunt type'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('automated').optional().isBoolean()
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

    const { type, priority = 'medium', automated = true } = req.body;
    
    const hunt = await threatHuntingService.startQuickHunt({
      type,
      priority,
      automated,
      userId: req.user.id,
      configuration: threatHuntingService.getQuickHuntConfig(type)
    });

    res.json({
      success: true,
      hunt: hunt,
      message: `${type.replace('-', ' ')} hunt started successfully`
    });

  } catch (error) {
    console.error('Error starting quick hunt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start threat hunt'
    });
  }
});

/**
 * @route   POST /api/threat-hunting/ai-hunt
 * @desc    Start AI-powered threat hunt
 * @access  Private
 */
router.post('/ai-hunt', [
  auth,
  huntingLimiter,
  body('useML').optional().isBoolean(),
  body('analyzePatterns').optional().isBoolean(),
  body('checkBehaviors').optional().isBoolean(),
  body('correlateEvents').optional().isBoolean()
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
      useML = true,
      analyzePatterns = true,
      checkBehaviors = true,
      correlateEvents = true
    } = req.body;
    
    const hunt = await threatHuntingService.startAIHunt({
      useML,
      analyzePatterns,
      checkBehaviors,
      correlateEvents,
      userId: req.user.id,
      aiConfiguration: {
        confidenceThreshold: 0.7,
        maxResults: 1000,
        timeWindow: '24h',
        enableDeepLearning: true
      }
    });

    res.json({
      success: true,
      hunt: hunt,
      message: 'AI-powered threat hunt initiated'
    });

  } catch (error) {
    console.error('Error starting AI hunt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start AI threat hunt'
    });
  }
});

/**
 * @route   POST /api/threat-hunting/custom-hunt
 * @desc    Start custom threat hunt with specific parameters
 * @access  Private
 */
router.post('/custom-hunt', [
  auth,
  huntingLimiter,
  body('name').isLength({ min: 3, max: 100 }).withMessage('Hunt name must be 3-100 characters'),
  body('huntQueries').isArray({ min: 1 }).withMessage('At least one hunt query is required'),
  body('timeRange').isObject().withMessage('Time range is required'),
  body('dataSources').isArray().withMessage('Data sources must be an array')
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
      name,
      huntQueries,
      timeRange,
      dataSources,
      priority = 'medium',
      description = '',
      tags = []
    } = req.body;
    
    const hunt = await threatHuntingService.startCustomHunt({
      name,
      huntQueries,
      timeRange,
      dataSources,
      priority,
      description,
      tags,
      userId: req.user.id
    });

    res.json({
      success: true,
      hunt: hunt,
      message: 'Custom threat hunt started successfully'
    });

  } catch (error) {
    console.error('Error starting custom hunt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start custom threat hunt'
    });
  }
});

/**
 * @route   POST /api/threat-hunting/analyze-ioc
 * @desc    Analyze Indicator of Compromise
 * @access  Private
 */
router.post('/analyze-ioc', [
  auth,
  body('ioc').isLength({ min: 3 }).withMessage('IOC is required'),
  body('type').optional().isIn(['auto', 'ip', 'domain', 'url', 'hash', 'email']),
  body('sources').optional().isArray()
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
      ioc, 
      type = 'auto', 
      sources = ['virustotal', 'alienvault', 'threatcrowd', 'hybrid-analysis']
    } = req.body;
    
    const analysis = await iocAnalysisService.analyzeIOC({
      ioc,
      type,
      sources,
      enrichment: true,
      contextualAnalysis: true
    });

    res.json({
      success: true,
      analysis: analysis
    });

  } catch (error) {
    console.error('Error analyzing IOC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze IOC'
    });
  }
});

/**
 * @route   GET /api/threat-hunting/iocs
 * @desc    Get threat indicators and IOCs
 * @access  Private
 */
router.get('/iocs', auth, async (req, res) => {
  try {
    const { 
      type, 
      severity, 
      confidence, 
      detected = null,
      limit = 100,
      page = 1
    } = req.query;
    
    const iocs = await iocAnalysisService.getIOCs({
      type,
      severity,
      confidence: confidence ? parseFloat(confidence) : null,
      detected: detected === 'true' ? true : detected === 'false' ? false : null,
      limit: parseInt(limit),
      page: parseInt(page),
      userId: req.user.id
    });

    res.json({
      success: true,
      iocs: iocs.data,
      pagination: {
        current: iocs.page,
        total: iocs.totalPages,
        count: iocs.count
      }
    });

  } catch (error) {
    console.error('Error fetching IOCs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IOCs'
    });
  }
});

/**
 * @route   GET /api/threat-hunting/intelligence-feed
 * @desc    Get threat intelligence feed
 * @access  Private
 */
router.get('/intelligence-feed', auth, async (req, res) => {
  try {
    const { 
      source, 
      severity, 
      category,
      limit = 50,
      hours = 24
    } = req.query;
    
    const intelligence = await threatHuntingService.getThreatIntelligenceFeed({
      source,
      severity,
      category,
      limit: parseInt(limit),
      timeWindow: `${hours}h`
    });

    res.json({
      success: true,
      intelligence: intelligence
    });

  } catch (error) {
    console.error('Error fetching threat intelligence feed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch threat intelligence feed'
    });
  }
});

/**
 * @route   GET /api/threat-hunting/mitre-techniques
 * @desc    Get MITRE ATT&CK techniques and mappings
 * @access  Private
 */
router.get('/mitre-techniques', auth, async (req, res) => {
  try {
    const { 
      tactic, 
      platform, 
      searchTerm,
      includeDetection = true
    } = req.query;
    
    const techniques = await mitreAttackService.getTechniques({
      tactic,
      platform,
      searchTerm,
      includeDetection: includeDetection === 'true'
    });

    res.json({
      success: true,
      techniques: techniques
    });

  } catch (error) {
    console.error('Error fetching MITRE techniques:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch MITRE techniques'
    });
  }
});

/**
 * @route   POST /api/threat-hunting/map-to-mitre
 * @desc    Map hunting results to MITRE ATT&CK framework
 * @access  Private
 */
router.post('/map-to-mitre', [
  auth,
  body('huntResults').isArray().withMessage('Hunt results must be an array'),
  body('confidence').optional().isFloat({ min: 0, max: 1 })
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

    const { huntResults, confidence = 0.5 } = req.body;
    
    const mapping = await mitreAttackService.mapToMITRE({
      huntResults,
      confidence,
      includeContext: true,
      generateReport: true
    });

    res.json({
      success: true,
      mapping: mapping
    });

  } catch (error) {
    console.error('Error mapping to MITRE:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to map to MITRE framework'
    });
  }
});

/**
 * @route   GET /api/threat-hunting/hunt/:huntId
 * @desc    Get specific hunt details
 * @access  Private
 */
router.get('/hunt/:huntId', auth, async (req, res) => {
  try {
    const { huntId } = req.params;
    const { includeResults = true } = req.query;
    
    const hunt = await threatHuntingService.getHuntDetails(huntId, {
      userId: req.user.id,
      includeResults: includeResults === 'true'
    });

    if (!hunt) {
      return res.status(404).json({
        success: false,
        message: 'Hunt not found'
      });
    }

    res.json({
      success: true,
      hunt: hunt
    });

  } catch (error) {
    console.error('Error fetching hunt details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hunt details'
    });
  }
});

/**
 * @route   POST /api/threat-hunting/hunt/:huntId/pause
 * @desc    Pause a running hunt
 * @access  Private
 */
router.post('/hunt/:huntId/pause', auth, async (req, res) => {
  try {
    const { huntId } = req.params;
    
    const result = await threatHuntingService.pauseHunt(huntId, req.user.id);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Hunt paused successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('Error pausing hunt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pause hunt'
    });
  }
});

/**
 * @route   POST /api/threat-hunting/hunt/:huntId/stop
 * @desc    Stop a running hunt
 * @access  Private
 */
router.post('/hunt/:huntId/stop', auth, async (req, res) => {
  try {
    const { huntId } = req.params;
    
    const result = await threatHuntingService.stopHunt(huntId, req.user.id);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Hunt stopped successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('Error stopping hunt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop hunt'
    });
  }
});

/**
 * @route   POST /api/threat-hunting/behavioral-analysis
 * @desc    Perform behavioral analysis for threat detection
 * @access  Private
 */
router.post('/behavioral-analysis', [
  auth,
  huntingLimiter,
  body('targetEntity').isLength({ min: 3 }).withMessage('Target entity is required'),
  body('entityType').isIn(['user', 'host', 'process', 'network']).withMessage('Invalid entity type'),
  body('timeWindow').isLength({ min: 2 }).withMessage('Time window is required')
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
      targetEntity, 
      entityType, 
      timeWindow,
      baselineWindow = '30d',
      anomalyThreshold = 0.8
    } = req.body;
    
    const analysis = await threatHuntingService.performBehavioralAnalysis({
      targetEntity,
      entityType,
      timeWindow,
      baselineWindow,
      anomalyThreshold,
      userId: req.user.id
    });

    res.json({
      success: true,
      analysis: analysis
    });

  } catch (error) {
    console.error('Error performing behavioral analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform behavioral analysis'
    });
  }
});

/**
 * @route   GET /api/threat-hunting/statistics
 * @desc    Get threat hunting statistics
 * @access  Private
 */
router.get('/statistics', auth, async (req, res) => {
  try {
    const stats = await threatHuntingService.getStatistics(req.user.id);
    
    res.json({
      success: true,
      statistics: stats
    });

  } catch (error) {
    console.error('Error fetching threat hunting statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

/**
 * @route   POST /api/threat-hunting/export
 * @desc    Export threat hunting data
 * @access  Private
 */
router.post('/export', [
  auth,
  body('dataType').isIn(['hunts', 'iocs', 'intelligence', 'mitre-mapping']).withMessage('Invalid data type'),
  body('format').isIn(['json', 'csv', 'stix', 'pdf']).withMessage('Invalid format'),
  body('huntIds').optional().isArray()
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

    const { dataType, format, huntIds, dateRange } = req.body;
    
    const exportData = await threatHuntingService.exportData({
      dataType,
      format,
      huntIds,
      dateRange,
      userId: req.user.id
    });

    res.setHeader('Content-Type', threatHuntingService.getContentType(format));
    res.setHeader('Content-Disposition', `attachment; filename="threat-hunting-${dataType}.${format}"`);
    res.send(exportData);

  } catch (error) {
    console.error('Error exporting threat hunting data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data'
    });
  }
});

module.exports = router;