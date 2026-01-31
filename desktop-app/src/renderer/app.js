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
            
            // Initialize Lottie animations
            this.initializeLottieAnimations();
            
            // Restore sidebar state
            this.restoreSidebarState();
            
            // Add navigation enhancements
            this.addNavigationEnhancements();
            
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
        console.log('🎬 Hiding loading screen...');
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            this.updateLoadingProgress(100);
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                    console.log('✅ Loading screen hidden');
                }, 500);
            }, 500);
        } else {
            console.warn('⚠️ Loading screen element not found');
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
        // Navigation events with better error handling
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent default anchor behavior
                e.stopPropagation(); // Stop event bubbling
                
                const screenName = e.currentTarget.dataset.screen;
                console.log('Navigation clicked:', screenName);
                
                if (screenName) {
                    try {
                        this.showScreen(screenName);
                    } catch (error) {
                        console.error('Error showing screen:', error);
                        window.notificationSystem?.error('Navigation Error', 'Failed to load screen: ' + screenName);
                    }
                }
            });
        });

        // Global search with AI enhancement
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
            
            // Add AI-powered suggestions
            globalSearch.addEventListener('focus', () => {
                this.showAISuggestions();
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

        // Header controls with enhanced functionality
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => this.showNotificationsPanel());
        }

        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        const aiChatBtn = document.getElementById('ai-chat-btn');
        if (aiChatBtn) {
            aiChatBtn.addEventListener('click', () => this.openAIChat());
        }

        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showScreen('settings'));
        }

        // Footer quick actions
        const runScanBtn = document.getElementById('run-scan-btn');
        if (runScanBtn) {
            runScanBtn.addEventListener('click', () => this.runQuickScan());
        }

        const exportReportBtn = document.getElementById('export-report-btn');
        if (exportReportBtn) {
            exportReportBtn.addEventListener('click', () => this.exportReport());
        }

        const fullScreenBtn = document.getElementById('full-screen-btn');
        if (fullScreenBtn) {
            fullScreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }

        // Enhanced sidebar section toggles
        document.querySelectorAll('.section-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const section = e.currentTarget.dataset.section;
                this.toggleSidebarSection(section);
            });
        });

        // Enhanced sidebar navigation
        document.querySelectorAll('.nav-section-title').forEach(title => {
            title.addEventListener('click', (e) => {
                if (!e.target.matches('.section-toggle') && !e.target.matches('.section-toggle i')) {
                    const section = title.querySelector('.section-toggle')?.dataset.section;
                    if (section) {
                        this.toggleSidebarSection(section);
                    }
                }
            });
        });

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
        
        // Start AI activity simulation
        this.startAIActivityUpdates();
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
            'dashboard': typeof DashboardScreen !== 'undefined' ? DashboardScreen : null,
            'real-time-monitor': typeof RealTimeMonitorScreen !== 'undefined' ? RealTimeMonitorScreen : null,
            'threat-center': typeof ThreatCenterScreen !== 'undefined' ? ThreatCenterScreen : null,
            'deep-analysis': typeof DeepAnalysisScreen !== 'undefined' ? DeepAnalysisScreen : null,
            'ai-assistant': typeof AIAssistantScreen !== 'undefined' ? AIAssistantScreen : null,
            'ml-models': typeof MLModelsScreen !== 'undefined' ? MLModelsScreen : null,
            'ai-insights': typeof AIInsightsScreen !== 'undefined' ? AIInsightsScreen : null,
            'predictions': typeof PredictionsScreen !== 'undefined' ? PredictionsScreen : null,
            'vulnerability-scanner': typeof VulnerabilityScannerScreen !== 'undefined' ? VulnerabilityScannerScreen : null,
            'network-analysis': typeof NetworkAnalysisScreen !== 'undefined' ? NetworkAnalysisScreen : null,
            'malware-detection': typeof MalwareDetectionScreen !== 'undefined' ? MalwareDetectionScreen : null,
            'digital-forensics': typeof DigitalForensicsScreen !== 'undefined' ? DigitalForensicsScreen : null,
            'datasets': typeof DatasetsScreen !== 'undefined' ? DatasetsScreen : null,
            'reports': typeof ReportsScreen !== 'undefined' ? ReportsScreen : null,
            'compliance': typeof ComplianceScreen !== 'undefined' ? ComplianceScreen : null,
            'settings': typeof SettingsScreen !== 'undefined' ? SettingsScreen : null,
            'profile': typeof ProfileScreen !== 'undefined' ? ProfileScreen : null,
            'system-logs': typeof SystemLogsScreen !== 'undefined' ? SystemLogsScreen : null,
            'incident-response': typeof IncidentResponseScreen !== 'undefined' ? IncidentResponseScreen : null,
            'risk-assessment': typeof RiskAssessmentScreen !== 'undefined' ? RiskAssessmentScreen : null,
            'security-metrics': typeof SecurityMetricsScreen !== 'undefined' ? SecurityMetricsScreen : null,
            'penetration-testing': typeof PenetrationTestingScreen !== 'undefined' ? PenetrationTestingScreen : null
        };

        // Only initialize screens that have classes defined
        Object.entries(screenClasses).forEach(([screenName, ScreenClass]) => {
            if (ScreenClass) {
                try {
                    const screen = new ScreenClass();
                    this.screens.set(screenName, screen);
                    console.log(`✅ ${screenName} screen initialized`);
                } catch (error) {
                    console.warn(`⚠️ Failed to initialize ${screenName} screen:`, error);
                }
            } else {
                console.log(`ℹ️ ${screenName} screen class not found (placeholder will be used)`);
            }
        });

        console.log(`📱 Initialized ${this.screens.size} screens successfully`);
        this.updateLoadingProgress(90);
    }

    showScreen(screenName, options = {}) {
        console.log(`🎯 Attempting to show screen: ${screenName}`);
        
        if (!this.isInitialized && screenName !== 'dashboard') {
            console.warn('Application not fully initialized, waiting...');
            // Wait for initialization and try again
            setTimeout(() => this.showScreen(screenName, options), 100);
            return;
        }

        // Update navigation highlighting
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        const navItem = document.querySelector(`[data-screen="${screenName}"]`);
        if (navItem) {
            navItem.classList.add('active');
            console.log(`✅ Navigation item highlighted: ${screenName}`);
        }

        // Get screen container
        const screenContainer = document.getElementById('screen-container');
        if (!screenContainer) {
            console.error('❌ Screen container not found in DOM');
            return;
        }

        // Hide current screen
        if (this.currentScreen && this.screens.has(this.currentScreen)) {
            const currentScreenObj = this.screens.get(this.currentScreen);
            if (currentScreenObj && currentScreenObj.hide) {
                currentScreenObj.hide();
                console.log(`👋 Hidden previous screen: ${this.currentScreen}`);
            }
        }

        // Show new screen
        this.currentScreen = screenName;
        
        if (this.screens.has(screenName)) {
            console.log(`📄 Loading initialized screen: ${screenName}`);
            const screen = this.screens.get(screenName);
            if (screen && screen.show) {
                try {
                    screen.show(screenContainer, options);
                    console.log(`✅ Successfully showed screen: ${screenName}`);
                } catch (error) {
                    console.error(`❌ Error showing screen ${screenName}:`, error);
                    this.showPlaceholderScreen(screenName, screenContainer);
                }
            }
        } else {
            // Fallback for screens not yet implemented
            console.log(`⚠️ Screen not initialized, showing placeholder: ${screenName}`);
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

    // Enhanced Sidebar Methods
    toggleSidebarSection(section) {
        const sectionElement = document.querySelector(`[data-section-content="${section}"]`);
        const parentSection = sectionElement?.closest('.nav-section');
        
        if (parentSection && sectionElement) {
            parentSection.classList.toggle('collapsed');
            
            // Save section state
            const collapsedSections = JSON.parse(localStorage.getItem('collapsedSidebarSections') || '[]');
            if (parentSection.classList.contains('collapsed')) {
                if (!collapsedSections.includes(section)) {
                    collapsedSections.push(section);
                }
            } else {
                const index = collapsedSections.indexOf(section);
                if (index > -1) {
                    collapsedSections.splice(index, 1);
                }
            }
            localStorage.setItem('collapsedSidebarSections', JSON.stringify(collapsedSections));
        }
    }

    restoreSidebarState() {
        const collapsedSections = JSON.parse(localStorage.getItem('collapsedSidebarSections') || '[]');
        collapsedSections.forEach(section => {
            const sectionElement = document.querySelector(`[data-section-content="${section}"]`);
            const parentSection = sectionElement?.closest('.nav-section');
            if (parentSection) {
                parentSection.classList.add('collapsed');
            }
        });
    }

    // Lottie Animation Methods
    initializeLottieAnimations() {
        console.log('🎬 Initializing Lottie animations...');
        
        // Initialize the Lottie Animation Manager
        if (window.LottieAnimationManager) {
            this.lottieManager = new window.LottieAnimationManager();
            
            // Set up loading screen animation
            this.setupLoadingAnimation();
            
            // Set up sidebar item animations
            this.setupSidebarAnimations();
            
            console.log('✅ Lottie animations initialized');
        } else {
            console.warn('⚠️ LottieAnimationManager not available');
        }
    }

    setupLoadingAnimation() {
        const loadingContainer = document.querySelector('.loading-spinner');
        if (loadingContainer && this.lottieManager) {
            // Replace spinner with Lottie animation
            loadingContainer.innerHTML = '<div id="loading-lottie"></div>';
            const lottieContainer = document.getElementById('loading-lottie');
            this.lottieManager.createLoadingAnimation(lottieContainer);
        }
    }

    setupSidebarAnimations() {
        // Start animations for visible nav items with animation data
        document.querySelectorAll('.nav-item[data-animation]').forEach(item => {
            const animationType = item.dataset.animation;
            if (this.lottieManager && animationType) {
                this.lottieManager.startAnimation(item, animationType);
            }
        });

        // Set up intersection observer for better performance
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const animationType = entry.target.dataset.animation;
                if (animationType && this.lottieManager) {
                    if (entry.isIntersecting) {
                        this.lottieManager.startAnimation(entry.target, animationType);
                    } else {
                        this.lottieManager.pauseAnimation(entry.target, animationType);
                    }
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('[data-animation]').forEach(el => {
            observer.observe(el);
        });
    }

    // Enhanced Navigation Methods
    addNavigationEnhancements() {
        // Add keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '1':
                    case '2':
                    case '3':
                    case '4':
                    case '5':
                    case '6':
                    case '7':
                    case '8':
                    case '9':
                        e.preventDefault();
                        this.navigateToScreenByIndex(parseInt(e.key) - 1);
                        break;
                    case 'b':
                        e.preventDefault();
                        this.toggleSidebar();
                        break;
                }
            }
        });

        // Add search in sidebar
        this.addSidebarSearch();
    }

    navigateToScreenByIndex(index) {
        const navItems = document.querySelectorAll('.nav-item[data-screen]');
        if (navItems[index]) {
            const screen = navItems[index].dataset.screen;
            this.showScreen(screen);
        }
    }

    addSidebarSearch() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        const searchContainer = document.createElement('div');
        searchContainer.className = 'sidebar-search';
        searchContainer.innerHTML = `
            <div class="search-input-container">
                <i class="fas fa-search"></i>
                <input type="text" placeholder="Search navigation..." id="sidebar-search">
                <button class="clear-search" id="clear-sidebar-search" style="display: none;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        const sidebarHeader = sidebar.querySelector('.sidebar-header');
        if (sidebarHeader) {
            sidebarHeader.appendChild(searchContainer);
        }

        // Add search functionality
        const searchInput = document.getElementById('sidebar-search');
        const clearButton = document.getElementById('clear-sidebar-search');

        searchInput.addEventListener('input', (e) => {
            this.filterSidebarItems(e.target.value);
            clearButton.style.display = e.target.value ? 'block' : 'none';
        });

        clearButton.addEventListener('click', () => {
            searchInput.value = '';
            this.filterSidebarItems('');
            clearButton.style.display = 'none';
            searchInput.focus();
        });
    }

    filterSidebarItems(searchTerm) {
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('.nav-section');

        navItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            const matches = text.includes(searchTerm.toLowerCase());
            item.style.display = matches ? 'flex' : 'none';
        });

        // Show/hide sections based on visible items
        sections.forEach(section => {
            const visibleItems = section.querySelectorAll('.nav-item[style*="flex"], .nav-item:not([style])');
            const hasVisibleItems = Array.from(visibleItems).some(item => 
                !item.style.display || item.style.display === 'flex'
            );
            section.style.display = hasVisibleItems ? 'block' : 'none';
        });
    }

    // ===========================
    // AI AGENT & FOOTER METHODS
    // ===========================

    startAIActivityUpdates() {
        // Update AI agent status every 3 seconds
        this.updateAIAgentStatus();
        setInterval(() => this.updateAIAgentStatus(), 3000);

        // Update agent tasks every 5 seconds
        this.updateAgentTasks();
        setInterval(() => this.updateAgentTasks(), 5000);

        // Update system stats in footer
        this.updateFooterSystemStats();
        setInterval(() => this.updateFooterSystemStats(), 5000);

        // Update notification count
        this.updateNotificationCount();
        setInterval(() => this.updateNotificationCount(), 10000);
    }

    updateAIAgentStatus() {
        const agentStates = [
            'Analyzing threats...',
            'Scanning network...',
            'Training models...',
            'Monitoring traffic...',
            'Detecting anomalies...',
            'Processing data...',
            'Learning patterns...',
            'Investigating alerts...'
        ];

        const randomState = agentStates[Math.floor(Math.random() * agentStates.length)];
        const agentStateEl = document.getElementById('agent-state');
        if (agentStateEl) {
            agentStateEl.textContent = randomState;
        }

        // Update agent count (simulate active agents)
        const agentCountEl = document.getElementById('agent-count');
        if (agentCountEl) {
            const activeAgents = Math.floor(Math.random() * 3) + 2; // 2-4 agents
            agentCountEl.textContent = activeAgents;
        }

        // Update connection status randomly
        this.updateConnectionStatus('backend', Math.random() > 0.3);
        this.updateConnectionStatus('ml', Math.random() > 0.4);
    }

    updateAgentTasks() {
        const tasks = [
            'Analyzing 127 packets',
            'Scanning 45 endpoints',
            'Classifying 23 threats',
            'Training DNN model',
            'Processing ML pipeline',
            'Extracting features',
            'Running inference',
            'Monitoring web traffic'
        ];

        const agentTasksEl = document.getElementById('agent-tasks');
        if (agentTasksEl) {
            // Randomly select 1-3 tasks
            const numTasks = Math.floor(Math.random() * 3) + 1;
            const selectedTasks = [];
            for (let i = 0; i < numTasks; i++) {
                selectedTasks.push(tasks[Math.floor(Math.random() * tasks.length)]);
            }

            agentTasksEl.innerHTML = selectedTasks
                .map(task => `<span class="agent-task">${task}</span>`)
                .join('');
        }

        // Update activity text
        const activityTextEl = document.getElementById('ai-activity-text');
        if (activityTextEl) {
            const activities = [
                'AI agents actively monitoring...',
                'Deep learning models analyzing data...',
                'Neural networks processing threats...',
                'Machine learning in progress...',
                'Autonomous agents working...'
            ];
            activityTextEl.textContent = activities[Math.floor(Math.random() * activities.length)];
        }
    }

    updateFooterSystemStats() {
        // Update CPU
        const cpuEl = document.getElementById('cpu-usage');
        if (cpuEl) {
            const cpu = Math.floor(Math.random() * 40) + 20; // 20-60%
            cpuEl.textContent = `${cpu}%`;
        }

        // Update Memory
        const memoryEl = document.getElementById('memory-usage');
        if (memoryEl) {
            const memory = Math.floor(Math.random() * 30) + 40; // 40-70%
            memoryEl.textContent = `${memory}%`;
        }

        // Update threats blocked
        const threatsEl = document.getElementById('threats-blocked');
        if (threatsEl) {
            const currentCount = parseInt(threatsEl.textContent) || 0;
            const increment = Math.floor(Math.random() * 5);
            threatsEl.textContent = currentCount + increment;
        }
    }

    updateNotificationCount() {
        const notificationBadge = document.getElementById('notification-count');
        if (notificationBadge) {
            const currentCount = parseInt(notificationBadge.textContent) || 0;
            const newCount = currentCount + Math.floor(Math.random() * 3);
            notificationBadge.textContent = newCount > 0 ? newCount : '';
        }
    }

    toggleTheme() {
        if (window.themeManager) {
            window.themeManager.toggleTheme();
        } else {
            document.body.classList.toggle('light-theme');
        }

        // Update theme icon
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = document.body.classList.contains('light-theme') 
                    ? 'fas fa-sun' 
                    : 'fas fa-moon';
            }
        }

        window.notificationSystem?.success('Theme', 'Theme changed successfully');
    }

    openAIChat() {
        this.showScreen('ai-assistant');
        window.notificationSystem?.info('AI Assistant', 'Opening AI chat interface...');
    }

    showNotificationsPanel() {
        // Create notification panel if it doesn't exist
        let panel = document.getElementById('notifications-panel');
        
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'notifications-panel';
            panel.className = 'notifications-panel';
            panel.innerHTML = `
                <div class="panel-header">
                    <h3>Notifications</h3>
                    <button class="close-panel" onclick="document.getElementById('notifications-panel').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="panel-content">
                    <div class="notification-item">
                        <i class="fas fa-shield-alt notification-icon success"></i>
                        <div class="notification-details">
                            <strong>Security Scan Complete</strong>
                            <p>No threats detected in last scan</p>
                            <span class="notification-time">5 minutes ago</span>
                        </div>
                    </div>
                    <div class="notification-item">
                        <i class="fas fa-exclamation-triangle notification-icon warning"></i>
                        <div class="notification-details">
                            <strong>Suspicious Activity Detected</strong>
                            <p>Unusual network traffic from 192.168.1.45</p>
                            <span class="notification-time">12 minutes ago</span>
                        </div>
                    </div>
                    <div class="notification-item">
                        <i class="fas fa-brain notification-icon info"></i>
                        <div class="notification-details">
                            <strong>AI Model Updated</strong>
                            <p>Threat detection model v2.1 deployed</p>
                            <span class="notification-time">1 hour ago</span>
                        </div>
                    </div>
                </div>
                <div class="panel-footer">
                    <button class="btn btn-sm btn-secondary" onclick="alert('Mark all as read')">Mark all as read</button>
                    <button class="btn btn-sm btn-primary" onclick="alert('View all notifications')">View All</button>
                </div>
            `;
            document.body.appendChild(panel);

            // Add styles for notification panel
            const panelStyles = `
                .notifications-panel {
                    position: fixed;
                    top: 70px;
                    right: 20px;
                    width: 400px;
                    max-height: 600px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-lg);
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                    z-index: var(--z-modal);
                    animation: slideInRight 0.3s ease-out;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    border-bottom: 1px solid var(--border-color);
                }
                .panel-header h3 {
                    margin: 0;
                    font-size: 1.125rem;
                }
                .close-panel {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    font-size: 1.25rem;
                    cursor: pointer;
                    padding: 0.25rem;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: all 0.2s;
                }
                .close-panel:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }
                .panel-content {
                    max-height: 450px;
                    overflow-y: auto;
                    padding: 0.5rem;
                }
                .notification-item {
                    display: flex;
                    gap: 1rem;
                    padding: 1rem;
                    border-radius: var(--radius-md);
                    margin-bottom: 0.5rem;
                    background: var(--bg-tertiary);
                    transition: all 0.2s;
                }
                .notification-item:hover {
                    background: var(--bg-hover);
                }
                .notification-icon {
                    font-size: 1.5rem;
                    flex-shrink: 0;
                }
                .notification-icon.success { color: var(--success); }
                .notification-icon.warning { color: var(--warning); }
                .notification-icon.info { color: var(--info); }
                .notification-details {
                    flex: 1;
                }
                .notification-details strong {
                    display: block;
                    margin-bottom: 0.25rem;
                    color: var(--text-primary);
                }
                .notification-details p {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    margin: 0;
                }
                .notification-time {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }
                .panel-footer {
                    display: flex;
                    gap: 0.5rem;
                    padding: 1rem;
                    border-top: 1px solid var(--border-color);
                }
            `;
            const styleEl = document.createElement('style');
            styleEl.textContent = panelStyles;
            document.head.appendChild(styleEl);
        } else {
            panel.remove();
        }

        // Reset notification count
        const notificationBadge = document.getElementById('notification-count');
        if (notificationBadge) {
            notificationBadge.textContent = '';
        }
    }

    showAISuggestions() {
        const suggestions = [
            'Check recent threat alerts',
            'Analyze suspicious URLs',
            'Review ML model performance',
            'Scan network for vulnerabilities'
        ];
        
        // This would show AI-powered suggestions
        console.log('AI Suggestions:', suggestions);
    }

    runQuickScan() {
        window.notificationSystem?.info('Quick Scan', 'Starting quick security scan...');
        
        // Simulate scan progress
        setTimeout(() => {
            window.notificationSystem?.success('Quick Scan', 'Scan completed - No threats found');
        }, 3000);
    }

    exportReport() {
        window.notificationSystem?.info('Export', 'Generating security report...');
        
        setTimeout(() => {
            window.notificationSystem?.success('Export', 'Report exported successfully');
        }, 2000);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            window.notificationSystem?.info('Fullscreen', 'Entered fullscreen mode');
        } else {
            document.exitFullscreen();
            window.notificationSystem?.info('Fullscreen', 'Exited fullscreen mode');
        }
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