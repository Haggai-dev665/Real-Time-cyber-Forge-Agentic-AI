/**
 * Cyber Forge AI Desktop Application
 * Main application controller
 */

class CyberForgeApp {
    constructor() {
        this.currentScreen = 'dashboard';
        this.isInitialized = false;
        this.screens = new Map();
        this.isConnected = false;
        this.systemStats = {
            cpu: 0,
            memory: 0,
            threats: 0,
            analyses: 0
        };
        
        // Loading progress tracking
        this.loadingSteps = [
            'Initializing security systems...',
            'Loading threat intelligence...',
            'Connecting to backend services...',
            'Setting up real-time monitoring...',
            'Starting AI analysis engines...',
            'Finalizing initialization...'
        ];
        this.currentStep = 0;
        
        this.init();
    }

    async init() {
        console.log('🚀 Starting Cyber Forge AI Application...');
        
        try {
            // Show loading screen
            this.showLoadingScreen();
            
            // Initialize core systems
            await this.initializeCore();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Connect to services
            await this.connectToServices();
            
            // Initialize screens
            await this.initializeScreens();
            
            // Start periodic updates
            this.startPeriodicUpdates();
            
            // Show initial screen
            this.showScreen('dashboard');
            
            // Hide loading screen
            this.hideLoadingScreen();
            
            this.isInitialized = true;
            console.log('✅ Application initialized successfully');
            
        } catch (error) {
            console.error('❌ Application initialization failed:', error);
            this.showErrorScreen(error);
        }
    }

    showLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
            this.updateLoadingProgress(0);
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            this.updateLoadingProgress(100);
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }, 500);
        }
    }

    updateLoadingProgress(percentage) {
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        const loadingText = document.querySelector('.loading-text');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${percentage}%`;
        }
        
        if (loadingText && this.currentStep < this.loadingSteps.length) {
            loadingText.textContent = this.loadingSteps[this.currentStep];
            this.currentStep++;
        }
    }

    async initializeCore() {
        this.updateLoadingProgress(15);
        
        // Initialize API client
        if (typeof APIClient !== 'undefined') {
            window.apiClient = new APIClient();
            console.log('✅ API client initialized');
        } else {
            console.warn('⚠️ APIClient not available');
        }
        
        // Initialize utilities
        if (window.themeManager) {
            window.themeManager.respectSystemPreferences();
        }
        
        if (window.notificationSystem) {
            console.log('✅ Notification system ready');
        }
        
        if (window.websocketManager) {
            window.websocketManager.setupDefaultHandlers();
            console.log('✅ WebSocket manager ready');
        }
        
        this.updateLoadingProgress(30);
    }

    setupEventListeners() {
        // Navigation events
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const screenName = e.currentTarget.dataset.screen;
                if (screenName) {
                    this.showScreen(screenName);
                }
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
            
            globalSearch.addEventListener('input', (e) => {
                this.handleSearchSuggestions(e.target.value);
            });
        }

        // Search type toggle
        document.querySelectorAll('.search-type').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.search-type').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                const searchType = e.currentTarget.dataset.type;
                this.updateSearchPlaceholder(searchType);
            });
        });

        // Header controls
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => this.showNotificationsPanel());
        }

        const fullscreenToggle = document.getElementById('fullscreen-toggle');
        if (fullscreenToggle) {
            fullscreenToggle.addEventListener('click', () => this.toggleFullscreen());
        }

        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showQuickSettings());
        }

        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }

        // FAB actions
        const fab = document.getElementById('quick-scan-fab');
        if (fab) {
            fab.addEventListener('click', () => this.toggleFabMenu());
        }

        document.querySelectorAll('.fab-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleFabAction(action);
            });
        });

        // Real-time data events
        window.addEventListener('realtimeData', (e) => {
            this.handleRealtimeData(e.detail);
        });

        window.addEventListener('taskUpdate', (e) => {
            this.handleTaskUpdate(e.detail);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    async connectToServices() {
        this.updateLoadingProgress(45);
        
        try {
            // Connect WebSocket
            if (window.websocketManager) {
                window.websocketManager.connect();
                
                // Wait for connection with timeout
                await this.waitForConnection(5000);
            }
            
            // Check backend health
            if (window.apiClient) {
                const health = await window.apiClient.checkBackendHealth();
                if (health.success) {
                    this.updateConnectionStatus('backend', true);
                    console.log('✅ Backend connection established');
                } else {
                    console.warn('⚠️ Backend health check failed');
                }
            }
            
            // Check ML service health
            if (window.apiClient) {
                const mlHealth = await window.apiClient.mlHealthCheck();
                if (mlHealth.success) {
                    this.updateConnectionStatus('ml', true);
                    console.log('✅ ML service connection established');
                } else {
                    console.warn('⚠️ ML service health check failed');
                }
            }
            
            this.updateLoadingProgress(60);
            
        } catch (error) {
            console.error('Service connection error:', error);
            window.notificationSystem?.warning('Connection Warning', 'Some services are not available. Features may be limited.');
        }
    }

    async waitForConnection(timeout = 5000) {
        return new Promise((resolve) => {
            const checkConnection = () => {
                if (window.websocketManager?.isConnected) {
                    resolve(true);
                } else {
                    setTimeout(checkConnection, 100);
                }
            };
            
            checkConnection();
            
            // Timeout fallback
            setTimeout(() => resolve(false), timeout);
        });
    }

    async initializeScreens() {
        this.updateLoadingProgress(75);
        
        // Initialize all screens
        const screenClasses = {
            'dashboard': DashboardScreen,
            'real-time-monitor': RealTimeMonitorScreen,
            'threat-center': ThreatCenterScreen,
            'deep-analysis': DeepAnalysisScreen,
            'ai-assistant': AIAssistantScreen,
            'ml-models': MLModelsScreen,
            'ai-insights': AIInsightsScreen,
            'predictions': PredictionsScreen,
            'vulnerability-scanner': VulnerabilityScannerScreen,
            'network-analysis': NetworkAnalysisScreen,
            'malware-detection': MalwareDetectionScreen,
            'digital-forensics': DigitalForensicsScreen,
            'datasets': DatasetsScreen,
            'reports': ReportsScreen,
            'compliance': ComplianceScreen,
            'settings': SettingsScreen,
            'profile': ProfileScreen,
            'system-logs': SystemLogsScreen,
            'incident-response': IncidentResponseScreen,
            'risk-assessment': RiskAssessmentScreen,
            'security-metrics': SecurityMetricsScreen,
            'penetration-testing': PenetrationTestingScreen
        };

        // Only initialize screens that have classes defined
        Object.entries(screenClasses).forEach(([screenName, ScreenClass]) => {
            if (ScreenClass) {
                try {
                    const screen = new ScreenClass();
                    this.screens.set(screenName, screen);
                    console.log(`✅ ${screenName} screen initialized`);
                } catch (error) {
                    console.error(`❌ Failed to initialize ${screenName} screen:`, error);
                }
            }
        });

        this.updateLoadingProgress(90);
    }

    showScreen(screenName, options = {}) {
        if (!this.isInitialized && screenName !== 'dashboard') {
            console.warn('Application not fully initialized');
            return;
        }

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        const navItem = document.querySelector(`[data-screen="${screenName}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }

        // Get screen container
        const screenContainer = document.getElementById('screen-container');
        if (!screenContainer) {
            console.error('Screen container not found');
            return;
        }

        // Hide current screen
        if (this.currentScreen && this.screens.has(this.currentScreen)) {
            const currentScreenObj = this.screens.get(this.currentScreen);
            if (currentScreenObj && currentScreenObj.hide) {
                currentScreenObj.hide();
            }
        }

        // Show new screen
        this.currentScreen = screenName;
        
        if (this.screens.has(screenName)) {
            const screen = this.screens.get(screenName);
            if (screen && screen.show) {
                screen.show(screenContainer, options);
            }
        } else {
            // Fallback for screens not yet implemented
            this.showPlaceholderScreen(screenName, screenContainer);
        }

        // Update page title
        document.title = `Cyber Forge AI - ${this.formatScreenName(screenName)}`;
    }

    showPlaceholderScreen(screenName, container) {
        const formattedName = this.formatScreenName(screenName);
        container.innerHTML = `
            <div class="screen-placeholder">
                <div class="placeholder-content">
                    <div class="placeholder-icon">
                        <i class="fas fa-tools"></i>
                    </div>
                    <h2>${formattedName}</h2>
                    <p>This screen is currently under development.</p>
                    <div class="placeholder-features">
                        <h3>Planned Features:</h3>
                        <ul>
                            <li>Real-time data integration</li>
                            <li>Advanced analytics and visualization</li>
                            <li>Interactive controls and management</li>
                            <li>Export and reporting capabilities</li>
                        </ul>
                    </div>
                    <button class="btn btn-primary" onclick="window.app.showScreen('dashboard')">
                        <i class="fas fa-home"></i> Return to Dashboard
                    </button>
                </div>
            </div>
        `;
    }

    formatScreenName(screenName) {
        return screenName.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    handleGlobalSearch(query) {
        if (!query.trim()) return;

        const searchType = document.querySelector('.search-type.active')?.dataset.type || 'search';
        
        switch (searchType) {
            case 'search':
                this.performGlobalSearch(query);
                break;
            case 'ai':
                this.showScreen('ai-assistant', { query });
                break;
            case 'analyze':
                this.performQuickAnalysis(query);
                break;
        }
    }

    performGlobalSearch(query) {
        // Search across all data and show results
        window.notificationSystem?.info('Search', `Searching for: ${query}`);
        // TODO: Implement global search
    }

    performQuickAnalysis(url) {
        if (!url.match(/^https?:\/\//)) {
            url = 'http://' + url;
        }
        
        this.showScreen('deep-analysis', { url });
    }

    handleSearchSuggestions(query) {
        // TODO: Implement search suggestions
    }

    updateSearchPlaceholder(type) {
        const searchInput = document.getElementById('global-search');
        if (!searchInput) return;

        const placeholders = {
            search: 'Search threats, analyze URLs, or ask AI...',
            ai: 'Ask AI anything about cybersecurity...',
            analyze: 'Enter URL to analyze...'
        };

        searchInput.placeholder = placeholders[type] || placeholders.search;
    }

    updateConnectionStatus(service, connected) {
        const statusElement = document.getElementById(`${service}-status`);
        if (statusElement) {
            const statusDot = statusElement.querySelector('.status-dot');
            if (statusDot) {
                statusDot.classList.toggle('connected', connected);
            }
            statusElement.title = `${service.toUpperCase()}: ${connected ? 'Connected' : 'Disconnected'}`;
        }
    }

    startPeriodicUpdates() {
        // Update system stats every 10 seconds
        setInterval(() => {
            this.updateSystemStats();
        }, 10000);

        // Update threat count every 30 seconds
        setInterval(() => {
            this.updateThreatCount();
        }, 30000);

        // Initial updates
        this.updateSystemStats();
        this.updateThreatCount();
    }

    async updateSystemStats() {
        try {
            // Mock system stats - replace with actual Electron IPC calls
            this.systemStats.cpu = Math.floor(Math.random() * 100);
            this.systemStats.memory = Math.floor(Math.random() * 100);
            
            const cpuElement = document.getElementById('cpu-usage');
            const memoryElement = document.getElementById('memory-usage');
            
            if (cpuElement) cpuElement.textContent = `${this.systemStats.cpu}%`;
            if (memoryElement) memoryElement.textContent = `${this.systemStats.memory}%`;
            
        } catch (error) {
            console.error('Failed to update system stats:', error);
        }
    }

    async updateThreatCount() {
        try {
            if (window.apiClient) {
                const stats = await window.apiClient.getThreatStats();
                if (stats.success) {
                    const threatCount = stats.data.active_threats || 0;
                    const threatElement = document.getElementById('threat-count');
                    if (threatElement) {
                        threatElement.textContent = threatCount;
                        threatElement.style.display = threatCount > 0 ? 'inline' : 'none';
                    }
                }
            }
        } catch (error) {
            console.error('Failed to update threat count:', error);
        }
    }

    handleRealtimeData(data) {
        // Route real-time data to appropriate screens
        if (this.screens.has(this.currentScreen)) {
            const screen = this.screens.get(this.currentScreen);
            if (screen && screen.handleRealtimeData) {
                screen.handleRealtimeData(data);
            }
        }
    }

    handleTaskUpdate(data) {
        // Handle task updates
        console.log('Task update received:', data);
    }

    handleKeyboardShortcuts(e) {
        // Global keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'k':
                    e.preventDefault();
                    document.getElementById('global-search')?.focus();
                    break;
                case '1':
                    e.preventDefault();
                    this.showScreen('dashboard');
                    break;
                case '2':
                    e.preventDefault();
                    this.showScreen('real-time-monitor');
                    break;
                case '3':
                    e.preventDefault();
                    this.showScreen('threat-center');
                    break;
                case ',':
                    e.preventDefault();
                    this.showScreen('settings');
                    break;
            }
        }
        
        if (e.key === 'Escape') {
            // Close any open modals or panels
            this.closeFabMenu();
        }
    }

    handleResize() {
        // Handle responsive behavior
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth < 1024) {
            sidebar?.classList.add('collapsed');
        } else {
            sidebar?.classList.remove('collapsed');
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar?.classList.toggle('collapsed');
    }

    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }

    toggleFabMenu() {
        const fabMenu = document.getElementById('fab-menu');
        fabMenu?.classList.toggle('active');
    }

    closeFabMenu() {
        const fabMenu = document.getElementById('fab-menu');
        fabMenu?.classList.remove('active');
    }

    handleFabAction(action) {
        this.closeFabMenu();
        
        switch (action) {
            case 'scan-url':
                this.showQuickUrlScan();
                break;
            case 'scan-file':
                this.showQuickFileScan();
                break;
            case 'ai-chat':
                this.showScreen('ai-assistant');
                break;
        }
    }

    showQuickUrlScan() {
        window.modal?.prompt('Quick URL Scan', 'Enter URL to scan:', '', {
            placeholder: 'https://example.com',
            confirmLabel: 'Scan',
            confirmClass: 'btn-primary'
        }).then(url => {
            if (url) {
                this.performQuickAnalysis(url);
            }
        });
    }

    showQuickFileScan() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '*/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.showScreen('malware-detection', { file });
            }
        };
        input.click();
    }

    showNotificationsPanel() {
        // TODO: Implement notifications panel
        window.notificationSystem?.info('Notifications', 'Notifications panel coming soon!');
    }

    showQuickSettings() {
        // TODO: Implement quick settings panel
        this.showScreen('settings');
    }

    showErrorScreen(error) {
        const container = document.getElementById('screen-container') || document.body;
        container.innerHTML = `
            <div class="error-screen">
                <div class="error-content">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2>Application Error</h2>
                    <p>An error occurred while initializing the application:</p>
                    <div class="error-details">
                        <code>${error.message}</code>
                    </div>
                    <div class="error-actions">
                        <button class="btn btn-primary" onclick="location.reload()">
                            <i class="fas fa-refresh"></i> Reload Application
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Cleanup
    destroy() {
        this.screens.forEach(screen => {
            if (screen.destroy) {
                screen.destroy();
            }
        });
        this.screens.clear();
    }
}

// CSS for placeholder and error screens
const appStyles = `
.screen-placeholder,
.error-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
}

