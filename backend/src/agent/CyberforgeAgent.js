/**
 * Cyberforge Agent
 * Persistent autonomous agent that runs continuously
 * Authenticates via Appwrite, polls for tasks, executes scans, and reports findings
 */

const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { appwriteService } = require('../services/appwriteService');
const { datadogMetrics } = require('../services/datadogMetrics');
const { webScraperAPIService } = require('../services/WebScraperAPIService');
const { mlServiceClient } = require('../services/mlServiceClient');
const logger = require('../utils/logger');

class CyberforgeAgent {
  constructor(config = {}) {
    this.agentId = null;
    this.deviceId = null;
    this.userId = config.userId;
    this.state = 'idle';
    this.isRunning = false;
    
    // Configuration
    this.config = {
      heartbeatInterval: config.heartbeatInterval || 30000, // 30 seconds
      taskPollInterval: config.taskPollInterval || 10000,   // 10 seconds
      maxRetries: config.maxRetries || 3,
      version: config.version || '1.0.0',
      capabilities: config.capabilities || ['web_scanning', 'threat_analysis'],
      // Alert threshold: Create alerts for medium risk and above (30+ out of 100)
      // Low risk (0-29): No alert, Medium (30-49): Alert, High (50-69): Alert, Critical (70+): Alert
      alertRiskThreshold: config.alertRiskThreshold || 30
    };
    
    // Agent metadata
    this.metadata = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      startedAt: null
    };
    
