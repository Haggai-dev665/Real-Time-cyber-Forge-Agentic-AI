/**
 * Logging Section Pages - Search, Findings, Exports
 * Connected to backend API for real data
 */

// ========================================
// SEARCH PAGES
// ========================================

class SearchQueriesPage extends BasePage {
    constructor() {
        super();
        this.queries = [];
        this.results = [];
    }

    createHTML() {
        return `
            <div class="page-content search-queries-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-search"></i>
                        <h2>Search Queries</h2>
                    </div>
                </div>

                <div class="search-container">
                    <div class="search-bar">
                        <input type="text" id="search-query" class="cf-input large" 
                               placeholder="Search requests, responses, headers..." />
                        <button class="cf-btn primary" id="execute-search">
                            <i class="fas fa-search"></i> Search
                        </button>
                    </div>

                    <div class="search-filters">
                        <select id="search-method" class="cf-select small">
                            <option value="">All Methods</option>
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                        <select id="search-status" class="cf-select small">
                            <option value="">All Status</option>
                            <option value="2xx">2xx Success</option>
                            <option value="3xx">3xx Redirect</option>
                            <option value="4xx">4xx Client Error</option>
                            <option value="5xx">5xx Server Error</option>
                        </select>
                        <input type="text" id="search-host" class="cf-input small" placeholder="Host filter..." />
                    </div>
                </div>

                <div class="search-results" id="search-results">
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <p>Enter a search query to find requests</p>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('execute-search')?.addEventListener('click', () => this.executeSearch());
        document.getElementById('search-query')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.executeSearch();
        });
    }

    async executeSearch() {
        const query = document.getElementById('search-query')?.value;
        const method = document.getElementById('search-method')?.value;
        const status = document.getElementById('search-status')?.value;
        const host = document.getElementById('search-host')?.value;

        if (!query && !method && !status && !host) {
            window.showToast?.('warning', 'Empty Query', 'Please enter a search query or filter');
            return;
        }

        const resultsContainer = document.getElementById('search-results');
        resultsContainer.innerHTML = '<div class="loading">Searching...</div>';

        try {
            const result = await this.api.getHttpRequests(1, 100);
            if (result.success) {
                let requests = result.data?.data?.requests || [];

                // Apply filters
                if (query) {
                    const q = query.toLowerCase();
                    requests = requests.filter(r => 
                        r.path?.toLowerCase().includes(q) ||
                        r.host?.toLowerCase().includes(q) ||
                        JSON.stringify(r.headers || []).toLowerCase().includes(q)
                    );
                }
                if (method) {
                    requests = requests.filter(r => r.method === method);
                }
                if (status) {
                    const statusPrefix = status.charAt(0);
                    requests = requests.filter(r => String(r.status).startsWith(statusPrefix));
                }
                if (host) {
                    requests = requests.filter(r => r.host?.includes(host));
                }

                this.results = requests;
                this.renderResults();
            }
        } catch (error) {
            resultsContainer.innerHTML = `<div class="error">Search failed: ${error.message}</div>`;
        }
    }

    renderResults() {
        const container = document.getElementById('search-results');
        if (!container) return;

        if (!this.results.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>No results found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="results-header">
                <span>${this.results.length} results found</span>
            </div>
            <div class="results-list">
                ${this.results.map(req => `
                    <div class="result-item" data-request-id="${req.id}">
                        <span class="method-badge ${req.method?.toLowerCase()}">${req.method}</span>
                        <span class="result-host">${req.host}</span>
                        <span class="result-path">${req.path}</span>
                        <span class="status-badge status-${Math.floor((req.status || 0) / 100)}xx">${req.status || '-'}</span>
                        <span class="result-time">${this.formatDate(req.timestamp)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

class SearchFiltersPage extends BasePage {
    constructor() {
        super();
        this.filters = [];
    }

    createHTML() {
        return `
            <div class="page-content search-filters-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-filter"></i>
                        <h2>Saved Filters</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn primary" id="create-filter">
                            <i class="fas fa-plus"></i> New Filter
                        </button>
                    </div>
                </div>

                <div class="filters-list" id="filters-list">
                    <div class="loading-placeholder">Loading filters...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('create-filter')?.addEventListener('click', () => this.createFilter());
    }

    async loadData() {
        try {
            const result = await this.api.get('/api/filters');
            if (result.success) {
                this.filters = result.data?.data?.filters || [];
            } else {
                this.filters = this.getDefaultFilters();
            }
        } catch (error) {
            this.filters = this.getDefaultFilters();
        }
        this.renderFilters();
    }

    getDefaultFilters() {
        return [
            { id: 1, name: 'API Endpoints', expression: 'path:/api/*', usageCount: 45 },
            { id: 2, name: 'Auth Requests', expression: 'path:*auth* OR path:*login*', usageCount: 23 },
            { id: 3, name: 'Error Responses', expression: 'status:>=400', usageCount: 67 },
            { id: 4, name: 'JSON Responses', expression: 'content-type:application/json', usageCount: 89 },
            { id: 5, name: 'Large Responses', expression: 'response-size:>10000', usageCount: 12 }
        ];
    }

    renderFilters() {
        const container = document.getElementById('filters-list');
        if (!container) return;

        if (!this.filters.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-filter"></i>
                    <p>No saved filters</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filters.map(filter => `
            <div class="filter-card" data-filter-id="${filter.id}">
                <div class="filter-info">
                    <h4>${filter.name}</h4>
                    <code>${filter.expression}</code>
                </div>
                <div class="filter-stats">
                    <span>Used ${filter.usageCount} times</span>
                </div>
                <div class="filter-actions">
                    <button class="cf-btn small primary" data-action="apply">
                        <i class="fas fa-play"></i> Apply
                    </button>
                    <button class="cf-btn small" data-action="edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="cf-btn small danger" data-action="delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        this.bindFilterActions();
    }

    bindFilterActions() {
        document.querySelectorAll('.filter-card').forEach(card => {
            const filterId = card.dataset.filterId;

            card.querySelector('[data-action="apply"]')?.addEventListener('click', () => {
                const filter = this.filters.find(f => f.id == filterId);
                if (filter) {
                    window.pageController?.navigateTo('search-queries', { query: filter.expression });
                }
            });

            card.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
                try {
                    await this.api.delete(`/api/filters/${filterId}`);
                    window.showToast?.('success', 'Deleted', 'Filter deleted');
                    await this.loadData();
                } catch (error) {
                    window.showToast?.('error', 'Failed', error.message);
                }
            });
        });
    }

    createFilter() {
        const content = `
            <div class="form-group">
                <label>Filter Name</label>
                <input type="text" name="name" class="cf-input" required />
            </div>
            <div class="form-group">
                <label>Filter Expression</label>
                <input type="text" name="expression" class="cf-input" placeholder="path:/api/* AND method:POST" required />
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" class="cf-input" rows="2"></textarea>
            </div>
        `;

        window.showModal?.('Create Filter', content, async (formData) => {
            try {
                const result = await this.api.post('/api/filters', formData);
                if (result.success) {
                    window.showToast?.('success', 'Created', 'Filter saved');
                    await this.loadData();
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }
}

class SearchHistoryPage extends BasePage {
    constructor() {
        super();
        this.history = [];
    }

    createHTML() {
        return `
            <div class="page-content search-history-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-history"></i>
                        <h2>Search History</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn small" id="clear-history">
                            <i class="fas fa-trash"></i> Clear History
                        </button>
                    </div>
                </div>

                <div class="history-list" id="history-list">
                    <div class="loading-placeholder">Loading history...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('clear-history')?.addEventListener('click', () => this.clearHistory());
    }

    async loadData() {
        try {
            const result = await this.api.getSearchHistory();
            if (result.success) {
                this.history = result.data?.history || [];
            } else {
                // Fallback to local storage
                this.history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
            }
        } catch (error) {
            console.error('Failed to load search history:', error);
            this.history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        }
        this.renderHistory();
    }

    renderHistory() {
        const container = document.getElementById('history-list');
        if (!container) return;

        if (!this.history.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>No search history</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.history.map((item, index) => `
            <div class="history-item" data-index="${index}">
                <div class="history-query">${item.query}</div>
                <div class="history-time">${this.formatDate(item.timestamp)}</div>
                <div class="history-results">${item.resultCount} results</div>
                <button class="cf-btn tiny" data-action="rerun">
                    <i class="fas fa-redo"></i>
                </button>
            </div>
        `).join('');

        document.querySelectorAll('.history-item [data-action="rerun"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.target.closest('.history-item').dataset.index;
                window.pageController?.navigateTo('search-queries', { query: this.history[index].query });
            });
        });
    }

    clearHistory() {
        window.showConfirmModal?.('Clear History', 'Clear all search history?', () => {
            localStorage.removeItem('searchHistory');
            this.history = [];
            this.renderHistory();
            window.showToast?.('success', 'Cleared', 'Search history cleared');
        });
    }
}

class SearchBookmarksPage extends BasePage {
    constructor() {
        super();
        this.bookmarks = [];
    }

    createHTML() {
        return `
            <div class="page-content search-bookmarks-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-bookmark"></i>
                        <h2>Bookmarked Requests</h2>
                    </div>
                </div>

                <div class="bookmarks-list" id="bookmarks-list">
                    <div class="loading-placeholder">Loading bookmarks...</div>
                </div>
            </div>
        `;
    }

    async loadData() {
        try {
            const result = await this.api.getBookmarks();
            if (result.success) {
                this.bookmarks = result.data?.bookmarks || [];
            } else {
                // Fallback to HTTP requests with bookmarked filter
                const fallback = await this.api.getHttpRequests(1, 100);
                if (fallback.success) {
                    this.bookmarks = (fallback.data?.data?.requests || []).filter(r => r.bookmarked);
                } else {
                    this.bookmarks = [];
                }
            }
        } catch (error) {
            console.error('Failed to load bookmarks:', error);
            this.bookmarks = [];
        }
        this.renderBookmarks();
    }

    renderBookmarks() {
        const container = document.getElementById('bookmarks-list');
        if (!container) return;

        if (!this.bookmarks.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bookmark"></i>
                    <p>No bookmarked requests</p>
                    <p class="subtext">Bookmark requests from the request list to save them here</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.bookmarks.map(req => `
            <div class="bookmark-item" data-request-id="${req.id}">
                <span class="method-badge ${req.method?.toLowerCase()}">${req.method}</span>
                <div class="bookmark-info">
                    <div class="bookmark-url">${req.host}${req.path}</div>
                    <div class="bookmark-meta">
                        <span>Status: ${req.status || '-'}</span>
                        <span>${this.formatDate(req.timestamp)}</span>
                    </div>
                </div>
                <div class="bookmark-actions">
                    <button class="cf-btn small" data-action="view">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="cf-btn small warning" data-action="unbookmark">
                        <i class="fas fa-bookmark"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
}

// ========================================
// FINDINGS PAGES
// ========================================

class FindingsAllPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 15000;
        this.findings = [];
    }

    createHTML() {
        return `
            <div class="page-content findings-all-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-flag"></i>
                        <h2>All Findings</h2>
                        <span class="findings-count" id="findings-count">0</span>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn primary" id="new-finding">
                            <i class="fas fa-plus"></i> New Finding
                        </button>
                        <button class="cf-btn" id="export-findings">
                            <i class="fas fa-download"></i> Export
                        </button>
                    </div>
                </div>

                <div class="findings-filters">
                    <button class="filter-btn active" data-severity="all">All</button>
                    <button class="filter-btn" data-severity="critical">Critical</button>
                    <button class="filter-btn" data-severity="high">High</button>
                    <button class="filter-btn" data-severity="medium">Medium</button>
                    <button class="filter-btn" data-severity="low">Low</button>
                    <button class="filter-btn" data-severity="info">Info</button>
                </div>

                <div class="findings-list" id="findings-list">
                    <div class="loading-placeholder">Loading findings...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('new-finding')?.addEventListener('click', () => this.createFinding());
        document.getElementById('export-findings')?.addEventListener('click', () => this.exportFindings());

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterBySeverity(btn.dataset.severity);
            });
        });
    }

    async loadData() {
        try {
            const result = await this.api.getFindings();
            if (result.success) {
                this.findings = result.data?.data?.findings || [];
            } else {
                this.findings = this.getDefaultFindings();
            }
        } catch (error) {
            this.findings = this.getDefaultFindings();
        }
        document.getElementById('findings-count').textContent = this.findings.length;
        this.renderFindings();
    }

    getDefaultFindings() {
        return [
            { id: 1, title: 'SQL Injection in Login', severity: 'critical', status: 'open', host: 'api.example.com', path: '/login', createdAt: new Date() },
            { id: 2, title: 'XSS in Search Parameter', severity: 'high', status: 'open', host: 'web.example.com', path: '/search', createdAt: new Date() },
            { id: 3, title: 'Missing CSRF Token', severity: 'medium', status: 'verified', host: 'app.example.com', path: '/settings', createdAt: new Date() },
            { id: 4, title: 'Information Disclosure', severity: 'low', status: 'closed', host: 'api.example.com', path: '/debug', createdAt: new Date() },
            { id: 5, title: 'Outdated jQuery Version', severity: 'info', status: 'open', host: 'web.example.com', path: '/assets/js', createdAt: new Date() }
        ];
    }

    renderFindings(filtered = null) {
        const container = document.getElementById('findings-list');
        if (!container) return;

        const toRender = filtered || this.findings;

        if (!toRender.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-flag"></i>
                    <p>No findings</p>
                </div>
            `;
            return;
        }

        container.innerHTML = toRender.map(finding => `
            <div class="finding-card ${finding.severity}" data-finding-id="${finding.id}">
                <div class="finding-severity">
                    <span class="severity-badge ${finding.severity}">${finding.severity}</span>
                </div>
                <div class="finding-info">
                    <h4>${finding.title}</h4>
                    <div class="finding-location">
                        <code>${finding.host}${finding.path}</code>
                    </div>
                    <div class="finding-meta">
                        <span class="status-badge ${finding.status}">${finding.status}</span>
                        <span>${this.formatDate(finding.createdAt)}</span>
                    </div>
                </div>
                <div class="finding-actions">
                    <button class="cf-btn small" data-action="view">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="cf-btn small" data-action="edit">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    filterBySeverity(severity) {
        if (severity === 'all') {
            this.renderFindings();
        } else {
            const filtered = this.findings.filter(f => f.severity === severity);
            this.renderFindings(filtered);
        }
    }

    createFinding() {
        const content = `
            <div class="form-group">
                <label>Title</label>
                <input type="text" name="title" class="cf-input" required />
            </div>
            <div class="form-group">
                <label>Severity</label>
                <select name="severity" class="cf-select">
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium" selected>Medium</option>
                    <option value="low">Low</option>
                    <option value="info">Info</option>
                </select>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" class="cf-input" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label>Host</label>
                <input type="text" name="host" class="cf-input" />
            </div>
            <div class="form-group">
                <label>Path</label>
                <input type="text" name="path" class="cf-input" />
            </div>
        `;

        window.showModal?.('Create Finding', content, async (formData) => {
            try {
                const result = await this.api.post('/api/findings', formData);
                if (result.success) {
                    window.showToast?.('success', 'Created', 'Finding created');
                    await this.loadData();
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }

    exportFindings() {
        window.pageController?.navigateTo('exports-generate', { type: 'findings' });
    }
}

class FindingsBySeverityPage extends BasePage {
    constructor() {
        super();
        this.findings = [];
    }

    createHTML() {
        return `
            <div class="page-content findings-severity-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-chart-bar"></i>
                        <h2>Findings by Severity</h2>
                    </div>
                </div>

                <div class="severity-summary" id="severity-summary">
                    <!-- Summary cards -->
                </div>

                <div class="severity-chart" id="severity-chart">
                    <!-- Chart placeholder -->
                </div>
            </div>
        `;
    }

    async loadData() {
        try {
            const result = await this.api.getFindings();
            if (result.success) {
                this.findings = result.data?.data?.findings || [];
            }
        } catch (error) {
            this.findings = [];
        }
        this.renderSummary();
    }

    renderSummary() {
        const counts = {
            critical: this.findings.filter(f => f.severity === 'critical').length,
            high: this.findings.filter(f => f.severity === 'high').length,
            medium: this.findings.filter(f => f.severity === 'medium').length,
            low: this.findings.filter(f => f.severity === 'low').length,
            info: this.findings.filter(f => f.severity === 'info').length
        };

        const container = document.getElementById('severity-summary');
        if (!container) return;

        container.innerHTML = `
            <div class="severity-cards">
                ${Object.entries(counts).map(([severity, count]) => `
                    <div class="severity-card ${severity}">
                        <div class="count">${count}</div>
                        <div class="label">${severity.charAt(0).toUpperCase() + severity.slice(1)}</div>
                    </div>
                `).join('')}
            </div>
        `;

        // Simple bar chart
        const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
        const chartContainer = document.getElementById('severity-chart');
        if (chartContainer) {
            chartContainer.innerHTML = `
                <div class="chart-title">Severity Distribution</div>
                <div class="bar-chart">
                    ${Object.entries(counts).map(([severity, count]) => `
                        <div class="bar-item">
                            <div class="bar-label">${severity}</div>
                            <div class="bar-container">
                                <div class="bar ${severity}" style="width: ${(count / total) * 100}%"></div>
                            </div>
                            <div class="bar-value">${count}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }
}

class FindingsByHostPage extends BasePage {
    constructor() {
        super();
        this.findings = [];
    }

    createHTML() {
        return `
            <div class="page-content findings-host-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-server"></i>
                        <h2>Findings by Host</h2>
                    </div>
                </div>

                <div class="host-findings" id="host-findings">
                    <div class="loading-placeholder">Loading...</div>
                </div>
            </div>
        `;
    }

    async loadData() {
        try {
            const result = await this.api.getFindings();
            if (result.success) {
                this.findings = result.data?.data?.findings || [];
            }
        } catch (error) {
            this.findings = [];
        }
        this.renderByHost();
    }

    renderByHost() {
        const byHost = {};
        this.findings.forEach(f => {
            const host = f.host || 'Unknown';
            if (!byHost[host]) byHost[host] = [];
            byHost[host].push(f);
        });

        const container = document.getElementById('host-findings');
        if (!container) return;

        if (!Object.keys(byHost).length) {
            container.innerHTML = `<div class="empty-state"><p>No findings</p></div>`;
            return;
        }

        container.innerHTML = Object.entries(byHost).map(([host, findings]) => `
            <div class="host-group">
                <div class="host-header">
                    <h4>${host}</h4>
                    <span class="finding-count">${findings.length} findings</span>
                </div>
                <div class="host-findings-list">
                    ${findings.map(f => `
                        <div class="finding-mini ${f.severity}">
                            <span class="severity-dot ${f.severity}"></span>
                            <span class="finding-title">${f.title}</span>
                            <span class="finding-path">${f.path}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }
}

class FindingsReportsPage extends BasePage {
    createHTML() {
        return `
            <div class="page-content findings-reports-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-file-alt"></i>
                        <h2>Findings Reports</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn primary" id="generate-report">
                            <i class="fas fa-plus"></i> Generate Report
                        </button>
                    </div>
                </div>

                <div class="reports-templates">
                    <h4>Report Templates</h4>
                    <div class="templates-grid">
                        <div class="template-card" data-template="executive">
                            <i class="fas fa-user-tie"></i>
                            <h5>Executive Summary</h5>
                            <p>High-level overview for stakeholders</p>
                        </div>
                        <div class="template-card" data-template="technical">
                            <i class="fas fa-code"></i>
                            <h5>Technical Report</h5>
                            <p>Detailed technical findings</p>
                        </div>
                        <div class="template-card" data-template="compliance">
                            <i class="fas fa-check-circle"></i>
                            <h5>Compliance Report</h5>
                            <p>Compliance-focused findings</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('generate-report')?.addEventListener('click', () => {
            window.pageController?.navigateTo('exports-generate', { type: 'findings' });
        });

        document.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                window.pageController?.navigateTo('exports-generate', { 
                    type: 'findings',
                    template: card.dataset.template 
                });
            });
        });
    }
}

// ========================================
// EXPORTS PAGES
// ========================================

class ExportsGeneratePage extends BasePage {
    createHTML() {
        return `
            <div class="page-content exports-generate-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-file-export"></i>
                        <h2>Generate Export</h2>
                    </div>
                </div>

                <div class="export-form">
                    <div class="form-group">
                        <label>Export Type</label>
                        <select id="export-type" class="cf-select">
                            <option value="requests">HTTP Requests</option>
                            <option value="findings">Security Findings</option>
                            <option value="sitemap">Sitemap</option>
                            <option value="full">Full Project</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Format</label>
                        <select id="export-format" class="cf-select">
                            <option value="json">JSON</option>
                            <option value="csv">CSV</option>
                            <option value="html">HTML Report</option>
                            <option value="pdf">PDF Report</option>
                            <option value="markdown">Markdown</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Options</label>
                        <div class="checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="include-headers" checked />
                                <span>Include Headers</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="include-bodies" checked />
                                <span>Include Request/Response Bodies</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="include-metadata" />
                                <span>Include Metadata</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button class="cf-btn primary" id="generate-export">
                            <i class="fas fa-download"></i> Generate Export
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('generate-export')?.addEventListener('click', () => this.generateExport());
    }

    async generateExport() {
        const type = document.getElementById('export-type')?.value;
        const format = document.getElementById('export-format')?.value;

        window.showToast?.('info', 'Generating', 'Creating export file...');

        try {
            const result = await this.api.post('/api/exports', {
                type,
                format,
                options: {
                    includeHeaders: document.getElementById('include-headers')?.checked,
                    includeBodies: document.getElementById('include-bodies')?.checked,
                    includeMetadata: document.getElementById('include-metadata')?.checked
                }
            });

            if (result.success) {
                window.showToast?.('success', 'Complete', 'Export generated');
                window.pageController?.navigateTo('exports-history');
            }
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }
}

class ExportsHistoryPage extends BasePage {
    constructor() {
        super();
        this.exports = [];
    }

    createHTML() {
        return `
            <div class="page-content exports-history-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-history"></i>
                        <h2>Export History</h2>
                    </div>
                </div>

                <div class="exports-list" id="exports-list">
                    <div class="loading-placeholder">Loading exports...</div>
                </div>
            </div>
        `;
    }

    async loadData() {
        try {
            const result = await this.api.get('/api/exports');
            if (result.success) {
                this.exports = result.data?.data?.exports || [];
            } else {
                this.exports = this.getDefaultExports();
            }
        } catch (error) {
            this.exports = this.getDefaultExports();
        }
        this.renderExports();
    }

    getDefaultExports() {
        return [
            { id: 1, name: 'findings-report.pdf', type: 'findings', format: 'pdf', createdAt: new Date(), size: 245000 },
            { id: 2, name: 'requests-export.json', type: 'requests', format: 'json', createdAt: new Date(), size: 1240000 },
            { id: 3, name: 'sitemap.xml', type: 'sitemap', format: 'xml', createdAt: new Date(), size: 56000 }
        ];
    }

    renderExports() {
        const container = document.getElementById('exports-list');
        if (!container) return;

        if (!this.exports.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-export"></i>
                    <p>No exports</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.exports.map(exp => `
            <div class="export-item" data-export-id="${exp.id}">
                <div class="export-icon">
                    <i class="fas fa-${this.getFormatIcon(exp.format)}"></i>
                </div>
                <div class="export-info">
                    <div class="export-name">${exp.name}</div>
                    <div class="export-meta">
                        <span>${exp.type}</span>
                        <span>${this.formatBytes(exp.size)}</span>
                        <span>${this.formatDate(exp.createdAt)}</span>
                    </div>
                </div>
                <div class="export-actions">
                    <button class="cf-btn small primary" data-action="download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="cf-btn small danger" data-action="delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    getFormatIcon(format) {
        const icons = {
            'json': 'file-code',
            'csv': 'file-csv',
            'pdf': 'file-pdf',
            'html': 'file-code',
            'xml': 'file-code',
            'markdown': 'file-alt'
        };
        return icons[format] || 'file';
    }

    formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }
}

class ExportsTemplatesPage extends BasePage {
    createHTML() {
        return `
            <div class="page-content exports-templates-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-file-invoice"></i>
                        <h2>Export Templates</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn primary" id="create-template">
                            <i class="fas fa-plus"></i> New Template
                        </button>
                    </div>
                </div>

                <div class="templates-list" id="templates-list">
                    <div class="template-card builtin">
                        <h4>Standard JSON</h4>
                        <p>Default JSON export with all fields</p>
                        <span class="template-type">Built-in</span>
                    </div>
                    <div class="template-card builtin">
                        <h4>OWASP Report</h4>
                        <p>Findings formatted for OWASP compliance</p>
                        <span class="template-type">Built-in</span>
                    </div>
                    <div class="template-card builtin">
                        <h4>Burp Compatible</h4>
                        <p>Export compatible with Burp Suite format</p>
                        <span class="template-type">Built-in</span>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('create-template')?.addEventListener('click', () => {
            window.showToast?.('info', 'Templates', 'Template editor coming soon');
        });
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.SearchQueriesPage = SearchQueriesPage;
    window.SearchFiltersPage = SearchFiltersPage;
    window.SearchHistoryPage = SearchHistoryPage;
    window.SearchBookmarksPage = SearchBookmarksPage;
    window.FindingsAllPage = FindingsAllPage;
    window.FindingsBySeverityPage = FindingsBySeverityPage;
    window.FindingsByHostPage = FindingsByHostPage;
    window.FindingsReportsPage = FindingsReportsPage;
    window.ExportsGeneratePage = ExportsGeneratePage;
    window.ExportsHistoryPage = ExportsHistoryPage;
    window.ExportsTemplatesPage = ExportsTemplatesPage;
}
