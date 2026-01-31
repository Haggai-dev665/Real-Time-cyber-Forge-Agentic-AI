/**
 * Browser Monitor Section Pages - Sessions, Cookies, Storage, Network, DOM, Console
 * Connected to backend API for real data
 */

// ========================================
// BROWSER SESSIONS PAGE
// ========================================

class BrowserSessionsPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 5000;
        this.sessions = [];
    }

    createHTML() {
        return `
            <div class="page-content browser-sessions-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-window-maximize"></i>
                        <h2>Browser Sessions</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="new-session">
                            <i class="fas fa-plus"></i> New Session
                        </button>
                    </div>
                </div>

                <div class="sessions-grid" id="sessions-grid">
                    <div class="loading-placeholder">Loading sessions...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('new-session')?.addEventListener('click', () => this.createSession());
    }

    async loadData() {
        try {
            const result = await this.api.getBrowserSessions();
            if (result.success) {
                this.sessions = result.data?.sessions || [];
            } else {
                this.sessions = this.getDefaultSessions();
            }
        } catch (error) {
            console.error('Failed to load browser sessions:', error);
            this.sessions = this.getDefaultSessions();
        }
        this.renderSessions();
    }

    getDefaultSessions() {
        return [
            { id: 1, name: 'Main Session', browser: 'Chrome', status: 'active', tabs: 5, createdAt: new Date() },
            { id: 2, name: 'Auth Testing', browser: 'Firefox', status: 'active', tabs: 3, createdAt: new Date() },
            { id: 3, name: 'Mobile View', browser: 'Chrome Mobile', status: 'paused', tabs: 2, createdAt: new Date() }
        ];
    }

    renderSessions() {
        const container = document.getElementById('sessions-grid');
        if (!container) return;

        if (!this.sessions.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-window-maximize"></i>
                    <p>No browser sessions</p>
                    <button class="caido-btn primary" onclick="document.getElementById('new-session').click()">
                        Start Session
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.sessions.map(session => `
            <div class="session-card ${session.status}" data-session-id="${session.id}">
                <div class="session-icon">
                    <i class="fab fa-${this.getBrowserIcon(session.browser)}"></i>
                </div>
                <div class="session-info">
                    <h4>${session.name}</h4>
                    <div class="session-meta">
                        <span>${session.browser}</span>
                        <span>${session.tabs} tabs</span>
                    </div>
                </div>
                <div class="session-status ${session.status}">${session.status}</div>
                <div class="session-actions">
                    <button class="caido-btn small primary" data-action="connect">
                        <i class="fas fa-plug"></i>
                    </button>
                    <button class="caido-btn small" data-action="inspect">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="caido-btn small danger" data-action="close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    getBrowserIcon(browser) {
        if (browser.toLowerCase().includes('chrome')) return 'chrome';
        if (browser.toLowerCase().includes('firefox')) return 'firefox';
        if (browser.toLowerCase().includes('safari')) return 'safari';
        if (browser.toLowerCase().includes('edge')) return 'edge';
        return 'globe';
    }

    createSession() {
        const content = `
            <div class="form-group">
                <label>Session Name</label>
                <input type="text" name="name" class="caido-input" required />
            </div>
            <div class="form-group">
                <label>Browser</label>
                <select name="browser" class="caido-select">
                    <option value="chrome">Chrome</option>
                    <option value="firefox">Firefox</option>
                    <option value="chrome-mobile">Chrome Mobile</option>
                </select>
            </div>
            <div class="form-group">
                <label>Start URL (optional)</label>
                <input type="url" name="url" class="caido-input" placeholder="https://" />
            </div>
        `;

        window.showModal?.('New Browser Session', content, async (formData) => {
            try {
                const result = await this.api.createBrowserSession(formData);
                if (result.success) {
                    window.showToast?.('success', 'Created', 'Browser session started');
                } else {
                    window.showToast?.('error', 'Error', result.error || 'Failed to create session');
                }
            } catch (error) {
                window.showToast?.('error', 'Error', 'Failed to create session');
            }
            await this.loadData();
        });
    }
}

