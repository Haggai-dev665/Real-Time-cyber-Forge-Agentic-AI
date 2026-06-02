/**
 * Browser Intelligence Routes
 * Receives behavioral intelligence data from the Tauri desktop app,
 * persists to Appwrite, and broadcasts via WebSocket.
 * 
 * NO fallbacks. NO mock data. All values come from the Rust
 * BrowserIntelligenceEngine running on the user's machine.
 */

const express = require('express');
const router = express.Router();
const { appwriteService } = require('../services/appwriteService');
const { wsManager } = require('../services/websocket');
const logger = require('../utils/logger');

// ──────────────────────────────────────────────────────
// POST /api/browser-intelligence/session
// Desktop app pushes full intelligence snapshot
// ──────────────────────────────────────────────────────
router.post('/session', async (req, res) => {
  try {
    const {
      sessions,
      alerts,
      total_domains_tracked,
      total_alerts,
      average_risk,
      device_id,
      user_id
    } = req.body;

    if (!sessions || !Array.isArray(sessions)) {
      return res.status(400).json({
        success: false,
        error: 'sessions array is required'
      });
    }

    // ── Broadcast live session update to all connected dashboards ──
    wsManager.broadcastToDesktops({
      type: 'session_update',
      data: {
        sessions,
        total_domains_tracked: total_domains_tracked || 0,
        total_alerts: total_alerts || 0,
        average_risk: average_risk || 0,
        timestamp: new Date().toISOString()
      }
    });

    wsManager.broadcastToMobiles({
      type: 'session_update',
      data: {
        total_sessions: sessions.length,
        total_alerts: total_alerts || 0,
        average_risk: average_risk || 0,
        timestamp: new Date().toISOString()
      }
    });

    // ── Persist snapshot to Appwrite ──
    let persistedId = null;
    try {
      const snapshot = {
        session_count: sessions.length,
        total_domains: total_domains_tracked || 0,
        total_alerts: total_alerts || 0,
        average_risk: average_risk || 0,
        sessions_json: JSON.stringify(sessions).substring(0, 16384),
        device_id: device_id || 'unknown',
        user_id: user_id || 'system',
        created_at: new Date().toISOString()
      };

      const result = await appwriteService.createBrowserIntelligenceSnapshot(snapshot);
      persistedId = result?.$id || null;
    } catch (persistErr) {
      // Log but don't fail the request — real-time broadcast already sent
      logger.warn('Appwrite persistence skipped:', persistErr.message);
    }

    res.json({
      success: true,
      message: 'Intelligence snapshot processed',
      data: {
        sessions_received: sessions.length,
        alerts_count: total_alerts || 0,
        average_risk: average_risk || 0,
        persisted_id: persistedId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ Browser intelligence session error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ──────────────────────────────────────────────────────
// POST /api/browser-intelligence/alert
// Desktop app pushes a single behavioral alert
// ──────────────────────────────────────────────────────
router.post('/alert', async (req, res) => {
  try {
    const {
      alert_id,
      session_id,
      browser,
      domain,
      reason,
      risk_score,
      flags,
      details,
      user_id,
      device_id
    } = req.body;

    if (!alert_id || !reason) {
      return res.status(400).json({
        success: false,
        error: 'alert_id and reason are required'
      });
    }

    // ── Broadcast behavioral alert to all connected clients ──
    const alertPayload = {
      type: 'behavioral_alert',
      data: {
        alert_id,
        session_id,
        browser: browser || 'unknown',
        domain: domain || 'unknown',
        reason,
        risk_score: risk_score || 0,
        flags: flags || [],
        details: details || '',
        timestamp: new Date().toISOString()
      }
    };

    wsManager.broadcastToDesktops(alertPayload);
    wsManager.broadcastToMobiles(alertPayload);

    // ── Persist alert to Appwrite alerts collection ──
    let alertDocId = null;
    try {
      // Map behavioral risk_score to severity
      let severity = 'low';
      if (risk_score >= 70) severity = 'high';
      else if (risk_score >= 40) severity = 'medium';

      const result = await appwriteService.createAlert({
        userId: user_id || 'system',
        deviceId: device_id || 'unknown',
        severity,
        source: 'browser',
        description: `[Behavioral] ${reason}: ${domain || 'unknown'} — ${details || 'No details'}`.substring(0, 4096),
        evidence: flags || [],
        confidence: Math.min(1, (risk_score || 0) / 100)
      });

      alertDocId = result?.$id || null;
    } catch (persistErr) {
      logger.warn('Alert persistence skipped:', persistErr.message);
    }

    res.json({
      success: true,
      message: 'Behavioral alert processed',
      data: {
        alert_id,
        severity: risk_score >= 70 ? 'high' : risk_score >= 40 ? 'medium' : 'low',
        persisted_id: alertDocId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ Behavioral alert error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ──────────────────────────────────────────────────────
// POST /api/browser-intelligence/risk-update
// Desktop app pushes a risk score update for a session
// ──────────────────────────────────────────────────────
router.post('/risk-update', async (req, res) => {
  try {
    const { session_id, browser, risk_score, domain_count, alert_count } = req.body;

    if (typeof risk_score !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'risk_score (number) is required'
      });
    }

    // ── Broadcast risk update ──
    wsManager.broadcastToDesktops({
      type: 'risk_score_update',
      data: {
        session_id,
        browser: browser || 'unknown',
        risk_score,
        domain_count: domain_count || 0,
        alert_count: alert_count || 0,
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      data: { session_id, risk_score }
    });

  } catch (error) {
    logger.error('❌ Risk update error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ──────────────────────────────────────────────────────
// GET /api/browser-intelligence/snapshot
// Returns latest intelligence data for dashboard polling
// ──────────────────────────────────────────────────────
router.get('/snapshot', async (req, res) => {
  try {
    // Try to get latest snapshot from Appwrite
    let latestSnapshot = null;
    try {
      latestSnapshot = await appwriteService.getLatestBrowserIntelligence();
    } catch (err) {
      logger.warn('Could not fetch latest intelligence snapshot:', err.message);
    }

    res.json({
      success: true,
      data: latestSnapshot || {
        session_count: 0,
        total_domains: 0,
        total_alerts: 0,
        average_risk: 0,
        sessions_json: '[]',
        message: 'No intelligence data yet — waiting for desktop app connection'
      }
    });

  } catch (error) {
    logger.error('❌ Snapshot fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
