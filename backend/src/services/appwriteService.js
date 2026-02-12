/**
 * Appwrite Service
 * Handles all interactions with Appwrite as the single source of truth
 * for identity, authentication, permissions, and agent control
 */

const { ID, Query, Permission, Role } = require('node-appwrite');
const { initializeAppwriteServices, APPWRITE_CONFIG } = require('../config/appwrite.config');
const logger = require('../utils/logger');

class AppwriteService {
  constructor() {
    this.services = null;
    this.isInitialized = false;
  }

  /**
   * Initialize Appwrite services
   */
  async initialize() {
    try {
      this.services = initializeAppwriteServices();
      this.isInitialized = true;
      logger.info('✅ Appwrite service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Appwrite service:', error);
      throw error;
    }
  }

  /**
   * Ensure service is initialized before operations
   */
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('Appwrite service not initialized. Call initialize() first.');
    }
  }

  // ==================== DEVICE MANAGEMENT ====================

  /**
   * Register a new device/agent in Appwrite
   * @param {Object} deviceData - Device information
   * @returns {Promise<Object>} Created device document
   */
  async registerDevice(deviceData) {
    this.ensureInitialized();
    
    const { userId, hostname, platform, type = 'agent', metadata = {} } = deviceData;
    
    const document = {
      userId,
      hostname,
      platform,
      type,
      status: 'registered',
      metadata: JSON.stringify(metadata),
      registeredAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    };

    try {
      const result = await this.services.databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.devices,
        ID.unique(),
        document,
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId))
        ]
      );
      
      logger.info(`✅ Device registered: ${result.$id}`);
      return result;
    } catch (error) {
      logger.error('❌ Failed to register device:', error);
      throw error;
    }
  }

  /**
   * Update device last seen timestamp (heartbeat)
   */
  async updateDeviceHeartbeat(deviceId) {
    this.ensureInitialized();
    
    try {
      const result = await this.services.databases.updateDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.devices,
        deviceId,
        {
          lastSeenAt: new Date().toISOString()
        }
      );
      
      return result;
    } catch (error) {
      logger.error(`❌ Failed to update device heartbeat for ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get device by ID
   */
  async getDevice(deviceId) {
    this.ensureInitialized();
    
    try {
      const result = await this.services.databases.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.devices,
        deviceId
      );
      
      return result;
    } catch (error) {
      logger.error(`❌ Failed to get device ${deviceId}:`, error);
      throw error;
    }
  }

  // ==================== AGENT MANAGEMENT ====================

  /**
   * Register a new agent in Appwrite
   */
  async registerAgent(agentData) {
    this.ensureInitialized();
    
    const { 
      deviceId, 
      userId, 
      agentType = 'security_scanner', 
      version, 
      capabilities = [] 
    } = agentData;
    
    const document = {
      deviceId,
      userId,
      agentType,
      version,
      capabilities: JSON.stringify(capabilities),
      state: 'idle',
      status: 'online',
      registeredAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      errorCount: 0
    };

    try {
      const result = await this.services.databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.agents,
        ID.unique(),
        document,
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId))
        ]
      );
      
      logger.info(`✅ Agent registered: ${result.$id}`);
      return result;
    } catch (error) {
      logger.error('❌ Failed to register agent:', error);
      throw error;
    }
  }

  /**
   * Update agent state
   */
  async updateAgentState(agentId, state, metadata = {}) {
    this.ensureInitialized();
    
    const validStates = ['idle', 'running', 'paused', 'error'];
    if (!validStates.includes(state)) {
      throw new Error(`Invalid agent state: ${state}. Must be one of: ${validStates.join(', ')}`);
    }

    try {
      const updateData = {
        state,
        lastHeartbeatAt: new Date().toISOString(),
        lastStateChange: new Date().toISOString()
      };

      if (Object.keys(metadata).length > 0) {
        updateData.metadata = JSON.stringify(metadata);
      }

      if (state === 'error') {
        const agent = await this.getAgent(agentId);
        updateData.errorCount = (agent.errorCount || 0) + 1;
      }

      const result = await this.services.databases.updateDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.agents,
        agentId,
        updateData
      );
      
      logger.info(`✅ Agent ${agentId} state updated to: ${state}`);
      return result;
    } catch (error) {
      logger.error(`❌ Failed to update agent state for ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Update agent heartbeat
   */
  async updateAgentHeartbeat(agentId) {
    this.ensureInitialized();
    
    try {
      const result = await this.services.databases.updateDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.agents,
        agentId,
        {
          lastHeartbeatAt: new Date().toISOString(),
          status: 'online'
        }
      );
      
      return result;
    } catch (error) {
      logger.error(`❌ Failed to update agent heartbeat for ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId) {
    this.ensureInitialized();
    
    try {
      const result = await this.services.databases.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.agents,
        agentId
      );
      
      return result;
    } catch (error) {
      logger.error(`❌ Failed to get agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * List agents by device
   */
  async listAgentsByDevice(deviceId) {
    this.ensureInitialized();
    
    try {
      const result = await this.services.databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.agents,
        [
          Query.equal('deviceId', deviceId)
        ]
      );
      
      return result.documents;
    } catch (error) {
      logger.error(`❌ Failed to list agents for device ${deviceId}:`, error);
      throw error;
    }
  }

  // ==================== TASK MANAGEMENT ====================

  /**
   * Create a new agent task
   */
  async createAgentTask(taskData) {
    this.ensureInitialized();
    
    const { 
      agentId, 
      userId, 
      taskType, 
      priority = 'normal', 
      targetUrl,
      parameters = {} 
    } = taskData;
    
    const document = {
      agentId,
      userId,
      taskType,
      priority,
      targetUrl,
      parameters: JSON.stringify(parameters),
      status: 'pending',
      createdAt: new Date().toISOString(),
      attempts: 0
    };

    try {
      const result = await this.services.databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.agentTasks,
        ID.unique(),
        document,
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId))
        ]
      );
      
      logger.info(`✅ Agent task created: ${result.$id}`);
      return result;
    } catch (error) {
      logger.error('❌ Failed to create agent task:', error);
      throw error;
    }
  }

  /**
   * Poll for pending tasks for an agent
   */
  async pollAgentTasks(agentId, limit = 10) {
    this.ensureInitialized();
    
    try {
      const result = await this.services.databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.agentTasks,
        [
          Query.equal('agentId', agentId),
          Query.equal('status', 'pending'),
          Query.orderDesc('priority'),
          Query.limit(limit)
        ]
      );
      
      return result.documents;
    } catch (error) {
      logger.error(`❌ Failed to poll tasks for agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId, status, resultData = {}) {
    this.ensureInitialized();
    
    const validStatuses = ['pending', 'processing', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid task status: ${status}`);
    }

    try {
      const updateData = {
        status,
        updatedAt: new Date().toISOString()
      };

      if (status === 'processing') {
        updateData.startedAt = new Date().toISOString();
      } else if (status === 'completed' || status === 'failed') {
        updateData.completedAt = new Date().toISOString();
        updateData.result = JSON.stringify(resultData);
      }

      const result = await this.services.databases.updateDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.agentTasks,
        taskId,
        updateData
      );
      
      logger.info(`✅ Task ${taskId} status updated to: ${status}`);
      return result;
    } catch (error) {
      logger.error(`❌ Failed to update task status for ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get task by ID
   */
  async getTask(taskId) {
    this.ensureInitialized();
    
    try {
      const result = await this.services.databases.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.agentTasks,
        taskId
      );
      
      return result;
    } catch (error) {
      logger.error(`❌ Failed to get task ${taskId}:`, error);
      throw error;
    }
  }

  // ==================== ALERT MANAGEMENT ====================
  // ==================== ALERT MANAGEMENT ====================

  /**
   * Create a security alert
   */
  async createAlert(alertData) {
    this.ensureInitialized();
    
    const {
      userId,
      deviceId,
      agentId,
      taskId,
      alertType,
      severity,
      title,
      description,
      evidenceId,
      mlOutputId,
      riskScore,
      metadata = {}
    } = alertData;
    
    const document = {
      userId,
      deviceId,
      agentId,
      taskId,
      evidenceId,
      mlOutputId,
      alertType,
      severity,
      title,
      description,
      riskScore,
      status: 'open',
      metadata: JSON.stringify(metadata),
      createdAt: new Date().toISOString()
    };

    try {
      const result = await this.services.databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.alerts,
        ID.unique(),
        document,
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId))
        ]
      );
      
      logger.info(`✅ Alert created: ${result.$id}`);
      return result;
    } catch (error) {
      logger.error('❌ Failed to create alert:', error);
      throw error;
    }
  }

  /**
   * List alerts for a user
   */
  async listAlerts(userId, filters = {}) {
    this.ensureInitialized();
    
    const queries = [Query.equal('userId', userId)];
    
    if (filters.severity) {
      queries.push(Query.equal('severity', filters.severity));
    }
    if (filters.status) {
      queries.push(Query.equal('status', filters.status));
    }
    
    queries.push(Query.orderDesc('createdAt'));
    queries.push(Query.limit(filters.limit || 50));

    try {
      const result = await this.services.databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.alerts,
        queries
      );
      
      return result.documents;
    } catch (error) {
      logger.error(`❌ Failed to list alerts for user ${userId}:`, error);
      throw error;
    }
  }

  // ==================== EVIDENCE METADATA ====================

  /**
   * Store evidence metadata (not raw data)
   */
  async storeEvidenceMetadata(evidenceData) {
    this.ensureInitialized();
    
    const {
      userId,
      agentId,
      taskId,
      sourceType, // 'web_scraper', 'network_capture', etc.
      targetUrl,
      evidenceType, // 'dom', 'network', 'headers', etc.
      summary,
      checksum, // Hash of the actual evidence data
      storageLocation, // Where the actual evidence is stored
      metadata = {}
    } = evidenceData;
    
    const document = {
      userId,
      agentId,
      taskId,
      sourceType,
      targetUrl,
      evidenceType,
      summary,
      checksum,
      storageLocation,
      metadata: JSON.stringify(metadata),
      collectedAt: new Date().toISOString()
    };

    try {
      const result = await this.services.databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.evidenceMetadata,
        ID.unique(),
        document,
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId))
        ]
      );
      
      logger.info(`✅ Evidence metadata stored: ${result.$id}`);
      return result;
    } catch (error) {
      logger.error('❌ Failed to store evidence metadata:', error);
      throw error;
    }
  }

  /**
   * Get evidence metadata by ID
   */
  async getEvidenceMetadata(evidenceId) {
    this.ensureInitialized();
    
    try {
      const result = await this.services.databases.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.evidenceMetadata,
        evidenceId
      );
      
      return result;
    } catch (error) {
      logger.error(`❌ Failed to get evidence metadata ${evidenceId}:`, error);
      throw error;
    }
  }
}

// Singleton instance
const appwriteService = new AppwriteService();

module.exports = { AppwriteService, appwriteService };
