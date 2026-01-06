/**
 * CyberForge API Client
 * Handles all communication between the desktop app and backend services
 */

const FALLBACK_API_BASE_URL = 'http://localhost:8000';
const FALLBACK_WS_URL = 'ws://localhost:8000/ws';

class CyberForgeAPI {
  constructor() {
    const config = (typeof window !== 'undefined' && window.electronAPI?.config) || {};
    this.baseUrl = config.backendUrl || FALLBACK_API_BASE_URL;
    this.wsUrl = config.wsUrl || FALLBACK_WS_URL;
    this.token = localStorage.getItem('cyberforge_token');
    this.ws = null;
    this.wsReconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.eventHandlers = new Map();

    // Sync token from native store if the renderer does not have it yet
    this.syncTokenFromNative();
  }

  // =========================================
  // HTTP Request Helpers
  // =========================================

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'cyber-forge-desktop/1.0'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async syncTokenFromNative() {
    try {
      if (!this.token && window.electronAPI?.auth) {
        const response = await window.electronAPI.auth.getToken();
        if (response?.token) {
          this.setToken(response.token);
        }
      }
    } catch (error) {
      console.warn('Token sync from native store failed:', error.message);
    }
  }

  setToken(token) {
    if (token) {
      this.token = token;
      localStorage.setItem('cyberforge_token', token);
    }
  }

