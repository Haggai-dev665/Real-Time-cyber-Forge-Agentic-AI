/**
 * Proxy Section Pages - Intercept, HTTP History, WS History, Match & Replace
 * Connected to backend API for real data
 */

// ========================================
// INTERCEPT PAGES
// ========================================

class InterceptRulesPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 0;
        this.rules = [];
    }

    createHTML() {
        return `
            <div class="page-content intercept-rules-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-filter"></i>
                        <h2>Intercept Rules</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn primary" id="add-intercept-rule">
                            <i class="fas fa-plus"></i> Add Rule
                        </button>
                    </div>
                </div>

                <div class="intercept-settings">
                    <div class="setting-row">
                        <label class="toggle-label">
                            <span>Enable Interception</span>
                            <label class="toggle-switch">
                                <input type="checkbox" id="intercept-enabled" />
                                <span class="toggle-slider"></span>
                            </label>
                        </label>
                    </div>
                    <div class="setting-row">
                        <label class="toggle-label">
                            <span>Intercept Requests</span>
                            <label class="toggle-switch">
                                <input type="checkbox" id="intercept-requests" checked />
                                <span class="toggle-slider"></span>
                            </label>
                        </label>
                    </div>
                    <div class="setting-row">
                        <label class="toggle-label">
                            <span>Intercept Responses</span>
                            <label class="toggle-switch">
                                <input type="checkbox" id="intercept-responses" />
                                <span class="toggle-slider"></span>
                            </label>
                        </label>
                    </div>
                </div>

                <div class="rules-list" id="intercept-rules-list">
                    <div class="loading-placeholder">Loading rules...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('add-intercept-rule')?.addEventListener('click', () => this.addRule());
        document.getElementById('intercept-enabled')?.addEventListener('change', (e) => this.saveSettings());
        document.getElementById('intercept-requests')?.addEventListener('change', (e) => this.saveSettings());
        document.getElementById('intercept-responses')?.addEventListener('change', (e) => this.saveSettings());
    }

    async loadData() {
        try {
            const [rulesRes, settingsRes] = await Promise.all([
                this.api.getFilters(),
                this.api.get('/api/intercepts/settings')
            ]);

            if (rulesRes.success) {
                this.rules = rulesRes.data?.data?.filters || [];
                this.renderRules();
            }

            if (settingsRes.success) {
                const settings = settingsRes.data?.data || {};
                document.getElementById('intercept-enabled').checked = settings.enabled;
                document.getElementById('intercept-requests').checked = settings.interceptRequests;
                document.getElementById('intercept-responses').checked = settings.interceptResponses;
            }
        } catch (error) {
            console.error('Failed to load intercept rules:', error);
        }
    }

    renderRules() {
        const container = document.getElementById('intercept-rules-list');
        if (!container) return;

        if (!this.rules.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-filter"></i>
                    <p>No intercept rules defined</p>
                    <button class="cf-btn primary" onclick="document.getElementById('add-intercept-rule').click()">
                        Add First Rule
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.rules.map((rule, index) => `
            <div class="rule-item ${rule.enabled ? 'enabled' : 'disabled'}" data-rule-id="${rule.id}" draggable="true">
                <div class="rule-handle">
                    <i class="fas fa-grip-vertical"></i>
                    <span class="rule-order">${index + 1}</span>
                </div>
                <div class="rule-toggle">
                    <label class="toggle-switch">
                        <input type="checkbox" ${rule.enabled ? 'checked' : ''} />
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="rule-content">
                    <div class="rule-name">${rule.name}</div>
                    <div class="rule-conditions">
                        ${(rule.conditions || []).slice(0, 3).map(c => 
                            `<span class="condition-tag">${c.field} ${c.operator} "${c.value.substring(0, 20)}${c.value.length > 20 ? '...' : ''}"</span>`
                        ).join('')}
                        ${rule.conditions?.length > 3 ? `<span class="condition-more">+${rule.conditions.length - 3} more</span>` : ''}
                    </div>
                </div>
                <div class="rule-actions">
                    <button class="cf-btn tiny" data-action="edit"><i class="fas fa-edit"></i></button>
                    <button class="cf-btn tiny danger" data-action="delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');

        this.bindRuleActions();
    }

    bindRuleActions() {
        document.querySelectorAll('#intercept-rules-list .rule-item').forEach(item => {
            const ruleId = item.dataset.ruleId;

            item.querySelector('input[type="checkbox"]')?.addEventListener('change', async (e) => {
                await this.toggleRule(ruleId, e.target.checked);
            });

            item.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
                this.editRule(ruleId);
            });

            item.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
                this.deleteRule(ruleId);
            });
        });
    }

    async saveSettings() {
        const settings = {
            enabled: document.getElementById('intercept-enabled')?.checked,
            interceptRequests: document.getElementById('intercept-requests')?.checked,
            interceptResponses: document.getElementById('intercept-responses')?.checked
        };

        try {
            await this.api.put('/api/intercepts/settings', settings);
            window.showToast?.('success', 'Settings Saved', 'Intercept settings updated');
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }

    addRule() {
        const content = `
            <div class="form-group">
                <label>Rule Name</label>
                <input type="text" name="name" class="cf-input" placeholder="My Rule" required />
            </div>
            <div class="form-group">
                <label>Match Type</label>
                <select name="matchType" class="cf-select">
                    <option value="host">Host</option>
                    <option value="path">Path</option>
                    <option value="method">Method</option>
                    <option value="header">Header</option>
                </select>
            </div>
            <div class="form-group">
                <label>Pattern</label>
                <input type="text" name="pattern" class="cf-input" placeholder="*.example.com" required />
            </div>
        `;

        window.showModal?.('Add Intercept Rule', content, async (formData) => {
            try {
                const result = await this.api.post('/api/filters', {
                    name: formData.name,
                    conditions: [{ field: formData.matchType, operator: 'matches', value: formData.pattern }]
                });
                if (result.success) {
                    window.showToast?.('success', 'Rule Added', 'Intercept rule created');
                    await this.loadData();
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }

    async toggleRule(ruleId, enabled) {
        try {
            await this.api.put(`/api/filters/${ruleId}/toggle`, { enabled });
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
            await this.loadData();
        }
    }

    editRule(ruleId) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (!rule) return;

        const content = `
            <div class="form-group">
                <label>Rule Name</label>
                <input type="text" name="name" class="cf-input" value="${rule.name}" required />
            </div>
            <div class="form-group">
                <label>Description</label>
                <input type="text" name="description" class="cf-input" value="${rule.description || ''}" />
            </div>
        `;

        window.showModal?.('Edit Rule', content, async (formData) => {
            try {
                await this.api.put(`/api/filters/${ruleId}`, formData);
                window.showToast?.('success', 'Updated', 'Rule updated');
                await this.loadData();
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }

    async deleteRule(ruleId) {
        window.showConfirmModal?.('Delete Rule', 'Are you sure you want to delete this rule?', async () => {
            try {
                await this.api.delete(`/api/filters/${ruleId}`);
                window.showToast?.('success', 'Deleted', 'Rule removed');
                await this.loadData();
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }
}

class InterceptQueuePage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 2000;
        this.intercepts = [];
        this.selectedIntercept = null;
    }

    createHTML() {
        return `
            <div class="page-content intercept-queue-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-pause-circle"></i>
                        <h2>Intercept Queue</h2>
                        <span class="queue-count" id="queue-count">0</span>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn success" id="forward-all">
                            <i class="fas fa-forward"></i> Forward All
                        </button>
                        <button class="cf-btn danger" id="drop-all">
                            <i class="fas fa-trash"></i> Drop All
                        </button>
                    </div>
                </div>

                <div class="intercept-split-view">
                    <div class="intercept-list-panel">
                        <div class="intercept-list" id="intercept-list">
                            <div class="loading-placeholder">Loading...</div>
                        </div>
                    </div>
                    <div class="intercept-detail-panel">
                        <div class="intercept-detail" id="intercept-detail">
                            <div class="empty-state">
                                <i class="fas fa-hand-paper"></i>
                                <p>Select an intercepted request</p>
                            </div>
                        </div>
                        <div class="intercept-actions" id="intercept-actions" style="display: none;">
                            <button class="cf-btn success" id="forward-selected">
                                <i class="fas fa-paper-plane"></i> Forward
                            </button>
                            <button class="cf-btn primary" id="edit-forward">
                                <i class="fas fa-edit"></i> Edit & Forward
                            </button>
                            <button class="cf-btn danger" id="drop-selected">
                                <i class="fas fa-times"></i> Drop
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('forward-all')?.addEventListener('click', () => this.forwardAll());
        document.getElementById('drop-all')?.addEventListener('click', () => this.dropAll());
        document.getElementById('forward-selected')?.addEventListener('click', () => this.forwardSelected());
        document.getElementById('edit-forward')?.addEventListener('click', () => this.editAndForward());
        document.getElementById('drop-selected')?.addEventListener('click', () => this.dropSelected());
    }

    async loadData() {
        try {
            const result = await this.api.getIntercepts();
            if (result.success) {
                this.intercepts = result.data?.data?.intercepts || [];
                document.getElementById('queue-count').textContent = this.intercepts.length;
                this.renderInterceptList();
            }
        } catch (error) {
            console.error('Failed to load intercepts:', error);
        }
    }

    renderInterceptList() {
        const container = document.getElementById('intercept-list');
        if (!container) return;

        if (!this.intercepts.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <p>No pending intercepts</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.intercepts.map(intercept => `
            <div class="intercept-item ${this.selectedIntercept?.id === intercept.id ? 'selected' : ''}" 
                 data-intercept-id="${intercept.id}">
                <div class="intercept-method ${intercept.method?.toLowerCase()}">${intercept.method}</div>
                <div class="intercept-info">
                    <div class="intercept-host">${intercept.host}</div>
                    <div class="intercept-path">${intercept.path}</div>
                </div>
                <div class="intercept-time">${this.formatTime(intercept.timestamp)}</div>
            </div>
        `).join('');

        container.querySelectorAll('.intercept-item').forEach(item => {
            item.addEventListener('click', () => this.selectIntercept(item.dataset.interceptId));
        });
    }

    selectIntercept(id) {
        this.selectedIntercept = this.intercepts.find(i => i.id === id);
        
        document.querySelectorAll('.intercept-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.interceptId === id);
        });

        const detailPanel = document.getElementById('intercept-detail');
        const actionsPanel = document.getElementById('intercept-actions');

        if (this.selectedIntercept) {
            actionsPanel.style.display = 'flex';
            detailPanel.innerHTML = this.renderInterceptDetail(this.selectedIntercept);
        } else {
            actionsPanel.style.display = 'none';
            detailPanel.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-hand-paper"></i>
                    <p>Select an intercepted request</p>
                </div>
            `;
        }
    }

    renderInterceptDetail(intercept) {
        return `
            <div class="request-detail-view">
                <div class="request-line">
                    <span class="method ${intercept.method?.toLowerCase()}">${intercept.method}</span>
                    <span class="url">${intercept.scheme}://${intercept.host}${intercept.path}${intercept.query ? '?' + intercept.query : ''}</span>
                </div>
                <div class="request-headers">
                    <h4>Headers</h4>
                    <pre>${JSON.stringify(intercept.headers || [], null, 2)}</pre>
                </div>
                ${intercept.body ? `
                    <div class="request-body">
                        <h4>Body</h4>
                        <pre>${typeof intercept.body === 'string' ? intercept.body : JSON.stringify(intercept.body, null, 2)}</pre>
                    </div>
                ` : ''}
            </div>
        `;
    }

    formatTime(timestamp) {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    }

    async forwardSelected() {
        if (!this.selectedIntercept) return;
        try {
            await this.api.post(`/api/intercepts/${this.selectedIntercept.id}/forward`);
            window.showToast?.('success', 'Forwarded', 'Request sent');
            this.selectedIntercept = null;
            await this.loadData();
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }

    editAndForward() {
        if (!this.selectedIntercept) return;
        // Open editor modal
        const intercept = this.selectedIntercept;
        const content = `
            <div class="form-group">
                <label>URL</label>
                <input type="text" name="url" class="cf-input" value="${intercept.scheme}://${intercept.host}${intercept.path}" />
            </div>
            <div class="form-group">
                <label>Headers (JSON)</label>
                <textarea name="headers" class="cf-input" rows="5">${JSON.stringify(intercept.headers || [], null, 2)}</textarea>
            </div>
            <div class="form-group">
                <label>Body</label>
                <textarea name="body" class="cf-input" rows="5">${intercept.body || ''}</textarea>
            </div>
        `;

        window.showModal?.('Edit Request', content, async (formData) => {
            try {
                await this.api.post(`/api/intercepts/${intercept.id}/forward`, {
                    modifications: {
                        headers: JSON.parse(formData.headers),
                        body: formData.body
                    }
                });
                window.showToast?.('success', 'Modified & Forwarded', 'Request sent with changes');
                await this.loadData();
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }

    async dropSelected() {
        if (!this.selectedIntercept) return;
        try {
            await this.api.delete(`/api/intercepts/${this.selectedIntercept.id}`);
            window.showToast?.('info', 'Dropped', 'Request discarded');
            this.selectedIntercept = null;
            await this.loadData();
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }

    async forwardAll() {
        try {
            await this.api.post('/api/intercepts/forward-all');
            window.showToast?.('success', 'All Forwarded', `Sent ${this.intercepts.length} requests`);
            await this.loadData();
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }

    async dropAll() {
        window.showConfirmModal?.('Drop All', `Drop all ${this.intercepts.length} pending requests?`, async () => {
            try {
                await this.api.delete('/api/intercepts/all');
                window.showToast?.('info', 'All Dropped', 'All requests discarded');
                await this.loadData();
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }
}

class InterceptHistoryPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 10000;
        this.history = [];
    }

    createHTML() {
        return `
            <div class="page-content intercept-history-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-history"></i>
                        <h2>Intercept History</h2>
                    </div>
                    <div class="page-actions">
                        <input type="text" id="history-search" class="cf-input" placeholder="Search history..." />
                        <select id="history-action-filter" class="cf-select">
                            <option value="all">All Actions</option>
                            <option value="forwarded">Forwarded</option>
                            <option value="dropped">Dropped</option>
                            <option value="modified">Modified</option>
                        </select>
                        <button class="cf-btn small" id="clear-history">
                            <i class="fas fa-trash"></i> Clear
                        </button>
                    </div>
                </div>

                <table class="cf-table" id="history-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Method</th>
                            <th>Host</th>
                            <th>Path</th>
                            <th>Action</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="history-body">
                        <tr><td colspan="6" class="loading">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('history-search')?.addEventListener('input', (e) => this.filterHistory(e.target.value));
        document.getElementById('history-action-filter')?.addEventListener('change', (e) => this.filterByAction(e.target.value));
        document.getElementById('clear-history')?.addEventListener('click', () => this.clearHistory());
    }

    async loadData() {
        try {
            // Get forwarded requests (these came through intercept)
            const result = await this.api.getHttpRequests(1, 100);
            if (result.success) {
                const requests = result.data?.data?.requests || [];
                this.history = requests.filter(r => r.isReplay || r.action);
                this.renderHistory(this.history);
            }
        } catch (error) {
            console.error('Failed to load intercept history:', error);
        }
    }

    renderHistory(history) {
        const tbody = document.getElementById('history-body');
        if (!tbody) return;

        if (!history.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty">No intercept history</td></tr>`;
            return;
        }

        tbody.innerHTML = history.map(item => `
            <tr>
                <td>${this.formatDate(item.timestamp)}</td>
                <td><span class="method-badge ${item.method?.toLowerCase()}">${item.method}</span></td>
                <td>${item.host}</td>
                <td><code>${item.path}</code></td>
                <td>
                    <span class="action-badge ${item.action || 'forwarded'}">
                        ${item.action || 'forwarded'}
                    </span>
                </td>
                <td>
                    <span class="status-badge status-${Math.floor((item.status || 0) / 100)}xx">
                        ${item.status || '-'}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    filterHistory(query) {
        const filtered = this.history.filter(h => 
            h.host?.includes(query) || h.path?.includes(query)
        );
        this.renderHistory(filtered);
    }

    filterByAction(action) {
        if (action === 'all') {
            this.renderHistory(this.history);
        } else {
            this.renderHistory(this.history.filter(h => h.action === action));
        }
    }

    clearHistory() {
        window.showConfirmModal?.('Clear History', 'Clear all intercept history?', async () => {
            this.history = [];
            this.renderHistory([]);
            window.showToast?.('info', 'Cleared', 'History cleared');
        });
    }
}

// ========================================
// HTTP HISTORY PAGES
// ========================================

class HttpRequestsPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 5000;
        this.requests = [];
        this.currentPage = 1;
        this.pageSize = 50;
    }

    createHTML() {
        return `
            <div class="page-content http-requests-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-arrow-right"></i>
                        <h2>HTTP Requests</h2>
                    </div>
                    <div class="page-actions">
                        <input type="text" id="request-search" class="cf-input" placeholder="Search requests..." />
                        <select id="method-filter" class="cf-select">
                            <option value="">All Methods</option>
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PATCH">PATCH</option>
                        </select>
                        <button class="cf-btn small" id="refresh-requests">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button class="cf-btn small" id="export-requests">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                </div>

                <div class="requests-split-view">
                    <div class="requests-table-panel">
                        <table class="cf-table" id="requests-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Method</th>
                                    <th>Host</th>
                                    <th>Path</th>
                                    <th>Status</th>
                                    <th>Size</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody id="requests-body">
                                <tr><td colspan="7" class="loading">Loading...</td></tr>
                            </tbody>
                        </table>
                        <div class="table-pagination" id="requests-pagination"></div>
                    </div>
                    <div class="request-detail-panel" id="request-detail-panel">
                        <div class="empty-state">
                            <i class="fas fa-mouse-pointer"></i>
                            <p>Click a request to view details</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('refresh-requests')?.addEventListener('click', () => this.refresh());
        document.getElementById('export-requests')?.addEventListener('click', () => this.exportRequests());
        document.getElementById('request-search')?.addEventListener('input', (e) => this.searchRequests(e.target.value));
        document.getElementById('method-filter')?.addEventListener('change', (e) => this.filterByMethod(e.target.value));
    }

    async loadData() {
        try {
            const methodFilter = document.getElementById('method-filter')?.value;
            const result = await this.api.getHttpRequests(this.currentPage, this.pageSize);
            
            if (result.success) {
                this.requests = result.data?.data?.requests || [];
                if (methodFilter) {
                    this.requests = this.requests.filter(r => r.method === methodFilter);
                }
                this.renderRequests(this.requests);
                this.renderPagination(result.data?.data?.pagination);
            }
        } catch (error) {
            console.error('Failed to load requests:', error);
        }
    }

    renderRequests(requests) {
        const tbody = document.getElementById('requests-body');
        if (!tbody) return;

        if (!requests.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty">No requests captured</td></tr>`;
            return;
        }

        tbody.innerHTML = requests.map((req, i) => `
            <tr class="request-row" data-request-id="${req.id}">
                <td>${i + 1}</td>
                <td><span class="method-badge ${req.method?.toLowerCase()}">${req.method}</span></td>
                <td>${req.host}</td>
                <td><code class="path">${req.path}</code></td>
                <td><span class="status-badge status-${Math.floor((req.status || 0) / 100)}xx">${req.status || '-'}</span></td>
                <td>${req.responseSize ? this.formatBytes(req.responseSize) : '-'}</td>
                <td>${this.formatDate(req.timestamp)}</td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.request-row').forEach(row => {
            row.addEventListener('click', () => this.showRequestDetail(row.dataset.requestId));
        });
    }

    showRequestDetail(requestId) {
        const request = this.requests.find(r => r.id === requestId);
        const panel = document.getElementById('request-detail-panel');
        if (!panel || !request) return;

        document.querySelectorAll('.request-row').forEach(r => r.classList.remove('selected'));
        document.querySelector(`[data-request-id="${requestId}"]`)?.classList.add('selected');

        panel.innerHTML = `
            <div class="detail-tabs">
                <button class="tab-btn active" data-tab="request">Request</button>
                <button class="tab-btn" data-tab="response">Response</button>
            </div>
            <div class="detail-content">
                <div class="tab-panel active" id="request-tab">
                    <div class="request-line">
                        <span class="method ${request.method?.toLowerCase()}">${request.method}</span>
                        <span class="url">${request.scheme}://${request.host}${request.path}</span>
                    </div>
                    <div class="headers-section">
                        <h4>Headers</h4>
                        <pre>${JSON.stringify(request.headers || [], null, 2)}</pre>
                    </div>
                    ${request.body ? `
                        <div class="body-section">
                            <h4>Body</h4>
                            <pre>${request.body}</pre>
                        </div>
                    ` : ''}
                </div>
                <div class="tab-panel" id="response-tab">
                    ${request.response ? `
                        <div class="response-status">Status: ${request.status}</div>
                        <div class="headers-section">
                            <h4>Headers</h4>
                            <pre>${JSON.stringify(request.response.headers || {}, null, 2)}</pre>
                        </div>
                        <div class="body-section">
                            <h4>Body</h4>
                            <pre>${request.response.body || 'No body'}</pre>
                        </div>
                    ` : '<p>No response data</p>'}
                </div>
            </div>
            <div class="detail-actions">
                <button class="cf-btn small" onclick="window.pageController.navigateTo('replay-queue', {requestId: '${request.id}'})">
                    <i class="fas fa-redo"></i> Replay
                </button>
                <button class="cf-btn small" onclick="navigator.clipboard.writeText(\`${request.method} ${request.path}\`)">
                    <i class="fas fa-copy"></i> Copy
                </button>
            </div>
        `;

        panel.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                panel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                panel.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                panel.querySelector(`#${e.target.dataset.tab}-tab`)?.classList.add('active');
            });
        });
    }

    renderPagination(pagination) {
        const container = document.getElementById('requests-pagination');
        if (!container || !pagination) return;

        container.innerHTML = `
            <button class="cf-btn small" ${pagination.page <= 1 ? 'disabled' : ''} onclick="this.page--; this.loadData();">
                <i class="fas fa-chevron-left"></i>
            </button>
            <span>Page ${pagination.page} of ${pagination.totalPages}</span>
            <button class="cf-btn small" ${pagination.page >= pagination.totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }

    searchRequests(query) {
        const filtered = this.requests.filter(r => 
            r.host?.toLowerCase().includes(query.toLowerCase()) ||
            r.path?.toLowerCase().includes(query.toLowerCase())
        );
        this.renderRequests(filtered);
    }

    filterByMethod(method) {
        this.loadData();
    }

    async exportRequests() {
        try {
            const result = await this.api.post('/api/exports', {
                name: `Requests-${Date.now()}`,
                format: 'har',
                includeRequests: true
            });
            if (result.success) {
                window.showToast?.('success', 'Export Started', 'Generating HAR file...');
            }
        } catch (error) {
            window.showToast?.('error', 'Export Failed', error.message);
        }
    }
}

class HttpResponsesPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 10000;
    }

    createHTML() {
        return `
            <div class="page-content http-responses-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-arrow-left"></i>
                        <h2>HTTP Responses</h2>
                    </div>
                    <div class="page-actions">
                        <select id="status-filter" class="cf-select">
                            <option value="">All Status</option>
                            <option value="2xx">2xx Success</option>
                            <option value="3xx">3xx Redirect</option>
                            <option value="4xx">4xx Client Error</option>
                            <option value="5xx">5xx Server Error</option>
                        </select>
                        <button class="cf-btn small" id="refresh-responses">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>

                <div class="responses-grid" id="responses-grid">
                    <div class="loading-placeholder">Loading responses...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('refresh-responses')?.addEventListener('click', () => this.refresh());
        document.getElementById('status-filter')?.addEventListener('change', (e) => this.filterByStatus(e.target.value));
    }

    async loadData() {
        try {
            const result = await this.api.getHttpRequests(1, 100);
            if (result.success) {
                const requests = result.data?.data?.requests || [];
                this.renderResponses(requests.filter(r => r.status));
            }
        } catch (error) {
            console.error('Failed to load responses:', error);
        }
    }

    renderResponses(responses) {
        const container = document.getElementById('responses-grid');
        if (!container) return;

        if (!responses.length) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>No responses captured</p></div>`;
            return;
        }

        container.innerHTML = responses.map(resp => `
            <div class="response-card status-${Math.floor(resp.status / 100)}xx">
                <div class="response-header">
                    <span class="status-code">${resp.status}</span>
                    <span class="method ${resp.method?.toLowerCase()}">${resp.method}</span>
                </div>
                <div class="response-url">${resp.host}${resp.path}</div>
                <div class="response-meta">
                    <span>${resp.responseSize ? this.formatBytes(resp.responseSize) : '-'}</span>
                    <span>${this.formatDate(resp.timestamp)}</span>
                </div>
            </div>
        `).join('');
    }

    filterByStatus(status) {
        this.loadData();
    }
}

class HttpAnalysisPage extends BasePage {
    createHTML() {
        return `
            <div class="page-content http-analysis-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-chart-bar"></i>
                        <h2>HTTP Traffic Analysis</h2>
                    </div>
                </div>

                <div class="analysis-dashboard">
                    <div class="analysis-card">
                        <h4>Request Distribution</h4>
                        <canvas id="method-chart"></canvas>
                    </div>
                    <div class="analysis-card">
                        <h4>Response Status</h4>
                        <canvas id="status-chart"></canvas>
                    </div>
                    <div class="analysis-card">
                        <h4>Top Hosts</h4>
                        <div id="top-hosts-list"></div>
                    </div>
                    <div class="analysis-card">
                        <h4>Content Types</h4>
                        <div id="content-types-list"></div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadData() {
        try {
            const result = await this.api.getHttpRequests(1, 500);
            if (result.success) {
                const requests = result.data?.data?.requests || [];
                this.renderAnalysis(requests);
            }
        } catch (error) {
            console.error('Failed to load analysis:', error);
        }
    }

    renderAnalysis(requests) {
        // Method distribution
        const methods = {};
        const statuses = {};
        const hosts = {};

        requests.forEach(r => {
            methods[r.method] = (methods[r.method] || 0) + 1;
            if (r.status) {
                const statusGroup = `${Math.floor(r.status / 100)}xx`;
                statuses[statusGroup] = (statuses[statusGroup] || 0) + 1;
            }
            hosts[r.host] = (hosts[r.host] || 0) + 1;
        });

        // Render top hosts
        const topHostsContainer = document.getElementById('top-hosts-list');
        if (topHostsContainer) {
            const sortedHosts = Object.entries(hosts).sort((a, b) => b[1] - a[1]).slice(0, 10);
            topHostsContainer.innerHTML = sortedHosts.map(([host, count]) => `
                <div class="analysis-row">
                    <span class="host">${host}</span>
                    <span class="count">${count}</span>
                </div>
            `).join('');
        }
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.InterceptRulesPage = InterceptRulesPage;
    window.InterceptQueuePage = InterceptQueuePage;
    window.InterceptHistoryPage = InterceptHistoryPage;
    window.HttpRequestsPage = HttpRequestsPage;
    window.HttpResponsesPage = HttpResponsesPage;
    window.HttpAnalysisPage = HttpAnalysisPage;
}
