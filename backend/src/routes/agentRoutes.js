/**
 * Agent Control Routes
 * API endpoints for managing agents and tasks
 */

const express = require('express');
const router = express.Router();
const { agentManager } = require('../agent/AgentManager');
const { appwriteService } = require('../services/appwriteService');
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

module.exports = router;
