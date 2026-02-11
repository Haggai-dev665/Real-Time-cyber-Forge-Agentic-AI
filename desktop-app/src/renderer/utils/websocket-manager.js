/**
 * WebSocket Manager for Real-time Communication
 * Handles WebSocket connections to the backend for real-time updates
 */

class WebSocketManager {
    constructor() {
        const config = (typeof window !== 'undefined' && window.electronAPI?.config) || {};
        this.url = (window.apiClient?.wsUrl) || config.wsUrl || 'wss://cyberforge-ddd97655464f.herokuapp.com/ws';
        this.authToken = window.apiClient?.token || localStorage.getItem('cyberforge_token');
        this.websocket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
        this.listeners = new Map();
        this.heartbeatInterval = null;
        this.heartbeatTimeout = 30000; // 30 seconds
        
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Auto-reconnect when page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !this.isConnected) {
                this.connect();
            }
        });
    }

    async connect() {
        if (this.websocket && (this.websocket.readyState === WebSocket.CONNECTING || this.websocket.readyState === WebSocket.OPEN)) {
            return;
        }

        // Refresh token from native store if possible
        await this.ensureAuthToken();

        try {
            console.log('🔌 Connecting to WebSocket...', this.url);
            this.websocket = new WebSocket(this.url);
            
            this.websocket.onopen = this.onOpen.bind(this);
            this.websocket.onmessage = this.onMessage.bind(this);
            this.websocket.onclose = this.onClose.bind(this);
            this.websocket.onerror = this.onError.bind(this);
        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.scheduleReconnect();
        }
    }

    onOpen(event) {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000; // Reset delay
        
        // Identify client
        this.send('identify', {
            clientType: 'desktop',
            version: '4.0',
            timestamp: new Date().toISOString()
        });

        if (this.authToken) {
            this.send('authenticate', {
                token: this.authToken,
                source: 'desktop-app'
            });
        }

        // Start heartbeat
        this.startHeartbeat();
        
        // Emit connection event
        this.emit('connected', { timestamp: new Date().toISOString() });
        
        // Update UI status
        this.updateConnectionStatus(true);
    }

    onMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('📨 WebSocket message received:', message.type);
            
            // Handle system messages
            if (message.type === 'connection_established') {
                console.log('🤝 Connection established:', message.clientId);
                return;
            }
            
            if (message.type === 'identification_confirmed') {
                console.log('✅ Client identification confirmed:', message.clientType);
                return;
            }
            
            if (message.type === 'authentication_confirmed') {
                console.log('✅ Authentication confirmed:', message.userId);
                return;
            }
            
            if (message.type === 'connection_acknowledged') {
                console.log('✅ Connection acknowledged');
                return;
            }
            
            if (message.type === 'heartbeat') {
                this.send('heartbeat', { timestamp: new Date().toISOString() });
                return;
            }
            
            // Emit message to listeners
            this.emit(message.type, message.data || message);
            
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    onClose(event) {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        this.isConnected = false;
        this.stopHeartbeat();
        
        // Update UI status
        this.updateConnectionStatus(false);
        
        // Emit disconnection event
        this.emit('disconnected', { 
            code: event.code, 
            reason: event.reason,
            timestamp: new Date().toISOString()
        });
        
        // Attempt reconnection if not a manual close
        if (event.code !== 1000 && event.code !== 1001) {
            this.scheduleReconnect();
        }
    }

    onError(error) {
        console.error('❌ WebSocket error:', error);
        this.emit('error', { error: error.message || 'WebSocket error' });
    }

    send(type, data = {}) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            const message = {
                type,
                data,
                timestamp: new Date().toISOString()
            };
            
            this.websocket.send(JSON.stringify(message));
            console.log('📤 WebSocket message sent:', message);
        } else {
            console.warn('WebSocket not connected, message queued:', type, data);
            // Could implement message queuing here
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.emit('maxReconnectAttemptsReached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);
        
        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);
        
        // Exponential backoff
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }

    async ensureAuthToken() {
        try {
            if (this.authToken) return;
            if (window.apiClient?.token) {
                this.authToken = window.apiClient.token;
                return;
            }
            if (window.electronAPI?.auth) {
                const response = await window.electronAPI.auth.getToken();
                if (response?.token) {
                    this.authToken = response.token;
                    if (window.apiClient?.setToken) {
                        window.apiClient.setToken(response.token);
                    }
                }
            }
        } catch (error) {
            console.warn('Unable to resolve auth token for WebSocket:', error.message);
        }
    }

    startHeartbeat() {
        this.stopHeartbeat(); // Clear any existing heartbeat
        
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.send('heartbeat', { timestamp: new Date().toISOString() });
            }
        }, this.heartbeatTimeout);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    disconnect() {
        console.log('🔌 Manually disconnecting WebSocket');
        this.stopHeartbeat();
        
        if (this.websocket) {
            this.websocket.close(1000, 'Manual disconnect');
        }
    }

    // Event listener management
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    // Helper methods for common operations
    requestPageAnalysis(url, options = {}) {
        this.send('analysis_request', {
            url,
            type: 'page_analysis',
            ...options
        });
    }

    requestThreatScan(target, scanType = 'comprehensive') {
        this.send('threat_scan', {
            target,
            scanType,
            timestamp: new Date().toISOString()
        });
    }

    requestData(dataType, filters = {}) {
        this.send('request_data', {
            dataType,
            filters,
            requestId: this.generateRequestId()
        });
    }

    reportPageVisit(pageData) {
        this.send('page_visit', {
            ...pageData,
            timestamp: new Date().toISOString()
        });
    }

    sendUserActivity(activity) {
        this.send('user_activity', {
            ...activity,
            timestamp: new Date().toISOString()
        });
    }

    // Update connection status in UI
    updateConnectionStatus(connected) {
        const backendStatus = document.getElementById('backend-status');
        if (backendStatus) {
            const statusDot = backendStatus.querySelector('.status-dot');
            if (statusDot) {
                statusDot.className = `status-dot ${connected ? 'connected' : 'disconnected'}`;
            }
            backendStatus.title = connected ? 'Backend Connected' : 'Backend Disconnected';
        }
    }

    // Utility methods
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getConnectionState() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            websocketState: this.websocket ? this.websocket.readyState : null,
            lastConnected: this.lastConnected
        };
    }

    // Setup default event handlers for common events
    setupDefaultHandlers() {
        // Analysis results
        this.on('analysis_result', (data) => {
            console.log('📊 Analysis result received:', data);
            window.notificationSystem?.show('success', 'Analysis Complete', `Analysis for ${data.url} completed`);
        });

        // Threat alerts
        this.on('threat_alert', (data) => {
            console.log('⚠️ Threat alert received:', data);
            window.notificationSystem?.show('danger', 'Threat Detected', data.message);
            
            // Update threat counter
            const threatCount = document.getElementById('threat-count');
            if (threatCount && data.totalThreats !== undefined) {
                threatCount.textContent = data.totalThreats;
            }
        });

        // Real-time data updates
        this.on('analysis_data', (data) => {
            console.log('📈 Real-time data received:', data);
            // Emit to application for handling
            window.dispatchEvent(new CustomEvent('realtimeData', { detail: data }));
        });

        // System notifications
        this.on('system_notification', (data) => {
            console.log('🔔 System notification:', data);
            window.notificationSystem?.show(data.type || 'info', data.title, data.message);
        });

        // Task updates
        this.on('task_update', (data) => {
            console.log('📋 Task update received:', data);
            window.dispatchEvent(new CustomEvent('taskUpdate', { detail: data }));
        });

        // Connection events
        this.on('connected', () => {
            window.notificationSystem?.show('success', 'Connected', 'Real-time connection established');
        });

        this.on('disconnected', () => {
            window.notificationSystem?.show('warning', 'Disconnected', 'Real-time connection lost. Attempting to reconnect...');
        });

        this.on('maxReconnectAttemptsReached', () => {
            window.notificationSystem?.show('error', 'Connection Failed', 'Unable to establish real-time connection. Please check your network.');
        });
    }

    // Cleanup
    destroy() {
        this.disconnect();
        this.listeners.clear();
    }
}

// Export singleton instance
window.websocketManager = new WebSocketManager();