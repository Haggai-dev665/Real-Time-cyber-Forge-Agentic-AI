/**
 * Web Scraper Screen Component
 * Advanced web scraping capabilities for cybersecurity intelligence
 */

class WebScraperScreen {
    constructor() {
        this.isInitialized = false;
        this.activeScrapes = new Map();
        this.scrapingResults = [];
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('Initializing Web Scraper Screen...');
        await this.loadScrapingTargets();
        this.setupEventListeners();
        this.isInitialized = true;
    }

    render() {
        return `
            <div class="screen web-scraper-screen">
                <div class="screen-header">
                    <div class="header-content">
                        <div class="header-title">
                            <i class="fas fa-spider"></i>
                            <h1>Advanced Web Scraper</h1>
                            <span class="status-badge active">Active</span>
                        </div>
                        <div class="header-actions">
                            <button class="btn btn-primary" id="new-scrape-btn">
                                <i class="fas fa-plus"></i>
                                New Scrape
                            </button>
                            <button class="btn btn-secondary" id="import-targets-btn">
                                <i class="fas fa-upload"></i>
                                Import Targets
                            </button>
                        </div>
                    </div>
                </div>

                <div class="screen-content">
                    <!-- Quick Actions -->
                    <div class="quick-actions-grid">
                        <div class="action-card" data-action="domain-scrape">
                            <div class="action-icon">
                                <i class="fas fa-globe"></i>
                            </div>
                            <div class="action-content">
                                <h3>Domain Scraping</h3>
                                <p>Extract information from websites and subdomains</p>
                            </div>
                        </div>
                        <div class="action-card" data-action="social-scrape">
                            <div class="action-icon">
                                <i class="fas fa-hashtag"></i>
                            </div>
                            <div class="action-content">
                                <h3>Social Media</h3>
                                <p>Monitor social platforms for threat intelligence</p>
                            </div>
                        </div>
                        <div class="action-card" data-action="deep-web-scrape">
                            <div class="action-icon">
                                <i class="fas fa-user-secret"></i>
                            </div>
                            <div class="action-content">
                                <h3>Deep Web</h3>
                                <p>Advanced crawling with proxy rotation</p>
                            </div>
                        </div>
                        <div class="action-card" data-action="api-scrape">
                            <div class="action-icon">
                                <i class="fas fa-code"></i>
                            </div>
                            <div class="action-content">
                                <h3>API Discovery</h3>
                                <p>Find and analyze exposed APIs and endpoints</p>
                            </div>
                        </div>
                    </div>

                    <!-- Active Scraping Tasks -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Active Scraping Tasks</h2>
                            <div class="task-stats">
                                <span class="stat-item">
                                    <span class="stat-value" id="active-tasks-count">0</span>
                                    <span class="stat-label">Active</span>
                                </span>
                                <span class="stat-item">
                                    <span class="stat-value" id="completed-tasks-count">0</span>
                                    <span class="stat-label">Completed</span>
                                </span>
                                <span class="stat-item">
                                    <span class="stat-value" id="data-points-count">0</span>
                                    <span class="stat-label">Data Points</span>
                                </span>
                            </div>
                        </div>
                        <div class="tasks-container" id="scraping-tasks">
                            <!-- Tasks will be rendered here -->
                        </div>
                    </div>

                    <!-- Scraping Results -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Recent Results</h2>
                            <div class="header-controls">
                                <select id="results-filter">
                                    <option value="all">All Results</option>
                                    <option value="threats">Threats Found</option>
                                    <option value="credentials">Credentials</option>
                                    <option value="apis">API Endpoints</option>
                                    <option value="emails">Email Addresses</option>
                                </select>
                                <button class="btn btn-sm" id="export-results-btn">
                                    <i class="fas fa-download"></i>
                                    Export
                                </button>
                            </div>
                        </div>
                        <div class="results-table-container">
                            <table class="data-table" id="results-table">
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Source</th>
                                        <th>Type</th>
                                        <th>Data</th>
                                        <th>Risk Level</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="results-tbody">
                                    <!-- Results will be populated here -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadScrapingTargets() {
        try {
            // Fetch active scraping tasks from backend
            const response = await fetch('/api/scraping/tasks');
            const data = await response.json();
            
            if (data.success) {
                this.activeScrapes = new Map(data.tasks.map(task => [task.id, task]));
                this.updateTasksDisplay();
            }
        } catch (error) {
            console.error('Error loading scraping targets:', error);
            this.showNotification('Failed to load scraping targets', 'error');
        }
    }

    setupEventListeners() {
        // New scrape button
        document.getElementById('new-scrape-btn')?.addEventListener('click', () => {
            this.showNewScrapeModal();
        });

        // Quick action cards
        document.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const action = card.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Results filter
        document.getElementById('results-filter')?.addEventListener('change', (e) => {
            this.filterResults(e.target.value);
        });

        // Export results
        document.getElementById('export-results-btn')?.addEventListener('click', () => {
            this.exportResults();
        });
    }

    async handleQuickAction(action) {
        switch (action) {
            case 'domain-scrape':
                this.startDomainScraping();
                break;
            case 'social-scrape':
                this.startSocialMediaScraping();
                break;
            case 'deep-web-scrape':
                this.startDeepWebScraping();
                break;
            case 'api-scrape':
                this.startAPIDiscovery();
                break;
        }
    }

    async startDomainScraping() {
        const domain = prompt('Enter domain to scrape:');
        if (!domain) return;

        try {
            // Use CyberForge API if available
            const api = window.cyberforgeAPI || window.apiClient;
            if (api?.scrapeDomain) {
                window.notificationSystem?.loading('Scraping', `Starting scrape of ${domain}...`);
                
                const response = await api.scrapeDomain(domain, {
                    depth: 3,
                    followSubdomains: true,
                    extractEmails: true,
                    extractPhoneNumbers: true,
                    checkSecurity: true
                });

                if (response.success) {
                    this.addScrapingTask(response.data?.task || { id: Date.now(), domain, status: 'running' });
                    window.notificationSystem?.success('Scraping Started', `Domain scraping started for ${domain}`);
                    
                    // If we have scraped data, analyze with CyberForge ML
                    if (response.data?.scraped_data && window.cyberforgeAPI) {
                        const analysis = await window.cyberforgeAPI.cyberforgeAnalyzeWebsite(response.data.scraped_data);
                        if (analysis.success) {
                            console.log('CyberForge ML Analysis:', analysis.data);
                            const riskLevel = analysis.data?.aggregate?.overall_risk_level || 'unknown';
                            if (riskLevel !== 'low' && riskLevel !== 'minimal') {
                                window.notificationSystem?.warning('⚠️ Security Issues', 
                                    `${domain} has ${riskLevel.toUpperCase()} risk indicators`);
                            }
                        }
                    }
                    return;
                }
            }
            
            // Fallback to direct fetch
            const response = await fetch('/api/scraping/domain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    domain,
                    options: {
                        depth: 3,
                        followSubdomains: true,
                        extractEmails: true,
                        extractPhoneNumbers: true,
                        checkSecurity: true
                    }
                })
            });

            const result = await response.json();
            if (result.success) {
                this.addScrapingTask(result.task);
                this.showNotification('Domain scraping started successfully', 'success');
            }
        } catch (error) {
            console.error('Error starting domain scraping:', error);
            window.notificationSystem?.error('Scrape Failed', error.message);
        }
    }

    async startSocialMediaScraping() {
        // Implementation for social media scraping
        this.showNotification('Social media scraping initiated', 'info');
    }

    async startDeepWebScraping() {
        // Implementation for deep web scraping with proxy rotation
        this.showNotification('Deep web scraping initiated with proxy rotation', 'info');
    }

    async startAPIDiscovery() {
        // Implementation for API discovery
        this.showNotification('API discovery scan initiated', 'info');
    }

    addScrapingTask(task) {
        this.activeScrapes.set(task.id, task);
        this.updateTasksDisplay();
        this.updateStats();
    }

    updateTasksDisplay() {
        const container = document.getElementById('scraping-tasks');
        if (!container) return;

        container.innerHTML = Array.from(this.activeScrapes.values())
            .map(task => this.renderTask(task))
            .join('');
    }

    renderTask(task) {
        const progress = task.progress || 0;
        const statusClass = task.status === 'completed' ? 'success' : 
                           task.status === 'error' ? 'error' : 'warning';

        return `
            <div class="task-card" data-task-id="${task.id}">
                <div class="task-header">
                    <div class="task-info">
                        <h3>${task.target}</h3>
                        <span class="task-type">${task.type}</span>
                    </div>
                    <div class="task-status ${statusClass}">
                        ${task.status}
                    </div>
                </div>
                <div class="task-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <span class="progress-text">${progress}%</span>
                </div>
                <div class="task-stats">
                    <span class="stat">Items: ${task.itemsFound || 0}</span>
                    <span class="stat">Threats: ${task.threatsFound || 0}</span>
                    <span class="stat">Runtime: ${this.formatDuration(task.runtime || 0)}</span>
                </div>
                <div class="task-actions">
                    <button class="btn btn-sm" onclick="webScraperScreen.viewTaskDetails('${task.id}')">
                        <i class="fas fa-eye"></i>
                        View
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="webScraperScreen.stopTask('${task.id}')">
                        <i class="fas fa-stop"></i>
                        Stop
                    </button>
                </div>
            </div>
        `;
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    updateStats() {
        const activeTasks = Array.from(this.activeScrapes.values()).filter(task => task.status === 'running').length;
        const completedTasks = Array.from(this.activeScrapes.values()).filter(task => task.status === 'completed').length;
        const totalDataPoints = this.scrapingResults.length;

        document.getElementById('active-tasks-count').textContent = activeTasks;
        document.getElementById('completed-tasks-count').textContent = completedTasks;
        document.getElementById('data-points-count').textContent = totalDataPoints;
    }

    showNotification(message, type = 'info') {
        // Use the existing notification system
        if (window.notificationSystem) {
            window.notificationSystem.show(message, type);
        }
    }

    filterResults(filterType) {
        // Implementation for filtering results
        console.log('Filtering results by:', filterType);
    }

    exportResults() {
        // Implementation for exporting results
        console.log('Exporting scraping results...');
    }
}

// Initialize and export
const webScraperScreen = new WebScraperScreen();

// Auto-initialize when screen is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.web-scraper-screen')) {
        webScraperScreen.init();
    }
});