  async request(method, endpoint, data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: this.getHeaders()
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const json = await response.json();

      if (!response.ok || json.success === false) {
        throw new Error(json.message || json.error || `HTTP ${response.status}`);
      }

      // Unwrap common API shape { success, data }
      const payload = json.data !== undefined ? json.data : json;

      return { success: true, data: payload, raw: json };
    } catch (error) {
      console.error(`API Error [${method} ${endpoint}]:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async get(endpoint) {
    return this.request('GET', endpoint);
  }

  async post(endpoint, data) {
    return this.request('POST', endpoint, data);
  }

  async put(endpoint, data) {
    return this.request('PUT', endpoint, data);
  }

  async delete(endpoint) {
    return this.request('DELETE', endpoint);
  }

  // =========================================
  // Health & Status
  // =========================================

  async checkHealth() {
    return this.get('/health');
  }

  async mlHealthCheck() {
    return this.get('/api/ai/ml-health');
  }

  async getServerStatus() {
    return this.get('/ws/info');
  }

  // =========================================
  // Authentication
  // =========================================

  async login(email, password) {
    const result = await this.post('/api/auth/login', { email, password });
    if (result.success && result.data.token) {
      this.setToken(result.data.token);
    }
    return result;
  }

  async register(userData) {
    const result = await this.post('/api/auth/register', userData);
    if (result.success && result.data.token) {
      this.setToken(result.data.token);
    }
    return result;
  }

  async getProfile() {
    return this.get('/api/auth/profile');
  }

  async updateProfile(profileData) {
    return this.put('/api/auth/profile', profileData);
  }

  logout() {
    this.token = null;
    localStorage.removeItem('cyberforge_token');
    this.disconnectWebSocket();
  }

  isAuthenticated() {
    return !!this.token;
  }

  // =========================================
  // Analysis Endpoints
  // =========================================

  async getAnalysisStats() {
    return this.get('/api/analysis/stats');
  }

  async getAnalysisHistory(params = {}) {
    const { page = 1, limit = 20, status, analysisType, priority } = typeof params === 'object' ? params : { page: params, limit: 20 };
    const search = new URLSearchParams();
    search.set('page', page);
    search.set('limit', limit);
    if (status) search.set('status', status);
    if (analysisType) search.set('analysisType', analysisType);
    if (priority) search.set('priority', priority);
    return this.get(`/api/analysis/history?${search.toString()}`);
  }

  async analyzeUrl(url, options = {}) {
    return this.post('/api/analysis/url', { url, ...options });
  }

  async bulkAnalyze(urls, options = {}) {
    return this.post('/api/analysis/bulk', { urls, ...options });
  }

  async getAnalysis(analysisId) {
    return this.get(`/api/analysis/${analysisId}`);
  }

  async deleteAnalysis(analysisId) {
    return this.delete(`/api/analysis/${analysisId}`);
  }

  // =========================================
  // Threat Endpoints
  // =========================================

  async getThreats(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.get(`/api/threats${params ? '?' + params : ''}`);
  }

  async getThreatStats() {
    return this.get('/api/threats/stats');
  }

  async resolveThreat(threatId, payload = {}) {
    return this.put(`/api/threats/${threatId}/resolve`, payload);
  }

  async dismissThreat(threatId, payload = {}) {
    return this.put(`/api/threats/${threatId}/dismiss`, payload);
  }

  async scanForThreats(urls = [], scanType = 'quick') {
    return this.post('/api/threats/scan', { urls, scanType });
  }

  async getThreat(threatId) {
    return this.get(`/api/threats/${threatId}`);
  }

  async dismissThreat(threatId) {
    return this.put(`/api/threats/${threatId}/dismiss`);
  }

  // =========================================
  // AI Endpoints
  // =========================================

  async chatWithAI(message, conversationId = null, context = {}) {
    return this.post('/api/ai/chat', { message, conversationId, context });
  }

  async analyzeWebsiteAI(url, content = null) {
    return this.post('/api/ai/analyze-website', { url, content });
  }

  async scanThreatsAI(data) {
    return this.post('/api/ai/scan-threats', { data });
  }

  async getAIInsights(query, context = {}) {
    return this.post('/api/ai/insights', { query, context });
  }

  async getMLHealth() {
    return this.get('/api/ai/ml-health');
  }

  async executeAITask(taskType, taskData) {
    return this.post('/api/ai/execute-task-ml', { task_type: taskType, task_data: taskData });
  }

  async mlExecuteTask(taskType, taskData) {
    return this.post('/api/ai/execute-task-ml', { task_type: taskType, task_data: taskData });
  }

  async getAIRecommendations(query) {
    return this.post('/api/ai/recommendations', { query });
  }

  // =========================================
  // ML & Training Endpoints
  // =========================================

  async getDatasets() {
    return this.get('/api/ml/datasets');
  }

  async getDataset(datasetId) {
    return this.get(`/api/ml/datasets/${datasetId}`);
  }

  async downloadDataset(datasetId, forceRefresh = false) {
    return this.post('/api/ml/datasets/download', { datasetId, forceRefresh });
  }

  async getModels() {
    return this.get('/api/ml/models');
  }

  async getModelDetails(modelId) {
    return this.get(`/api/ml/models/${modelId}`);
  }

  async startTraining(datasetId, modelType, hyperparameters = {}, trainAll = false) {
    return this.post('/api/ml/train', { datasetId, modelType, hyperparameters, trainAll });
  }

  async getTrainingStatus(jobId) {
    return this.get(`/api/ml/train/status/${jobId}`);
  }

  async getTrainingHistory(limit = 20, offset = 0) {
    const params = new URLSearchParams({ limit, offset }).toString();
    return this.get(`/api/ml/train/history?${params}`);
  }

  async predict(modelId, data, context = {}) {
    return this.post('/api/ml/predict', { modelId, data, context });
  }

  async batchPredict(modelId, dataArray, context = {}) {
    return this.post('/api/ml/predict/batch', { modelId, dataArray, context });
  }

  // =========================================
  // Domain Intelligence
  // =========================================

  async analyzeDomain(domain, options = {}) {
    return this.post('/api/domain-intel/analyze', { domain, options });
  }

  async deepScanDomain(domain, options = {}) {
    return this.post('/api/domain-intel/deep-scan', { domain, ...options });
  }

  async getWatchedDomains(page = 1, limit = 50) {
    return this.get(`/api/domain-intel/watched?page=${page}&limit=${limit}`);
  }

  async watchDomain(domain, monitoringOptions = {}) {
    return this.post('/api/domain-intel/watch', { domain, monitoringOptions });
  }

  // =========================================
  // Threat Hunting
  // =========================================

  async getActiveHunts(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.get(`/api/threat-hunting/hunts${params ? '?' + params : ''}`);
  }

  async startQuickHunt(type, priority = 'medium') {
    return this.post('/api/threat-hunting/quick-hunt', { type, priority });
  }

  async startAIHunt(options = {}) {
    return this.post('/api/threat-hunting/ai-hunt', options);
  }

  async analyzeIOC(ioc, type = 'auto') {
    return this.post('/api/threat-hunting/analyze-ioc', { ioc, type });
  }

  // =========================================
  // Web Scraping
  // =========================================

  async getScrapingTasks() {
    return this.get('/api/scraping/tasks');
  }

  async scrapeDomain(domain, options = {}) {
    return this.post('/api/scraping/domain', { domain, options });
  }

  async getScrapingResults(taskId, page = 1) {
    return this.get(`/api/scraping/results/${taskId}?page=${page}`);
  }

  async stopScrapingTask(taskId) {
    return this.post(`/api/scraping/stop/${taskId}`);
  }

  // =========================================
  // WebSocket Connection
  // =========================================

  connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.wsReconnectAttempts = 0;
        
        // Identify as desktop client
        this.ws.send(JSON.stringify({
          type: 'identify',
          clientType: 'desktop',
          version: '1.0.0'
        }));

        if (this.token) {
          this.ws.send(JSON.stringify({
            type: 'authenticate',
            token: this.token
          }));
        }

        this.emit('ws:connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.emit('ws:disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('ws:error', error);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }

  attemptReconnect() {
    if (this.wsReconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      this.emit('ws:reconnect_failed');
      return;
    }

    this.wsReconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.wsReconnectAttempts), 30000);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.wsReconnectAttempts})`);
    setTimeout(() => this.connectWebSocket(), delay);
  }

  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  sendWebSocketMessage(type, data = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
      return true;
    }
    console.warn('WebSocket not connected');
    return false;
  }

  handleWebSocketMessage(data) {
    const { type, ...payload } = data;
    
    switch (type) {
      case 'connection_established':
        console.log('Connection confirmed:', payload);
        break;
      case 'analysis_result':
        this.emit('analysis:result', payload);
        break;
      case 'threat_alert':
        this.emit('threat:alert', payload);
        break;
      case 'sync_update':
        this.emit('sync:update', payload);
        break;
      default:
        this.emit(`ws:${type}`, payload);
    }
  }

  // =========================================
  // Event System
  // =========================================

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, data = null) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (e) {
          console.error(`Error in event handler for ${event}:`, e);
        }
      });
    }
  }

  // =========================================
  // Real-time Subscriptions
  // =========================================

  subscribeToThreats(callback) {
    this.on('threat:alert', callback);
    this.sendWebSocketMessage('subscribe', { channel: 'threats' });
  }

  subscribeToAnalysis(callback) {
    this.on('analysis:result', callback);
    this.sendWebSocketMessage('subscribe', { channel: 'analysis' });
  }

  subscribeToSync(callback) {
    this.on('sync:update', callback);
    this.sendWebSocketMessage('subscribe', { channel: 'sync' });
  }

  // =========================================
  // Request Analysis (for HTTP traffic display)
  // =========================================

  async requestAnalysis(requestData) {
    this.sendWebSocketMessage('analysis_request', { request: requestData });
  }

  async pageVisit(pageData) {
    this.sendWebSocketMessage('page_visit', pageData);
  }

  // =========================================
  // ML Training Endpoints
  // =========================================

  async getDatasets() {
    return this.get('/api/ml/datasets');
  }

  async getDatasetDetails(datasetId) {
    return this.get(`/api/ml/datasets/${datasetId}`);
  }

  async downloadDataset(datasetId) {
    return this.get(`/api/ml/datasets/${datasetId}/download`);
  }

  async previewDataset(datasetId, limit = 10) {
    return this.get(`/api/ml/datasets/${datasetId}/preview?limit=${limit}`);
  }

  async getModels() {
    return this.get('/api/ml/models');
  }

  async getModelDetails(modelId) {
    return this.get(`/api/ml/models/${modelId}`);
  }

  async getModelMetrics(modelId) {
    return this.get(`/api/ml/models/${modelId}/metrics`);
  }

  async trainModel(datasetId, modelType = 'auto', hyperparameters = {}, config = {}) {
    return this.post('/api/ml/train', {
      dataset_id: datasetId,
      model_type: modelType,
      hyperparameters,
      config
    });
  }

  async getTrainingStatus(jobId) {
    return this.get(`/api/ml/train/${jobId}/status`);
  }

  async getTrainingHistory(limit = 20) {
    return this.get(`/api/ml/train/history?limit=${limit}`);
  }

  async stopTraining(jobId) {
    return this.post(`/api/ml/train/${jobId}/stop`);
  }

  async evaluateModel(modelId, datasetId = null) {
    const params = datasetId ? `?dataset_id=${datasetId}` : '';
    return this.post(`/api/ml/evaluate/${modelId}${params}`);
  }

  async predict(modelId, data, format = 'json') {
    return this.post('/api/ml/predict', {
      model_id: modelId,
      data,
      format
    });
  }

  async batchPredict(modelId, samples) {
    return this.post('/api/ml/predict/batch', {
      model_id: modelId,
      samples
    });
  }

  // =========================================
  // Threat Detection ML Endpoints
  // =========================================

  async detectMalware(sample, fileHash = null) {
    return this.post('/api/ml/detect/malware', { sample, file_hash: fileHash });
  }

  async detectPhishing(url, emailContent = null) {
    return this.post('/api/ml/detect/phishing', { url, email_content: emailContent });
  }

  async detectIntrusion(networkData, realtime = false) {
    return this.post('/api/ml/detect/intrusion', { network_data: networkData, realtime });
  }

  async detectAnomaly(data, sensitivity = 0.5) {
    return this.post('/api/ml/detect/anomaly', { data, sensitivity });
  }

  async getDetectionStatus() {
    return this.get('/api/ml/detect/status');
  }

  // =========================================
  // Dashboard Statistics
  // =========================================

  async getDashboardStats() {
    return this.get('/api/dashboard/stats');
  }

  async getRealTimeThreats() {
    return this.get('/api/dashboard/threats/realtime');
  }

  async getSystemStatus() {
    return this.get('/api/dashboard/system/status');
  }

  async getRecentActivity(limit = 50) {
    return this.get(`/api/dashboard/activity?limit=${limit}`);
  }
}

// Create singleton instance
const cyberforgeAPI = new CyberForgeAPI();

// Export for Node/Electron require
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cyberforgeAPI, CyberForgeAPI };
}

// Expose to window for browser context (Electron renderer with nodeIntegration=false)
if (typeof window !== 'undefined') {
  window.cyberforgeAPI = cyberforgeAPI;
}
