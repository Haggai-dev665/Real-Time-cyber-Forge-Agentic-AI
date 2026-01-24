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
    // Check both localStorage and sessionStorage for token (auth-page-v2.js stores as 'authToken')
    this.token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    this.refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
    this.user = this.loadUser();
    this.ws = null;
    this.wsReconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.eventHandlers = new Map();
    this.isRefreshing = false;
  }

  loadUser() {
    try {
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
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

  async request(method, endpoint, data = null, retryOnAuth = true) {
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

      // Handle 401 - try to refresh token and retry once
      if (response.status === 401 && retryOnAuth && !endpoint.includes('/auth/')) {
        console.log('🔄 Token expired, attempting refresh...');
        const refreshed = await this.refreshAuthToken();
        if (refreshed) {
          // Retry the request with new token
          return this.request(method, endpoint, data, false);
        } else {
          // Refresh failed, emit event so UI can redirect to login
          this.emit('auth:expired');
          throw new Error('Session expired. Please log in again.');
        }
      }

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
    if (result.success && result.data?.data?.token) {
      this.setAuthData(result.data.data.token, result.data.data.user, result.data.data.refreshToken);
    } else if (result.success && result.data?.token) {
      this.setAuthData(result.data.token, result.data.user, result.data.refreshToken);
    }
    return result;
  }

  async register(userData) {
    const result = await this.post('/api/auth/register', userData);
    if (result.success && result.data?.data?.token) {
      this.setAuthData(result.data.data.token, result.data.data.user, result.data.data.refreshToken);
    } else if (result.success && result.data?.token) {
      this.setAuthData(result.data.token, result.data.user, result.data.refreshToken);
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
    this.refreshToken = null;
    this.user = null;
    // Clear all auth-related storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    // Legacy cleanup
    localStorage.removeItem('cyberforge_token');
    this.disconnectWebSocket();
    this.emit('auth:logout');
  }

  setAuthData(token, user, refreshToken = null) {
    this.token = token;
    this.user = user;
    this.refreshToken = refreshToken;
    localStorage.setItem('authToken', token);
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    this.emit('auth:login', { user });
  }

  getCurrentUser() {
    return this.user;
  }

  async refreshAuthToken() {
    if (this.isRefreshing) return false;
    this.isRefreshing = true;
    
    try {
      // If we have a refresh token, try to use it
      if (this.refreshToken) {
        const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: this.refreshToken })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.token) {
            this.setAuthData(data.data.token, data.data.user || this.user, data.data.refreshToken || this.refreshToken);
            this.isRefreshing = false;
            return true;
          }
        }
      }
      
      // Token refresh failed - user needs to re-authenticate
      this.logout();
      this.isRefreshing = false;
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.isRefreshing = false;
      return false;
    }
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
  // HTTP Requests/History Endpoints
  // =========================================

  async getHttpRequests(page = 1, limit = 50, filters = {}) {
    const params = new URLSearchParams({ page, limit, ...filters }).toString();
    return this.get(`/api/requests?${params}`);
  }

  async getHttpRequest(requestId) {
    return this.get(`/api/requests/${requestId}`);
  }

  async createHttpRequest(requestData) {
    return this.post('/api/requests', requestData);
  }

  async replayRequest(requestId, modifications = {}) {
    return this.post(`/api/requests/${requestId}/replay`, modifications);
  }

  async deleteHttpRequest(requestId) {
    return this.delete(`/api/requests/${requestId}`);
  }

  // =========================================
  // Intercept Endpoints
  // =========================================

  async getIntercepts(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.get(`/api/intercepts${params ? '?' + params : ''}`);
  }

  async getInterceptSettings() {
    return this.get('/api/intercepts/settings');
  }

  async updateInterceptSettings(settings) {
    return this.put('/api/intercepts/settings', settings);
  }

  async forwardIntercept(interceptId, modifications = {}) {
    return this.post(`/api/intercepts/${interceptId}/forward`, modifications);
  }

  async dropIntercept(interceptId) {
    return this.delete(`/api/intercepts/${interceptId}`);
  }

  async forwardAllIntercepts() {
    return this.post('/api/intercepts/forward-all');
  }

  async dropAllIntercepts() {
    return this.delete('/api/intercepts/all');
  }

  // =========================================
  // Match & Replace Rules
  // =========================================

  async getMatchRules() {
    return this.get('/api/match-rules');
  }

  async createMatchRule(rule) {
    return this.post('/api/match-rules', rule);
  }

  async updateMatchRule(ruleId, rule) {
    return this.put(`/api/match-rules/${ruleId}`, rule);
  }

  async deleteMatchRule(ruleId) {
    return this.delete(`/api/match-rules/${ruleId}`);
  }

  async toggleMatchRule(ruleId, enabled) {
    return this.put(`/api/match-rules/${ruleId}/toggle`, { enabled });
  }

  // =========================================
  // Automation Jobs
  // =========================================

  async getAutomations() {
    return this.get('/api/automations');
  }

  async createAutomation(automation) {
    return this.post('/api/automations', automation);
  }

  async updateAutomation(automationId, automation) {
    return this.put(`/api/automations/${automationId}`, automation);
  }

  async deleteAutomation(automationId) {
    return this.delete(`/api/automations/${automationId}`);
  }

  async runAutomation(automationId) {
    return this.post(`/api/automations/${automationId}/run`);
  }

  async pauseAutomation(automationId) {
    return this.post(`/api/automations/${automationId}/pause`);
  }

  async getAutomationLogs(automationId, page = 1) {
    return this.get(`/api/automations/${automationId}/logs?page=${page}`);
  }

  // =========================================
  // Workflows
  // =========================================

  async getWorkflows() {
    return this.get('/api/workflows');
  }

  async createWorkflow(workflow) {
    return this.post('/api/workflows', workflow);
  }

  async updateWorkflow(workflowId, workflow) {
    return this.put(`/api/workflows/${workflowId}`, workflow);
  }

  async deleteWorkflow(workflowId) {
    return this.delete(`/api/workflows/${workflowId}`);
  }

  async runWorkflow(workflowId, params = {}) {
    return this.post(`/api/workflows/${workflowId}/run`, params);
  }

  async getWorkflowRuns(workflowId, page = 1) {
    return this.get(`/api/workflows/${workflowId}/runs?page=${page}`);
  }

  // =========================================
  // Findings
  // =========================================

  async getFindings(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.get(`/api/findings${params ? '?' + params : ''}`);
  }

  async createFinding(finding) {
    return this.post('/api/findings', finding);
  }

  async updateFinding(findingId, finding) {
    return this.put(`/api/findings/${findingId}`, finding);
  }

  async deleteFinding(findingId) {
    return this.delete(`/api/findings/${findingId}`);
  }

  async resolveFinding(findingId, resolution) {
    return this.post(`/api/findings/${findingId}/resolve`, resolution);
  }

  // =========================================
  // Scopes
  // =========================================

  async getScopes() {
    return this.get('/api/scopes');
  }

  async createScope(scope) {
    return this.post('/api/scopes', scope);
  }

  async updateScope(scopeId, scope) {
    return this.put(`/api/scopes/${scopeId}`, scope);
  }

  async deleteScope(scopeId) {
    return this.delete(`/api/scopes/${scopeId}`);
  }

  // =========================================
  // Filters
  // =========================================

  async getFilters() {
    return this.get('/api/filters');
  }

  async createFilter(filter) {
    return this.post('/api/filters', filter);
  }

  async updateFilter(filterId, filter) {
    return this.put(`/api/filters/${filterId}`, filter);
  }

  async deleteFilter(filterId) {
    return this.delete(`/api/filters/${filterId}`);
  }

  async toggleFilter(filterId, enabled) {
    return this.put(`/api/filters/${filterId}/toggle`, { enabled });
  }

  // =========================================
  // Plugins
  // =========================================

  async getPlugins() {
    return this.get('/api/plugins');
  }

  async getPluginStore() {
    return this.get('/api/plugins/store');
  }

  async installPlugin(pluginId) {
    return this.post('/api/plugins/install', { pluginId });
  }

  async uninstallPlugin(pluginId) {
    return this.delete(`/api/plugins/${pluginId}`);
  }

  async togglePlugin(pluginId, enabled) {
    return this.put(`/api/plugins/${pluginId}/toggle`, { enabled });
  }

  // =========================================
  // Exports
  // =========================================

  async getExports() {
    return this.get('/api/exports');
  }

  async createExport(exportConfig) {
    return this.post('/api/exports', exportConfig);
  }

  async downloadExport(exportId) {
    return this.get(`/api/exports/${exportId}/download`);
  }

  async deleteExport(exportId) {
    return this.delete(`/api/exports/${exportId}`);
  }

  // =========================================
  // Environment Variables
  // =========================================

  async getEnvironmentVariables() {
    return this.get('/api/environment');
  }

  async setEnvironmentVariable(key, value, scope = 'session') {
    return this.post('/api/environment', { key, value, scope });
  }

  async deleteEnvironmentVariable(key) {
    return this.delete(`/api/environment/${key}`);
  }

  // =========================================
  // Sitemap
  // =========================================

  async getSitemap(domain) {
    return this.get(`/api/sitemap/${encodeURIComponent(domain)}`);
  }

  async buildSitemap(domain, options = {}) {
    return this.post('/api/sitemap/build', { domain, ...options });
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

  async chatWithAI(message, conversationHistory = [], context = {}) {
    return this.post('/api/ai/chat', { message, conversationHistory, context });
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
        
        // Identify as desktop client with auth token
        const identifyMessage = {
          type: 'identify',
          clientType: 'desktop',
          version: '1.0.0'
        };
        
        // Include auth token if available
        if (this.token) {
          identifyMessage.token = this.token;
        }
        
        this.ws.send(JSON.stringify(identifyMessage));

        // Also send separate authenticate message for backend compatibility
        if (this.token) {
          this.ws.send(JSON.stringify({
            type: 'authenticate',
            token: this.token
          }));
        }

        // Request initial OTX threat data
        this.ws.send(JSON.stringify({
          type: 'request_initial_threats'
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
      case 'otx_threat':
        // Real-time threat from OTX
        this.emit('otx:threat', payload.threat);
        break;
      case 'initial_threats':
        // Initial batch of threats on connection
        this.emit('otx:initial_threats', payload.threats);
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

// Expose on window for renderer usage when nodeIntegration is disabled
if (typeof window !== 'undefined') {
  window.cyberforgeAPI = cyberforgeAPI;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cyberforgeAPI, CyberForgeAPI };
}
