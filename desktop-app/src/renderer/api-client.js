/**
 * CyberForge API Client
 * Handles all communication between the desktop app and backend services
 */

const API_BASE_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws';

class CyberForgeAPI {
  constructor() {
    this.baseUrl = API_BASE_URL;
    this.wsUrl = WS_URL;
    this.token = localStorage.getItem('cyberforge_token');
    this.ws = null;
    this.wsReconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.eventHandlers = new Map();
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

      if (!response.ok) {
        throw new Error(json.message || `HTTP ${response.status}`);
      }

      return { success: true, data: json };
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

  async getServerStatus() {
    return this.get('/ws/info');
  }

  // =========================================
  // Authentication
  // =========================================

  async login(email, password) {
    const result = await this.post('/api/auth/login', { email, password });
    if (result.success && result.data.token) {
      this.token = result.data.token;
      localStorage.setItem('cyberforge_token', this.token);
    }
    return result;
  }

  async register(userData) {
    const result = await this.post('/api/auth/register', userData);
    if (result.success && result.data.token) {
      this.token = result.data.token;
      localStorage.setItem('cyberforge_token', this.token);
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

  async getAnalysisHistory(page = 1, limit = 20) {
    return this.get(`/api/analysis/history?page=${page}&limit=${limit}`);
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
}

// Create singleton instance
const cyberforgeAPI = new CyberForgeAPI();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cyberforgeAPI, CyberForgeAPI };
}
