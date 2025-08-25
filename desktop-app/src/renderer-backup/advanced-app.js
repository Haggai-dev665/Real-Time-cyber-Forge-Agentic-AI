/**
 * Cyber Forge AI - Advanced Desktop Application
 * Enhanced UI with comprehensive features and backend integration
 */

class CyberForgeAdvanced {
    constructor() {
        this.currentTab = 'dashboard';
        this.isConnected = false;
        this.mlConnected = false;
        this.userData = null;
        this.realTimeData = new Map();
        this.notifications = [];
        this.chatHistory = [];
        this.isLoading = false;
        
        // Initialize the application
        this.init();
    }

    async init() {
        try {
            this.showLoadingScreen();
            await this.setupEventListeners();
            await this.setupElectronAPI();
            await this.checkConnections();
            await this.loadInitialData();
            this.hideLoadingScreen();
            await this.loadContent('dashboard');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showToast('Failed to initialize application', 'error');
        }
    }

    showLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }, 1000);
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Global search
        const globalSearch = document.getElementById('global-search');
        if (globalSearch) {
            globalSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleGlobalSearch(e.target.value);
                }
            });
        }

        // Search type toggle
        document.querySelectorAll('.search-type').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.search-type').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // Header controls
        document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('fullscreen-toggle')?.addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('notifications-btn')?.addEventListener('click', () => this.showNotifications());

        // FAB
        document.getElementById('quick-scan-fab')?.addEventListener('click', () => this.quickSecurityScan());

        // Context menu
        document.addEventListener('contextmenu', (e) => this.showContextMenu(e));
        document.addEventListener('click', () => this.hideContextMenu());

        // System monitoring
        this.startSystemMonitoring();
    }

    async setupElectronAPI() {
        // Check if running in Electron
        if (window.electronAPI) {
            this.electronAPI = window.electronAPI;
            console.log('Electron API available');
        } else {
            console.warn('Electron API not available - running in browser mode');
        }
    }

    async checkConnections() {
        try {
            // Check backend connection
            const backendStatus = await this.checkBackendConnection();
            this.updateConnectionStatus('backend', backendStatus);

            // Check ML services connection
            const mlStatus = await this.checkMLConnection();
            this.updateConnectionStatus('ml', mlStatus);

            this.isConnected = backendStatus;
            this.mlConnected = mlStatus;
        } catch (error) {
            console.error('Connection check failed:', error);
        }
    }

    async checkBackendConnection() {
        try {
            if (this.electronAPI?.healthCheck) {
                const response = await this.electronAPI.healthCheck();
                console.log('Backend health check response:', response);
                return response.success;
            }
            return false;
        } catch (error) {
            console.error('Backend health check failed:', error);
            return false;
        }
    }

    async checkMLConnection() {
        try {
            if (this.electronAPI?.mlService?.healthCheck) {
                const response = await this.electronAPI.mlService.healthCheck();
                console.log('ML health check response:', response);
                return response.success;
            }
            return false;
        } catch (error) {
            console.error('ML service health check failed:', error);
            return false;
        }
    }

    updateConnectionStatus(service, connected) {
        const statusElement = document.getElementById(`${service}-status`);
        if (statusElement) {
            const dot = statusElement.querySelector('.status-dot');
            if (connected) {
                statusElement.classList.add('connected');
                dot.style.background = 'var(--success)';
            } else {
                statusElement.classList.remove('connected');
                dot.style.background = 'var(--error)';
            }
        }
    }

    async loadInitialData() {
        try {
            // Load user data
            await this.loadUserData();
            
            // Load recent threats
            await this.loadRecentThreats();
            
            // Initialize real-time monitoring
            this.initializeRealTimeMonitoring();
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    async loadUserData() {
        try {
            if (this.electronAPI?.auth?.getUser) {
                this.userData = await this.electronAPI.auth.getUser();
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    async loadRecentThreats() {
        try {
            if (this.electronAPI?.getThreats) {
                const threats = await this.electronAPI.getThreats();
                this.updateThreatCount(threats.length);
            }
        } catch (error) {
            console.error('Failed to load threats:', error);
        }
    }

    updateThreatCount(count) {
        const threatBadge = document.getElementById('threat-count');
        if (threatBadge) {
            threatBadge.textContent = count;
            threatBadge.style.display = count > 0 ? 'block' : 'none';
        }
    }

    initializeRealTimeMonitoring() {
        // Start real-time data collection
        setInterval(() => {
            this.updateSystemStats();
        }, 5000);
    }

    async updateSystemStats() {
        try {
            if (this.electronAPI?.getSystemStats) {
                const stats = await this.electronAPI.getSystemStats();
                
                const cpuElement = document.getElementById('cpu-usage');
                const memoryElement = document.getElementById('memory-usage');
                
                if (cpuElement && stats.cpu) {
                    cpuElement.textContent = `${Math.round(stats.cpu)}%`;
                }
                
                if (memoryElement && stats.memory) {
                    memoryElement.textContent = `${Math.round(stats.memory)}%`;
                }
            }
        } catch (error) {
            console.error('Failed to update system stats:', error);
        }
    }

    startSystemMonitoring() {
        // Update system stats every 5 seconds
        setInterval(() => {
            this.updateSystemStats();
        }, 5000);
    }

    async switchTab(tabName) {
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }

        this.currentTab = tabName;
        await this.loadContent(tabName);
    }

    async loadContent(contentType) {
        const container = document.getElementById('content-container');
        if (!container) return;

        // Show loading state
        container.innerHTML = '<div class="loading-placeholder">Loading...</div>';

        try {
            let content = '';
            
            switch (contentType) {
                case 'dashboard':
                    content = await this.renderDashboard();
                    break;
                case 'real-time':
                    content = await this.renderRealTimeMonitor();
                    break;
                case 'threats':
                    content = await this.renderThreatCenter();
                    break;
                case 'analysis':
                    content = await this.renderDeepAnalysis();
                    break;
                case 'ai-chat':
                    content = await this.renderAIChat();
                    break;
                case 'ml-models':
                    content = await this.renderMLModels();
                    break;
                case 'ai-insights':
                    content = await this.renderAIInsights();
                    break;
                case 'predictions':
                    content = await this.renderPredictions();
                    break;
                case 'vulnerability-scan':
                    content = await this.renderVulnerabilityScanner();
                    break;
                case 'network-analysis':
                    content = await this.renderNetworkAnalysis();
                    break;
                case 'malware-detection':
                    content = await this.renderMalwareDetection();
                    break;
                case 'forensics':
                    content = await this.renderDigitalForensics();
                    break;
                case 'datasets':
                    content = await this.renderDatasets();
                    break;
                case 'reports':
                    content = await this.renderReports();
                    break;
                case 'compliance':
                    content = await this.renderCompliance();
                    break;
                case 'settings':
                    content = await this.renderSettings();
                    break;
                case 'profile':
                    content = await this.renderProfile();
                    break;
                case 'logs':
                    content = await this.renderSystemLogs();
                    break;
                default:
                    content = '<div class="error-message">Content not found</div>';
            }

            container.innerHTML = content;
            await this.initializeContentScripts(contentType);
        } catch (error) {
            console.error(`Failed to load ${contentType} content:`, error);
            container.innerHTML = '<div class="error-message">Failed to load content</div>';
        }
    }

    async renderDashboard() {
        return `
            <div class="enhanced-dashboard-container">
                <!-- Real-Time Header -->
                <div class="dashboard-header">
                    <div class="header-left">
                        <h1 class="dashboard-title">Real-Time Security Dashboard</h1>
                        <div class="live-indicator">
                            <div class="pulse-dot"></div>
                            <span>Live Data</span>
                        </div>
                    </div>
                    <div class="header-right">
                        <div class="dashboard-time" id="current-time">${new Date().toLocaleString()}</div>
                        <button class="btn-primary" id="add-browser-btn">
                            <i class="fas fa-plus"></i>
                            Add Browser
                        </button>
                    </div>
                </div>
                
                <!-- Real-Time Metrics Grid -->
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-header">
                            <i class="fas fa-shield-alt"></i>
                            <h3>Threats Blocked</h3>
                        </div>
                        <div class="metric-value" id="threats-blocked">0</div>
                        <div class="metric-change positive" id="threats-change">+0%</div>
                        <canvas id="threats-mini-chart" class="mini-chart"></canvas>
                    </div>

                    <div class="metric-card">
                        <div class="metric-header">
                            <i class="fas fa-globe"></i>
                            <h3>Websites Analyzed</h3>
                        </div>
                        <div class="metric-value" id="websites-analyzed">0</div>
                        <div class="metric-change positive" id="websites-change">+0%</div>
                        <canvas id="websites-mini-chart" class="mini-chart"></canvas>
                    </div>

                    <div class="metric-card">
                        <div class="metric-header">
                            <i class="fas fa-network-wired"></i>
                            <h3>Network Events</h3>
                        </div>
                        <div class="metric-value" id="network-events">0</div>
                        <div class="metric-change neutral" id="network-change">+0%</div>
                        <canvas id="network-mini-chart" class="mini-chart"></canvas>
                    </div>

                    <div class="metric-card">
                        <div class="metric-header">
                            <i class="fas fa-brain"></i>
                            <h3>AI Predictions</h3>
                        </div>
                        <div class="metric-value" id="ai-predictions">0</div>
                        <div class="metric-change positive" id="ai-change">+0%</div>
                        <canvas id="ai-mini-chart" class="mini-chart"></canvas>
                    </div>
                </div>

                <!-- Charts Section -->
                <div class="charts-section">
                    <div class="chart-row">
                        <div class="chart-container large">
                            <div class="chart-header">
                                <h3>Real-Time Security Analytics</h3>
                                <select id="time-range" class="chart-select">
                                    <option value="1h">Last Hour</option>
                                    <option value="6h">Last 6 Hours</option>
                                    <option value="24h" selected>Last 24 Hours</option>
                                </select>
                            </div>
                            <canvas id="main-security-chart"></canvas>
                        </div>

                        <div class="chart-container medium">
                            <div class="chart-header">
                                <h3>Threat Distribution</h3>
                            </div>
                            <canvas id="threat-distribution-chart"></canvas>
                        </div>
                    </div>

                    <div class="chart-row">
                        <div class="chart-container medium">
                            <div class="chart-header">
                                <h3>Geographic Threat Map</h3>
                            </div>
                            <div id="threat-map" class="map-container"></div>
                        </div>

                        <div class="chart-container medium">
                            <div class="chart-header">
                                <h3>Browser Activity</h3>
                            </div>
                            <canvas id="browser-activity-chart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Browser Management Section -->
                <div class="browser-section">
                    <div class="section-header">
                        <h2>Browser Security Monitoring</h2>
                        <div class="browser-status" id="browser-status">
                            <div class="status-dot offline"></div>
                            <span>No browsers monitored</span>
                        </div>
                    </div>

                    <div class="browser-grid" id="browser-grid">
                        <!-- Browser cards will be dynamically added here -->
                    </div>

                    <div class="browser-analytics">
                        <div class="analytics-card">
                            <h3>Real-Time Web Activity</h3>
                            <div class="web-activity-feed" id="web-activity-feed">
                                <div class="no-activity">
                                    <i class="fas fa-globe"></i>
                                    <p>Start monitoring browsers to see real-time web activity</p>
                                </div>
                            </div>
                        </div>

                        <div class="analytics-card">
                            <h3>Page Analysis Results</h3>
                            <div class="analysis-results" id="analysis-results">
                                <div class="no-analysis">
                                    <i class="fas fa-search"></i>
                                    <p>Analysis results will appear here</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Live Threat Feed -->
                <div class="threat-feed-section">
                    <div class="section-header">
                        <h2>Live Threat Intelligence</h2>
                        <div class="feed-controls">
                            <button class="btn-secondary" id="pause-feed-btn">
                                <i class="fas fa-pause"></i>
                                Pause Feed
                            </button>
                            <button class="btn-secondary" id="clear-feed-btn">
                                <i class="fas fa-trash"></i>
                                Clear
                            </button>
                        </div>
                    </div>

                    <div class="threat-feed" id="threat-feed">
                        <!-- Real-time threat notifications will appear here -->
                    </div>
                </div>
            </div>

            <!-- Browser Modal -->
            <div class="modal" id="browser-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Add Browser for Monitoring</h2>
                        <button class="modal-close" id="close-browser-modal">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="browser-selection">
                            <h3>Available Browsers</h3>
                            <div class="browser-list" id="available-browsers">
                                <!-- Available browsers will be listed here -->
                            </div>
                        </div>
                        <div class="monitoring-options">
                            <h3>Monitoring Options</h3>
                            <label class="checkbox-label">
                                <input type="checkbox" id="enable-real-time-analysis" checked>
                                <span class="checkmark"></span>
                                Enable Real-Time Analysis
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="enable-threat-detection" checked>
                                <span class="checkmark"></span>
                                Advanced Threat Detection
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="enable-content-scraping" checked>
                                <span class="checkmark"></span>
                                Content Scraping & Analysis
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" id="cancel-browser-btn">Cancel</button>
                        <button class="btn-primary" id="confirm-browser-btn">Start Monitoring</button>
                    </div>
                </div>
            </div>
        `;
    }

    async renderAIChat() {
        return `
            <div class="ai-chat-container">
                <div class="chat-header">
                    <div class="chat-title">
                        <i class="fas fa-robot"></i>
                        <h2>AI Security Assistant</h2>
                    </div>
                    <div class="chat-status">
                        <div class="status-indicator ${this.mlConnected ? 'online' : 'offline'}">
                            <div class="status-dot"></div>
                            <span>${this.mlConnected ? 'AI Online' : 'AI Offline'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="chat-messages" id="chat-messages">
                    <div class="message ai-message">
                        <div class="message-avatar">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="message-content">
                            <div class="message-text">
                                Hello! I'm your AI Security Assistant. I can help you with threat analysis, security recommendations, and answer any cybersecurity questions you have. How can I assist you today?
                            </div>
                            <div class="message-time">${new Date().toLocaleTimeString()}</div>
                        </div>
                    </div>
                </div>
                
                <div class="chat-input-container">
                    <div class="chat-suggestions">
                        <button class="suggestion-chip" onclick="cyberForge.sendPredefinedMessage('What are the current security threats?')">
                            Current threats
                        </button>
                        <button class="suggestion-chip" onclick="cyberForge.sendPredefinedMessage('Analyze my security posture')">
                            Security analysis
                        </button>
                        <button class="suggestion-chip" onclick="cyberForge.sendPredefinedMessage('Recommend security improvements')">
                            Get recommendations
                        </button>
                    </div>
                    
                    <div class="chat-input-wrapper">
                        <div class="chat-input-box">
                            <textarea 
                                id="chat-input" 
                                placeholder="Ask me anything about cybersecurity..."
                                rows="1"
                            ></textarea>
                            <div class="input-actions">
                                <button class="attachment-btn" title="Attach file">
                                    <i class="fas fa-paperclip"></i>
                                </button>
                                <button class="voice-btn" title="Voice input">
                                    <i class="fas fa-microphone"></i>
                                </button>
                                <button class="send-btn" id="send-message" title="Send message">
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="chat-loading" id="chat-loading" style="display: none;">
                    <div class="message ai-message">
                        <div class="message-avatar">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="message-content">
                            <div class="typing-indicator">
                                <div class="typing-dots">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                                <span class="typing-text">AI is thinking...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initializeContentScripts(contentType) {
        switch (contentType) {
            case 'dashboard':
                await this.initializeDashboard();
                break;
            case 'ai-chat':
                this.initializeAIChat();
                break;
            // Add other content initializations as needed
        }
    }

    async initializeDashboard() {
        // Load recent threats
        await this.loadDashboardData();
        
        // Initialize enhanced dashboard components
        await this.initializeEnhancedDashboard();
    }

    async initializeEnhancedDashboard() {
        try {
            // Initialize charts
            await this.initializeCharts();
            
            // Initialize real-time metrics
            this.startMetricsUpdates();
            
            // Initialize threat map
            this.initializeMap();
            
            // Initialize browser monitoring
            this.initializeBrowserMonitoring();
            
            // Start real-time updates
            this.startRealTimeUpdates();
            
            console.log('Enhanced dashboard initialized successfully');
        } catch (error) {
            console.error('Failed to initialize enhanced dashboard:', error);
        }
    }

    async initializeCharts() {
        // Threat Trends Chart
        const threatTrendsCtx = document.getElementById('threatTrendsChart');
        if (threatTrendsCtx) {
            this.threatTrendsChart = new Chart(threatTrendsCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Threats Detected',
                        data: [],
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#ffffff' }
                        }
                    },
                    scales: {
                        x: { ticks: { color: '#888' } },
                        y: { ticks: { color: '#888' } }
                    }
                }
            });
        }

        // Security Score Chart
        const securityScoreCtx = document.getElementById('securityScoreChart');
        if (securityScoreCtx) {
            this.securityScoreChart = new Chart(securityScoreCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Secure', 'At Risk'],
                    datasets: [{
                        data: [85, 15],
                        backgroundColor: ['#4CAF50', '#FF5722'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#ffffff' }
                        }
                    }
                }
            });
        }

        // Attack Vectors Chart
        const attackVectorsCtx = document.getElementById('attackVectorsChart');
        if (attackVectorsCtx) {
            this.attackVectorsChart = new Chart(attackVectorsCtx, {
                type: 'bar',
                data: {
                    labels: ['Malware', 'Phishing', 'DDoS', 'SQL Injection', 'XSS'],
                    datasets: [{
                        label: 'Attack Attempts',
                        data: [23, 45, 12, 8, 19],
                        backgroundColor: [
                            '#FF6B6B', '#4ECDC4', '#45B7D1', 
                            '#FFA07A', '#98D8C8'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#ffffff' }
                        }
                    },
                    scales: {
                        x: { ticks: { color: '#888' } },
                        y: { ticks: { color: '#888' } }
                    }
                }
            });
        }
    }

    startMetricsUpdates() {
        // Update metrics every 5 seconds
        this.metricsInterval = setInterval(() => {
            this.updateRealTimeMetrics();
        }, 5000);
        
        // Initial update
        this.updateRealTimeMetrics();
    }

    updateRealTimeMetrics() {
        // Simulate real-time data updates
        const metrics = {
            activeThreats: Math.floor(Math.random() * 10) + 1,
            blockedAttempts: Math.floor(Math.random() * 100) + 50,
            securityScore: Math.floor(Math.random() * 20) + 80,
            systemHealth: Math.floor(Math.random() * 10) + 90
        };

        // Update metric displays
        this.updateMetricDisplay('active-threats', metrics.activeThreats);
        this.updateMetricDisplay('blocked-attempts', metrics.blockedAttempts);
        this.updateMetricDisplay('security-score', metrics.securityScore + '%');
        this.updateMetricDisplay('system-health', metrics.systemHealth + '%');
    }

    updateMetricDisplay(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
            
            // Add pulse animation
            element.classList.add('metric-update');
            setTimeout(() => {
                element.classList.remove('metric-update');
            }, 500);
        }
    }

    initializeMap() {
        const mapContainer = document.getElementById('threat-map');
        if (mapContainer && typeof L !== 'undefined') {
            // Initialize Leaflet map
            this.threatMap = L.map('threat-map').setView([40.7128, -74.0060], 2);
            
            // Add map tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.threatMap);
            
            // Add sample threat markers
            this.addThreatMarkers();
        }
    }

    addThreatMarkers() {
        const sampleThreats = [
            { lat: 40.7128, lng: -74.0060, type: 'DDoS Attack', severity: 'high' },
            { lat: 51.5074, lng: -0.1278, type: 'Malware', severity: 'medium' },
            { lat: 35.6762, lng: 139.6503, type: 'Phishing', severity: 'low' },
            { lat: -33.8688, lng: 151.2093, type: 'SQL Injection', severity: 'high' }
        ];

        sampleThreats.forEach(threat => {
            const icon = this.getThreatIcon(threat.severity);
            L.marker([threat.lat, threat.lng], { icon })
                .addTo(this.threatMap)
                .bindPopup('<b>' + threat.type + '</b><br>Severity: ' + threat.severity);
        });
    }

    getThreatIcon(severity) {
        const colors = {
            high: '#ff4444',
            medium: '#ffaa00',
            low: '#44ff44'
        };
        
        return L.divIcon({
            className: 'threat-marker',
            html: '<div style="background-color: ' + colors[severity] + '; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
    }

    initializeBrowserMonitoring() {
        // Initialize browser list
        this.updateBrowserList();
        
        // Set up browser monitoring controls
        const addBrowserBtn = document.getElementById('add-browser-btn');
        if (addBrowserBtn) {
            addBrowserBtn.addEventListener('click', () => {
                this.showAddBrowserDialog();
            });
        }
    }

    updateBrowserList() {
        const browserList = document.getElementById('browser-list');
        if (!browserList) return;

        // Sample browser data
        const browsers = [
            { name: 'Chrome', status: 'monitoring', threats: 2 },
            { name: 'Firefox', status: 'idle', threats: 0 },
            { name: 'Edge', status: 'monitoring', threats: 1 }
        ];

        browserList.innerHTML = browsers.map(browser => 
            '<div class="browser-item">' +
                '<div class="browser-info">' +
                    '<i class="fab fa-' + browser.name.toLowerCase() + '"></i>' +
                    '<span class="browser-name">' + browser.name + '</span>' +
                    '<span class="browser-status ' + browser.status + '">' + browser.status + '</span>' +
                '</div>' +
                '<div class="browser-threats">' +
                    '<span class="threat-count">' + browser.threats + '</span>' +
                    '<span class="threat-label">threats</span>' +
                '</div>' +
                '<div class="browser-actions">' +
                    '<button class="btn-icon" onclick="cyberForge.toggleBrowserMonitoring(\'' + browser.name + '\')">' +
                        '<i class="fas fa-' + (browser.status === 'monitoring' ? 'pause' : 'play') + '"></i>' +
                    '</button>' +
                    '<button class="btn-icon" onclick="cyberForge.removeBrowser(\'' + browser.name + '\')">' +
                        '<i class="fas fa-trash"></i>' +
                    '</button>' +
                '</div>' +
            '</div>'
        ).join('');
    }

    startRealTimeUpdates() {
        // Update threat feeds every 10 seconds
        this.threatFeedInterval = setInterval(() => {
            this.updateThreatFeeds();
        }, 10000);
        
        // Initial update
        this.updateThreatFeeds();
    }

    updateThreatFeeds() {
        const threatFeed = document.getElementById('threat-feed');
        if (!threatFeed) return;

        // Generate sample threat feed data
        const threats = [
            'New malware variant detected targeting financial institutions',
            'Critical vulnerability found in popular web framework',
            'Large-scale phishing campaign targeting healthcare sector',
            'Zero-day exploit detected in widely-used software',
            'Suspicious network activity from known threat actors'
        ];

        const randomThreat = threats[Math.floor(Math.random() * threats.length)];
        const timestamp = new Date().toLocaleTimeString();

        // Add new threat to feed
        const threatItem = document.createElement('div');
        threatItem.className = 'threat-feed-item';
        threatItem.innerHTML = 
            '<div class="threat-indicator"></div>' +
            '<div class="threat-content">' +
                '<div class="threat-text">' + randomThreat + '</div>' +
                '<div class="threat-timestamp">' + timestamp + '</div>' +
            '</div>';

        threatFeed.insertBefore(threatItem, threatFeed.firstChild);

        // Keep only last 5 items
        while (threatFeed.children.length > 5) {
            threatFeed.removeChild(threatFeed.lastChild);
        }
    }

    async loadDashboardData() {
        try {
            // Load and display recent threats
            if (this.electronAPI?.getThreats) {
                const response = await this.electronAPI.getThreats();
                console.log('Threats response:', response);
                
                // Handle the response structure properly
                const threats = response.success && response.data ? response.data : [];
                
                if (Array.isArray(threats)) {
                    this.displayRecentThreats(threats.slice(0, 5));
                } else {
                    console.warn('Threats data is not an array:', threats);
                    this.displayRecentThreats([]);
                }
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.displayRecentThreats([]);
        }
    }

    displayRecentThreats(threats) {
        const container = document.getElementById('recent-threats');
        if (!container) return;

        if (threats.length === 0) {
            container.innerHTML = '<div class="no-threats">No recent threats detected</div>';
            return;
        }

        const threatsHTML = threats.map(threat => 
            '<div class="threat-item ' + threat.severity + '">' +
                '<div class="threat-icon">' +
                    '<i class="fas fa-exclamation-triangle"></i>' +
                '</div>' +
                '<div class="threat-content">' +
                    '<div class="threat-title">' + threat.type + '</div>' +
                    '<div class="threat-description">' + threat.description + '</div>' +
                    '<div class="threat-time">' + new Date(threat.timestamp).toLocaleTimeString() + '</div>' +
                '</div>' +
                '<div class="threat-actions">' +
                    '<button class="btn-icon" onclick="cyberForge.viewThreatDetails(\'' + threat.id + '\')">' +
                        '<i class="fas fa-eye"></i>' +
                    '</button>' +
                '</div>' +
            '</div>'
        ).join('');

        container.innerHTML = threatsHTML;
    }

    initializeAIChat() {
        const chatInput = document.getElementById('chat-input');
        const sendButton = document.getElementById('send-message');
        
        if (chatInput && sendButton) {
            // Auto-resize textarea
            chatInput.addEventListener('input', () => {
                chatInput.style.height = 'auto';
                chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
            });

            // Send message on Enter (but not Shift+Enter)
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });

            // Send button click
            sendButton.addEventListener('click', () => this.sendChatMessage());
        }
    }

    async sendChatMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        if (!message) return;
        
        // Clear input
        chatInput.value = '';
        chatInput.style.height = 'auto';
        
        // Add user message to chat
        this.addMessageToChat('user', message);
        
        // Show loading indicator
        this.showChatLoading(true);
        
        try {
            // Send message to AI
            const response = await this.sendMessageToAI(message);
            
            // Hide loading and add AI response
            this.showChatLoading(false);
            this.addMessageToChat('ai', response);
            
        } catch (error) {
            console.error('Failed to send message to AI:', error);
            this.showChatLoading(false);
            this.addMessageToChat('ai', 'Sorry, I encountered an error processing your request. Please try again.');
        }
    }

    sendPredefinedMessage(message) {
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.value = message;
            this.sendChatMessage();
        }
    }

    addMessageToChat(sender, content) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = 'message ' + (sender === 'ai' ? 'ai-message' : 'user-message');
        
        const avatarIcon = sender === 'ai' ? 'fas fa-robot' : 'fas fa-user';
        const currentTime = new Date().toLocaleTimeString();
        
        messageElement.innerHTML = 
            '<div class="message-avatar">' +
                '<i class="' + avatarIcon + '"></i>' +
            '</div>' +
            '<div class="message-content">' +
                '<div class="message-text">' + content + '</div>' +
                '<div class="message-time">' + currentTime + '</div>' +
            '</div>';
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Add to chat history
        this.chatHistory.push({ sender, content, timestamp: new Date() });
    }

    showChatLoading(show) {
        const loadingElement = document.getElementById('chat-loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
            
            if (show) {
                const chatMessages = document.getElementById('chat-messages');
                if (chatMessages) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }
        }
    }

    async sendMessageToAI(message) {
        try {
            if (this.electronAPI?.mlService?.chat) {
                const response = await this.electronAPI.mlService.chat(message);
                if (response.success) {
                    return response.data.response || 'No response from AI service.';
                } else {
                    throw new Error(response.error || 'AI service error');
                }
            } else {
                // Fallback response if ML service is not available
                return 'AI service is currently unavailable. Please check your connection and try again.';
            }
        } catch (error) {
            console.error('AI chat error:', error);
            throw error;
        }
    }

    async handleGlobalSearch(query) {
        if (!query.trim()) return;

        const searchType = document.querySelector('.search-type.active')?.dataset.type || 'search';
        
        if (searchType === 'ai') {
            // Switch to AI chat and send message
            await this.switchTab('ai-chat');
            setTimeout(() => {
                const chatInput = document.getElementById('chat-input');
                if (chatInput) {
                    chatInput.value = query;
                    this.sendChatMessage();
                }
            }, 500);
        } else {
            // Perform regular search
            this.performSearch(query);
        }
    }

    async performSearch(query) {
        // Implement search functionality
        this.showToast('Searching for: ' + query, 'info');
    }

    async quickSecurityScan() {
        this.showToast('Starting quick security scan...', 'info');
        
        try {
            if (this.electronAPI?.mlService?.scanThreats) {
                const scanResult = await this.electronAPI.mlService.scanThreats({
                    target: 'system',
                    scanType: 'quick'
                });
                
                if (scanResult.success) {
                    this.showToast('Security scan completed successfully', 'success');
                    // Update threat count if new threats found
                    if (scanResult.data.threatsFound > 0) {
                        this.updateThreatCount(scanResult.data.threatsFound);
                    }
                } else {
                    this.showToast('Security scan failed', 'error');
                }
            }
        } catch (error) {
            console.error('Quick scan failed:', error);
            this.showToast('Security scan encountered an error', 'error');
        }
    }

    showToast(message, type = 'info', duration = 5000) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.innerHTML = 
            '<div class="toast-content">' +
                '<div class="toast-message">' + message + '</div>' +
                '<button class="toast-close" onclick="this.parentElement.parentElement.remove()">' +
                    '<i class="fas fa-times"></i>' +
                '</button>' +
            '</div>';

        toastContainer.appendChild(toast);

        // Auto-remove after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
    }

    showContextMenu(e) {
        e.preventDefault();
        const contextMenu = document.getElementById('context-menu');
        if (!contextMenu) return;

        contextMenu.style.display = 'block';
        contextMenu.style.left = e.pageX + 'px';
        contextMenu.style.top = e.pageY + 'px';
    }

    hideContextMenu() {
        const contextMenu = document.getElementById('context-menu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
    }

    toggleTheme() {
        // Implement theme toggling
        document.body.classList.toggle('light-theme');
        this.showToast('Theme toggled', 'info');
    }

    toggleFullscreen() {
        if (this.electronAPI?.toggleFullscreen) {
            this.electronAPI.toggleFullscreen();
        }
    }

    showNotifications() {
        this.showToast('Notifications panel coming soon', 'info');
    }

    // Placeholder methods for other content renderers
    async renderRealTimeMonitor() { return '<div class="placeholder">Real-time Monitor - Coming Soon</div>'; }
    async renderThreatCenter() { return '<div class="placeholder">Threat Center - Coming Soon</div>'; }
    async renderDeepAnalysis() { return '<div class="placeholder">Deep Analysis - Coming Soon</div>'; }
    async renderMLModels() { return '<div class="placeholder">ML Models - Coming Soon</div>'; }
    async renderAIInsights() { return '<div class="placeholder">AI Insights - Coming Soon</div>'; }
    async renderPredictions() { return '<div class="placeholder">Predictions - Coming Soon</div>'; }
    async renderVulnerabilityScanner() { return '<div class="placeholder">Vulnerability Scanner - Coming Soon</div>'; }
    async renderNetworkAnalysis() { return '<div class="placeholder">Network Analysis - Coming Soon</div>'; }
    async renderMalwareDetection() { return '<div class="placeholder">Malware Detection - Coming Soon</div>'; }
    async renderDigitalForensics() { return '<div class="placeholder">Digital Forensics - Coming Soon</div>'; }
    async renderDatasets() { return '<div class="placeholder">Datasets - Coming Soon</div>'; }
    async renderReports() { return '<div class="placeholder">Reports - Coming Soon</div>'; }
    async renderCompliance() { return '<div class="placeholder">Compliance - Coming Soon</div>'; }
    async renderSettings() { return '<div class="placeholder">Settings - Coming Soon</div>'; }
    async renderProfile() { return '<div class="placeholder">Profile - Coming Soon</div>'; }
    async renderSystemLogs() { return '<div class="placeholder">System Logs - Coming Soon</div>'; }

    // Enhanced Dashboard Interactive Methods
    showAddBrowserDialog() {
        // Implement browser addition dialog
        const browsers = ['Chrome', 'Firefox', 'Edge', 'Safari', 'Opera'];
        const browserSelect = browsers.map(browser => 
            '<option value="' + browser + '">' + browser + '</option>'
        ).join('');

        const dialog = 
            '<div class="modal-overlay" onclick="cyberForge.closeModal()">' +
                '<div class="modal-content" onclick="event.stopPropagation()">' +
                    '<div class="modal-header">' +
                        '<h3>Add Browser for Monitoring</h3>' +
                        '<button class="modal-close" onclick="cyberForge.closeModal()">' +
                            '<i class="fas fa-times"></i>' +
                        '</button>' +
                    '</div>' +
                    '<div class="modal-body">' +
                        '<div class="form-group">' +
                            '<label>Select Browser:</label>' +
                            '<select id="browser-select" class="form-control">' +
                                browserSelect +
                            '</select>' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>' +
                                '<input type="checkbox" id="enable-monitoring" checked>' +
                                'Enable real-time monitoring' +
                            '</label>' +
                        '</div>' +
                    '</div>' +
                    '<div class="modal-footer">' +
                        '<button class="btn btn-secondary" onclick="cyberForge.closeModal()">Cancel</button>' +
                        '<button class="btn btn-primary" onclick="cyberForge.addBrowser()">Add Browser</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        document.body.insertAdjacentHTML('beforeend', dialog);
    }

    addBrowser() {
        const browserSelect = document.getElementById('browser-select');
        const enableMonitoring = document.getElementById('enable-monitoring');
        
        if (browserSelect && enableMonitoring) {
            const browser = browserSelect.value;
            const monitoring = enableMonitoring.checked;
            
            console.log('Adding ' + browser + ' with monitoring: ' + monitoring);
            
            // Update browser list
            this.updateBrowserList();
            
            // Close modal
            this.closeModal();
            
            // Show success notification
            this.showNotification(browser + ' browser added successfully', 'success');
        }
    }

    toggleBrowserMonitoring(browserName) {
        console.log('Toggling monitoring for ' + browserName);
        this.updateBrowserList();
        this.showNotification(browserName + ' monitoring toggled', 'info');
    }

    removeBrowser(browserName) {
        console.log('Removing ' + browserName);
        this.updateBrowserList();
        this.showNotification(browserName + ' browser removed', 'warning');
    }

    closeModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'notification notification-' + type;
        notification.innerHTML = 
            '<div class="notification-content">' +
                '<i class="fas fa-' + this.getNotificationIcon(type) + '"></i>' +
                '<span>' + message + '</span>' +
            '</div>' +
            '<button class="notification-close" onclick="this.parentElement.remove()">' +
                '<i class="fas fa-times"></i>' +
            '</button>';

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    viewThreatDetails(threatId) {
        console.log('Viewing details for threat: ' + threatId);
        this.showNotification('Threat details feature coming soon!', 'info');
    }

    // Cleanup method for intervals
    cleanup() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        if (this.threatFeedInterval) {
            clearInterval(this.threatFeedInterval);
        }
    }
}

// Initialize the application when DOM is loaded
let cyberForge;
document.addEventListener('DOMContentLoaded', () => {
    cyberForge = new CyberForgeAdvanced();
    window.cyberForge = cyberForge; // Make globally accessible
});
