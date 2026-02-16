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

  // ==================== USER AUTH / PROFILE SYNC ====================

  normalizeUserRole(role = 'user') {
    if (role === 'analyst') return 'expert';
    if (role === 'expert') return 'expert';
    if (role === 'admin') return 'admin';
    return 'user';
  }

  async findAuthUserByEmail(email) {
    this.ensureInitialized();

    try {
      const result = await this.services.users.list([
        Query.equal('email', [email.toLowerCase()])
      ]);

      return result.users?.[0] || null;
    } catch (error) {
      logger.error(`❌ Failed to find Appwrite auth user by email ${email}:`, error);
      throw error;
    }
  }

  async createAuthUser({ email, password, firstName, lastName }) {
    this.ensureInitialized();

    try {
      const fullName = `${firstName || ''} ${lastName || ''}`.trim() || email;
      const user = await this.services.users.create(
        ID.unique(),
        email.toLowerCase(),
        undefined,
        password,
        fullName
      );

      logger.info(`✅ Appwrite auth user created: ${user.$id}`);
      return user;
    } catch (error) {
      logger.error(`❌ Failed to create Appwrite auth user for ${email}:`, error);
      throw error;
    }
  }

  async upsertUserMetadata({ userId, role = 'user', status = 'active' }) {
    this.ensureInitialized();

    const normalizedRole = this.normalizeUserRole(role);

    try {
      const existing = await this.services.databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.users,
        [Query.equal('user_id', [userId])]
      );

      if (existing.documents?.length > 0) {
        const doc = existing.documents[0];
        const updated = await this.services.databases.updateDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.users,
          doc.$id,
          {
            role: normalizedRole,
            status
          }
        );
        return updated;
      }

      const created = await this.createDocumentWithPermissionFallback(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.users,
        ID.unique(),
        {
          user_id: userId,
          role: normalizedRole,
          status,
          created_at: new Date().toISOString()
        },
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
          Permission.read(Role.label('agent'))
        ],
        'users metadata upsert'
      );

      logger.info(`✅ Appwrite users metadata created for: ${userId}`);
      return created;
    } catch (error) {
      logger.error(`❌ Failed to upsert Appwrite users metadata for ${userId}:`, error);
      throw error;
    }
  }

  async registerAppwriteUser({ email, password, firstName, lastName, role = 'user' }) {
    this.ensureInitialized();

    if (!APPWRITE_CONFIG.apiKey) {
      throw new Error('APPWRITE_API_KEY is missing. Set APPWRITE_API_KEY in backend .env with users.write and databases.write scopes.');
    }

    let authUser = null;

    try {
      authUser = await this.createAuthUser({ email, password, firstName, lastName });
    } catch (error) {
      if (error?.code === 409 || /already exists|duplicate/i.test(error?.message || '')) {
        authUser = await this.findAuthUserByEmail(email);
      } else {
        throw error;
      }
    }

    if (!authUser?.$id) {
      throw new Error('Unable to resolve Appwrite auth user');
    }

    await this.upsertUserMetadata({
      userId: authUser.$id,
      role,
      status: 'active'
    });

    return authUser;
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

  /**
   * Detect Appwrite errors related to collection-level permission mode.
   * Covers both "Permissions must be one of: (any, guests)" (user-scoped
   * permissions rejected) and "No permissions provided for action 'create'"
   * (empty permissions rejected).
   */
  isPermissionModeError(error) {
    const raw = error?.response || error?.message || '';
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
    return (
      /Permissions must be one of:\s*\(any,\s*guests\)/i.test(text) ||
      /No permissions provided for action/i.test(text)
    );
  }

  async createDocumentWithPermissionFallback(databaseId, collectionId, documentId, document, permissions = [], context = 'document') {
    this.ensureInitialized();

    // Broad any/guests permissions that Appwrite's collection-level mode accepts
    const anyPermissions = [
      Permission.read(Role.any()),
      Permission.write(Role.any())
    ];

    try {
      return await this.services.databases.createDocument(
        databaseId,
        collectionId,
        documentId,
        document,
        permissions?.length ? permissions : anyPermissions
      );
    } catch (error) {
      if (this.isPermissionModeError(error)) {
        logger.warn(`⚠️ Appwrite collection is in any/guests permission mode for ${context}; retrying with Role.any() permissions.`);
        return this.services.databases.createDocument(
          databaseId,
          collectionId,
          documentId,
          document,
          anyPermissions
        );
      }
      throw error;
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
    
    const {
      userId,
      hostname,
      platform,
      agentVersion = '1.0.0'
    } = deviceData;

    const deviceDocumentId = ID.unique();
    const now = new Date().toISOString();

    // Exact fields matching Appwrite devices collection schema
    const document = {
      device_id: deviceDocumentId,
      user_id: userId,
      os: (platform || process.platform || 'unknown').substring(0, 64),
      hostname: (hostname || 'unknown-host').substring(0, 255),
      agent_version: (agentVersion || '1.0.0').substring(0, 64),
      last_seen: now,
      created_at: now
    };

    try {
      const result = await this.createDocumentWithPermissionFallback(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.devices,
        deviceDocumentId,
        document,
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId))
        ],
        'device registration'
      );
      
      logger.info(`✅ Device registered: ${result.$id}`);
      return result;
    } catch (error) {
      logger.error('❌ Failed to register device:', JSON.stringify(error?.response || error?.message || error));
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
          last_seen: new Date().toISOString()
        }
      );
      
      return result;
    } catch (error) {
      logger.error(`❌ Failed to update device heartbeat for ${deviceId}:`, JSON.stringify(error?.response || error?.message || error));
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

    const now = new Date().toISOString();
    const generatedAgentId = ID.unique();

    // Exact fields matching Appwrite agents collection schema
    const document = {
      device_id: deviceId,
      user_id: userId,
      agent_type: (agentType || 'security_scanner').substring(0, 128),
      agent_version: (version || '1.0.0').substring(0, 64),
      capabilities: JSON.stringify(capabilities),
      state: 'idle',
      status: 'online',
      error_count: 0,
      last_heartbeat: now,
      created_at: now
    };

    try {
      const result = await this.services.databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.agents,
        generatedAgentId,
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
      logger.error('❌ Failed to register agent:', JSON.stringify(error?.response || error?.message || error));
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
      // Only send fields that exist in the agents schema
      const updateData = {
        state,
        last_heartbeat: new Date().toISOString()
      };

      if (state === 'error') {
        try {
          const agent = await this.getAgent(agentId);
          updateData.error_count = (agent.error_count || 0) + 1;
        } catch (e) {
          updateData.error_count = 1;
        }
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
      logger.error(`❌ Failed to update agent state for ${agentId}:`, JSON.stringify(error?.response || error?.message || error));
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
          last_heartbeat: new Date().toISOString(),
          status: 'online'
        }
      );
      
      return result;
    } catch (error) {
      logger.error(`❌ Failed to update agent heartbeat for ${agentId}:`, JSON.stringify(error?.response || error?.message || error));
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
          Query.equal('device_id', deviceId)
        ]
      );
      
      return result.documents;
    } catch (error) {
      logger.error(`❌ Failed to list agents for device ${deviceId}:`, JSON.stringify(error?.response || error?.message || error));
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
      priority = 5, 
    } = taskData;

    const now = new Date().toISOString();
    const taskDocId = ID.unique();

    // Convert priority to integer if string
    let priorityInt = typeof priority === 'number' ? priority : 5;
    if (typeof priority === 'string') {
      const priorityMap = { low: 1, normal: 5, high: 8, critical: 10 };
      priorityInt = priorityMap[priority] || 5;
    }

    // Exact fields matching Appwrite agent_tasks collection schema
    const document = {
      task_id: taskDocId,
      task_type: (taskType || 'scan').substring(0, 128),
      status: 'pending',
      priority: priorityInt,
      retries: 0,
      created_at: now,
      updated_at: now,
      agent_id: agentId || '',
      user_id: userId || ''
    };

    try {
      const result = await this.createDocumentWithPermissionFallback(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.agentTasks,
        taskDocId,
        document,
        userId ? [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId))
        ] : [],
        'agent task creation'
      );
      
      logger.info(`✅ Agent task created: ${result.$id}`);
      return result;
    } catch (error) {
      logger.error('❌ Failed to create agent task:', JSON.stringify(error?.response || error?.message || error));
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
          Query.equal('agent_id', agentId),
          Query.equal('status', 'pending'),
          Query.orderDesc('priority'),
          Query.limit(limit)
        ]
      );
      
      return result.documents;
    } catch (error) {
      logger.error(`❌ Failed to poll tasks for agent ${agentId}:`, JSON.stringify(error?.response || error?.message || error));
      throw error;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId, status, resultData = {}) {
    this.ensureInitialized();
    
    // Map to the enum values the schema allows: pending, running, done, failed
    const statusMap = { 'processing': 'running', 'completed': 'done', 'pending': 'pending', 'running': 'running', 'done': 'done', 'failed': 'failed' };
    const mappedStatus = statusMap[status] || status;
    
    const validStatuses = ['pending', 'running', 'done', 'failed'];
    if (!validStatuses.includes(mappedStatus)) {
      throw new Error(`Invalid task status: ${status}. Must map to one of: ${validStatuses.join(', ')}`);
    }

    try {
      // Only send fields that exist in the agent_tasks schema
      const updateData = {
        status: mappedStatus,
        updated_at: new Date().toISOString()
      };

      const result = await this.services.databases.updateDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.agentTasks,
        taskId,
        updateData
      );
      
      logger.info(`✅ Task ${taskId} status updated to: ${mappedStatus}`);
      return result;
    } catch (error) {
      logger.error(`❌ Failed to update task status for ${taskId}:`, JSON.stringify(error?.response || error?.message || error));
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
      severity,
      source,
      description,
      evidence = [],
      confidence = 0.5,
      riskScore
    } = alertData;

    const alertDocId = ID.unique();

    // Map severity to allowed enum values: low, medium, high
    let mappedSeverity = (severity || 'medium').toLowerCase();
    if (!['low', 'medium', 'high'].includes(mappedSeverity)) {
      if (mappedSeverity === 'critical') mappedSeverity = 'high';
      else if (mappedSeverity === 'info') mappedSeverity = 'low';
      else mappedSeverity = 'medium';
    }

    // Map source to allowed enum values: browser, scraper, model
    let mappedSource = (source || 'model').toLowerCase();
    if (!['browser', 'scraper', 'model'].includes(mappedSource)) {
      mappedSource = 'model';
    }

    // Confidence from riskScore if provided (riskScore is 0-100, confidence is 0-1)
    const resolvedConfidence = typeof confidence === 'number' ? Math.min(1, Math.max(0, confidence)) :
      typeof riskScore === 'number' ? Math.min(1, Math.max(0, riskScore / 100)) : 0.5;

    // Exact fields matching Appwrite alerts collection schema
    const document = {
      alert_id: alertDocId,
      severity: mappedSeverity,
      source: mappedSource,
      description: (description || 'Security alert').substring(0, 4096),
      evidence: Array.isArray(evidence) ? evidence.map(e => String(e).substring(0, 2048)) : [],
      confidence: resolvedConfidence,
      user_id: userId,
      device_id: deviceId,
      created_at: new Date().toISOString()
    };

    try {
      const result = await this.createDocumentWithPermissionFallback(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.alerts,
        alertDocId,
        document,
        userId ? [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId))
        ] : [],
        'alert creation'
      );
      
      logger.info(`✅ Alert created: ${result.$id}`);
      return result;
    } catch (error) {
      logger.error('❌ Failed to create alert:', JSON.stringify(error?.response || error?.message || error));
      throw error;
    }
  }

  /**
   * List alerts for a user
   */
  async listAlerts(userId, filters = {}) {
    this.ensureInitialized();
    
    const queries = [Query.equal('user_id', userId)];
    
    if (filters.severity) {
      queries.push(Query.equal('severity', filters.severity));
    }
    
    queries.push(Query.orderDesc('created_at'));
    queries.push(Query.limit(filters.limit || 50));

    try {
      const result = await this.services.databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.alerts,
        queries
      );
      
      return result.documents;
    } catch (error) {
      logger.error(`❌ Failed to list alerts for user ${userId}:`, JSON.stringify(error?.response || error?.message || error));
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
      const result = await this.createDocumentWithPermissionFallback(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.evidenceMetadata,
        ID.unique(),
        document,
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId))
        ],
        'evidence metadata storage'
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
