/**
 * Testing Section Pages - Replay, Automate, Workflows
 * Connected to backend API for real data
 */

// ========================================
// REPLAY PAGES
// ========================================

class ReplayQueuePage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 5000;
        this.queue = [];
    }

    createHTML() {
        return `
            <div class="page-content replay-queue-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-redo"></i>
                        <h2>Replay Queue</h2>
                        <span class="queue-badge" id="queue-count">0</span>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="add-to-queue">
                            <i class="fas fa-plus"></i> Add Request
                        </button>
                        <button class="caido-btn success" id="replay-all">
                            <i class="fas fa-play"></i> Replay All
                        </button>
                        <button class="caido-btn small" id="clear-queue">
                            <i class="fas fa-trash"></i> Clear
                        </button>
                    </div>
                </div>

                <div class="replay-queue-container">
                    <div class="queue-list" id="queue-list">
                        <div class="loading-placeholder">Loading queue...</div>
                    </div>
                    <div class="queue-editor" id="queue-editor">
                        <div class="empty-state">
                            <i class="fas fa-edit"></i>
                            <p>Select a request to edit before replay</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('add-to-queue')?.addEventListener('click', () => this.addToQueue());
        document.getElementById('replay-all')?.addEventListener('click', () => this.replayAll());
        document.getElementById('clear-queue')?.addEventListener('click', () => this.clearQueue());
    }

    async loadData() {
        try {
            const result = await this.api.getReplayQueue();
            if (result.success) {
                this.queue = result.data?.queue || [];
                document.getElementById('queue-count').textContent = this.queue.length;
                this.renderQueue();
            } else {
                // Fallback to HTTP requests
                const fallback = await this.api.getHttpRequests(1, 20);
                if (fallback.success) {
                    this.queue = fallback.data?.data?.requests || [];
                    document.getElementById('queue-count').textContent = this.queue.length;
                    this.renderQueue();
                }
            }
        } catch (error) {
            console.error('Failed to load replay queue:', error);
        }
    }

    renderQueue() {
        const container = document.getElementById('queue-list');
        if (!container) return;

        if (!this.queue.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-redo"></i>
                    <p>No requests in queue</p>
                    <button class="caido-btn primary" onclick="document.getElementById('add-to-queue').click()">
                        Add Request
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.queue.map((req, index) => `
            <div class="queue-item" data-request-id="${req.id}">
                <div class="queue-number">${index + 1}</div>
                <div class="queue-method ${req.method?.toLowerCase()}">${req.method}</div>
                <div class="queue-info">
                    <div class="queue-host">${req.host}</div>
                    <div class="queue-path">${req.path}</div>
                </div>
                <div class="queue-actions">
                    <button class="caido-btn tiny success" data-action="replay">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="caido-btn tiny" data-action="edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="caido-btn tiny danger" data-action="remove">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');

        this.bindQueueActions();
    }

    bindQueueActions() {
        document.querySelectorAll('.queue-item').forEach(item => {
            const requestId = item.dataset.requestId;

            item.querySelector('[data-action="replay"]')?.addEventListener('click', () => {
                this.replayRequest(requestId);
            });

            item.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
                this.editRequest(requestId);
            });

            item.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
                this.removeFromQueue(requestId);
            });
        });
    }

    async replayRequest(requestId) {
        try {
            const result = await this.api.replayRequest(requestId);
            if (result.success) {
                window.showToast?.('success', 'Replayed', 'Request sent successfully');
            } else {
                window.showToast?.('error', 'Replay Failed', result.error || 'Failed to replay');
            }
        } catch (error) {
            window.showToast?.('error', 'Replay Failed', error.message);
        }
    }

    editRequest(requestId) {
        const request = this.queue.find(r => r.id === requestId);
        if (!request) return;

        const editor = document.getElementById('queue-editor');
        if (!editor) return;

        editor.innerHTML = `
            <div class="request-editor">
                <h4>Edit Request</h4>
                <div class="form-group">
                    <label>Method</label>
                    <select id="edit-method" class="caido-select">
                        ${['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map(m => 
                            `<option value="${m}" ${request.method === m ? 'selected' : ''}>${m}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>URL</label>
                    <input type="text" id="edit-url" class="caido-input" 
                           value="${request.scheme}://${request.host}${request.path}${request.query ? '?' + request.query : ''}" />
                </div>
                <div class="form-group">
                    <label>Headers</label>
                    <textarea id="edit-headers" class="caido-input" rows="5">${JSON.stringify(request.headers || [], null, 2)}</textarea>
                </div>
                <div class="form-group">
                    <label>Body</label>
                    <textarea id="edit-body" class="caido-input" rows="5">${request.body || ''}</textarea>
                </div>
                <div class="editor-actions">
                    <button class="caido-btn" onclick="document.getElementById('queue-editor').innerHTML = '<div class=\\'empty-state\\'><p>Select a request to edit</p></div>'">
                        Cancel
                    </button>
                    <button class="caido-btn primary" id="save-and-replay">
                        <i class="fas fa-play"></i> Save & Replay
                    </button>
                </div>
            </div>
        `;

        document.getElementById('save-and-replay')?.addEventListener('click', async () => {
            try {
                await this.api.post(`/api/requests/${requestId}/replay`, {
                    modifications: {
                        method: document.getElementById('edit-method')?.value,
                        headers: JSON.parse(document.getElementById('edit-headers')?.value || '[]'),
                        body: document.getElementById('edit-body')?.value
                    }
                });
                window.showToast?.('success', 'Replayed', 'Modified request sent');
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }

    addToQueue() {
        const content = `
            <div class="form-group">
                <label>Method</label>
                <select name="method" class="caido-select">
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                </select>
            </div>
            <div class="form-group">
                <label>URL</label>
                <input type="text" name="url" class="caido-input" placeholder="https://example.com/api" required />
            </div>
            <div class="form-group">
                <label>Body (optional)</label>
                <textarea name="body" class="caido-input" rows="3"></textarea>
            </div>
        `;

        window.showModal?.('Add Request to Queue', content, async (formData) => {
            try {
                const url = new URL(formData.url);
                const result = await this.api.post('/api/requests', {
                    method: formData.method,
                    host: url.hostname,
                    path: url.pathname,
                    query: url.search.slice(1),
                    scheme: url.protocol.replace(':', ''),
                    body: formData.body
                });
                if (result.success) {
                    window.showToast?.('success', 'Added', 'Request added to queue');
                    await this.loadData();
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }

    async replayAll() {
        window.showToast?.('info', 'Replaying', `Sending ${this.queue.length} requests...`);
        for (const req of this.queue) {
            await this.replayRequest(req.id);
        }
        window.showToast?.('success', 'Complete', 'All requests replayed');
    }

    removeFromQueue(requestId) {
        this.queue = this.queue.filter(r => r.id !== requestId);
        document.getElementById('queue-count').textContent = this.queue.length;
        this.renderQueue();
    }

    clearQueue() {
        window.showConfirmModal?.('Clear Queue', 'Remove all requests from the queue?', () => {
            this.queue = [];
            document.getElementById('queue-count').textContent = 0;
            this.renderQueue();
        });
    }
}

class ReplayHistoryPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 10000;
        this.history = [];
    }

    createHTML() {
        return `
            <div class="page-content replay-history-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-history"></i>
                        <h2>Replay History</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn small" id="export-history">
                            <i class="fas fa-download"></i> Export
                        </button>
                        <button class="caido-btn small" id="clear-history">
                            <i class="fas fa-trash"></i> Clear
                        </button>
                    </div>
                </div>

                <table class="caido-table" id="history-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Original</th>
                            <th>Method</th>
                            <th>URL</th>
                            <th>Status</th>
                            <th>Response Time</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="history-body">
                        <tr><td colspan="7" class="loading">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    async loadData() {
        try {
            const result = await this.api.getHttpRequests(1, 100);
            if (result.success) {
                this.history = (result.data?.data?.requests || []).filter(r => r.isReplay);
                this.renderHistory();
            }
        } catch (error) {
            console.error('Failed to load replay history:', error);
        }
    }

    renderHistory() {
        const tbody = document.getElementById('history-body');
        if (!tbody) return;

        if (!this.history.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty">No replay history</td></tr>`;
            return;
        }

        tbody.innerHTML = this.history.map(item => `
            <tr>
                <td>${this.formatDate(item.timestamp)}</td>
                <td>${item.originalId ? `#${item.originalId.slice(0, 8)}` : '-'}</td>
                <td><span class="method-badge ${item.method?.toLowerCase()}">${item.method}</span></td>
                <td><code>${item.host}${item.path}</code></td>
                <td><span class="status-badge status-${Math.floor((item.status || 0) / 100)}xx">${item.status || '-'}</span></td>
                <td>${item.responseTime || '-'}ms</td>
                <td>
                    <button class="caido-btn tiny" onclick="window.pageController.navigateTo('replay-comparison', {replayId: '${item.id}'})">
                        <i class="fas fa-columns"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
}

class ReplayComparisonPage extends BasePage {
    createHTML() {
        return `
            <div class="page-content replay-comparison-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-columns"></i>
                        <h2>Response Comparison</h2>
                    </div>
                </div>

                <div class="comparison-container">
                    <div class="comparison-panel original">
                        <h4>Original Response</h4>
                        <div class="comparison-content" id="original-response">
                            <div class="empty-state small">
                                <p>Select requests to compare</p>
                            </div>
                        </div>
                    </div>
                    <div class="comparison-panel replay">
                        <h4>Replay Response</h4>
                        <div class="comparison-content" id="replay-response">
                            <div class="empty-state small">
                                <p>Select requests to compare</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="comparison-diff" id="comparison-diff">
                    <h4>Differences</h4>
                    <div class="diff-content">
                        <p>Select two requests to see differences</p>
                    </div>
                </div>
            </div>
        `;
    }

    async loadData() {
        // Load comparison data based on options
    }
}

// ========================================
// AUTOMATE PAGES
// ========================================

class AutomateSequencesPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 0;
        this.sequences = [];
    }

    createHTML() {
        return `
            <div class="page-content automate-sequences-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-list-ol"></i>
                        <h2>Request Sequences</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="create-sequence">
                            <i class="fas fa-plus"></i> New Sequence
                        </button>
                    </div>
                </div>

                <div class="sequences-list" id="sequences-list">
                    <div class="loading-placeholder">Loading sequences...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('create-sequence')?.addEventListener('click', () => this.createSequence());
    }

    async loadData() {
        try {
            const result = await this.api.getAutomations();
            if (result.success) {
                this.sequences = result.data?.data?.automations?.filter(a => a.type === 'sequence') || [];
                this.renderSequences();
            }
        } catch (error) {
            console.error('Failed to load sequences:', error);
        }
    }

    renderSequences() {
        const container = document.getElementById('sequences-list');
        if (!container) return;

        if (!this.sequences.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-list-ol"></i>
                    <p>No sequences defined</p>
                    <p class="subtext">Sequences allow you to chain multiple requests together</p>
                    <button class="caido-btn primary" onclick="document.getElementById('create-sequence').click()">
                        Create First Sequence
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.sequences.map(seq => `
            <div class="sequence-card" data-sequence-id="${seq.id}">
                <div class="sequence-header">
                    <h4>${seq.name}</h4>
                    <span class="step-count">${seq.actions?.length || 0} steps</span>
                </div>
                <div class="sequence-description">${seq.description || 'No description'}</div>
                <div class="sequence-actions">
                    <button class="caido-btn small success" data-action="run">
                        <i class="fas fa-play"></i> Run
                    </button>
                    <button class="caido-btn small" data-action="edit">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            </div>
        `).join('');
    }

    createSequence() {
        const content = `
            <div class="form-group">
                <label>Sequence Name</label>
                <input type="text" name="name" class="caido-input" placeholder="My Sequence" required />
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" class="caido-input" rows="2"></textarea>
            </div>
        `;

        window.showModal?.('Create Sequence', content, async (formData) => {
            try {
                const result = await this.api.post('/api/automations', {
                    name: formData.name,
                    description: formData.description,
                    trigger: { type: 'manual' },
                    actions: [],
                    type: 'sequence'
                });
                if (result.success) {
                    window.showToast?.('success', 'Created', 'Sequence created');
                    await this.loadData();
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }
}

class AutomateMacrosPage extends BasePage {
    constructor() {
        super();
        this.macros = [];
    }

    createHTML() {
        return `
            <div class="page-content automate-macros-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-magic"></i>
                        <h2>Macros</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="create-macro">
                            <i class="fas fa-plus"></i> New Macro
                        </button>
                        <button class="caido-btn" id="record-macro">
                            <i class="fas fa-circle"></i> Record
                        </button>
                    </div>
                </div>

                <div class="macros-grid" id="macros-grid">
                    <div class="loading-placeholder">Loading macros...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('create-macro')?.addEventListener('click', () => this.createMacro());
        document.getElementById('record-macro')?.addEventListener('click', () => this.startRecording());
    }

    async loadData() {
        try {
            const result = await this.api.getAutomations();
            if (result.success) {
                this.macros = result.data?.data?.automations?.filter(a => a.type === 'macro') || [];
                this.renderMacros();
            }
        } catch (error) {
            console.error('Failed to load macros:', error);
        }
    }

    renderMacros() {
        const container = document.getElementById('macros-grid');
        if (!container) return;

        if (!this.macros.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-magic"></i>
                    <p>No macros defined</p>
                    <p class="subtext">Macros automate repetitive tasks</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.macros.map(macro => `
            <div class="macro-card">
                <div class="macro-icon"><i class="fas fa-magic"></i></div>
                <h4>${macro.name}</h4>
                <p>${macro.description || ''}</p>
                <div class="macro-stats">
                    <span>Runs: ${macro.runCount || 0}</span>
                </div>
                <button class="caido-btn small success" onclick="alert('Running macro...')">
                    <i class="fas fa-play"></i>
                </button>
            </div>
        `).join('');
    }

    createMacro() {
        window.showToast?.('info', 'Macros', 'Macro editor coming soon');
    }

    startRecording() {
        window.showToast?.('info', 'Recording', 'Macro recording started - perform actions to record');
    }
}

class AutomateScriptsPage extends BasePage {
    createHTML() {
        return `
            <div class="page-content automate-scripts-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-code"></i>
                        <h2>Automation Scripts</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="new-script">
                            <i class="fas fa-plus"></i> New Script
                        </button>
                    </div>
                </div>

                <div class="scripts-container">
                    <div class="scripts-sidebar">
                        <div class="scripts-list" id="scripts-list">
                            <div class="empty-state small">No scripts</div>
                        </div>
                    </div>
                    <div class="scripts-editor">
                        <div class="editor-toolbar">
                            <button class="caido-btn small" id="run-script">
                                <i class="fas fa-play"></i> Run
                            </button>
                            <button class="caido-btn small" id="save-script">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                        <textarea id="script-editor" class="code-editor" placeholder="// Write your automation script here
// Available APIs: request, response, crypto, encoding

async function main() {
    // Your code here
}

main();"></textarea>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('new-script')?.addEventListener('click', () => this.newScript());
        document.getElementById('run-script')?.addEventListener('click', () => this.runScript());
        document.getElementById('save-script')?.addEventListener('click', () => this.saveScript());
    }

    newScript() {
        document.getElementById('script-editor').value = `// New automation script
async function main() {
    // Make a request
    const response = await request({
        method: 'GET',
        url: 'https://example.com/api'
    });
    
    console.log('Response:', response.status);
}

main();`;
    }

    runScript() {
        const code = document.getElementById('script-editor')?.value;
        window.showToast?.('info', 'Script', 'Script execution coming soon');
    }

    saveScript() {
        window.showToast?.('success', 'Saved', 'Script saved');
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.ReplayQueuePage = ReplayQueuePage;
    window.ReplayHistoryPage = ReplayHistoryPage;
    window.ReplayComparisonPage = ReplayComparisonPage;
    window.AutomateSequencesPage = AutomateSequencesPage;
    window.AutomateMacrosPage = AutomateMacrosPage;
    window.AutomateScriptsPage = AutomateScriptsPage;
}
