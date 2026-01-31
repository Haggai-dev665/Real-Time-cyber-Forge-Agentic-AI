/**
 * Page Index - Master file that registers all page classes
 * Import this file to have access to all pages
 */

// Import all page modules (they register themselves on window)
// In a real ES6 module setup, these would be proper imports

/**
 * Page Registry - Maps route keys to page classes
 */
const PageRegistry = {
    // ========================================
    // OVERVIEW SECTION
    // ========================================
    'dashboard-summary': 'DashboardSummaryPage',
    'dashboard-metrics': 'DashboardMetricsPage',
    'dashboard-activity': 'DashboardActivityPage',
    'sitemap-structure': 'SitemapStructurePage',
    'sitemap-endpoints': 'SitemapEndpointsPage',
    'sitemap-assets': 'SitemapAssetsPage',
    'scopes-global': 'ScopesGlobalPage',
    'scopes-project': 'ScopesProjectPage',
    'scopes-custom': 'ScopesCustomPage',

    // ========================================
    // PROXY SECTION
    // ========================================
    'intercept-rules': 'InterceptRulesPage',
    'intercept-queue': 'InterceptQueuePage',
    'intercept-history': 'InterceptHistoryPage',
    'http-requests': 'HttpRequestsPage',
    'http-responses': 'HttpResponsesPage',
    'http-analysis': 'HttpAnalysisPage',
    'websocket-connections': 'WsConnectionsPage',
    'websocket-messages': 'WsMessagesPage',
    'websocket-frames': 'WsFramesPage',
    'match-rules': 'MatchRulesPage',
    'match-templates': 'MatchTemplatesPage',
    'match-testing': 'MatchTestingPage',

    // ========================================
    // TESTING SECTION
    // ========================================
    'replay-queue': 'ReplayQueuePage',
    'replay-history': 'ReplayHistoryPage',
    'replay-comparison': 'ReplayComparisonPage',
    'automate-sequences': 'AutomateSequencesPage',
    'automate-macros': 'AutomateMacrosPage',
    'automate-scripts': 'AutomateScriptsPage',
    'workflows-active': 'WorkflowsActivePage',
    'workflows-templates': 'WorkflowsTemplatesPage',
    'workflows-schedule': 'WorkflowsSchedulePage',
    'assistant-chat': 'AssistantChatPage',
    'assistant-suggestions': 'AssistantSuggestionsPage',
    'assistant-actions': 'AssistantActionsPage',
    'ai-models-list': 'AIModelsListPage',
    'ai-models-config': 'AIModelsConfigPage',
    'ai-models-training': 'AIModelsTrainingPage',
    'threat-intel-feeds': 'ThreatIntelFeedsPage',
    'threat-intel-indicators': 'ThreatIntelIndicatorsPage',
    'threat-intel-reports': 'ThreatIntelReportsPage',
    'environment-variables': 'EnvironmentVariablesPage',
    'environment-secrets': 'EnvironmentSecretsPage',
    'environment-presets': 'EnvironmentPresetsPage',

    // ========================================
    // LOGGING SECTION
    // ========================================
    'search-queries': 'SearchQueriesPage',
    'search-filters': 'SearchFiltersPage',
    'search-history': 'SearchHistoryPage',
    'search-bookmarks': 'SearchBookmarksPage',
    'findings-all': 'FindingsAllPage',
    'findings-severity': 'FindingsBySeverityPage',
    'findings-host': 'FindingsByHostPage',
    'findings-reports': 'FindingsReportsPage',
    'exports-generate': 'ExportsGeneratePage',
    'exports-history': 'ExportsHistoryPage',
    'exports-templates': 'ExportsTemplatesPage',

    // ========================================
    // WORKSPACE SECTION
    // ========================================
    'files-project': 'FilesProjectPage',
    'files-notes': 'FilesNotesPage',
    'files-attachments': 'FilesAttachmentsPage',
    'plugins-installed': 'PluginsInstalledPage',
    'plugins-store': 'PluginsStorePage',
    'plugins-editor': 'PluginsEditorPage',
    'workspace-settings': 'WorkspaceSettingsPage',
    'workspace-projects': 'WorkspaceProjectsPage',
    'team-members': 'TeamMembersPage',
    'team-activity': 'TeamActivityPage',

    // ========================================
    // AI AGENT SECTION
    // ========================================
    'ai-agent-status': 'AIAgentStatusPage',
    'ai-agent-tasks': 'AIAgentTasksPage',
    'ai-agent-threats': 'AIThreatQueuePage',
    'ai-agent-learning': 'AILearningPage',
    'ai-agent-settings': 'AISettingsPage',

    // ========================================
    // BROWSER MONITOR SECTION
    // ========================================
    'browser-sessions': 'BrowserSessionsPage',
    'browser-cookies': 'BrowserCookiesPage',
    'browser-storage': 'BrowserStoragePage',
    'browser-network': 'BrowserNetworkPage',
    'browser-dom': 'BrowserDOMPage',
    'browser-console': 'BrowserConsolePage',

    // ========================================
    // REAL-TIME INTEL SECTION
    // ========================================
    'realtime-threat-map': 'ThreatMapPage',
    'realtime-live-feeds': 'LiveFeedsPage',
    'realtime-alerts': 'AlertsPage',

    // ========================================
    // SCAN MODES SECTION
    // ========================================
    'scan-passive': 'PassiveScanPage',
    'scan-active': 'ActiveScanPage',
    'scan-stealth': 'StealthScanPage',
    'scan-aggressive': 'AggressiveScanPage'
};

