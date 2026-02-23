/**
 * Agent Control Routes
 * API endpoints for managing agents and tasks
 */

const express = require('express');
const router = express.Router();
const { agentManager } = require('../agent/AgentManager');
const { appwriteService } = require('../services/appwriteService');
const { webScraperAPIService } = require('../services/WebScraperAPIService');
const { mlServiceClient } = require('../services/mlServiceClient');
const logger = require('../utils/logger');

/**
 * Start an agent
 * POST /api/agent/start
 */
router.post('/start', async (req, res) => {
  try {
    const { userId, agentName = 'default', config = {} } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const agent = await agentManager.startAgent({
      userId,
      agentName,
      ...config
    });

    res.json({
      success: true,
      message: 'Agent started successfully',
      data: {
        agentName,
        agentId: agent.agentId,
        deviceId: agent.deviceId,
        state: agent.state
      }
    });

  } catch (error) {
    logger.error('Failed to start agent:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Stop an agent
 * POST /api/agent/stop
 */
router.post('/stop', async (req, res) => {
  try {
    const { agentName = 'default' } = req.body;

    await agentManager.stopAgent(agentName);

    res.json({
      success: true,
      message: 'Agent stopped successfully',
      data: { agentName }
    });

  } catch (error) {
    logger.error('Failed to stop agent:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get agent status
 * GET /api/agent/status/:agentName
 */
router.get('/status/:agentName?', (req, res) => {
  try {
    const agentName = req.params.agentName || 'default';

    const status = agentManager.getAgentStatus(agentName);

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Failed to get agent status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * List all agents
 * GET /api/agent/list
 */
router.get('/list', (req, res) => {
  try {
    const agents = agentManager.listAgents();

    res.json({
      success: true,
      data: {
        count: agents.length,
        agents
      }
    });

  } catch (error) {
    logger.error('Failed to list agents:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Create a task for an agent
 * POST /api/agent/task/create
 */
router.post('/task/create', async (req, res) => {
  try {
    const { agentId, userId, taskType, targetUrl, priority, parameters } = req.body;

    if (!agentId || !userId || !taskType || !targetUrl) {
      return res.status(400).json({
        success: false,
        error: 'agentId, userId, taskType, and targetUrl are required'
      });
    }

    const task = await appwriteService.createAgentTask({
      agentId,
      userId,
      taskType,
      targetUrl,
      priority: priority || 'normal',
      parameters: parameters || {}
    });

    res.json({
      success: true,
      message: 'Task created successfully',
      data: {
        taskId: task.$id,
        status: task.status,
        createdAt: task.createdAt
      }
    });

  } catch (error) {
    logger.error('Failed to create task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get task status
 * GET /api/agent/task/:taskId
 */
router.get('/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    // Get task from Appwrite using service method
    const task = await appwriteService.getTask(taskId);

    res.json({
      success: true,
      data: task
    });

  } catch (error) {
    logger.error('Failed to get task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * List alerts for a user
 * GET /api/agent/alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const { userId, severity, status, limit } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const filters = {};
    if (severity) filters.severity = severity;
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit, 10);

    const alerts = await appwriteService.listAlerts(userId, filters);

    res.json({
      success: true,
      data: {
        count: alerts.length,
        alerts
      }
    });

  } catch (error) {
    logger.error('Failed to list alerts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== BROWSER INTELLIGENCE ====================

/**
 * Save browser intelligence snapshot from desktop agent
 * POST /api/agent/browser-intelligence
 */
router.post('/browser-intelligence', async (req, res) => {
  try {
    const {
      userId,
      deviceId,
      os,
      osDisplay,
      defaultBrowser,
      browsers,
      scanTimestamp
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    if (!browsers || !Array.isArray(browsers)) {
      return res.status(400).json({
        success: false,
        error: 'browsers array is required'
      });
    }

    const result = await appwriteService.saveBrowserIntelligence({
      userId,
      deviceId,
      os,
      osDisplay,
      defaultBrowser,
      browsers,
      scanTimestamp
    });

    res.json({
      success: true,
      message: 'Browser intelligence saved',
      data: {
        documentId: result.$id,
        installedCount: browsers.filter(b => b.isInstalled).length,
        runningCount: browsers.filter(b => b.isRunning).length
      }
    });

  } catch (error) {
    logger.error('Failed to save browser intelligence:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get browser intelligence history for a user
 * GET /api/agent/browser-intelligence?userId=xxx&limit=20
 */
router.get('/browser-intelligence', async (req, res) => {
  try {
    const { userId, limit } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const snapshots = await appwriteService.listBrowserIntelligence(
      userId,
      limit ? parseInt(limit, 10) : 20
    );

    res.json({
      success: true,
      data: {
        count: snapshots.length,
        snapshots
      }
    });

  } catch (error) {
    logger.error('Failed to list browser intelligence:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Direct URL scan — real-time pipeline
 * Scrapes → Analyses → ML Classification → Gemini Explanation → Returns immediately
 * POST /api/agent/scan-url
 *
 * This is the endpoint the desktop app's URL monitor calls for every new URL
 * the user visits. No auth required (same as task/create) so the floating agent
 * can call it without a login token.
 */
router.post('/scan-url', async (req, res) => {
  try {
    const { url, browser, pageTitle, userId, agentId } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'url is required' });
    }

    logger.info(`🌐 Real-time URL scan requested: ${url} (browser: ${browser || 'unknown'})`);

    // ── Step 1: Web Scraper ──────────────────────────────────────────
    const scraperStart = Date.now();
    const scrapedData = await webScraperAPIService.scrapeWebsite(url);
    const scraperDuration = Date.now() - scraperStart;

    if (!scrapedData.success) {
      logger.warn(`⚠️ Scraper failed for ${url}: ${scrapedData.error}`);
      return res.json({
        success: true,
        data: {
          url,
          scraperSuccess: false,
          scraperError: scrapedData.error,
          riskScore: 0,
          riskLevel: 'unknown',
          category: 'unreachable',
          summary: `Could not scrape ${url}: ${scrapedData.error}`,
          recommendations: ['Verify the URL is correct and accessible'],
          scraperDuration
        }
      });
    }

    // ── Step 2: Format for analysis ──────────────────────────────────
    const analysisData = webScraperAPIService.formatForAIAnalysis(scrapedData);
    const aiContext = webScraperAPIService.generateAIContext(analysisData);

    logger.info(`📊 Scraper risk score for ${url}: ${analysisData.risk_score}/100 (${analysisData.risk_level})`);

    // ── Step 3: ML Classification ────────────────────────────────────
    let mlOutput;
    const mlStart = Date.now();
    try {
      mlOutput = await mlServiceClient.classifyThreat(analysisData);
      logger.info(`🤖 ML classification for ${url}: ${mlOutput.category} (score: ${mlOutput.riskScore}, confidence: ${mlOutput.confidence})`);
    } catch (mlErr) {
      logger.warn(`⚠️ ML classification failed for ${url}: ${mlErr.message}`);
      mlOutput = mlServiceClient.fallbackClassification(analysisData);
    }
    const mlDuration = Date.now() - mlStart;

    // ── Step 4: Gemini Explanation ────────────────────────────────────
    let geminiExplanation;
    const geminiStart = Date.now();
    try {
      geminiExplanation = await mlServiceClient.getExplanation(mlOutput);
      logger.info(`💡 Gemini explanation generated for ${url}`);
    } catch (geminiErr) {
      logger.warn(`⚠️ Gemini explanation failed for ${url}: ${geminiErr.message}`);
      geminiExplanation = {
        summary: `${mlOutput.category} threat detected (${Math.round(mlOutput.confidence * 100)}% confidence)`,
        recommendations: ['Block suspicious activity', 'Enable security headers', 'Monitor for similar patterns'],
        technicalDetails: 'Detailed analysis unavailable'
      };
    }
    const geminiDuration = Date.now() - geminiStart;

    // ── Step 5: Store evidence + create alert if needed ──────────────
    let alertCreated = false;
    try {
      if (mlOutput.riskScore >= 30 && userId) {
        await appwriteService.createAlert({
          userId,
          deviceId: 'desktop',
          severity: mlOutput.riskScore >= 70 ? 'critical' : mlOutput.riskScore >= 50 ? 'high' : 'medium',
          source: 'scraper',
          description: `[${mlOutput.category}] ${geminiExplanation.summary || ''} — ${url}`.substring(0, 4096),
          evidence: [
            `URL: ${url}`,
            `Category: ${mlOutput.category}`,
            `Browser: ${browser || 'unknown'}`,
            ...(geminiExplanation.recommendations || []).slice(0, 2)
          ],
          confidence: mlOutput.confidence || 0.5,
          riskScore: mlOutput.riskScore
        });
        alertCreated = true;
        logger.info(`🚨 Alert created for ${url}`);
      }
    } catch (alertErr) {
      logger.warn(`⚠️ Alert creation failed: ${alertErr.message}`);
    }

    // ── Return full results to desktop app ───────────────────────────
    res.json({
      success: true,
      data: {
        url,
        browser: browser || 'unknown',
        pageTitle: pageTitle || '',

        // Scraper results
        scraperSuccess: true,
        scraperDuration,
        securitySummary: analysisData.security_summary,
        networkSummary: analysisData.network_summary,
        performance: analysisData.performance,
        missingHeaders: analysisData.missing_headers,
        suspiciousRequests: analysisData.suspicious_requests,
        externalDomains: analysisData.external_domains,

        // ML classification
        riskScore: mlOutput.riskScore,
        riskLevel: analysisData.risk_level,
        category: mlOutput.category,
        confidence: mlOutput.confidence,
        indicators: mlOutput.indicators,
        mlDuration,

        // Gemini analysis
        summary: geminiExplanation.summary,
        recommendations: geminiExplanation.recommendations,
        technicalDetails: geminiExplanation.technicalDetails,
        geminiDuration,

        // Alert
        alertCreated,

        // Full AI context (for the floating agent panel)
        formattedReport: aiContext,

        scannedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error(`❌ URL scan failed:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
