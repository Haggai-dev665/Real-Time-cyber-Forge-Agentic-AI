const express = require('express');
const router = express.Router();
const otxService = require('../services/otx');

/**
 * GET /api/otx/pulses
 * Get subscribed threat pulses from OTX
 */
router.get('/pulses', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const data = await otxService.getSubscribedPulses(parseInt(page), parseInt(limit));
    
    res.json({
      success: true,
      data: data.results || [],
      count: data.count || 0,
      next: data.next,
      previous: data.previous
    });
  } catch (error) {
    console.error('Error fetching OTX pulses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch threat pulses',
      message: error.message
    });
  }
});

/**
 * GET /api/otx/search
 * Search for specific threats
 */
router.get('/search', async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      });
    }
    
    const data = await otxService.searchPulses(query, parseInt(limit));
    
    res.json({
      success: true,
      data: data.results || [],
      count: data.count || 0
    });
  } catch (error) {
    console.error('Error searching OTX:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search threats',
      message: error.message
    });
  }
});

/**
 * GET /api/otx/indicator/:type/:indicator
 * Get details for a specific indicator (IP, domain, hash)
 */
router.get('/indicator/:type/:indicator', async (req, res) => {
  try {
    const { type, indicator } = req.params;
    
    // Validate indicator type
    const validTypes = ['IPv4', 'IPv6', 'domain', 'hostname', 'url', 'FileHash-MD5', 'FileHash-SHA1', 'FileHash-SHA256'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid indicator type. Must be one of: ${validTypes.join(', ')}`
      });
    }
    
    const data = await otxService.getIndicatorDetails(type, indicator);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching indicator:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch indicator details',
      message: error.message
    });
  }
});

/**
 * GET /api/otx/threats/recent
 * Get recent threat events for dashboard
 */
router.get('/threats/recent', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const threats = await otxService.getRecentThreats(parseInt(limit));
    
    res.json({
      success: true,
      data: threats,
      count: threats.length
    });
  } catch (error) {
    console.error('Error fetching recent threats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent threats',
      message: error.message
    });
  }
});

/**
 * POST /api/otx/start-polling
 * Start real-time threat polling (admin only)
 */
router.post('/start-polling', async (req, res) => {
  try {
    const { interval = 30000 } = req.body;
    otxService.startPolling(interval);
    
    res.json({
      success: true,
      message: 'OTX threat polling started',
      interval
    });
  } catch (error) {
    console.error('Error starting OTX polling:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start polling',
      message: error.message
    });
  }
});

/**
 * POST /api/otx/stop-polling
 * Stop real-time threat polling (admin only)
 */
router.post('/stop-polling', async (req, res) => {
  try {
    otxService.stopPolling();
    
    res.json({
      success: true,
      message: 'OTX threat polling stopped'
    });
  } catch (error) {
    console.error('Error stopping OTX polling:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop polling',
      message: error.message
    });
  }
});

/**
 * GET /api/otx/stats
 * Get OTX service statistics
 */
router.get('/stats', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        polling: !!otxService.pollingInterval,
        lastPulseTimestamp: otxService.lastPulseTimestamp,
        apiKey: otxService.apiKey ? '***' + otxService.apiKey.slice(-4) : 'Not set'
      }
    });
  } catch (error) {
    console.error('Error fetching OTX stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      message: error.message
    });
  }
});

module.exports = router;
