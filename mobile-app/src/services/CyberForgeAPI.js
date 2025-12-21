/**
 * CyberForge API Service for Mobile App
 * Comprehensive API client for all backend endpoints
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = __DEV__ ? 'http://localhost:8000' : 'https://api.cyberforge.ai';
const WS_BASE_URL = __DEV__ ? 'ws://localhost:8000/ws' : 'wss://api.cyberforge.ai/ws';

class CyberForgeAPIService {
  constructor() {
    this.baseUrl = API_BASE_URL;
    this.wsUrl = WS_BASE_URL;
    this.token = null;
    this.ws = null;
    this.eventHandlers = new Map();
  }

  // =========================================
  // Token Management
  // =========================================

  async loadToken() {
    try {
      this.token = await AsyncStorage.getItem('authToken');
      return this.token;
    } catch (error) {
      console.error('Failed to load token:', error);
      return null;
    }
  }

  async setToken(token) {
    this.token = token;
    if (token) {
      await AsyncStorage.setItem('authToken', token);
    } else {
      await AsyncStorage.removeItem('authToken');
    }
  }

  // =========================================
  // HTTP Request Helpers
  // =========================================

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'cyber-forge-mobile/1.0',
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
      headers: this.getHeaders(),
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
    if (result.success && result.data.data?.token) {
      await this.setToken(result.data.data.token);
    }
    return result;
  }

  async register(userData) {
    const result = await this.post('/api/auth/register', userData);
    if (result.success && result.data.data?.token) {
      await this.setToken(result.data.data.token);
    }
    return result;
  }

  async getProfile() {
    return this.get('/api/auth/profile');
  }

  async updateProfile(profileData) {
    return this.put('/api/auth/profile', profileData);
  }

  async logout() {
    await this.setToken(null);
    this.disconnectWebSocket();
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

  async getAnalysis(analysisId) {
    return this.get(`/api/analysis/${analysisId}`);
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
    return this.post('/api/ai/chat', { 
      message, 
      conversationId, 
      context: { ...context, source: 'mobile' }
    });
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

  // =========================================
  // Domain Intelligence
  // =========================================

  async analyzeDomain(domain, options = {}) {
    return this.post('/api/domain-intel/analyze', { domain, options });
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

  async analyzeIOC(ioc, type = 'auto') {
    return this.post('/api/threat-hunting/analyze-ioc', { ioc, type });
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
        console.log('✅ Mobile WebSocket connected');
        this.ws.send(JSON.stringify({
          type: 'identify',
          clientType: 'mobile',
          version: '1.0.0',
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
        console.log('WebSocket disconnected:', event.code);
        this.emit('ws:disconnected');
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('ws:error', error);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }

  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  handleWebSocketMessage(data) {
    const { type, ...payload } = data;
    
    switch (type) {
      case 'threat_alert':
        this.emit('threat:alert', payload);
        break;
      case 'analysis_result':
        this.emit('analysis:result', payload);
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
    return () => this.off(event, handler);
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

  // Subscribe to real-time events
  subscribeToThreats(callback) {
    return this.on('threat:alert', callback);
  }

  subscribeToAnalysis(callback) {
    return this.on('analysis:result', callback);
  }
}

// Create singleton instance
const cyberforgeAPI = new CyberForgeAPIService();

export default cyberforgeAPI;
export { CyberForgeAPIService };
