/**
 * Page Controller - Central routing and navigation system for child component pages
 * Manages screen transitions, state persistence, and backend integration
 */

class PageController {
    constructor() {
        this.currentPage = null;
        this.pageHistory = [];
        this.pageCache = new Map();
        this.loadingStates = new Map();
        this.container = null;
        this.api = null;
        this.eventBus = new Map();
    }

    /**
     * Initialize the page controller
     * @param {HTMLElement} container - Main content container
     * @param {Object} api - CyberForge API client instance
     */
    initialize(container, api) {
        this.container = container;
        this.api = api;
        this.setupEventListeners();
        console.log('🎯 PageController initialized');
    }

    /**
     * Setup event listeners for navigation
     */
    setupEventListeners() {
        // Listen for sidebar child clicks
        document.addEventListener('click', (e) => {
            const childLink = e.target.closest('.sidebar-child-link');
            if (childLink) {
                e.preventDefault();
                e.stopPropagation();
                const page = childLink.dataset.page;
                const section = childLink.dataset.section;
                if (page) {
                    this.navigateTo(page, { section });
                }
            }
        });

        // Handle back navigation
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                this.navigateTo(e.state.page, e.state.options, false);
            }
        });
    }

    /**
     * Navigate to a specific page
     * @param {string} pageId - The page identifier
     * @param {Object} options - Navigation options
     * @param {boolean} pushState - Whether to push to browser history
     */
    async navigateTo(pageId, options = {}, pushState = true) {
        console.log(`📍 Navigating to: ${pageId}`, options);

        // Show loading state
        this.showLoading(pageId);

        try {
            // Get or create page instance
            const page = await this.getPage(pageId);
            
            if (!page) {
                throw new Error(`Page not found: ${pageId}`);
            }

            // Hide current page if exists
            if (this.currentPage && this.currentPage.hide) {
                this.currentPage.hide();
            }

            // Update history
            if (pushState) {
                history.pushState({ page: pageId, options }, '', `#${pageId}`);
                this.pageHistory.push({ page: pageId, options, timestamp: Date.now() });
            }

            // Show new page
            await page.show(this.container, { ...options, api: this.api });
            this.currentPage = page;

            // Update sidebar active state
            this.updateSidebarActive(pageId);

            // Emit navigation event
            this.emit('navigate', { pageId, options });

        } catch (error) {
            console.error(`❌ Navigation error:`, error);
            this.showError(pageId, error.message);
        } finally {
            this.hideLoading(pageId);
        }
    }

    /**
     * Get or create a page instance
     */
    async getPage(pageId) {
        // Check cache first
        if (this.pageCache.has(pageId)) {
            return this.pageCache.get(pageId);
        }

        // Create new page instance based on pageId
        const page = await this.createPage(pageId);
        if (page) {
            this.pageCache.set(pageId, page);
        }
        return page;
    }

    /**
     * Factory method to create page instances
     */
    async createPage(pageId) {
        const pageMap = {
            // Overview Section
            'dashboard-summary': () => new DashboardSummaryPage(),
            'dashboard-metrics': () => new DashboardMetricsPage(),
            'dashboard-activity': () => new DashboardActivityPage(),
            'sitemap-structure': () => new SitemapStructurePage(),
            'sitemap-endpoints': () => new SitemapEndpointsPage(),
            'sitemap-assets': () => new SitemapAssetsPage(),
            'scopes-global': () => new ScopesGlobalPage(),
            'scopes-project': () => new ScopesProjectPage(),
            'scopes-custom': () => new ScopesCustomPage(),
            
            // Proxy Section
            'intercept-rules': () => new InterceptRulesPage(),
            'intercept-queue': () => new InterceptQueuePage(),
            'intercept-history': () => new InterceptHistoryPage(),
            'http-requests': () => new HttpRequestsPage(),
            'http-responses': () => new HttpResponsesPage(),
            'http-analysis': () => new HttpAnalysisPage(),
            'ws-connections': () => new WsConnectionsPage(),
            'ws-messages': () => new WsMessagesPage(),
            'ws-frames': () => new WsFramesPage(),
            'match-rules': () => new MatchRulesPage(),
            'match-templates': () => new MatchTemplatesPage(),
            'match-testing': () => new MatchTestingPage(),
            
            // Testing Section
            'replay-queue': () => new ReplayQueuePage(),
            'replay-history': () => new ReplayHistoryPage(),
            'replay-comparison': () => new ReplayComparisonPage(),
            'automate-sequences': () => new AutomateSequencesPage(),
            'automate-macros': () => new AutomateMacrosPage(),
            'automate-scripts': () => new AutomateScriptsPage(),
            'workflows-active': () => new WorkflowsActivePage(),
            'workflows-templates': () => new WorkflowsTemplatesPage(),
            'workflows-schedule': () => new WorkflowsSchedulePage(),
            'assistant-chat': () => new AssistantChatPage(),
            'assistant-suggestions': () => new AssistantSuggestionsPage(),
            'assistant-actions': () => new AssistantActionsPage(),
            'ai-models-active': () => new AiModelsActivePage(),
            'ai-models-training': () => new AiModelsTrainingPage(),
            'ai-models-metrics': () => new AiModelsMetricsPage(),
            'threat-intel-feeds': () => new ThreatIntelFeedsPage(),
            'threat-intel-indicators': () => new ThreatIntelIndicatorsPage(),
            'threat-intel-alerts': () => new ThreatIntelAlertsPage(),
            'environment-variables': () => new EnvironmentVariablesPage(),
            'environment-configs': () => new EnvironmentConfigsPage(),
            'environment-profiles': () => new EnvironmentProfilesPage(),
            
            // Logging Section
            'search-quick': () => new SearchQuickPage(),
            'search-advanced': () => new SearchAdvancedPage(),
            'search-saved': () => new SearchSavedPage(),
            'search-history': () => new SearchHistoryPage(),
            'findings-vulnerabilities': () => new FindingsVulnerabilitiesPage(),
            'findings-issues': () => new FindingsIssuesPage(),
            'findings-notes': () => new FindingsNotesPage(),
            'findings-tags': () => new FindingsTagsPage(),
            'exports-reports': () => new ExportsReportsPage(),
            'exports-data': () => new ExportsDataPage(),
            'exports-scheduled': () => new ExportsScheduledPage(),
            
            // Workspace Section
            'files-projects': () => new FilesProjectsPage(),
            'files-scripts': () => new FilesScriptsPage(),
            'files-templates': () => new FilesTemplatesPage(),
            'plugins-installed': () => new PluginsInstalledPage(),
            'plugins-available': () => new PluginsAvailablePage(),
            'plugins-settings': () => new PluginsSettingsPage(),
            'workspace-settings': () => new WorkspaceSettingsPage(),
            'workspace-team': () => new WorkspaceTeamPage(),
            
            // AI Agent Section
            'agent-status': () => new AgentStatusPage(),
            'agent-tasks': () => new AgentTasksPage(),
            'agent-threat-queue': () => new AgentThreatQueuePage(),
            'agent-learning': () => new AgentLearningPage(),
            'agent-settings': () => new AgentSettingsPage(),
            
            // Browser Monitor Section
            'browser-sessions': () => new BrowserSessionsPage(),
            'browser-cookies': () => new BrowserCookiesPage(),
            'browser-storage': () => new BrowserStoragePage(),
            'browser-network': () => new BrowserNetworkPage(),
            'browser-dom': () => new BrowserDomPage(),
            'browser-console': () => new BrowserConsolePage(),
            
            // Real-Time Intel Section
            'realtime-threat-map': () => new RealtimeThreatMapPage(),
            'realtime-live-feeds': () => new RealtimeLiveFeedsPage(),
            'realtime-alerts': () => new RealtimeAlertsPage(),
            
            // Scan Modes Section
            'scan-passive': () => new ScanPassivePage(),
            'scan-active': () => new ScanActivePage(),
            'scan-stealth': () => new ScanStealthPage(),
            'scan-aggressive': () => new ScanAggressivePage()
        };

        const factory = pageMap[pageId];
        return factory ? factory() : null;
    }

    /**
     * Show loading indicator
     */
    showLoading(pageId) {
        this.loadingStates.set(pageId, true);
        if (this.container) {
            const existingLoader = this.container.querySelector('.page-loader');
            if (!existingLoader) {
                const loader = document.createElement('div');
                loader.className = 'page-loader';
                loader.innerHTML = `
                    <div class="loader-content">
                        <div class="loader-spinner">
                            <i class="fas fa-circle-notch fa-spin"></i>
                        </div>
                        <span class="loader-text">Loading...</span>
                    </div>
                `;
                this.container.appendChild(loader);
            }
        }
    }

    /**
     * Hide loading indicator
     */
    hideLoading(pageId) {
        this.loadingStates.delete(pageId);
        const loader = this.container?.querySelector('.page-loader');
        if (loader) {
            loader.remove();
        }
    }

    /**
     * Show error state
     */
    showError(pageId, message) {
        if (this.container) {
            this.container.innerHTML = `
                <div class="page-error">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Error Loading Page</h3>
                    <p>${message}</p>
                    <button class="caido-btn primary" onclick="window.pageController.goBack()">
                        <i class="fas fa-arrow-left"></i> Go Back
                    </button>
                </div>
            `;
        }
    }

    /**
     * Update sidebar active state
     */
    updateSidebarActive(pageId) {
        // Remove previous active states
        document.querySelectorAll('.sidebar-child-link.active').forEach(el => {
            el.classList.remove('active');
        });

        // Add active to current
        const activeLink = document.querySelector(`.sidebar-child-link[data-page="${pageId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    /**
     * Go back in history
     */
    goBack() {
        if (this.pageHistory.length > 1) {
            this.pageHistory.pop(); // Remove current
            const previous = this.pageHistory[this.pageHistory.length - 1];
            if (previous) {
                this.navigateTo(previous.page, previous.options, false);
            }
        }
    }

    /**
     * Event emitter methods
     */
    on(event, callback) {
        if (!this.eventBus.has(event)) {
            this.eventBus.set(event, []);
        }
        this.eventBus.get(event).push(callback);
    }

    off(event, callback) {
        if (this.eventBus.has(event)) {
            const handlers = this.eventBus.get(event);
            const index = handlers.indexOf(callback);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventBus.has(event)) {
            this.eventBus.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`Event handler error:`, e);
                }
            });
        }
    }

    /**
     * Refresh current page
     */
    async refresh() {
        if (this.currentPage && this.currentPage.refresh) {
            await this.currentPage.refresh();
        }
    }

    /**
     * Clear page cache
     */
    clearCache() {
        this.pageCache.clear();
    }
}

// Base Page Class for inheritance
class BasePage {
    constructor() {
        this.container = null;
        this.api = null;
        this.data = null;
        this.isActive = false;
        this.refreshInterval = null;
        this.autoRefreshMs = 30000; // 30 seconds default
    }

    async show(container, options = {}) {
        this.container = container;
        this.api = options.api;
        this.isActive = true;
        
        // Render structure
        this.container.innerHTML = this.createHTML();
        
        // Initialize components
        await this.initialize();
        
        // Load data from backend
        await this.loadData();
        
        // Setup auto-refresh if needed
        if (this.autoRefreshMs > 0) {
            this.startAutoRefresh();
        }
        
        // Add entrance animation
        this.container.classList.add('page-enter');
    }

    hide() {
        this.isActive = false;
        this.stopAutoRefresh();
        this.cleanup();
    }

    createHTML() {
        return `<div class="page-content">Override createHTML() in subclass</div>`;
    }

    async initialize() {
        // Override in subclass for component initialization
    }

    async loadData() {
        // Override in subclass to load data from API
    }

    async refresh() {
        if (this.isActive) {
            await this.loadData();
        }
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            if (this.isActive) {
                this.refresh();
            }
        }, this.autoRefreshMs);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    cleanup() {
        // Override for cleanup tasks
    }

    // Helper methods for subclasses
    showLoading(elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            el.innerHTML = `
                <div class="inline-loader">
                    <i class="fas fa-spinner fa-spin"></i> Loading...
                </div>
            `;
        }
    }

    showEmpty(elementId, message = 'No data available') {
        const el = document.getElementById(elementId);
        if (el) {
            el.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    showError(elementId, message) {
        const el = document.getElementById(elementId);
        if (el) {
            el.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>${message}</p>
                    <button class="caido-btn small" onclick="this.closest('.page-content').dispatchEvent(new Event('retry'))">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    formatDate(date) {
        return new Date(date).toLocaleString();
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getSeverityClass(severity) {
        const map = { critical: 'red', high: 'orange', medium: 'yellow', low: 'blue', info: 'gray' };
        return map[severity?.toLowerCase()] || 'gray';
    }

    getStatusClass(status) {
        const map = { active: 'green', running: 'green', open: 'red', resolved: 'gray', pending: 'yellow' };
        return map[status?.toLowerCase()] || 'gray';
    }
}

// Global instance
window.pageController = new PageController();
window.BasePage = BasePage;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PageController, BasePage };
}