    // Timers
    this.heartbeatTimer = null;
    this.taskPollTimer = null;
  }

  /**
   * Initialize and start the agent
   */
  async start() {
    if (this.isRunning) {
      logger.warn('⚠️  Agent is already running');
      return;
    }

    logger.info('🚀 Starting Cyberforge Agent...');

    try {
      // Ensure Appwrite is initialized
      if (!appwriteService.isInitialized) {
        await appwriteService.initialize();
      }

      // Register device
      await this.registerDevice();

      // Register agent
      await this.registerAgent();

      // Update state to running
      await this.updateState('running');

      // Start heartbeat
      this.startHeartbeat();

      // Start task polling
      this.startTaskPolling();

      this.isRunning = true;
      this.metadata.startedAt = new Date().toISOString();

      logger.info(`✅ Cyberforge Agent started successfully`);
      logger.info(`   Device ID: ${this.deviceId}`);
      logger.info(`   Agent ID: ${this.agentId}`);

      // Record metrics
      datadogMetrics.incrementCounter('agent.started', 1, {
        agentId: this.agentId
      });

    } catch (error) {
      logger.error('❌ Failed to start agent:', error);
      await this.updateState('error', { error: error.message });
      datadogMetrics.recordError('agent_start_failure', 'agent', {
        agentId: this.agentId
      });
      throw error;
    }
  }

  /**
   * Stop the agent gracefully
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn('⚠️  Agent is not running');
      return;
    }

    logger.info('🛑 Stopping Cyberforge Agent...');

    try {
      // Stop timers
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      if (this.taskPollTimer) {
        clearInterval(this.taskPollTimer);
        this.taskPollTimer = null;
      }

      // Update state
      await this.updateState('paused');

      this.isRunning = false;

      logger.info('✅ Cyberforge Agent stopped successfully');

      // Record metrics
      datadogMetrics.incrementCounter('agent.stopped', 1, {
        agentId: this.agentId
      });

    } catch (error) {
      logger.error('❌ Failed to stop agent gracefully:', error);
      throw error;
    }
  }

  /**
   * Register device with Appwrite
   */
  async registerDevice() {
    try {
      const deviceData = {
        userId: this.userId,
        hostname: this.metadata.hostname,
        platform: this.metadata.platform,
        type: 'agent',
        agentVersion: this.config.version,
        agentType: 'security_scanner',
        metadata: {
          arch: this.metadata.arch,
          nodeVersion: this.metadata.nodeVersion
        }
      };

      const device = await appwriteService.registerDevice(deviceData);
      this.deviceId = device.$id;

      logger.info(`✅ Device registered: ${this.deviceId}`);

    } catch (error) {
      logger.error('❌ Failed to register device:', error);
      throw error;
    }
  }

  /**
   * Register agent with Appwrite
   */
  async registerAgent() {
    try {
      const agentData = {
        deviceId: this.deviceId,
        userId: this.userId,
        agentType: 'security_scanner',
        version: this.config.version,
        capabilities: this.config.capabilities
      };

      const agent = await appwriteService.registerAgent(agentData);
      this.agentId = agent.$id;

      logger.info(`✅ Agent registered: ${this.agentId}`);

    } catch (error) {
      logger.error('❌ Failed to register agent:', error);
      throw error;
    }
  }

  /**
   * Update agent state in Appwrite
   */
  async updateState(newState, metadata = {}) {
    const oldState = this.state;
    this.state = newState;

    try {
      if (this.agentId) {
        await appwriteService.updateAgentState(this.agentId, newState, metadata);
        
        // Record state change
        datadogMetrics.recordAgentStateChange(
          this.agentId,
          oldState,
          newState,
          { userId: this.userId }
        );

        logger.info(`✅ Agent state updated: ${oldState} → ${newState}`);
      }
    } catch (error) {
      logger.error('❌ Failed to update agent state:', error);
      throw error;
    }
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      const startTime = Date.now();
      
      try {
        await appwriteService.updateAgentHeartbeat(this.agentId);
        await appwriteService.updateDeviceHeartbeat(this.deviceId);
        
        const latency = Date.now() - startTime;
        
        // Record heartbeat metrics
        datadogMetrics.recordAgentHeartbeat(this.agentId, latency, {
          userId: this.userId,
          state: this.state
        });

        logger.debug(`💓 Heartbeat sent (latency: ${latency}ms)`);
        
      } catch (error) {
        logger.error('❌ Heartbeat failed:', error);
        datadogMetrics.recordError('heartbeat_failure', 'agent', {
          agentId: this.agentId
        });
      }
    }, this.config.heartbeatInterval);

    logger.info(`💓 Heartbeat started (interval: ${this.config.heartbeatInterval}ms)`);
  }

  /**
   * Start task polling mechanism
   */
  startTaskPolling() {
    this.taskPollTimer = setInterval(async () => {
      try {
        if (this.state !== 'running') {
          logger.debug('Agent not in running state, skipping task poll');
          return;
        }

        const tasks = await appwriteService.pollAgentTasks(this.agentId, 5);
        
        if (tasks.length > 0) {
          logger.info(`📋 Found ${tasks.length} pending task(s)`);
          
          // Process tasks sequentially
          for (const task of tasks) {
            await this.executeTask(task);
          }
        } else {
          logger.debug('No pending tasks');
        }
        
      } catch (error) {
        logger.error('❌ Task polling failed:', error);
        datadogMetrics.recordError('task_poll_failure', 'agent', {
          agentId: this.agentId
        });
      }
    }, this.config.taskPollInterval);

    logger.info(`📋 Task polling started (interval: ${this.config.taskPollInterval}ms)`);
  }

  /**
   * Execute a scanning task
   */
  async executeTask(task) {
    const taskStartTime = Date.now();
    logger.info(`🔍 Executing task ${task.$id}: ${task.taskType} on ${task.targetUrl}`);

    try {
      // Update task status to processing
      await appwriteService.updateTaskStatus(task.$id, 'processing');

      // Execute based on task type
      let result;
      switch (task.taskType) {
        case 'web_scan':
          result = await this.executeWebScan(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.taskType}`);
      }

      // Update task status to completed
      await appwriteService.updateTaskStatus(task.$id, 'completed', result);

      const duration = Date.now() - taskStartTime;
      logger.info(`✅ Task ${task.$id} completed in ${duration}ms`);

      // Record metrics
      datadogMetrics.recordScanDuration(task.$id, duration, true, {
        agentId: this.agentId,
        taskType: task.taskType
      });

    } catch (error) {
      logger.error(`❌ Task ${task.$id} failed:`, error);

      // Update task status to failed
      await appwriteService.updateTaskStatus(task.$id, 'failed', {
        error: error.message,
        stack: error.stack
      });

      const duration = Date.now() - taskStartTime;
      datadogMetrics.recordScanDuration(task.$id, duration, false, {
        agentId: this.agentId,
        taskType: task.taskType,
        error: error.message
      });

      datadogMetrics.recordError('task_execution_failure', 'agent', {
        agentId: this.agentId,
        taskId: task.$id
      });
    }
  }

  /**
   * Execute web scan task
   */
  async executeWebScan(task) {
    const { targetUrl } = task;
    
    logger.info(`🌐 Starting web scan for: ${targetUrl}`);

    // Step 1: Call web scraper (API key authentication)
    const scraperStartTime = Date.now();
    const scrapedData = await webScraperAPIService.scrapeWebsite(targetUrl);
    const scraperDuration = Date.now() - scraperStartTime;

    datadogMetrics.recordScraperApiCall(
      targetUrl,
      scraperDuration,
      scrapedData.success,
      { agentId: this.agentId }
    );

    if (!scrapedData.success) {
      throw new Error(`Web scraper failed: ${scrapedData.error}`);
    }

    // Format data for analysis
    const analysisData = webScraperAPIService.formatForAIAnalysis(scrapedData);

    // Store evidence metadata (not raw data)
    const evidenceMetadata = await appwriteService.storeEvidenceMetadata({
      userId: this.userId,
      agentId: this.agentId,
      taskId: task.$id,
      sourceType: 'web_scraper',
      targetUrl,
      evidenceType: 'security_scan',
      summary: `Risk Score: ${analysisData.risk_score}/100 (${analysisData.risk_level})`,
      checksum: this.calculateChecksum(scrapedData),
      storageLocation: 'memory', // In production, this would be S3, etc.
      metadata: {
        riskScore: analysisData.risk_score,
        riskLevel: analysisData.risk_level,
        securitySummary: analysisData.security_summary
      }
    });

    logger.info(`✅ Evidence metadata stored: ${evidenceMetadata.$id}`);

    // Step 2: ML threat classification (call ML service)
    const mlStartTime = Date.now();
    const mlOutput = await this.performMLClassification(analysisData);
    const mlDuration = Date.now() - mlStartTime;

    datadogMetrics.recordMlInference(
      'threat_classifier',
      mlDuration,
      true,
      { agentId: this.agentId }
    );

    // Step 3: Gemini reasoning (call ML service for explanation)
    const geminiStartTime = Date.now();
    const geminiExplanation = await this.getGeminiExplanation(mlOutput, analysisData);
    const geminiDuration = Date.now() - geminiStartTime;

    datadogMetrics.recordGeminiUsage(
      geminiDuration,
      0, // Token count would come from actual API
      true,
      { agentId: this.agentId }
    );

    // Step 4: Create alert if risk is significant
    // Use configured threshold (default: 30 = medium risk)
    if (mlOutput.riskScore >= this.config.alertRiskThreshold) {
      const alert = await appwriteService.createAlert({
        userId: this.userId,
        deviceId: this.deviceId,
        agentId: this.agentId,
        taskId: task.$id,
        evidenceId: evidenceMetadata.$id,
        mlOutputId: 'ml-output-id', // Would be actual ML output ID
        alertType: mlOutput.category,
        severity: this.calculateSeverity(mlOutput.riskScore),
        title: `${mlOutput.category} detected on ${targetUrl}`,
        description: geminiExplanation.summary,
        riskScore: mlOutput.riskScore,
        metadata: {
          mlConfidence: mlOutput.confidence,
          recommendations: geminiExplanation.recommendations
        }
      });

      logger.info(`🚨 Alert created: ${alert.$id}`);

      datadogMetrics.recordAlert(
        alert.severity,
        alert.alertType,
        { agentId: this.agentId }
      );
    }

    return {
      evidenceId: evidenceMetadata.$id,
      mlOutput,
      geminiExplanation,
      riskScore: mlOutput.riskScore,
      category: mlOutput.category
    };
  }

  /**
   * Perform ML threat classification
   * Calls the Python ML service for threat analysis
   */
  async performMLClassification(analysisData) {
    // No fallback — calls real HF ML models via /analyze-url
    const mlResult = await mlServiceClient.classifyThreat(analysisData);
    logger.info(`✅ ML classification: ${mlResult.category} (score: ${mlResult.riskScore}, confidence: ${mlResult.confidence})`);
    return mlResult;
  }

  /**
   * Get Gemini explanation
   * Calls the ML service for AI-generated explanation
   */
  async getGeminiExplanation(mlOutput, analysisData) {
    // No fallback — calls real Gemini via /scan-threats
    const explanation = await mlServiceClient.getExplanation(mlOutput, analysisData);
    logger.info(`✅ Gemini explanation generated`);
    return explanation;
  }

  /**
   * Calculate checksum for evidence
   */
  calculateChecksum(data) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  /**
   * Calculate severity from risk score
   */
  calculateSeverity(riskScore) {
    if (riskScore >= 70) return 'critical';
    if (riskScore >= 50) return 'high';
    if (riskScore >= 30) return 'medium';
    return 'low';
  }

  /**
   * Fail gracefully with error handling
   */
  async failGracefully(error) {
    logger.error('❌ Agent encountered fatal error:', error);

    try {
      await this.updateState('error', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });

      datadogMetrics.recordError('agent_fatal_error', 'agent', {
        agentId: this.agentId,
        error: error.message
      });

    } catch (updateError) {
      logger.error('❌ Failed to update error state:', updateError);
    }

    // Don't throw - agent should continue running
  }
}

module.exports = { CyberforgeAgent };
