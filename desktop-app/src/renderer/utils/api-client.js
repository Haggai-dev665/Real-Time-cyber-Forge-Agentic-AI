/**
 * API Client for Backend Communication
 * Handles all HTTP requests to the backend and ML services
 */

class APIClient {
    constructor() {
        this.backendUrl = 'http://localhost:8000';
        this.authToken = localStorage.getItem('authToken');
        this.refreshToken = localStorage.getItem('refreshToken');
        
        // Set up interceptors
        this.setupRequestInterceptors();
    }

    setupRequestInterceptors() {
        // Auto-retry logic and token refresh
        this.retryCount = 3;
        this.retryDelay = 1000; // 1 second
    }

    // Helper method to make HTTP requests
    async request(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
                ...options.headers
            }
        };

        const finalOptions = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, finalOptions);
            
            // Handle 401 - attempt token refresh
            if (response.status === 401 && this.refreshToken) {
                const refreshed = await this.refreshAuthToken();
                if (refreshed) {
                    // Retry with new token
                    finalOptions.headers['Authorization'] = `Bearer ${this.authToken}`;
                    return await fetch(url, finalOptions);
                }
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Authentication methods
    async login(email, password) {
        try {
            const response = await this.request(`${this.backendUrl}/api/auth/login`, {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (response.success) {
                this.authToken = response.data.token;
                this.refreshToken = response.data.refreshToken;
                localStorage.setItem('authToken', this.authToken);
                localStorage.setItem('refreshToken', this.refreshToken);
                localStorage.setItem('user', JSON.stringify(response.data.user));
            }

            return response;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async register(userData) {
        try {
            const response = await this.request(`${this.backendUrl}/api/auth/register`, {
                method: 'POST',
                body: JSON.stringify(userData)
            });

            if (response.success) {
                this.authToken = response.data.token;
                this.refreshToken = response.data.refreshToken;
                localStorage.setItem('authToken', this.authToken);
                localStorage.setItem('refreshToken', this.refreshToken);
                localStorage.setItem('user', JSON.stringify(response.data.user));
            }

            return response;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async refreshAuthToken() {
        try {
            const response = await this.request(`${this.backendUrl}/api/auth/refresh`, {
                method: 'POST',
                body: JSON.stringify({ refreshToken: this.refreshToken })
            });

            if (response.success) {
                this.authToken = response.data.token;
                localStorage.setItem('authToken', this.authToken);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Token refresh failed:', error);
            this.logout();
            return false;
        }
    }

    async getProfile() {
        try {
            return await this.request(`${this.backendUrl}/api/auth/profile`);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateProfile(profileData) {
        try {
            return await this.request(`${this.backendUrl}/api/auth/profile`, {
                method: 'PUT',
                body: JSON.stringify(profileData)
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async changePassword(currentPassword, newPassword) {
        try {
            return await this.request(`${this.backendUrl}/api/auth/change-password`, {
                method: 'PUT',
                body: JSON.stringify({ currentPassword, newPassword })
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    logout() {
        this.authToken = null;
        this.refreshToken = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
    }

    // Threat management methods
    async getThreats(params = {}) {
        try {
            const queryParams = new URLSearchParams(params);
            return await this.request(`${this.backendUrl}/api/threats?${queryParams}`);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getThreatStats() {
        try {
            return await this.request(`${this.backendUrl}/api/threats/stats`);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async dismissThreat(threatId, reason, notes) {
        try {
            return await this.request(`${this.backendUrl}/api/threats/${threatId}/dismiss`, {
                method: 'PUT',
                body: JSON.stringify({ reason, notes })
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async resolveThreat(threatId, resolution, notes) {
        try {
            return await this.request(`${this.backendUrl}/api/threats/${threatId}/resolve`, {
                method: 'PUT',
                body: JSON.stringify({ resolution, notes })
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Analysis methods
    async getAnalysisStats() {
        try {
            return await this.request(`${this.backendUrl}/api/analysis/stats`);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async analyzeUrl(url, options = {}) {
        try {
            return await this.request(`${this.backendUrl}/api/analysis/url`, {
                method: 'POST',
                body: JSON.stringify({ url, ...options })
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getAnalysisHistory(params = {}) {
        try {
            const queryParams = new URLSearchParams(params);
            return await this.request(`${this.backendUrl}/api/analysis/history?${queryParams}`);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getAnalysis(analysisId) {
        try {
            return await this.request(`${this.backendUrl}/api/analysis/${analysisId}`);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async deleteAnalysis(analysisId) {
        try {
            return await this.request(`${this.backendUrl}/api/analysis/${analysisId}`, {
                method: 'DELETE'
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async bulkAnalyze(urls, options = {}) {
        try {
            return await this.request(`${this.backendUrl}/api/analysis/bulk`, {
                method: 'POST',
                body: JSON.stringify({ urls, ...options })
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // AI and ML methods
    async chatWithAI(message, conversationId = null, context = 'chat') {
        try {
            return await this.request(`${this.backendUrl}/api/ai/chat`, {
                method: 'POST',
                body: JSON.stringify({ message, conversationId, context })
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async analyzeFile(fileData, options = {}) {
        try {
            return await this.request(`${this.backendUrl}/api/ai/analyze/file`, {
                method: 'POST',
                body: JSON.stringify({ ...fileData, ...options })
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async analyzeNetworkTraffic(networkData, options = {}) {
        try {
            return await this.request(`${this.backendUrl}/api/ai/analyze/network`, {
                method: 'POST',
                body: JSON.stringify({ networkData, ...options })
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getMonitoringStatus() {
        try {
            return await this.request(`${this.backendUrl}/api/ai/monitoring/status`);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async startMonitoring() {
        try {
            return await this.request(`${this.backendUrl}/api/ai/monitoring/start`, {
                method: 'POST'
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async stopMonitoring() {
        try {
            return await this.request(`${this.backendUrl}/api/ai/monitoring/stop`, {
                method: 'POST'
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ML Service methods (via backend)
    async mlHealthCheck() {
        try {
            // Route through backend instead of direct ML service call
            return await this.request(`${this.backendUrl}/api/ai/ml-health`);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async mlAnalyze(query, context = 'general') {
        try {
            // Route through backend instead of direct ML service call
            return await this.request(`${this.backendUrl}/api/ai/chat`, {
                method: 'POST',
                body: JSON.stringify({ message: query, context })
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async mlAnalyzeUrl(url, context = 'website_analysis') {
        try {
            // Route through backend instead of direct ML service call
            return await this.request(`${this.backendUrl}/api/ai/analyze-website`, {
                method: 'POST',
                body: JSON.stringify({ url, context })
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async mlGetModels() {
        try {
            // Route through backend instead of direct ML service call
            return await this.request(`${this.backendUrl}/api/ai/models/status`);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async mlTrainModel(modelConfig) {
        try {
            // Route through backend instead of direct ML service call
            return await this.request(`${this.backendUrl}/api/ai/execute-task`, {
                method: 'POST',
                body: JSON.stringify({ task: 'train_model', config: modelConfig })
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async mlPredictThreat(data) {
        try {
            // Route through backend instead of direct ML service call
            return await this.request(`${this.backendUrl}/api/ai/scan-threats`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // System health check
    async checkBackendHealth() {
        try {
            return await this.request(`${this.backendUrl}/health`);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // File upload helper
    async uploadFile(file, endpoint, additionalData = {}) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            Object.keys(additionalData).forEach(key => {
                formData.append(key, additionalData[key]);
            });

            const response = await fetch(`${this.backendUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Helper method to check if user is authenticated
    isAuthenticated() {
        return !!this.authToken;
    }

    // Helper method to get current user
    getCurrentUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    }

    // Helper method to check user permissions
    hasPermission(permission) {
        const user = this.getCurrentUser();
        return user && user.permissions && user.permissions.includes(permission);
    }

    // Method to handle real-time updates (works with WebSocket)
    setupRealtimeHandlers(websocketManager) {
        this.websocketManager = websocketManager;
    }

    // Error handling helper
    handleApiError(error, context = '') {
        console.error(`API Error ${context}:`, error);
        
        if (error.message.includes('401')) {
            // Unauthorized - logout user
            this.logout();
            window.location.reload();
        }
        
        return {
            success: false,
            error: error.message,
            context
        };
    }
}

// Export singleton instance
window.apiClient = new APIClient();