.placeholder-content,
.error-content {
    text-align: center;
    max-width: 600px;
}

.placeholder-icon,
.error-icon {
    font-size: 4rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
}

.error-icon {
    color: var(--error);
}

.placeholder-features {
    margin: 2rem 0;
    text-align: left;
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: var(--radius-lg);
}

.placeholder-features h3 {
    margin-bottom: 1rem;
    color: var(--text-primary);
}

.placeholder-features ul {
    list-style: none;
    padding: 0;
}

.placeholder-features li {
    padding: 0.5rem 0;
    padding-left: 1.5rem;
    position: relative;
}

.placeholder-features li::before {
    content: '✓';
    position: absolute;
    left: 0;
    color: var(--success);
    font-weight: bold;
}

.error-details {
    background: var(--bg-secondary);
    padding: 1rem;
    border-radius: var(--radius-md);
    margin: 1rem 0;
    border-left: 4px solid var(--error);
}

.error-details code {
    color: var(--error);
    font-family: var(--font-mono);
}

.error-actions {
    margin-top: 2rem;
}
`;

// Inject styles
const appStyleSheet = document.createElement('style');
appStyleSheet.textContent = appStyles;
document.head.appendChild(appStyleSheet);

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CyberForgeApp();
});

// Export for global access
window.CyberForgeApp = CyberForgeApp;