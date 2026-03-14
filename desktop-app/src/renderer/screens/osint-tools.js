/**
 * OSINT Tools Screen Component
 * Open Source Intelligence gathering and analysis tools
 */

class OSINTToolsScreen {
    constructor() {
        this.isInitialized = false;
        this.activeInvestigations = [];
        this.osintSources = [];
        this.searchResults = new Map();
        this.container = null;
        this.isActive = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('Initializing OSINT Tools Screen...');
        await this.loadOSINTData();
        this.setupEventListeners();
        this.isInitialized = true;
    }

    render() {
        return `
            <div class="screen osint-tools-screen">
                <div class="screen-header">
                    <div class="header-content">
                        <div class="header-title">
                            <i class="fas fa-globe"></i>
                            <h1>OSINT Intelligence Tools</h1>
                            <span class="status-badge gathering">Gathering</span>
                        </div>
                        <div class="header-actions">
                            <button class="btn btn-primary" id="new-investigation-btn">
                                <i class="fas fa-plus"></i>
                                New Investigation
                            </button>
                            <button class="btn btn-secondary" id="bulk-search-btn">
                                <i class="fas fa-layer-group"></i>
                                Bulk Search
                            </button>
                        </div>
                    </div>
                </div>

                <div class="screen-content">
                    <!-- OSINT Search Hub -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>OSINT Search Hub</h2>
                        </div>
                        <div class="search-hub">
                            <div class="search-input-section">
                                <div class="input-group large">
                                    <select id="search-type">
                                        <option value="domain">Domain</option>
                                        <option value="ip">IP Address</option>
                                        <option value="email">Email</option>
                                        <option value="username">Username</option>
                                        <option value="phone">Phone Number</option>
                                        <option value="hash">File Hash</option>
                                        <option value="social">Social Media</option>
                                        <option value="person">Person</option>
                                    </select>
                                    <input type="text" id="osint-search-input" placeholder="Enter target for OSINT investigation..." />
                                    <button class="btn btn-primary" id="start-search-btn">
                                        <i class="fas fa-search"></i>
                                        Search All Sources
                                    </button>
                                </div>
                            </div>
                            <div class="search-options">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="include-passive" checked>
                                    <span class="checkmark"></span>
                                    Passive Sources Only
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="include-social">
                                    <span class="checkmark"></span>
                                    Social Media
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="include-breach">
                                    <span class="checkmark"></span>
                                    Breach Databases
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="include-darkweb">
                                    <span class="checkmark"></span>
                                    Dark Web Sources
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="auto-pivot" checked>
                                    <span class="checkmark"></span>
                                    Auto-Pivot on Results
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- OSINT Tools Grid -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Intelligence Tools</h2>
                        </div>
                        <div class="osint-tools-grid">
                            <div class="tool-category" data-category="domain-intel">
                                <div class="category-header">
                                    <h3>Domain Intelligence</h3>
                                    <span class="tools-count">8 tools</span>
                                </div>
                                <div class="tools-list">
                                    <div class="tool-item" data-tool="whois">
                                        <i class="fas fa-info-circle"></i>
                                        <span>WHOIS Lookup</span>
                                        <button class="tool-launch-btn" onclick="osintToolsScreen.launchTool('whois')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                    <div class="tool-item" data-tool="dns">
                                        <i class="fas fa-network-wired"></i>
                                        <span>DNS Records</span>
                                        <button class="tool-launch-btn" onclick="osintToolsScreen.launchTool('dns')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                    <div class="tool-item" data-tool="subdomains">
                                        <i class="fas fa-sitemap"></i>
                                        <span>Subdomain Enum</span>
                                        <button class="tool-launch-btn" onclick="osintToolsScreen.launchTool('subdomains')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                    <div class="tool-item" data-tool="certificates">
                                        <i class="fas fa-certificate"></i>
                                        <span>SSL Certificates</span>
                                        <button class="tool-launch-btn" onclick="osintToolsScreen.launchTool('certificates')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="tool-category" data-category="ip-intel">
                                <div class="category-header">
                                    <h3>IP Intelligence</h3>
                                    <span class="tools-count">6 tools</span>
                                </div>
                                <div class="tools-list">
                                    <div class="tool-item" data-tool="geolocation">
                                        <i class="fas fa-map-marker-alt"></i>
                                        <span>Geolocation</span>
                                        <button class="tool-launch-btn" onclick="osintToolsScreen.launchTool('geolocation')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                    <div class="tool-item" data-tool="reputation">
                                        <i class="fas fa-shield-alt"></i>
                                        <span>IP Reputation</span>
                                        <button class="tool-launch-btn" onclick="osintToolsScreen.launchTool('reputation')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                    <div class="tool-item" data-tool="ports">
                                        <i class="fas fa-door-open"></i>
                                        <span>Port Scanner</span>
                                        <button class="tool-launch-btn" onclick="osintToolsScreen.launchTool('ports')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                    <div class="tool-item" data-tool="shodan">
                                        <i class="fas fa-satellite"></i>
                                        <span>Shodan Search</span>
                                        <button class="tool-launch-btn" onclick="osintToolsScreen.launchTool('shodan')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="tool-category" data-category="social-intel">
                                <div class="category-header">
                                    <h3>Social Intelligence</h3>
                                    <span class="tools-count">10 tools</span>
                                </div>
                                <div class="tools-list">
                                    <div class="tool-item" data-tool="social-search">
                                        <i class="fas fa-users"></i>
                                        <span>Social Search</span>
                                        <button class="tool-launch-btn" onclick="osintToolsScreen.launchTool('social-search')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                    <div class="tool-item" data-tool="username">
                                        <i class="fas fa-user-circle"></i>
                                        <span>Username Search</span>
                                        <button class="tool-launch-btn" onclick="osintToolsScreen.launchTool('username')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                    <div class="tool-item" data-tool="email-search">
                                        <i class="fas fa-envelope"></i>
                                        <span>Email Search</span>
                                        <button class="tool-launch-btn" onclick="osintToolsScreen.launchTool('email-search')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                    <div class="tool-item" data-tool="people-search">
                                        <i class="fas fa-user-friends"></i>
                                        <span>People Search</span>
                                        <button class="tool-launch-btn" onclick="osintToolsScreen.launchTool('people-search')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="tool-category" data-category="file-intel">
                                <div class="category-header">
                                    <h3>File Intelligence</h3>
                                    <span class="tools-count">5 tools</span>
                                </div>
                                <div class="tools-list">
                                    <div class="tool-item" data-tool="hash-lookup">
                                        <i class="fas fa-fingerprint"></i>
                                        <span>Hash Lookup</span>
                                        <button class="tool-launch-btn" onclick="osintToolsScreen.launchTool('hash-lookup')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                    <div class="tool-item" data-tool="virustotal">
                                        <i class="fas fa-virus"></i>
                                        <span>VirusTotal</span>
                                        <button class="tool-launch-btn" onclick="osintToolsScreen.launchTool('virustotal')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                    <div class="tool-item" data-tool="metadata">
                                        <i class="fas fa-info"></i>
                                        <span>Metadata Analysis</span>
                                        <button class="tool-launch-btn" onclick="osintToolsScreen.launchTool('metadata')">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Active Investigations -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Active Investigations</h2>
                            <div class="header-controls">
                                <select id="investigation-filter">
                                    <option value="all">All Investigations</option>
                                    <option value="active">Active</option>
                                    <option value="completed">Completed</option>
                                    <option value="paused">Paused</option>
                                </select>
                            </div>
                        </div>
                        <div class="investigations-container" id="active-investigations">
                            <!-- Investigations will be rendered here -->
                        </div>
                    </div>

                    <!-- Search Results -->
                    <div class="content-section" id="search-results-section" style="display: none;">
                        <div class="section-header">
                            <h2>Search Results</h2>
                            <div class="header-controls">
                                <button class="btn btn-sm" id="export-osint-results-btn">
                                    <i class="fas fa-download"></i>
                                    Export
                                </button>
                                <button class="btn btn-sm" id="create-report-btn">
                                    <i class="fas fa-file-alt"></i>
                                    Generate Report
                                </button>
                            </div>
                        </div>
                        <div class="results-container" id="osint-results">
                            <!-- Results will be rendered here -->
                        </div>
                    </div>

                    <!-- Data Sources Status -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Data Sources</h2>
                            <div class="header-controls">
                                <button class="btn btn-sm" id="test-sources-btn">
                                    <i class="fas fa-heartbeat"></i>
                                    Test All Sources
                                </button>
                            </div>
                        </div>
                        <div class="sources-grid" id="sources-grid">
                            <!-- Data sources will be rendered here -->
                        </div>
                    </div>

                    <!-- OSINT Analytics -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Analytics Dashboard</h2>
                        </div>
                        <div class="analytics-grid">
                            <div class="analytics-card">
                                <div class="card-header">
                                    <h3>Search Activity</h3>
                                </div>
                                <div class="analytics-content">
                                    <canvas id="search-activity-chart" width="400" height="200"></canvas>
                                </div>
                            </div>
                            
                            <div class="analytics-card">
                                <div class="card-header">
                                    <h3>Source Performance</h3>
                                </div>
                                <div class="analytics-content">
                                    <canvas id="source-performance-chart" width="400" height="200"></canvas>
                                </div>
                            </div>
                            
                            <div class="analytics-card">
                                <div class="card-header">
                                    <h3>Investigation Types</h3>
                                </div>
                                <div class="analytics-content">
                                    <canvas id="investigation-types-chart" width="400" height="200"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadOSINTData() {
        try {
            // Load active investigations
            const investigationsResponse = await fetch('/api/osint/investigations');
            const investigationsData = await investigationsResponse.json();
            
            if (investigationsData.success) {
                this.activeInvestigations = investigationsData.investigations;
                this.updateInvestigationsDisplay();
            }

            // Load OSINT sources status
            const sourcesResponse = await fetch('/api/osint/sources');
            const sourcesData = await sourcesResponse.json();
            
            if (sourcesData.success) {
                this.osintSources = sourcesData.sources;
                this.updateSourcesDisplay();
            }

            // Load analytics data
            await this.loadAnalytics();
            
        } catch (error) {
            console.error('Error loading OSINT data:', error);
            this.showNotification('Failed to load OSINT data', 'error');
        }
    }

    setupEventListeners() {
        // New investigation button
        document.getElementById('new-investigation-btn')?.addEventListener('click', () => {
            this.createNewInvestigation();
        });

        // Bulk search button
        document.getElementById('bulk-search-btn')?.addEventListener('click', () => {
            this.showBulkSearchModal();
        });

        // Start search button
        document.getElementById('start-search-btn')?.addEventListener('click', () => {
            this.startOSINTSearch();
        });

        // Search type change
        document.getElementById('search-type')?.addEventListener('change', (e) => {
            this.updateSearchPlaceholder(e.target.value);
        });

        // Enter key for search
        document.getElementById('osint-search-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.startOSINTSearch();
            }
        });

        // Investigation filter
        document.getElementById('investigation-filter')?.addEventListener('change', (e) => {
            this.filterInvestigations(e.target.value);
        });

        // Export and report buttons
        document.getElementById('export-osint-results-btn')?.addEventListener('click', () => {
            this.exportResults();
        });

        document.getElementById('create-report-btn')?.addEventListener('click', () => {
            this.generateReport();
        });

        // Test sources button
        document.getElementById('test-sources-btn')?.addEventListener('click', () => {
            this.testAllSources();
        });
    }

    async startOSINTSearch() {
        const searchInput = document.getElementById('osint-search-input').value.trim();
        const searchType = document.getElementById('search-type').value;
        
        if (!searchInput) {
            this.showNotification('Please enter a search target', 'warning');
            return;
        }

        const options = {
            includePassive: document.getElementById('include-passive').checked,
            includeSocial: document.getElementById('include-social').checked,
            includeBreach: document.getElementById('include-breach').checked,
            includeDarkweb: document.getElementById('include-darkweb').checked,
            autoPivot: document.getElementById('auto-pivot').checked
        };

        try {
            const response = await fetch('/api/osint/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target: searchInput,
                    type: searchType,
                    options: options
                })
            });

            const result = await response.json();
            if (result.success) {
                this.displaySearchResults(result.results);
                this.showNotification('OSINT search completed', 'success');
            }
        } catch (error) {
            console.error('Error performing OSINT search:', error);
            this.showNotification('Failed to perform OSINT search', 'error');
        }
    }

    displaySearchResults(results) {
        const resultsSection = document.getElementById('search-results-section');
        const resultsContainer = document.getElementById('osint-results');
        
        if (!resultsSection || !resultsContainer) return;
        
        resultsSection.style.display = 'block';
        
        resultsContainer.innerHTML = `
            <div class="osint-results-grid">
                ${Object.entries(results).map(([source, data]) => `
                    <div class="result-source-card">
                        <div class="source-header">
                            <h4>${source}</h4>
                            <span class="results-count">${data.results?.length || 0} results</span>
                        </div>
                        <div class="source-results">
                            ${data.results?.map(result => `
                                <div class="result-item">
                                    <div class="result-content">
                                        <strong>${result.title || 'Result'}</strong>
                                        <p>${result.description || result.data}</p>
                                        ${result.url ? `<a href="${result.url}" target="_blank" class="result-link">View Source</a>` : ''}
                                    </div>
                                    <div class="result-meta">
                                        <span class="confidence">Confidence: ${result.confidence || 'N/A'}</span>
                                        <span class="timestamp">${new Date(result.timestamp || Date.now()).toLocaleString()}</span>
                                    </div>
                                </div>
                            `).join('') || '<p class="no-results">No results found</p>'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    updateInvestigationsDisplay() {
        const container = document.getElementById('active-investigations');
        if (!container) return;

        container.innerHTML = this.activeInvestigations.map(investigation => `
            <div class="investigation-card">
                <div class="investigation-header">
                    <div class="investigation-info">
                        <h3>${investigation.name}</h3>
                        <div class="investigation-meta">
                            <span class="investigation-type">${investigation.type}</span>
                            <span class="investigation-target">${investigation.target}</span>
                        </div>
                    </div>
                    <div class="investigation-status ${investigation.status.toLowerCase()}">
                        ${investigation.status}
                    </div>
                </div>
                <div class="investigation-progress">
                    <div class="progress-info">
                        <span>Progress: ${investigation.progress || 0}%</span>
                        <span>Sources: ${investigation.sourcesUsed || 0}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${investigation.progress || 0}%"></div>
                    </div>
                </div>
                <div class="investigation-stats">
                    <div class="stat-item">
                        <span class="stat-value">${investigation.resultsFound || 0}</span>
                        <span class="stat-label">Results Found</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${investigation.pivotPoints || 0}</span>
                        <span class="stat-label">Pivot Points</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${investigation.relevanceScore || 0}%</span>
                        <span class="stat-label">Relevance</span>
                    </div>
                </div>
                <div class="investigation-actions">
                    <button class="btn btn-sm" onclick="osintToolsScreen.viewInvestigation('${investigation.id}')">
                        <i class="fas fa-eye"></i>
                        View
                    </button>
                    <button class="btn btn-sm" onclick="osintToolsScreen.pauseInvestigation('${investigation.id}')">
                        <i class="fas fa-pause"></i>
                        Pause
                    </button>
                    <button class="btn btn-sm" onclick="osintToolsScreen.exportInvestigation('${investigation.id}')">
                        <i class="fas fa-download"></i>
                        Export
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateSourcesDisplay() {
        const container = document.getElementById('sources-grid');
        if (!container) return;

        container.innerHTML = this.osintSources.map(source => `
            <div class="source-card ${source.status.toLowerCase()}">
                <div class="source-header">
                    <div class="source-info">
                        <h4>${source.name}</h4>
                        <span class="source-type">${source.type}</span>
                    </div>
                    <div class="source-status ${source.status.toLowerCase()}">
                        <i class="fas ${source.status === 'online' ? 'fa-check-circle' : source.status === 'offline' ? 'fa-times-circle' : 'fa-exclamation-circle'}"></i>
                        ${source.status}
                    </div>
                </div>
                <div class="source-metrics">
                    <div class="source-metric">
                        <span class="metric-label">Response Time:</span>
                        <span class="metric-value">${source.responseTime || 'N/A'}ms</span>
                    </div>
                    <div class="source-metric">
                        <span class="metric-label">Success Rate:</span>
                        <span class="metric-value">${source.successRate || 0}%</span>
                    </div>
                    <div class="source-metric">
                        <span class="metric-label">Last Check:</span>
                        <span class="metric-value">${source.lastCheck ? new Date(source.lastCheck).toLocaleString() : 'Never'}</span>
                    </div>
                </div>
                <div class="source-actions">
                    <button class="btn btn-xs" onclick="osintToolsScreen.testSource('${source.id}')">
                        <i class="fas fa-heartbeat"></i>
                        Test
                    </button>
                    <button class="btn btn-xs" onclick="osintToolsScreen.configureSource('${source.id}')">
                        <i class="fas fa-cog"></i>
                        Configure
                    </button>
                </div>
            </div>
        `).join('');
    }

    async loadAnalytics() {
        try {
            const response = await fetch('/api/osint/analytics');
            const data = await response.json();
            
            if (data.success) {
                this.renderCharts(data.analytics);
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    }

    renderCharts(analyticsData) {
        // Search Activity Chart
        const searchActivityCtx = document.getElementById('search-activity-chart');
        if (searchActivityCtx) {
            new Chart(searchActivityCtx, {
                type: 'line',
                data: {
                    labels: analyticsData.searchActivity?.labels || [],
                    datasets: [{
                        label: 'Searches',
                        data: analyticsData.searchActivity?.data || [],
                        borderColor: 'rgb(255, 255, 255)',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }

        // Source Performance Chart
        const sourcePerformanceCtx = document.getElementById('source-performance-chart');
        if (sourcePerformanceCtx) {
            new Chart(sourcePerformanceCtx, {
                type: 'bar',
                data: {
                    labels: analyticsData.sourcePerformance?.labels || [],
                    datasets: [{
                        label: 'Success Rate %',
                        data: analyticsData.sourcePerformance?.data || [],
                        backgroundColor: 'rgba(255, 255, 255, 0.8)'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true, max: 100 }
                    }
                }
            });
        }

        // Investigation Types Chart
        const investigationTypesCtx = document.getElementById('investigation-types-chart');
        if (investigationTypesCtx) {
            new Chart(investigationTypesCtx, {
                type: 'doughnut',
                data: {
                    labels: analyticsData.investigationTypes?.labels || [],
                    datasets: [{
                        data: analyticsData.investigationTypes?.data || [],
                        backgroundColor: [
                            'rgba(255, 255, 255, 0.8)',
                            'rgba(255, 255, 255, 0.6)',
                            'rgba(255, 255, 255, 0.4)',
                            'rgba(255, 255, 255, 0.2)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }
    }

    updateSearchPlaceholder(searchType) {
        const input = document.getElementById('osint-search-input');
        const placeholders = {
            domain: 'Enter domain (e.g., example.com)',
            ip: 'Enter IP address (e.g., 192.168.1.1)',
            email: 'Enter email address (e.g., user@example.com)',
            username: 'Enter username (e.g., johndoe)',
            phone: 'Enter phone number (e.g., +1-555-123-4567)',
            hash: 'Enter file hash (MD5, SHA1, SHA256)',
            social: 'Enter social media handle (e.g., @username)',
            person: 'Enter person name (e.g., John Doe)'
        };
        
        if (input) {
            input.placeholder = placeholders[searchType] || 'Enter search target...';
        }
    }

    async launchTool(toolName) {
        try {
            const response = await fetch('/api/osint/tools/launch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tool: toolName })
            });

            const result = await response.json();
            if (result.success) {
                this.showNotification(`${toolName} tool launched`, 'success');
            }
        } catch (error) {
            console.error('Error launching tool:', error);
            this.showNotification('Failed to launch tool', 'error');
        }
    }

    showNotification(message, type = 'info') {
        if (window.notificationSystem) {
            window.notificationSystem.show(message, type);
        }
    }

    // Action methods
    createNewInvestigation() {
        console.log('Creating new investigation');
    }

    showBulkSearchModal() {
        console.log('Showing bulk search modal');
    }

    viewInvestigation(investigationId) {
        console.log('Viewing investigation:', investigationId);
    }

    pauseInvestigation(investigationId) {
        console.log('Pausing investigation:', investigationId);
    }

    exportInvestigation(investigationId) {
        console.log('Exporting investigation:', investigationId);
    }

    testSource(sourceId) {
        console.log('Testing source:', sourceId);
    }

    configureSource(sourceId) {
        console.log('Configuring source:', sourceId);
    }

    testAllSources() {
        console.log('Testing all sources');
    }

    filterInvestigations(filter) {
        console.log('Filtering investigations:', filter);
    }

    exportResults() {
        console.log('Exporting OSINT results');
    }

    generateReport() {
        console.log('Generating OSINT report');
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        container.innerHTML = this.render();
        await this.init();
        container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
    }
}

// Initialize and export
window.OSINTToolsScreen = OSINTToolsScreen;