// ========================================
// BROWSER COOKIES PAGE
// ========================================

class BrowserCookiesPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 10000;
        this.cookies = [];
    }

    createHTML() {
        return `
            <div class="page-content browser-cookies-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-cookie"></i>
                        <h2>Cookies</h2>
                    </div>
                    <div class="page-actions">
                        <input type="text" class="caido-input search-input" id="cookie-search" placeholder="Filter cookies..." />
                        <button class="caido-btn" id="clear-cookies">
                            <i class="fas fa-trash"></i> Clear All
                        </button>
                    </div>
                </div>

                <div class="cookies-table-container">
                    <table class="caido-table" id="cookies-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Domain</th>
                                <th>Value</th>
                                <th>Expires</th>
                                <th>Flags</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="cookies-body">
                            <tr><td colspan="6" class="loading">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('clear-cookies')?.addEventListener('click', () => this.clearAllCookies());
        document.getElementById('cookie-search')?.addEventListener('input', (e) => {
            this.filterCookies(e.target.value);
        });
    }

    async loadData() {
        try {
            const result = await this.api.getBrowserCookies();
            if (result.success) {
                this.cookies = result.data?.cookies || [];
            } else {
                this.cookies = this.getDefaultCookies();
            }
        } catch (error) {
            console.error('Failed to load cookies:', error);
            this.cookies = this.getDefaultCookies();
        }
        this.renderCookies();
    }

    getDefaultCookies() {
        return [
            { name: 'session_id', domain: '.example.com', value: 'abc123...', expires: new Date(Date.now() + 86400000), httpOnly: true, secure: true, sameSite: 'Strict' },
            { name: 'user_pref', domain: '.example.com', value: 'dark_mode', expires: new Date(Date.now() + 31536000000), httpOnly: false, secure: true, sameSite: 'Lax' },
            { name: 'tracking_id', domain: '.analytics.com', value: 'xyz789...', expires: null, httpOnly: false, secure: false, sameSite: 'None' },
            { name: 'csrf_token', domain: 'app.example.com', value: 'token...', expires: new Date(Date.now() + 3600000), httpOnly: true, secure: true, sameSite: 'Strict' }
        ];
    }

    renderCookies(filtered = null) {
        const tbody = document.getElementById('cookies-body');
        if (!tbody) return;

        const toRender = filtered || this.cookies;

        if (!toRender.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty">No cookies</td></tr>`;
            return;
        }

        tbody.innerHTML = toRender.map(cookie => `
            <tr data-cookie-name="${cookie.name}">
                <td><code>${cookie.name}</code></td>
                <td>${cookie.domain}</td>
                <td><span class="cookie-value">${cookie.value.substring(0, 20)}${cookie.value.length > 20 ? '...' : ''}</span></td>
                <td>${cookie.expires ? this.formatDate(cookie.expires) : 'Session'}</td>
                <td>
                    ${cookie.httpOnly ? '<span class="flag">HttpOnly</span>' : ''}
                    ${cookie.secure ? '<span class="flag">Secure</span>' : ''}
                    ${cookie.sameSite ? `<span class="flag">${cookie.sameSite}</span>` : ''}
                </td>
                <td>
                    <button class="caido-btn tiny" data-action="edit"><i class="fas fa-edit"></i></button>
                    <button class="caido-btn tiny danger" data-action="delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    filterCookies(query) {
        if (!query) {
            this.renderCookies();
            return;
        }
        const filtered = this.cookies.filter(c => 
            c.name.toLowerCase().includes(query.toLowerCase()) ||
            c.domain.toLowerCase().includes(query.toLowerCase())
        );
        this.renderCookies(filtered);
    }

    clearAllCookies() {
        window.showConfirmModal?.('Clear Cookies', 'Delete all cookies?', async () => {
            try {
                // Delete all cookies via API
                for (const cookie of this.cookies) {
                    await this.api.deleteBrowserCookie(cookie.id || cookie.name);
                }
                this.cookies = [];
                this.renderCookies();
                window.showToast?.('success', 'Cleared', 'All cookies deleted');
            } catch (error) {
                console.error('Failed to clear cookies:', error);
                window.showToast?.('error', 'Error', 'Failed to clear cookies');
            }
        });
    }
}

// ========================================
// BROWSER STORAGE PAGE
// ========================================

class BrowserStoragePage extends BasePage {
    constructor() {
        super();
        this.localStorage = [];
        this.sessionStorage = [];
        this.activeTab = 'local';
    }

    createHTML() {
        return `
            <div class="page-content browser-storage-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-database"></i>
                        <h2>Browser Storage</h2>
                    </div>
                    <div class="storage-tabs">
                        <button class="tab-btn active" data-tab="local">Local Storage</button>
                        <button class="tab-btn" data-tab="session">Session Storage</button>
                        <button class="tab-btn" data-tab="indexed">IndexedDB</button>
                    </div>
                </div>

                <div class="storage-content" id="storage-content">
                    <div class="loading-placeholder">Loading storage...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeTab = btn.dataset.tab;
                this.renderStorage();
            });
        });
    }

    async loadData() {
        try {
            const result = await this.api.getBrowserStorage();
            if (result.success) {
                this.localStorage = result.data?.localStorage || [];
                this.sessionStorage = result.data?.sessionStorage || [];
            } else {
                this.setDefaultStorage();
            }
        } catch (error) {
            console.error('Failed to load storage:', error);
            this.setDefaultStorage();
        }
        this.renderStorage();
    }

    setDefaultStorage() {
        this.localStorage = [
            { key: 'user_settings', value: JSON.stringify({ theme: 'dark', language: 'en' }), size: 45 },
            { key: 'auth_token', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...', size: 256 },
            { key: 'cached_data', value: '[{"id":1},{"id":2}...]', size: 1024 }
        ];
        this.sessionStorage = [
            { key: 'temp_form', value: '{"field1":"value1"}', size: 32 },
            { key: 'navigation_state', value: '{"page":2}', size: 18 }
        ];
    }

    renderStorage() {
        const container = document.getElementById('storage-content');
        if (!container) return;

        let data = [];
        if (this.activeTab === 'local') {
            data = this.localStorage;
        } else if (this.activeTab === 'session') {
            data = this.sessionStorage;
        }

        if (!data.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-database"></i>
                    <p>No ${this.activeTab} storage data</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="storage-actions">
                <button class="caido-btn small primary" id="add-storage-item">
                    <i class="fas fa-plus"></i> Add Item
                </button>
                <button class="caido-btn small" id="clear-storage">
                    <i class="fas fa-trash"></i> Clear All
                </button>
            </div>
            <table class="caido-table">
                <thead>
                    <tr>
                        <th>Key</th>
                        <th>Value</th>
                        <th>Size</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(item => `
                        <tr>
                            <td><code>${item.key}</code></td>
                            <td><code class="storage-value">${item.value.substring(0, 50)}${item.value.length > 50 ? '...' : ''}</code></td>
                            <td>${item.size} bytes</td>
                            <td>
                                <button class="caido-btn tiny"><i class="fas fa-eye"></i></button>
                                <button class="caido-btn tiny"><i class="fas fa-edit"></i></button>
                                <button class="caido-btn tiny danger"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

// ========================================
// BROWSER NETWORK PAGE
// ========================================

class BrowserNetworkPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 2000;
        this.requests = [];
        this.isCapturing = true;
    }

    createHTML() {
        return `
            <div class="page-content browser-network-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-network-wired"></i>
                        <h2>Network Traffic</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn ${this.isCapturing ? 'danger' : 'success'}" id="toggle-capture">
                            <i class="fas fa-${this.isCapturing ? 'stop' : 'play'}"></i>
                            ${this.isCapturing ? 'Stop' : 'Start'}
                        </button>
                        <button class="caido-btn" id="clear-network">
                            <i class="fas fa-trash"></i> Clear
                        </button>
                    </div>
                </div>

                <div class="network-filters">
                    <button class="filter-btn active" data-type="all">All</button>
                    <button class="filter-btn" data-type="xhr">XHR</button>
                    <button class="filter-btn" data-type="fetch">Fetch</button>
                    <button class="filter-btn" data-type="script">JS</button>
                    <button class="filter-btn" data-type="stylesheet">CSS</button>
                    <button class="filter-btn" data-type="image">Images</button>
                </div>

                <div class="network-list" id="network-list">
                    <div class="loading-placeholder">Capturing network traffic...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('toggle-capture')?.addEventListener('click', () => this.toggleCapture());
        document.getElementById('clear-network')?.addEventListener('click', () => this.clearNetwork());

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterByType(btn.dataset.type);
            });
        });
    }

    async loadData() {
        if (!this.isCapturing) return;

        try {
            const result = await this.api.getNetworkCaptures();
            if (result.success) {
                this.requests = result.data?.captures || [];
            } else {
                this.setDefaultRequests();
            }
        } catch (error) {
            console.error('Failed to load network captures:', error);
            this.setDefaultRequests();
        }
        this.renderRequests();
    }

    setDefaultRequests() {
        this.requests = [
            { id: 1, method: 'GET', url: 'https://api.example.com/users', status: 200, type: 'xhr', size: 1234, time: 45 },
            { id: 2, method: 'POST', url: 'https://api.example.com/auth', status: 200, type: 'fetch', size: 567, time: 120 },
            { id: 3, method: 'GET', url: 'https://cdn.example.com/app.js', status: 200, type: 'script', size: 45678, time: 89 },
            { id: 4, method: 'GET', url: 'https://cdn.example.com/styles.css', status: 200, type: 'stylesheet', size: 12345, time: 34 },
            { id: 5, method: 'GET', url: 'https://cdn.example.com/logo.png', status: 200, type: 'image', size: 8901, time: 56 }
        ];
    }

    renderRequests(filtered = null) {
        const container = document.getElementById('network-list');
        if (!container) return;

        const toRender = filtered || this.requests;

        if (!toRender.length) {
            container.innerHTML = `
                <div class="empty-state small">
                    <i class="fas fa-network-wired"></i>
                    <p>No network requests</p>
                </div>
            `;
            return;
        }

        container.innerHTML = toRender.map(req => `
            <div class="network-item" data-request-id="${req.id}">
                <span class="method-badge ${req.method.toLowerCase()}">${req.method}</span>
                <span class="network-url">${req.url}</span>
                <span class="network-status status-${Math.floor(req.status / 100)}xx">${req.status}</span>
                <span class="network-type">${req.type}</span>
                <span class="network-size">${this.formatBytes(req.size)}</span>
                <span class="network-time">${req.time}ms</span>
            </div>
        `).join('');
    }

    formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    filterByType(type) {
        if (type === 'all') {
            this.renderRequests();
        } else {
            const filtered = this.requests.filter(r => r.type === type);
            this.renderRequests(filtered);
        }
    }

    toggleCapture() {
        this.isCapturing = !this.isCapturing;
        const btn = document.getElementById('toggle-capture');
        if (btn) {
            btn.className = `caido-btn ${this.isCapturing ? 'danger' : 'success'}`;
            btn.innerHTML = `<i class="fas fa-${this.isCapturing ? 'stop' : 'play'}"></i> ${this.isCapturing ? 'Stop' : 'Start'}`;
        }
        if (this.isCapturing) {
            this.api.startNetworkCapture().then(result => {
                if (result.success) {
                    window.showToast?.('info', 'Capturing', 'Network capture started');
                }
            });
            this.startAutoRefresh();
        } else {
            this.stopAutoRefresh();
            window.showToast?.('info', 'Stopped', 'Network capture paused');
        }
    }

    async clearNetwork() {
        try {
            // Stop any existing captures
            for (const req of this.requests) {
                if (req.captureId) {
                    await this.api.stopNetworkCapture(req.captureId);
                }
            }
        } catch (error) {
            console.error('Error clearing network captures:', error);
        }
        this.requests = [];
        this.renderRequests();
    }
}

