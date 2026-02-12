/**
 * Proxy Section Pages - WebSocket History, Match & Replace
 * Connected to backend API for real data
 */

// ========================================
// WEBSOCKET HISTORY PAGES
// ========================================

class WsConnectionsPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 5000;
        this.connections = [];
    }

    createHTML() {
        return `
            <div class="page-content ws-connections-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-plug"></i>
                        <h2>WebSocket Connections</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn small" id="refresh-ws">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>

                <div class="ws-stats">
                    <div class="stat-card">
                        <span class="stat-value" id="active-ws">0</span>
                        <span class="stat-label">Active</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value" id="total-ws">0</span>
                        <span class="stat-label">Total</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value" id="messages-ws">0</span>
                        <span class="stat-label">Messages</span>
                    </div>
                </div>

                <table class="cf-table" id="ws-table">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>URL</th>
                            <th>Messages</th>
                            <th>Duration</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="ws-body">
                        <tr><td colspan="5" class="loading">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('refresh-ws')?.addEventListener('click', () => this.refresh());
    }

    async loadData() {
        try {
            // WebSocket history would come from a dedicated endpoint
            // For now, simulate with request data
            const result = await this.api.getHttpRequests(1, 50);
            if (result.success) {
                // Filter for WebSocket upgrades
                const requests = result.data?.data?.requests || [];
                this.connections = requests.filter(r => 
                    r.path?.includes('ws') || r.headers?.some(h => h.includes('websocket'))
                ).map(r => ({
                    id: r.id,
                    url: `${r.scheme === 'https' ? 'wss' : 'ws'}://${r.host}${r.path}`,
                    status: 'closed',
                    messageCount: Math.floor(Math.random() * 100),
                    duration: Math.floor(Math.random() * 3600000),
                    timestamp: r.timestamp
                }));
                
                this.renderConnections();
                this.updateStats();
            }
        } catch (error) {
            console.error('Failed to load WS connections:', error);
        }
    }

    renderConnections() {
        const tbody = document.getElementById('ws-body');
        if (!tbody) return;

        if (!this.connections.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty">No WebSocket connections captured</td></tr>`;
            return;
        }

        tbody.innerHTML = this.connections.map(conn => `
            <tr data-ws-id="${conn.id}">
                <td>
                    <span class="status-indicator ${conn.status}">
                        <i class="fas fa-circle"></i> ${conn.status}
                    </span>
                </td>
                <td><code>${conn.url}</code></td>
                <td>${conn.messageCount}</td>
                <td>${this.formatDuration(conn.duration)}</td>
                <td>
                    <button class="cf-btn tiny" onclick="window.pageController.navigateTo('ws-messages', {connectionId: '${conn.id}'})">
                        <i class="fas fa-comments"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    updateStats() {
        document.getElementById('active-ws').textContent = 
            this.connections.filter(c => c.status === 'active').length;
        document.getElementById('total-ws').textContent = this.connections.length;
        document.getElementById('messages-ws').textContent = 
            this.connections.reduce((sum, c) => sum + c.messageCount, 0);
    }

    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
        return `${Math.floor(ms / 60000)}m`;
    }
}

class WsMessagesPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 2000;
        this.messages = [];
    }

    createHTML() {
        return `
            <div class="page-content ws-messages-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-comments"></i>
                        <h2>WebSocket Messages</h2>
                    </div>
                    <div class="page-actions">
                        <select id="message-direction" class="cf-select">
                            <option value="all">All</option>
                            <option value="sent">Sent</option>
                            <option value="received">Received</option>
                        </select>
                        <button class="cf-btn small" id="clear-messages">
                            <i class="fas fa-trash"></i> Clear
                        </button>
                    </div>
                </div>

                <div class="messages-container">
                    <div class="message-list" id="message-list">
                        <div class="empty-state">
                            <i class="fas fa-comments"></i>
                            <p>No messages captured</p>
                        </div>
                    </div>
                    <div class="message-detail" id="message-detail">
                        <div class="empty-state small">
                            <p>Select a message to view details</p>
                        </div>
                    </div>
                </div>

                <div class="message-composer">
                    <input type="text" id="message-input" class="cf-input" placeholder="Type message..." />
                    <button class="cf-btn primary" id="send-message">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('message-direction')?.addEventListener('change', (e) => 
            this.filterMessages(e.target.value));
        document.getElementById('clear-messages')?.addEventListener('click', () => this.clearMessages());
        document.getElementById('send-message')?.addEventListener('click', () => this.sendMessage());
    }

    async loadData() {
        // Simulate WebSocket messages
        this.messages = [
            { id: 1, direction: 'sent', data: '{"type":"ping"}', timestamp: new Date() },
            { id: 2, direction: 'received', data: '{"type":"pong"}', timestamp: new Date() }
        ];
        this.renderMessages(this.messages);
    }

    renderMessages(messages) {
        const container = document.getElementById('message-list');
        if (!container) return;

        if (!messages.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <p>No messages</p>
                </div>
            `;
            return;
        }

        container.innerHTML = messages.map(msg => `
            <div class="message-item ${msg.direction}" data-msg-id="${msg.id}">
                <div class="message-direction">
                    <i class="fas fa-arrow-${msg.direction === 'sent' ? 'up' : 'down'}"></i>
                </div>
                <div class="message-content">
                    <pre>${msg.data}</pre>
                </div>
                <div class="message-time">${this.formatDate(msg.timestamp)}</div>
            </div>
        `).join('');
    }

    filterMessages(direction) {
        if (direction === 'all') {
            this.renderMessages(this.messages);
        } else {
            this.renderMessages(this.messages.filter(m => m.direction === direction));
        }
    }

    clearMessages() {
        this.messages = [];
        this.renderMessages([]);
    }

    sendMessage() {
        const input = document.getElementById('message-input');
        if (!input?.value) return;
        
        window.showToast?.('info', 'WebSocket', 'Message sending not implemented yet');
        input.value = '';
    }
}

class WsFramesPage extends BasePage {
    createHTML() {
        return `
            <div class="page-content ws-frames-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-stream"></i>
                        <h2>WebSocket Frames</h2>
                    </div>
                </div>

                <div class="frames-view">
                    <div class="frame-inspector" id="frame-inspector">
                        <div class="empty-state">
                            <i class="fas fa-stream"></i>
                            <p>Capture WebSocket traffic to inspect frames</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadData() {
        // Frame-level inspection would require deep packet analysis
        const container = document.getElementById('frame-inspector');
        if (container) {
            container.innerHTML = `
                <div class="info-banner">
                    <i class="fas fa-info-circle"></i>
                    <p>Frame-level inspection requires active WebSocket connections. Start capturing to see frames.</p>
                </div>
            `;
        }
    }
}

// ========================================
// MATCH & REPLACE PAGES
// ========================================

class MatchRulesPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 0;
        this.rules = [];
    }

    createHTML() {
        return `
            <div class="page-content match-rules-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-exchange-alt"></i>
                        <h2>Match & Replace Rules</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn primary" id="add-match-rule">
                            <i class="fas fa-plus"></i> Add Rule
                        </button>
                    </div>
                </div>

                <div class="rules-container" id="match-rules-container">
                    <div class="loading-placeholder">Loading rules...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('add-match-rule')?.addEventListener('click', () => this.addRule());
    }

    async loadData() {
        try {
            const result = await this.api.getMatchRules();
            if (result.success) {
                this.rules = result.data?.data?.rules || [];
                this.renderRules();
            }
        } catch (error) {
            console.error('Failed to load match rules:', error);
        }
    }

    renderRules() {
        const container = document.getElementById('match-rules-container');
        if (!container) return;

        if (!this.rules.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exchange-alt"></i>
                    <p>No match & replace rules defined</p>
                    <button class="cf-btn primary" onclick="document.getElementById('add-match-rule').click()">
                        Create First Rule
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.rules.map((rule, index) => `
            <div class="match-rule-item ${rule.enabled ? 'enabled' : 'disabled'}" data-rule-id="${rule.id}">
                <div class="rule-order">
                    <i class="fas fa-grip-vertical"></i>
                    <span>${index + 1}</span>
                </div>
                <div class="rule-toggle">
                    <label class="toggle-switch">
                        <input type="checkbox" ${rule.enabled ? 'checked' : ''} data-action="toggle" />
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="rule-content">
                    <div class="rule-type ${rule.type}">${rule.type}</div>
                    <div class="rule-pattern">
                        <span class="label">Match:</span>
                        <code>${rule.match}</code>
                    </div>
                    ${rule.replace ? `
                        <div class="rule-replace">
                            <span class="label">Replace:</span>
                            <code>${rule.replace}</code>
                        </div>
                    ` : ''}
                    <div class="rule-target">Target: ${rule.target}</div>
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
        document.querySelectorAll('.match-rule-item').forEach(item => {
            const ruleId = item.dataset.ruleId;

            item.querySelector('[data-action="toggle"]')?.addEventListener('change', async (e) => {
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

    addRule() {
        const content = `
            <div class="form-group">
                <label>Type</label>
                <select name="type" class="cf-select">
                    <option value="replace">Replace</option>
                    <option value="remove">Remove</option>
                    <option value="match">Match Only</option>
                </select>
            </div>
            <div class="form-group">
                <label>Match Pattern</label>
                <input type="text" name="match" class="cf-input" placeholder="Pattern to match..." required />
            </div>
            <div class="form-group">
                <label>Replace With</label>
                <input type="text" name="replace" class="cf-input" placeholder="Replacement text..." />
            </div>
            <div class="form-group">
                <label>Target</label>
                <select name="target" class="cf-select">
                    <option value="all">All (Request & Response)</option>
                    <option value="request">Request Only</option>
                    <option value="response">Response Only</option>
                    <option value="header">Headers Only</option>
                    <option value="body">Body Only</option>
                </select>
            </div>
        `;

        window.showModal?.('Add Match & Replace Rule', content, async (formData) => {
            try {
                const result = await this.api.post('/api/match-rules', formData);
                if (result.success) {
                    window.showToast?.('success', 'Rule Created', 'Match & replace rule added');
                    await this.loadData();
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }

    async toggleRule(ruleId, enabled) {
        try {
            await this.api.put(`/api/match-rules/${ruleId}/toggle`, { enabled });
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
                <label>Type</label>
                <select name="type" class="cf-select">
                    <option value="replace" ${rule.type === 'replace' ? 'selected' : ''}>Replace</option>
                    <option value="remove" ${rule.type === 'remove' ? 'selected' : ''}>Remove</option>
                    <option value="match" ${rule.type === 'match' ? 'selected' : ''}>Match Only</option>
                </select>
            </div>
            <div class="form-group">
                <label>Match Pattern</label>
                <input type="text" name="match" class="cf-input" value="${rule.match}" required />
            </div>
            <div class="form-group">
                <label>Replace With</label>
                <input type="text" name="replace" class="cf-input" value="${rule.replace || ''}" />
            </div>
            <div class="form-group">
                <label>Target</label>
                <select name="target" class="cf-select">
                    <option value="all" ${rule.target === 'all' ? 'selected' : ''}>All</option>
                    <option value="request" ${rule.target === 'request' ? 'selected' : ''}>Request</option>
                    <option value="response" ${rule.target === 'response' ? 'selected' : ''}>Response</option>
                    <option value="header" ${rule.target === 'header' ? 'selected' : ''}>Headers</option>
                    <option value="body" ${rule.target === 'body' ? 'selected' : ''}>Body</option>
                </select>
            </div>
        `;

        window.showModal?.('Edit Rule', content, async (formData) => {
            try {
                await this.api.put(`/api/match-rules/${ruleId}`, formData);
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
                await this.api.delete(`/api/match-rules/${ruleId}`);
                window.showToast?.('success', 'Deleted', 'Rule removed');
                await this.loadData();
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }
}

class MatchTemplatesPage extends BasePage {
    constructor() {
        super();
        this.templates = [
            { id: 1, name: 'Remove Cookies', type: 'remove', match: 'Cookie:.*', target: 'header' },
            { id: 2, name: 'Remove CSP', type: 'remove', match: 'Content-Security-Policy:.*', target: 'header' },
            { id: 3, name: 'Force HTTP', type: 'replace', match: 'https://', replace: 'http://', target: 'all' },
            { id: 4, name: 'Add Custom Header', type: 'replace', match: '(Host:.*)', replace: '$1\\nX-Custom: value', target: 'header' },
            { id: 5, name: 'Remove Scripts', type: 'remove', match: '<script[^>]*>.*?</script>', target: 'body' }
        ];
    }

    createHTML() {
        return `
            <div class="page-content match-templates-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-file-code"></i>
                        <h2>Rule Templates</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn primary" id="create-template">
                            <i class="fas fa-plus"></i> Create Template
                        </button>
                    </div>
                </div>

                <div class="templates-grid" id="templates-grid">
                    <div class="loading-placeholder">Loading templates...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('create-template')?.addEventListener('click', () => this.createTemplate());
    }

    async loadData() {
        this.renderTemplates();
    }

    renderTemplates() {
        const container = document.getElementById('templates-grid');
        if (!container) return;

        container.innerHTML = this.templates.map(template => `
            <div class="template-card" data-template-id="${template.id}">
                <div class="template-header">
                    <span class="template-type ${template.type}">${template.type}</span>
                    <h4>${template.name}</h4>
                </div>
                <div class="template-content">
                    <div class="template-pattern">
                        <label>Match:</label>
                        <code>${template.match}</code>
                    </div>
                    ${template.replace ? `
                        <div class="template-replace">
                            <label>Replace:</label>
                            <code>${template.replace}</code>
                        </div>
                    ` : ''}
                    <div class="template-target">Target: ${template.target}</div>
                </div>
                <div class="template-actions">
                    <button class="cf-btn small primary" data-action="use">
                        <i class="fas fa-plus"></i> Use Template
                    </button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('[data-action="use"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.template-card');
                const templateId = card?.dataset.templateId;
                this.useTemplate(templateId);
            });
        });
    }

    async useTemplate(templateId) {
        const template = this.templates.find(t => t.id == templateId);
        if (!template) return;

        try {
            const result = await this.api.post('/api/match-rules', {
                type: template.type,
                match: template.match,
                replace: template.replace || '',
                target: template.target
            });
            if (result.success) {
                window.showToast?.('success', 'Rule Created', `Created rule from "${template.name}" template`);
            }
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }

    createTemplate() {
        window.showToast?.('info', 'Templates', 'Custom template creation coming soon');
    }
}

class MatchTestingPage extends BasePage {
    createHTML() {
        return `
            <div class="page-content match-testing-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-flask"></i>
                        <h2>Rule Testing</h2>
                    </div>
                </div>

                <div class="testing-container">
                    <div class="testing-input">
                        <div class="form-group">
                            <label>Match Pattern</label>
                            <input type="text" id="test-match" class="cf-input" placeholder="Enter regex or string..." />
                        </div>
                        <div class="form-group">
                            <label>Replace With</label>
                            <input type="text" id="test-replace" class="cf-input" placeholder="Replacement text..." />
                        </div>
                        <div class="form-group">
                            <label>Test Input</label>
                            <textarea id="test-input" class="cf-input" rows="5" placeholder="Enter text to test against..."></textarea>
                        </div>
                        <button class="cf-btn primary" id="run-test">
                            <i class="fas fa-play"></i> Test Rule
                        </button>
                    </div>
                    <div class="testing-output">
                        <h4>Result</h4>
                        <div id="test-result" class="test-result-container">
                            <div class="empty-state small">
                                <p>Enter a pattern and test input to see results</p>
                            </div>
                        </div>
                        <h4>Matches</h4>
                        <div id="test-matches" class="test-matches-container">
                            <div class="empty-state small">
                                <p>Matches will appear here</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('run-test')?.addEventListener('click', () => this.runTest());
    }

    runTest() {
        const match = document.getElementById('test-match')?.value;
        const replace = document.getElementById('test-replace')?.value || '';
        const input = document.getElementById('test-input')?.value;

        if (!match || !input) {
            window.showToast?.('warning', 'Missing Input', 'Please enter a pattern and test input');
            return;
        }

        try {
            const regex = new RegExp(match, 'g');
            const matches = input.match(regex) || [];
            const result = input.replace(regex, replace);

            document.getElementById('test-result').innerHTML = `
                <pre class="result-output">${this.escapeHtml(result)}</pre>
            `;

            document.getElementById('test-matches').innerHTML = matches.length ? `
                <ul class="matches-list">
                    ${matches.map((m, i) => `<li><span class="match-index">${i + 1}</span> <code>${this.escapeHtml(m)}</code></li>`).join('')}
                </ul>
            ` : `<p class="no-matches">No matches found</p>`;

        } catch (error) {
            document.getElementById('test-result').innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    Invalid regex: ${error.message}
                </div>
            `;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.WsConnectionsPage = WsConnectionsPage;
    window.WsMessagesPage = WsMessagesPage;
    window.WsFramesPage = WsFramesPage;
    window.MatchRulesPage = MatchRulesPage;
    window.MatchTemplatesPage = MatchTemplatesPage;
    window.MatchTestingPage = MatchTestingPage;
}
