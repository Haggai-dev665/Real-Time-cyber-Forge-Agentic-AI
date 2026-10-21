/**
 * Agent Control Routes
 * API endpoints for managing agents and tasks
 */

const express = require('express');
const { verifiedUser } = require('../middleware/verifiedUser');
const router = express.Router();

// Every route below requires a signed-in user, and takes the user's identity
// from the session rather than from the request.
router.use(verifiedUser);
const { analysisQuota } = require('../middleware/analysisQuota');
const { agentManager } = require('../agent/AgentManager');
const { appwriteService } = require('../services/appwriteService');
const { requireWorkspace } = require('../middleware/workspace');
const alertDecisions = require('../services/alertDecisionService');
const { webScraperAPIService } = require('../services/WebScraperAPIService');
const { mlServiceClient } = require('../services/mlServiceClient');
const realtimeBus = require('../services/realtimeBus');
const logger = require('../utils/logger');

// The hosting platform ends a request after 30 seconds, and the chat model
// alone can take that long. A scan therefore answers inside a budget: the
// rendered-page scan gets a share of it, the explanation gets what is left,
// and whatever has not finished is reported as missing instead of awaited.
const scanBudgetMs = () => Number(process.env.SCAN_BUDGET_MS) || 24000;
const pageScanShareMs = () => Math.min(11000, Math.round(scanBudgetMs() * 0.45));

/**
 * The explanation for a scan, if the chat model answers within `budgetMs`.
 * A late answer is not thrown away: `whenLate` receives it, and the caller
 * publishes it to the owner's live feed. A failed explanation never fails the
 * scan; the detection models' result stands on its own.
 */
async function explainWithinBudget(mlOutput, analysisData, budgetMs, whenLate) {
  if (budgetMs < 2000) return mlServiceClient.unavailableExplanation('unavailable');
  const pending = Promise.resolve().then(() => mlServiceClient.getExplanation(mlOutput, analysisData));
  let timer;
  const outOfTime = new Promise(resolve => { timer = setTimeout(() => resolve(null), budgetMs); });
  try {
    const explanation = await Promise.race([pending, outOfTime]);
    if (explanation) return explanation;
  } catch (error) {
    logger.warn(`⚠️ Explanation failed: ${error.message}`);
    return mlServiceClient.unavailableExplanation('unavailable');
  } finally {
    clearTimeout(timer);
  }
  pending.then(explanation => { if (explanation) whenLate(explanation); })
    .catch(error => logger.warn(`⚠️ Late explanation failed: ${error.message}`));
  return mlServiceClient.unavailableExplanation('pending');
}

const explanationStatus = explanation => (explanation.available === false ? explanation.status : 'complete');

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

    await agentManager.stopAgent(agentName, req.user.userId);

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

    const status = agentManager.getAgentStatus(agentName, req.user.userId);

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
    const agents = agentManager.listAgents(req.user.userId);

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

    // A task can only be queued for an agent that belongs to the signed-in
    // account. Another account's agent is reported exactly like a missing one.
    const agent = await appwriteService.getAgent(agentId).catch(() => null);
    if (!agent || String(agent.user_id) !== String(req.user.userId)) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
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

    // Another account's task is reported exactly like a missing one.
    const task = await appwriteService.getTask(taskId).catch(error => {
      if (error?.code === 404) return null;
      throw error;
    });
    if (!task || String(task.user_id) !== String(req.user.userId)) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

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
/**
 * PUT /api/agent/alerts/:alertId/state { action, note } — the alert workflow
 * (DET-02): acknowledge, escalate, resolve, false_positive, reopen. Checked
 * against the current state, kept with its history, audited.
 */