/**
 * Get page class by route key
 * @param {string} key - The route key (e.g., 'dashboard-summary')
 * @returns {Function|null} - The page class constructor or null if not found
 */
function getPageClass(key) {
    const className = PageRegistry[key];
    if (!className) {
        console.warn(`Page not found for key: ${key}`);
        return null;
    }
    
    const PageClass = window[className];
    if (!PageClass) {
        console.warn(`Page class not loaded: ${className}`);
        return null;
    }
    
    return PageClass;
}

/**
 * Create page instance by route key
 * @param {string} key - The route key
 * @returns {BasePage|null} - The page instance or null
 */
function createPage(key) {
    const PageClass = getPageClass(key);
    if (!PageClass) return null;
    return new PageClass();
}

/**
 * Load all page scripts dynamically
 * @returns {Promise<void>}
 */
async function loadAllPageScripts() {
    const scripts = [
        'page-controller.js',
        'overview-dashboard.js',
        'overview-sitemap.js',
        'overview-scopes.js',
        'proxy-intercept.js',
        'proxy-websocket-match.js',
        'testing-replay-automate.js',
        'testing-workflows-assistant.js',
        'testing-ai-threat-env.js',
        'logging-search-findings-exports.js',
        'workspace-files-plugins.js',
        'ai-agent-pages.js',
        'browser-monitor-pages.js',
        'realtime-intel-pages.js',
        'scan-modes-pages.js'
    ];

    const basePath = './pages/';
    
    for (const script of scripts) {
        await new Promise((resolve, reject) => {
            const scriptEl = document.createElement('script');
            scriptEl.src = basePath + script;
            scriptEl.onload = resolve;
            scriptEl.onerror = reject;
            document.head.appendChild(scriptEl);
        });
    }
    
    console.log('All page scripts loaded');
}

/**
 * Initialize page controller with all pages
 */
function initializePageController() {
    if (!window.pageController) {
        window.pageController = new PageController();
    }
    
    // Register all pages
    Object.entries(PageRegistry).forEach(([key, className]) => {
        const PageClass = window[className];
        if (PageClass) {
            window.pageController.registerPage(key, PageClass);
        }
    });
    
    console.log(`Registered ${Object.keys(PageRegistry).length} pages`);
}

// Export to window
if (typeof window !== 'undefined') {
    window.PageRegistry = PageRegistry;
    window.getPageClass = getPageClass;
    window.createPage = createPage;
    window.loadAllPageScripts = loadAllPageScripts;
    window.initializePageController = initializePageController;
}

// Page count summary
const pageCounts = {
    'Overview': 9,
    'Proxy': 12,
    'Testing': 18,
    'Logging': 11,
    'Workspace': 10,
    'AI Agent': 5,
    'Browser Monitor': 6,
    'Real-Time Intel': 3,
    'Scan Modes': 4
};

console.log('=== Page Index Loaded ===');
console.log('Total Pages:', Object.keys(PageRegistry).length);
Object.entries(pageCounts).forEach(([section, count]) => {
    console.log(`  ${section}: ${count} pages`);
});