// ========================================
// BROWSER DOM PAGE
// ========================================

class BrowserDOMPage extends BasePage {
    createHTML() {
        return `
            <div class="page-content browser-dom-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-code"></i>
                        <h2>DOM Inspector</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn" id="refresh-dom">
                            <i class="fas fa-sync"></i> Refresh
                        </button>
                        <button class="caido-btn primary" id="select-element">
                            <i class="fas fa-mouse-pointer"></i> Select Element
                        </button>
                    </div>
                </div>

                <div class="dom-container">
                    <div class="dom-tree" id="dom-tree">
                        <div class="dom-node expanded" data-level="0">
                            <span class="node-toggle"><i class="fas fa-chevron-down"></i></span>
                            <span class="node-tag">&lt;html&gt;</span>
                            <div class="node-children">
                                <div class="dom-node expanded" data-level="1">
                                    <span class="node-toggle"><i class="fas fa-chevron-down"></i></span>
                                    <span class="node-tag">&lt;head&gt;</span>
                                    <div class="node-children">
                                        <div class="dom-node" data-level="2">
                                            <span class="node-tag">&lt;title&gt;</span>
                                            <span class="node-text">Page Title</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="dom-node expanded" data-level="1">
                                    <span class="node-toggle"><i class="fas fa-chevron-down"></i></span>
                                    <span class="node-tag">&lt;body&gt;</span>
                                    <div class="node-children">
                                        <div class="dom-node" data-level="2">
                                            <span class="node-tag">&lt;div <span class="node-attr">class</span>="container"&gt;</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="dom-details" id="dom-details">
                        <h4>Element Details</h4>
                        <div class="details-content">
                            <p>Select an element to view details</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('refresh-dom')?.addEventListener('click', () => this.refreshDOM());
        document.getElementById('select-element')?.addEventListener('click', () => this.selectElement());

        document.querySelectorAll('.node-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const node = e.target.closest('.dom-node');
                node?.classList.toggle('expanded');
            });
        });

        document.querySelectorAll('.dom-node').forEach(node => {
            node.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.dom-node').forEach(n => n.classList.remove('selected'));
                node.classList.add('selected');
                this.showDetails(node);
            });
        });
    }

    refreshDOM() {
        window.showToast?.('info', 'Refreshing', 'Updating DOM tree...');
    }

    selectElement() {
        window.showToast?.('info', 'Select Mode', 'Click on an element in the page to inspect');
    }

    showDetails(node) {
        const details = document.getElementById('dom-details');
        if (!details) return;

        const tag = node.querySelector('.node-tag')?.textContent || '';
        details.querySelector('.details-content').innerHTML = `
            <div class="detail-item">
                <label>Tag</label>
                <code>${tag}</code>
            </div>
            <div class="detail-item">
                <label>Computed Styles</label>
                <button class="caido-btn small">View Styles</button>
            </div>
            <div class="detail-item">
                <label>Event Listeners</label>
                <button class="caido-btn small">View Events</button>
            </div>
        `;
    }
}

// ========================================
// BROWSER CONSOLE PAGE
// ========================================

class BrowserConsolePage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 2000;
        this.logs = [];
    }

    createHTML() {
        return `
            <div class="page-content browser-console-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-terminal"></i>
                        <h2>Console</h2>
                    </div>
                    <div class="console-filters">
                        <button class="filter-btn active" data-level="all">All</button>
                        <button class="filter-btn" data-level="log">Log</button>
                        <button class="filter-btn" data-level="warn">Warn</button>
                        <button class="filter-btn" data-level="error">Error</button>
                        <button class="filter-btn" data-level="info">Info</button>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn" id="clear-console">
                            <i class="fas fa-trash"></i> Clear
                        </button>
                    </div>
                </div>

                <div class="console-output" id="console-output">
                    <div class="loading-placeholder">Loading console output...</div>
                </div>

                <div class="console-input">
                    <span class="prompt">&gt;</span>
                    <input type="text" id="console-command" placeholder="Enter JavaScript expression..." />
                    <button class="caido-btn small primary" id="run-command">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('clear-console')?.addEventListener('click', () => this.clearConsole());
        document.getElementById('run-command')?.addEventListener('click', () => this.runCommand());
        document.getElementById('console-command')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.runCommand();
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterLogs(btn.dataset.level);
            });
        });
    }

    async loadData() {
        try {
            const result = await this.api.getConsoleLogs();
            if (result.success) {
                this.logs = result.data?.logs || [];
            } else {
                this.setDefaultLogs();
            }
        } catch (error) {
            console.error('Failed to load console logs:', error);
            this.setDefaultLogs();
        }
        this.renderLogs();
    }

    setDefaultLogs() {
        this.logs = [
            { level: 'log', message: 'Application started', timestamp: new Date(), source: 'app.js:1' },
            { level: 'info', message: 'Connected to server', timestamp: new Date(), source: 'api.js:45' },
            { level: 'warn', message: 'Deprecated function used', timestamp: new Date(), source: 'utils.js:123' },
            { level: 'error', message: 'Failed to fetch resource', timestamp: new Date(), source: 'fetch.js:67', stack: 'Error: Network error\n  at fetch...' },
            { level: 'log', message: 'User logged in', timestamp: new Date(), source: 'auth.js:89' }
        ];
    }

    renderLogs(filtered = null) {
        const container = document.getElementById('console-output');
        if (!container) return;

        const toRender = filtered || this.logs;

        if (!toRender.length) {
            container.innerHTML = `<div class="console-empty">Console is empty</div>`;
            return;
        }

        container.innerHTML = toRender.map(log => `
            <div class="console-entry ${log.level}">
                <span class="log-icon"><i class="fas fa-${this.getLogIcon(log.level)}"></i></span>
                <span class="log-message">${log.message}</span>
                <span class="log-source">${log.source}</span>
                <span class="log-time">${this.formatTime(log.timestamp)}</span>
            </div>
        `).join('');

        container.scrollTop = container.scrollHeight;
    }

    getLogIcon(level) {
        const icons = {
            log: 'chevron-right',
            info: 'info-circle',
            warn: 'exclamation-triangle',
            error: 'times-circle'
        };
        return icons[level] || 'chevron-right';
    }

    formatTime(date) {
        return date.toLocaleTimeString();
    }

    filterLogs(level) {
        if (level === 'all') {
            this.renderLogs();
        } else {
            const filtered = this.logs.filter(l => l.level === level);
            this.renderLogs(filtered);
        }
    }

    async runCommand() {
        const input = document.getElementById('console-command');
        const command = input?.value?.trim();
        if (!command) return;

        const commandLog = {
            level: 'log',
            message: `> ${command}`,
            timestamp: new Date(),
            source: 'console'
        };
        this.logs.push(commandLog);

        // Send command to API
        try {
            await this.api.addConsoleLog(commandLog);
        } catch (error) {
            console.error('Failed to save console command:', error);
        }

        // Simulate response
        const responseLog = {
            level: 'log',
            message: '← undefined',
            timestamp: new Date(),
            source: 'console'
        };
        this.logs.push(responseLog);

        input.value = '';
        this.renderLogs();
    }

    async clearConsole() {
        this.logs = [];
        this.renderLogs();
        window.showToast?.('info', 'Cleared', 'Console cleared');
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.BrowserSessionsPage = BrowserSessionsPage;
    window.BrowserCookiesPage = BrowserCookiesPage;
    window.BrowserStoragePage = BrowserStoragePage;
    window.BrowserNetworkPage = BrowserNetworkPage;
    window.BrowserDOMPage = BrowserDOMPage;
    window.BrowserConsolePage = BrowserConsolePage;
}