router.put('/alerts/:alertId/state', requireWorkspace, async (req, res) => {
  try {
    const { action, note } = req.body || {};
    res.json({ success: true, data: await alertDecisions.transition(req.user, req.params.alertId, action, note, req) });
  } catch (error) {
    if (error instanceof alertDecisions.AlertDecisionError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    logger.error('alert state change failed:', error);
    res.status(500).json({ success: false, message: 'Failed to change the alert' });
  }
});

router.get('/alerts', requireWorkspace, async (req, res) => {
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

    // each with the state people decided for it (DET-02)
    const alerts = await alertDecisions.applyDecisions(req.user, await appwriteService.listAlerts(userId, filters));

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

/**
 * Unified agent activity feed for the desktop Agent Core screen.
 * GET /api/agent/activity?userId=...
 *
 * Aggregates the agent roster + recent alerts into the shape the new desktop
 * app's Agent Core needs in one call: session counters (actions / resolved /
 * critical / tools / agents) and a reasoning-console-style activity list.
 */
router.get('/activity', async (req, res) => {
  try {
    const { userId } = req.query;

    let agents = [];
    try { agents = agentManager.listAgents(req.user.userId) || []; } catch (e) { agents = []; }

    let alerts = [];
    if (userId) {
      try { alerts = await appwriteService.listAlerts(userId, { limit: 25 }); } catch (e) { alerts = []; }
    }

    const norm = (s) => String(s || '').toLowerCase();
    const resolved = alerts.filter(a => ['resolved', 'dismissed'].includes(norm(a.status))).length;
    const critical = alerts.filter(a => norm(a.severity) === 'critical').length;

    // Map alerts -> reasoning-console lines (THINK/ACTION/OBSERVE/ALERT).
    const activity = alerts.slice(0, 20).map(a => {
      const sev = norm(a.severity) || 'info';
      const isResolved = ['resolved', 'dismissed'].includes(norm(a.status));
      const kind = (sev === 'critical' || sev === 'high') ? 'warn' : (isResolved ? 'obs' : 'act');
      return {
        type: kind,
        tag: sev === 'critical' ? 'ALERT' : (kind === 'obs' ? 'OBSERVE' : 'ACTION'),
        message: a.description || a.source || 'agent event',
        severity: sev,
        riskScore: a.riskScore || 0,
        ts: a.createdAt || a.$createdAt || new Date().toISOString()
      };
    });

    res.json({
      success: true,
      data: {
        session: {
          actions: alerts.length,
          resolved,
          critical,
          tools: 6,
          agents: (agents.length || 0) + 1
        },
        activity,
        agents: agents.map(a => ({
          name: a.name || a.agentName || 'agent',
          status: a.status || (a.isRunning ? 'running' : 'idle')
        }))
      }
    });
  } catch (error) {
    logger.error('Failed to build agent activity:', error);
    res.status(500).json({ success: false, error: error.message });
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
 * the user visits. It requires a signed-in user, like every route in this file.
 */
router.post('/scan-url', analysisQuota(), async (req, res) => {
  try {
    const { url, browser, pageTitle, userId, agentId, sessionId } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'url is required' });
    }

    logger.info(`🌐 Real-time URL scan requested: ${url} (browser: ${browser || 'unknown'})`);

    // ── Step 1: Rendered-page scan ───────────────────────────────────
    // The scanner is one source of evidence. When it is unavailable the scan
    // goes on with the URL models and reports the gap; it never stops with a
    // zero score, and never calls the page clean.
    const scanStart = Date.now();
    const timeLeft = () => scanBudgetMs() - (Date.now() - scanStart);
    const scraperStart = Date.now();
    const scrapedData = await webScraperAPIService.scrapeWebsite(url, { budgetMs: pageScanShareMs() });
    const scraperDuration = Date.now() - scraperStart;
    if (!scrapedData.success) {
      logger.warn(`⚠️ Rendered-page evidence unavailable (${scrapedData.error_code}): ${scrapedData.error}`);
    }

    // ── Step 2: Format for analysis ──────────────────────────────────
    const analysisData = webScraperAPIService.formatForAIAnalysis(scrapedData);
    const aiContext = webScraperAPIService.generateAIContext(analysisData);

    logger.info(`📊 Page evidence: ${analysisData.evidence_status}; ${analysisData.signals.length} signal(s); evidence score ${analysisData.risk_score === null ? 'none' : analysisData.risk_score}`);

    // ── Step 3: ML Classification (no fallback — real HF ML models) ─
    const mlStart = Date.now();
    const mlOutput = await mlServiceClient.classifyThreat(analysisData);
    logger.info(`🤖 ML classification for ${url}: ${mlOutput.category} (score: ${mlOutput.riskScore}, confidence: ${mlOutput.confidence})`);
    const mlDuration = Date.now() - mlStart;

    // ── Step 4: Explanation, within what is left of the time budget ──
    const geminiStart = Date.now();
    const geminiExplanation = await explainWithinBudget(mlOutput, analysisData, timeLeft() - 1500, late => {
      realtimeBus.emit('scan:explanation', {
        userId: userId || null, url,
        summary: late.summary, fullAnalysis: late.fullAnalysis,
        recommendations: late.recommendations, modelUsed: late.modelUsed,
        scannedAt: new Date().toISOString()
      });
    });
    logger.info(`💡 Explanation for ${url}: ${explanationStatus(geminiExplanation)}`);
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
          description: `[${mlOutput.category}] ${geminiExplanation.available === false ? '' : geminiExplanation.summary || ''} — ${url}`.substring(0, 4096),
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

    // ── Push this scan to every live dashboard over SSE (real-time) ──
    // A low score is only a clean result when the page was actually observed.
    const verdict = mlOutput.riskScore >= 70 ? 'malicious'
      : mlOutput.riskScore >= 40 ? 'suspicious'
      : analysisData.evidence_status === 'complete' ? 'safe' : 'unknown';
    realtimeBus.emit('scan:update', {
      url,
      browser: browser || 'unknown',
      userId: userId || null,
      riskScore: mlOutput.riskScore,
      riskLevel: analysisData.risk_level,
      category: mlOutput.category,
      confidence: mlOutput.confidence,
      verdict,
      summary: geminiExplanation.summary,
      scannedAt: new Date().toISOString()
    });
    realtimeBus.emit('agent:activity', {
      type: 'scan', url, verdict, riskScore: mlOutput.riskScore,
      userId: userId || null, ts: Date.now()
    });
    if (mlOutput.riskScore >= 40) {
      realtimeBus.emit('alert:new', {
        userId: userId || null, url, verdict,
        severity: verdict === 'malicious' ? 'high' : 'medium',
        riskScore: mlOutput.riskScore, category: mlOutput.category,
        message: `${verdict.toUpperCase()} URL detected (${mlOutput.riskScore})`,
        scannedAt: new Date().toISOString()
      });
      realtimeBus.emit('threat:new', {
        userId: userId || null, indicator: url, type: 'url',
        severity: verdict === 'malicious' ? 'high' : 'medium',
        riskScore: mlOutput.riskScore, category: mlOutput.category, source: 'agent-scan'
      });
    }

    // ── Return full results to desktop app ───────────────────────────
    res.json({
      success: true,
      data: {
        url,
        browser: browser || 'unknown',
        pageTitle: pageTitle || '',
        sessionId: sessionId || null,

        // Rendered-page evidence. `scraperSuccess` is whether the scanner
        // returned a scan; `evidenceStatus` is how much of the page it covers.
        scraperSuccess: scrapedData.success,
        scraperError: scrapedData.success ? null : scrapedData.error,
        scraperErrorCode: scrapedData.error_code,
        scraperDuration,
        scanId: analysisData.scan_id,
        verdict,
        evidenceStatus: analysisData.evidence_status,
        coverage: analysisData.coverage,
        coverageGaps: analysisData.coverage_gaps,
        signals: analysisData.signals,
        evidenceScore: analysisData.risk_score,
        finalUrl: analysisData.final_url || null,
        forms: analysisData.forms || [],
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
        modelPredictions: mlOutput.modelPredictions,
        mlDuration,

        // Explanation from the chat model. `explanationStatus` is 'complete',
        // 'pending' (it will follow as a scan:explanation event) or 'unavailable'.
        explanationStatus: explanationStatus(geminiExplanation),
        summary: geminiExplanation.summary,
        fullAnalysis: geminiExplanation.fullAnalysis,
        recommendations: geminiExplanation.recommendations,
        technicalDetails: geminiExplanation.technicalDetails,
        geminiRiskScore: geminiExplanation.geminiRiskScore,
        geminiConfidence: geminiExplanation.geminiConfidence,
        modelUsed: geminiExplanation.modelUsed,
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

/**
 * Batch URL scan — run /scan-url logic for multiple URLs concurrently.
 * POST /api/agent/scan-url/batch
 * Body: { urls: string[], browser?: string, userId?: string, sessionId?: string, concurrency?: number }
 * Returns: { success: true, results: Array<{ url, success, data?, error? }>, completedAt }
 *
 * Concurrency is capped at 5 to avoid flooding the HF Space.
 */
router.post('/scan-url/batch', analysisQuota(req => (Array.isArray(req.body && req.body.urls) ? Math.min(req.body.urls.length, 20) : 1)), async (req, res) => {
  try {
    const { urls, browser, userId, sessionId, concurrency = 3 } = req.body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ success: false, error: 'urls array is required and must not be empty' });
    }
    if (urls.length > 20) {
      return res.status(400).json({ success: false, error: 'Maximum 20 URLs per batch' });
    }

    const cap = Math.max(1, Math.min(5, concurrency));
    logger.info(`📦 Batch URL scan: ${urls.length} URLs, concurrency=${cap}, userId=${userId || 'anon'}`);

    // Process URLs in chunks to respect concurrency cap. The whole batch shares
    // one time budget: a URL that cannot be started in time is reported as not
    // scanned, and explanations are only waited for while time remains.
    const batchStart = Date.now();
    const timeLeft = () => scanBudgetMs() - (Date.now() - batchStart);
    const results = [];
    for (let i = 0; i < urls.length; i += cap) {
      const chunk = urls.slice(i, i + cap);
      const chunksLeft = Math.ceil((urls.length - i) / cap);
      const chunkShare = timeLeft() / chunksLeft;
      const chunkResults = await Promise.all(chunk.map(async (url) => {
        if (timeLeft() < 1500) {
          return { url, success: false, error: 'Not scanned: the batch ran out of time. Send fewer URLs per request.' };
        }
        try {
          // As in /scan-url: a scanner failure is reported as missing coverage,
          // and the URL is still classified by the URL models.
          const scrapedData = await webScraperAPIService.scrapeWebsite(url, { budgetMs: Math.max(1000, Math.min(pageScanShareMs(), chunkShare * 0.5)) });
          const analysisData = webScraperAPIService.formatForAIAnalysis(scrapedData);
          const mlOutput = await mlServiceClient.classifyThreat(analysisData);
          const geminiExplanation = await explainWithinBudget(mlOutput, analysisData, Math.min(timeLeft() - 1500, chunkShare * 0.5), late => {
            realtimeBus.emit('scan:explanation', {
              userId: userId || null, url, summary: late.summary, fullAnalysis: late.fullAnalysis,
              recommendations: late.recommendations, modelUsed: late.modelUsed, scannedAt: new Date().toISOString()
            });
          });

          let alertCreated = false;
          try {
            if (mlOutput.riskScore >= 30 && userId) {
              await appwriteService.createAlert({
                userId,
                deviceId: 'desktop',
                severity: mlOutput.riskScore >= 70 ? 'critical' : mlOutput.riskScore >= 50 ? 'high' : 'medium',
                source: 'batch-scan',
                description: `[${mlOutput.category}] ${geminiExplanation.available === false ? '' : geminiExplanation.summary || ''} — ${url}`.substring(0, 4096),
                evidence: [`URL: ${url}`, `Category: ${mlOutput.category}`, ...(geminiExplanation.recommendations || []).slice(0, 2)],
                confidence: mlOutput.confidence || 0.5,
                riskScore: mlOutput.riskScore
              });
              alertCreated = true;
            }
          } catch (_) { /* non-fatal */ }

          return {
            url,
            success: true,
            data: {
              riskScore: mlOutput.riskScore,
              riskLevel: analysisData.risk_level,
              category: mlOutput.category,
              confidence: mlOutput.confidence,
              verdict: mlOutput.riskScore >= 70 ? 'malicious'
                : mlOutput.riskScore >= 40 ? 'suspicious'
                : analysisData.evidence_status === 'complete' ? 'safe' : 'unknown',
              scraperSuccess: scrapedData.success,
              scraperError: scrapedData.success ? null : scrapedData.error,
              evidenceStatus: analysisData.evidence_status,
              coverageGaps: analysisData.coverage_gaps,
              signals: analysisData.signals.map(signal => ({ id: signal.id, severity: signal.severity, title: signal.title })),
              explanationStatus: explanationStatus(geminiExplanation),
              summary: geminiExplanation.summary,
              recommendations: geminiExplanation.recommendations,
              modelPredictions: mlOutput.modelPredictions,
              alertCreated,
              sessionId: sessionId || null,
              scannedAt: new Date().toISOString()
            }
          };
        } catch (err) {
          logger.warn(`⚠️ Batch scan failed for ${url}: ${err.message}`);
          return { url, success: false, error: err.message };
        }
      }));
      results.push(...chunkResults);
    }

    res.json({
      success: true,
      count: results.length,
      results,
      completedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Batch URL scan failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
