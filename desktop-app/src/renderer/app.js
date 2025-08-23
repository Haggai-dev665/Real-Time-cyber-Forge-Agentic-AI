class CyberForgeUI {
    constructor() {
        this.currentTab = 'dashboard';
        this.isConnected = false;
        this.metrics = {
            pagesCount: 0,
            threatsCount: 0,
            riskScore: 0,
            insightsCount: 0
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupElectronAPI();
        this.initializeUI();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchTab(e.target.closest('.nav-item').dataset.tab);
            });
        });

        // Chat functionality
        const chatInput = document.getElementById('chat-input');
        const sendButton = document.getElementById('send-message');
        
        sendButton.addEventListener('click', () => this.sendChatMessage());
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });

        // Settings
        document.getElementById('monitoring-enabled').addEventListener('change', (e) => {
            this.updateSetting('monitoring', e.target.checked);
        });

        document.getElementById('threat-alerts').addEventListener('change', (e) => {
            this.updateSetting('threatAlerts', e.target.checked);
        });

        document.getElementById('ai-insights').addEventListener('change', (e) => {
            this.updateSetting('aiInsights', e.target.checked);
        });
    }

    setupElectronAPI() {
        if (window.electronAPI) {
            // Backend status updates
            window.electronAPI.onBackendStatus((event, status) => {
                this.updateBackendStatus(status);
            });

            // Analysis results
            window.electronAPI.onAnalysisResult((event, data) => {
                this.handleAnalysisResult(data);
            });

            // Threat alerts
            window.electronAPI.onThreatAlert((event, data) => {
                this.handleThreatAlert(data);
            });

            // AI insights
            window.electronAPI.onAIInsight((event, data) => {
                this.handleAIInsight(data);
            });

            console.log('Electron API initialized');
        } else {
            console.warn('Electron API not available');
        }
    }

    initializeUI() {
        this.updateMetrics();
        this.addActivityItem('System initialized', 'info');
        this.switchTab('dashboard');
    }

    switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        this.currentTab = tabName;

        // Load tab-specific data
        this.loadTabData(tabName);
    }

    loadTabData(tabName) {
        switch (tabName) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'analysis':
                this.loadAnalysisData();
                break;
            case 'threats':
                this.loadThreatsData();
                break;
            case 'ai-chat':
                // Chat is always loaded
                break;
            case 'settings':
                // Settings are always loaded
                break;
        }
    }

    async loadDashboardData() {
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.getAnalysisData();
                this.metrics.pagesCount = data.totalVisits || 0;
                this.updateMetrics();
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        }
    }

    async loadAnalysisData() {
        const container = document.getElementById('analysis-results');
        container.innerHTML = '<div class="loading">Loading analysis data...</div>';
        
        try {
            if (window.electronAPI) {
                const data = await window.electronAPI.getAnalysisData();
                this.displayAnalysisResults(data);
            }
        } catch (error) {
            container.innerHTML = '<div class="error">Failed to load analysis data</div>';
        }
    }

    loadThreatsData() {
        const container = document.getElementById('threats-list');
        container.innerHTML = '<div class="loading">Scanning for threats...</div>';
        
        // Simulate threat detection
        setTimeout(() => {
            this.displayThreats([
                {
                    type: 'Suspicious Domain',
                    description: 'Detected access to potentially malicious domain',
                    severity: 'medium',
                    url: 'example-suspicious.com',
                    timestamp: new Date().toISOString()
                }
            ]);
        }, 1000);
    }

    updateBackendStatus(status) {
        const statusElement = document.getElementById('backend-status');
        statusElement.className = 'status-item';
        
        switch (status) {
            case 'connected':
                statusElement.classList.add('connected');
                this.isConnected = true;
                break;
            case 'disconnected':
                statusElement.classList.add('disconnected');
                this.isConnected = false;
                break;
            case 'error':
                statusElement.classList.add('warning');
                this.isConnected = false;
                break;
        }
    }

    handleAnalysisResult(data) {
        this.addActivityItem(`Analysis completed for ${data.url}`, 'info');
        if (data.security && data.security.hasWarnings) {
            this.metrics.threatsCount++;
            this.updateMetrics();
        }
    }

    handleThreatAlert(data) {
        this.metrics.threatsCount++;
        this.updateMetrics();
        this.addActivityItem(`Threat detected: ${data.type}`, 'warning');
        
        // Show notification
        this.showNotification('Security Alert', `Threat detected: ${data.type}`, 'warning');
    }

    handleAIInsight(data) {
        this.metrics.insightsCount++;
        this.updateMetrics();
        this.addActivityItem(`AI Insight: ${data.summary}`, 'info');
    }

    updateMetrics() {
        document.getElementById('pages-count').textContent = this.metrics.pagesCount;
        document.getElementById('threats-count').textContent = this.metrics.threatsCount;
        document.getElementById('insights-count').textContent = this.metrics.insightsCount;
        
        // Update risk score
        const riskScore = Math.min(this.metrics.threatsCount * 10, 100);
        const riskLevel = riskScore < 30 ? 'Low' : riskScore < 70 ? 'Medium' : 'High';
        
        document.getElementById('risk-score').textContent = riskLevel;
        document.getElementById('risk-fill').style.width = `${riskScore}%`;
    }

    addActivityItem(message, type = 'info') {
        const activityList = document.getElementById('activity-list');
        const item = document.createElement('div');
        item.className = `activity-item ${type}`;
        
        item.innerHTML = `
            <div class="activity-message">${message}</div>
            <div class="activity-time">${new Date().toLocaleTimeString()}</div>
        `;
        
        activityList.insertBefore(item, activityList.firstChild);
        
        // Keep only last 50 items
        while (activityList.children.length > 50) {
            activityList.removeChild(activityList.lastChild);
        }
    }

    async sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add user message
        this.addChatMessage(message, 'user');
        input.value = '';
        
        // Add loading indicator
        const loadingId = this.addChatMessage('Thinking...', 'ai', true);
        
        try {
            if (window.electronAPI) {
                const response = await window.electronAPI.queryAI(message);
                
                // Remove loading message
                document.getElementById(loadingId).remove();
                
                // Add AI response
                this.addChatMessage(response.response || response, 'ai');
            } else {
                // Remove loading message
                document.getElementById(loadingId).remove();
                
                // Fallback response
                this.addChatMessage('AI service is not available. Please check your connection.', 'ai');
            }
        } catch (error) {
            // Remove loading message
            document.getElementById(loadingId).remove();
            
            this.addChatMessage('Sorry, I encountered an error. Please try again.', 'ai');
            console.error('Chat error:', error);
        }
    }

    addChatMessage(message, sender, isLoading = false) {
        const chatMessages = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');
        const messageId = `msg-${Date.now()}`;
        
        messageElement.id = messageId;
        messageElement.className = `message ${sender}-message${isLoading ? ' loading' : ''}`;
        
        messageElement.innerHTML = `
            <div class="message-content">
                <strong>${sender === 'user' ? 'You' : 'AI Assistant'}:</strong> ${message}
            </div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        return messageId;
    }

    displayAnalysisResults(data) {
        const container = document.getElementById('analysis-results');
        
        if (!data || !data.visitedPages || data.visitedPages.length === 0) {
            container.innerHTML = '<div class="no-data">No analysis data available</div>';
            return;
        }
        
        const results = `
            <div class="analysis-summary">
                <h4>Analysis Summary</h4>
                <p>Total pages analyzed: ${data.totalVisits}</p>
                <p>Monitoring status: ${data.isMonitoring ? 'Active' : 'Inactive'}</p>
            </div>
            <div class="recent-pages">
                <h4>Recent Pages</h4>
                ${data.visitedPages.slice(-10).map(page => `
                    <div class="page-item">
                        <div class="page-url">${page.url}</div>
                        <div class="page-time">${new Date(page.timestamp).toLocaleString()}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.innerHTML = results;
    }

    displayThreats(threats) {
        const container = document.getElementById('threats-list');
        
        if (!threats || threats.length === 0) {
            container.innerHTML = '<div class="no-threats">No threats detected</div>';
            return;
        }
        
        const threatsHTML = threats.map(threat => `
            <div class="threat-item">
                <div class="threat-info">
                    <div class="threat-type">${threat.type}</div>
                    <div class="threat-description">${threat.description}</div>
                    <div class="threat-url">${threat.url}</div>
                </div>
                <div class="threat-severity ${threat.severity}">${threat.severity.toUpperCase()}</div>
            </div>
        `).join('');
        
        container.innerHTML = threatsHTML;
    }

    showNotification(title, message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    updateSetting(setting, value) {
        console.log(`Setting ${setting} updated to:`, value);
        
        if (window.electronAPI) {
            window.electronAPI.sendToBackend({
                type: 'setting_update',
                setting: setting,
                value: value
            });
        }
    }
}

// Global functions
window.scanForThreats = function() {
    const ui = window.cyberForgeUI;
    ui.loadThreatsData();
    ui.addActivityItem('Manual threat scan initiated', 'info');
};

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.cyberForgeUI = new CyberForgeUI();
    console.log('Cyber Forge UI initialized');
});