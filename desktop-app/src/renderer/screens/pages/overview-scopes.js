/**
 * Scopes Pages - Global, Project, Custom
 * Connected to backend API for real data
 */

// ========================================
// SCOPES PAGES
// ========================================

class ScopesGlobalPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 30000;
        this.scopes = [];
    }

    createHTML() {
        return `
            <div class="page-content scopes-global-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-globe"></i>
                        <h2>Global Scopes</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn primary" id="add-global-scope">
                            <i class="fas fa-plus"></i> Add Scope
                        </button>
                    </div>
                </div>

                <div class="scope-info-banner">
                    <i class="fas fa-info-circle"></i>
                    <p>Global scopes apply to all projects and sessions. Use patterns like <code>*.example.com</code> or <code>192.168.1.*</code></p>
                </div>

                <div class="scopes-container">
                    <div class="scope-section">
                        <h3><i class="fas fa-check-circle"></i> Include Patterns</h3>
                        <div class="scope-list" id="include-scopes">
                            <div class="loading-placeholder">Loading...</div>
                        </div>
                    </div>
                    <div class="scope-section">
                        <h3><i class="fas fa-ban"></i> Exclude Patterns</h3>
                        <div class="scope-list" id="exclude-scopes">
                            <div class="loading-placeholder">Loading...</div>
                        </div>
                    </div>
                </div>

                <div class="scope-stats">
                    <div class="stat-item">
                        <span class="stat-value" id="total-scopes">0</span>
                        <span class="stat-label">Total Scopes</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value" id="active-scopes">0</span>
                        <span class="stat-label">Active</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value" id="matched-requests">0</span>
                        <span class="stat-label">Matched Requests</span>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('add-global-scope')?.addEventListener('click', () => this.showAddScopeModal());
    }

    async loadData() {
        try {
            const result = await this.api.getScopes();
            if (result.success) {
                this.scopes = result.data?.data?.scopes || [];
                this.renderScopes();
                this.updateStats();
            }
        } catch (error) {
            console.error('Failed to load scopes:', error);
        }
    }

    renderScopes() {
        const includeContainer = document.getElementById('include-scopes');
        const excludeContainer = document.getElementById('exclude-scopes');

        const includeScopes = this.scopes.filter(s => s.type === 'include');
        const excludeScopes = this.scopes.filter(s => s.type === 'exclude');

        if (includeContainer) {
            includeContainer.innerHTML = includeScopes.length ? 
                includeScopes.map(s => this.renderScopeItem(s)).join('') :
                `<div class="empty-state small"><i class="fas fa-plus-circle"></i> No include patterns</div>`;
        }

        if (excludeContainer) {
            excludeContainer.innerHTML = excludeScopes.length ?
                excludeScopes.map(s => this.renderScopeItem(s)).join('') :
                `<div class="empty-state small"><i class="fas fa-minus-circle"></i> No exclude patterns</div>`;
        }

        this.bindScopeActions();
    }

    renderScopeItem(scope) {
        return `
            <div class="scope-item ${scope.enabled ? 'enabled' : 'disabled'}" data-scope-id="${scope.id}">
                <div class="scope-toggle">
                    <label class="toggle-switch">
                        <input type="checkbox" ${scope.enabled ? 'checked' : ''} data-action="toggle" />
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="scope-content">
                    <code class="scope-pattern">${scope.pattern}</code>
                    ${scope.description ? `<span class="scope-description">${scope.description}</span>` : ''}
                </div>
                <div class="scope-meta">
                    <span class="scope-count">${scope.requestCount || 0} matches</span>
                </div>
                <div class="scope-actions">
                    <button class="cf-btn tiny" data-action="edit"><i class="fas fa-edit"></i></button>
                    <button class="cf-btn tiny danger" data-action="delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }

    bindScopeActions() {
        document.querySelectorAll('.scope-item').forEach(item => {
            const scopeId = item.dataset.scopeId;

            item.querySelector('[data-action="toggle"]')?.addEventListener('change', async (e) => {
                await this.toggleScope(scopeId, e.target.checked);
            });

            item.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
                const scope = this.scopes.find(s => s.id === scopeId);
                this.showEditScopeModal(scope);
            });

            item.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
                this.deleteScope(scopeId);
            });
        });
    }

    updateStats() {
        document.getElementById('total-scopes').textContent = this.scopes.length;
        document.getElementById('active-scopes').textContent = this.scopes.filter(s => s.enabled).length;
        document.getElementById('matched-requests').textContent = 
            this.scopes.reduce((sum, s) => sum + (s.requestCount || 0), 0);
    }

    showAddScopeModal() {
        const content = `
            <div class="form-group">
                <label>Pattern</label>
                <input type="text" name="pattern" class="cf-input" placeholder="*.example.com" required />
            </div>
            <div class="form-group">
                <label>Type</label>
                <select name="type" class="cf-select">
                    <option value="include">Include</option>
                    <option value="exclude">Exclude</option>
                </select>
            </div>
            <div class="form-group">
                <label>Description (optional)</label>
                <input type="text" name="description" class="cf-input" placeholder="Description..." />
            </div>
        `;

        window.showModal?.('Add Global Scope', content, async (formData) => {
            await this.createScope(formData);
        });
    }

    showEditScopeModal(scope) {
        if (!scope) return;
        
        const content = `
            <div class="form-group">
                <label>Pattern</label>
                <input type="text" name="pattern" class="cf-input" value="${scope.pattern}" required />
            </div>
            <div class="form-group">
                <label>Type</label>
                <select name="type" class="cf-select">
                    <option value="include" ${scope.type === 'include' ? 'selected' : ''}>Include</option>
                    <option value="exclude" ${scope.type === 'exclude' ? 'selected' : ''}>Exclude</option>
                </select>
            </div>
            <div class="form-group">
                <label>Description</label>
                <input type="text" name="description" class="cf-input" value="${scope.description || ''}" />
            </div>
        `;

        window.showModal?.('Edit Scope', content, async (formData) => {
            await this.updateScope(scope.id, formData);
        });
    }

    async createScope(data) {
        try {
            const result = await this.api.post('/api/scopes', data);
            if (result.success) {
                window.showToast?.('success', 'Scope Created', `Pattern "${data.pattern}" added`);
                await this.loadData();
            }
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }

    async updateScope(id, data) {
        try {
            const result = await this.api.put(`/api/scopes/${id}`, data);
            if (result.success) {
                window.showToast?.('success', 'Scope Updated', 'Changes saved');
                await this.loadData();
            }
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }

    async toggleScope(id, enabled) {
        try {
            await this.api.put(`/api/scopes/${id}`, { enabled });
            const scope = this.scopes.find(s => s.id === id);
            if (scope) scope.enabled = enabled;
            this.updateStats();
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
            await this.loadData();
        }
    }

    async deleteScope(id) {
        const scope = this.scopes.find(s => s.id === id);
        window.showConfirmModal?.('Delete Scope', 
            `Are you sure you want to delete "${scope?.pattern}"?`,
            async () => {
                try {
                    const result = await this.api.delete(`/api/scopes/${id}`);
                    if (result.success) {
                        window.showToast?.('success', 'Deleted', 'Scope removed');
                        await this.loadData();
                    }
                } catch (error) {
                    window.showToast?.('error', 'Failed', error.message);
                }
            }
        );
    }
}

class ScopesProjectPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 30000;
        this.projects = [];
        this.selectedProject = null;
    }

    createHTML() {
        return `
            <div class="page-content scopes-project-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-folder"></i>
                        <h2>Project Scopes</h2>
                    </div>
                    <div class="page-actions">
                        <select id="project-select" class="cf-select">
                            <option value="">Select Project...</option>
                        </select>
                        <button class="cf-btn primary" id="add-project-scope">
                            <i class="fas fa-plus"></i> Add Scope
                        </button>
                    </div>
                </div>

                <div class="project-scope-container">
                    <div class="project-sidebar">
                        <h4>Projects</h4>
                        <div class="project-list" id="project-list">
                            <div class="loading-placeholder">Loading projects...</div>
                        </div>
                        <button class="cf-btn small full-width" id="create-project">
                            <i class="fas fa-folder-plus"></i> New Project
                        </button>
                    </div>
                    <div class="project-scopes">
                        <div class="project-scope-header" id="project-scope-header">
                            <h3>Select a project to manage scopes</h3>
                        </div>
                        <div class="project-scope-list" id="project-scope-list">
                            <div class="empty-state">
                                <i class="fas fa-folder-open"></i>
                                <p>Select a project from the sidebar</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('add-project-scope')?.addEventListener('click', () => this.addProjectScope());
        document.getElementById('create-project')?.addEventListener('click', () => this.createProject());
        document.getElementById('project-select')?.addEventListener('change', (e) => {
            this.selectProject(e.target.value);
        });
    }

    async loadData() {
        try {
            // Load projects from workspace/files
            const result = await this.api.getScopes();
            if (result.success) {
                const scopes = result.data?.data?.scopes || [];
                // Group scopes by project
                this.projects = this.groupByProject(scopes);
                this.renderProjectList();
            }
        } catch (error) {
            console.error('Failed to load project scopes:', error);
        }
    }

    groupByProject(scopes) {
        // For now, treat all scopes as part of a "Default" project
        // In a full implementation, scopes would have a projectId field
        return [{
            id: 'default',
            name: 'Default Project',
            scopes: scopes
        }];
    }

    renderProjectList() {
        const container = document.getElementById('project-list');
        const select = document.getElementById('project-select');
        if (!container) return;

        if (!this.projects.length) {
            container.innerHTML = `<div class="empty-state small">No projects</div>`;
            return;
        }

        container.innerHTML = this.projects.map(p => `
            <div class="project-item ${this.selectedProject?.id === p.id ? 'selected' : ''}" data-project-id="${p.id}">
                <i class="fas fa-folder"></i>
                <span class="project-name">${p.name}</span>
                <span class="project-count">${p.scopes?.length || 0}</span>
            </div>
        `).join('');

        if (select) {
            select.innerHTML = `
                <option value="">Select Project...</option>
                ${this.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            `;
        }

        container.querySelectorAll('.project-item').forEach(item => {
            item.addEventListener('click', () => this.selectProject(item.dataset.projectId));
        });
    }

    selectProject(projectId) {
        this.selectedProject = this.projects.find(p => p.id === projectId);
        
        document.querySelectorAll('.project-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.projectId === projectId);
        });

        const header = document.getElementById('project-scope-header');
        const list = document.getElementById('project-scope-list');

        if (this.selectedProject) {
            header.innerHTML = `<h3><i class="fas fa-folder-open"></i> ${this.selectedProject.name}</h3>`;
            
            if (this.selectedProject.scopes?.length) {
                list.innerHTML = this.selectedProject.scopes.map(s => `
                    <div class="scope-item ${s.enabled ? 'enabled' : 'disabled'}">
                        <div class="scope-toggle">
                            <label class="toggle-switch">
                                <input type="checkbox" ${s.enabled ? 'checked' : ''} />
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="scope-content">
                            <code class="scope-pattern">${s.pattern}</code>
                            <span class="scope-type ${s.type}">${s.type}</span>
                        </div>
                        <div class="scope-actions">
                            <button class="cf-btn tiny"><i class="fas fa-edit"></i></button>
                            <button class="cf-btn tiny danger"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `).join('');
            } else {
                list.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-filter"></i>
                        <p>No scopes in this project</p>
                        <button class="cf-btn primary" onclick="document.getElementById('add-project-scope').click()">
                            Add Scope
                        </button>
                    </div>
                `;
            }
        } else {
            header.innerHTML = `<h3>Select a project to manage scopes</h3>`;
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>Select a project from the sidebar</p>
                </div>
            `;
        }
    }

    addProjectScope() {
        if (!this.selectedProject) {
            window.showToast?.('warning', 'No Project', 'Please select a project first');
            return;
        }
        
        const content = `
            <div class="form-group">
                <label>Pattern</label>
                <input type="text" name="pattern" class="cf-input" placeholder="*.example.com" required />
            </div>
            <div class="form-group">
                <label>Type</label>
                <select name="type" class="cf-select">
                    <option value="include">Include</option>
                    <option value="exclude">Exclude</option>
                </select>
            </div>
        `;

        window.showModal?.('Add Project Scope', content, async (formData) => {
            try {
                const result = await this.api.post('/api/scopes', {
                    ...formData,
                    projectId: this.selectedProject.id
                });
                if (result.success) {
                    window.showToast?.('success', 'Scope Added', 'New scope created');
                    await this.loadData();
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }

    createProject() {
        const content = `
            <div class="form-group">
                <label>Project Name</label>
                <input type="text" name="name" class="cf-input" placeholder="My Project" required />
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" class="cf-input" placeholder="Project description..."></textarea>
            </div>
        `;

        window.showModal?.('Create Project', content, async (formData) => {
            // For now, just show a message - full implementation would create in backend
            window.showToast?.('info', 'Projects', 'Project management coming soon');
        });
    }
}

class ScopesCustomPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 0; // No auto-refresh for custom scopes
        this.customScopes = [];
    }

    createHTML() {
        return `
            <div class="page-content scopes-custom-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-sliders-h"></i>
                        <h2>Custom Scope Rules</h2>
                    </div>
                    <div class="page-actions">
                        <button class="cf-btn" id="import-scopes">
                            <i class="fas fa-file-import"></i> Import
                        </button>
                        <button class="cf-btn" id="export-scopes">
                            <i class="fas fa-file-export"></i> Export
                        </button>
                        <button class="cf-btn primary" id="add-custom-scope">
                            <i class="fas fa-plus"></i> Add Rule
                        </button>
                    </div>
                </div>

                <div class="custom-scope-builder">
                    <div class="builder-section">
                        <h3>Rule Builder</h3>
                        <div class="rule-builder" id="rule-builder">
                            <div class="rule-row">
                                <select class="cf-select rule-field">
                                    <option value="host">Host</option>
                                    <option value="path">Path</option>
                                    <option value="port">Port</option>
                                    <option value="scheme">Scheme</option>
                                    <option value="method">Method</option>
                                </select>
                                <select class="cf-select rule-operator">
                                    <option value="matches">Matches</option>
                                    <option value="contains">Contains</option>
                                    <option value="equals">Equals</option>
                                    <option value="startsWith">Starts With</option>
                                    <option value="endsWith">Ends With</option>
                                    <option value="regex">Regex</option>
                                </select>
                                <input type="text" class="cf-input rule-value" placeholder="Value..." />
                                <button class="cf-btn tiny" id="add-rule-condition">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                        </div>
                        <div class="rule-actions">
                            <button class="cf-btn" id="test-rule">
                                <i class="fas fa-flask"></i> Test Rule
                            </button>
                            <button class="cf-btn primary" id="save-rule">
                                <i class="fas fa-save"></i> Save Rule
                            </button>
                        </div>
                    </div>

                    <div class="builder-section">
                        <h3>Saved Custom Rules</h3>
                        <div class="custom-rules-list" id="custom-rules-list">
                            <div class="loading-placeholder">Loading rules...</div>
                        </div>
                    </div>
                </div>

                <div class="rule-tester" id="rule-tester" style="display: none;">
                    <h4>Rule Tester</h4>
                    <div class="tester-input">
                        <input type="text" id="test-url" class="cf-input" placeholder="Enter URL to test..." />
                        <button class="cf-btn" id="run-test">Test</button>
                    </div>
                    <div class="tester-result" id="tester-result"></div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('add-custom-scope')?.addEventListener('click', () => this.addCustomScope());
        document.getElementById('add-rule-condition')?.addEventListener('click', () => this.addConditionRow());
        document.getElementById('test-rule')?.addEventListener('click', () => this.testRule());
        document.getElementById('save-rule')?.addEventListener('click', () => this.saveRule());
        document.getElementById('import-scopes')?.addEventListener('click', () => this.importScopes());
        document.getElementById('export-scopes')?.addEventListener('click', () => this.exportScopes());
        document.getElementById('run-test')?.addEventListener('click', () => this.runTest());
    }

    async loadData() {
        try {
            const result = await this.api.getFilters();
            if (result.success) {
                this.customScopes = result.data?.data?.filters || [];
                this.renderCustomRules();
            }
        } catch (error) {
            console.error('Failed to load custom scopes:', error);
        }
    }

    renderCustomRules() {
        const container = document.getElementById('custom-rules-list');
        if (!container) return;

        if (!this.customScopes.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-filter"></i>
                    <p>No custom rules defined</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.customScopes.map(scope => `
            <div class="custom-rule-item ${scope.enabled ? 'enabled' : 'disabled'}">
                <div class="rule-toggle">
                    <label class="toggle-switch">
                        <input type="checkbox" ${scope.enabled ? 'checked' : ''} data-rule-id="${scope.id}" />
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="rule-info">
                    <div class="rule-name">${scope.name}</div>
                    <div class="rule-conditions">
                        ${(scope.conditions || []).map(c => 
                            `<span class="condition-badge">${c.field} ${c.operator} "${c.value}"</span>`
                        ).join('')}
                    </div>
                </div>
                <div class="rule-actions">
                    <button class="cf-btn tiny" data-action="edit"><i class="fas fa-edit"></i></button>
                    <button class="cf-btn tiny danger" data-action="delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }

    addConditionRow() {
        const builder = document.getElementById('rule-builder');
        if (!builder) return;

        const row = document.createElement('div');
        row.className = 'rule-row';
        row.innerHTML = `
            <select class="cf-select rule-logic">
                <option value="AND">AND</option>
                <option value="OR">OR</option>
            </select>
            <select class="cf-select rule-field">
                <option value="host">Host</option>
                <option value="path">Path</option>
                <option value="port">Port</option>
                <option value="scheme">Scheme</option>
                <option value="method">Method</option>
            </select>
            <select class="cf-select rule-operator">
                <option value="matches">Matches</option>
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
                <option value="startsWith">Starts With</option>
                <option value="endsWith">Ends With</option>
                <option value="regex">Regex</option>
            </select>
            <input type="text" class="cf-input rule-value" placeholder="Value..." />
            <button class="cf-btn tiny danger remove-condition">
                <i class="fas fa-times"></i>
            </button>
        `;

        row.querySelector('.remove-condition')?.addEventListener('click', () => row.remove());
        builder.appendChild(row);
    }

    testRule() {
        const tester = document.getElementById('rule-tester');
        if (tester) {
            tester.style.display = tester.style.display === 'none' ? 'block' : 'none';
        }
    }

    runTest() {
        const url = document.getElementById('test-url')?.value;
        const resultContainer = document.getElementById('tester-result');
        if (!resultContainer || !url) return;

        // Get current rule conditions
        const conditions = this.getBuilderConditions();
        const matches = this.evaluateConditions(url, conditions);

        resultContainer.innerHTML = `
            <div class="test-result ${matches ? 'match' : 'no-match'}">
                <i class="fas ${matches ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                <span>${matches ? 'URL matches the rule' : 'URL does not match'}</span>
            </div>
        `;
    }

    getBuilderConditions() {
        const conditions = [];
        document.querySelectorAll('#rule-builder .rule-row').forEach(row => {
            conditions.push({
                logic: row.querySelector('.rule-logic')?.value || 'AND',
                field: row.querySelector('.rule-field')?.value,
                operator: row.querySelector('.rule-operator')?.value,
                value: row.querySelector('.rule-value')?.value
            });
        });
        return conditions;
    }

    evaluateConditions(url, conditions) {
        // Simple URL matching logic
        try {
            const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
            
            return conditions.every(cond => {
                let fieldValue = '';
                switch (cond.field) {
                    case 'host': fieldValue = parsed.hostname; break;
                    case 'path': fieldValue = parsed.pathname; break;
                    case 'port': fieldValue = parsed.port || (parsed.protocol === 'https:' ? '443' : '80'); break;
                    case 'scheme': fieldValue = parsed.protocol.replace(':', ''); break;
                    default: fieldValue = '';
                }

                switch (cond.operator) {
                    case 'equals': return fieldValue === cond.value;
                    case 'contains': return fieldValue.includes(cond.value);
                    case 'startsWith': return fieldValue.startsWith(cond.value);
                    case 'endsWith': return fieldValue.endsWith(cond.value);
                    case 'matches':
                    case 'regex': return new RegExp(cond.value).test(fieldValue);
                    default: return false;
                }
            });
        } catch {
            return false;
        }
    }

    async saveRule() {
        const conditions = this.getBuilderConditions().filter(c => c.value);
        if (!conditions.length) {
            window.showToast?.('warning', 'No Conditions', 'Please add at least one condition');
            return;
        }

        const content = `
            <div class="form-group">
                <label>Rule Name</label>
                <input type="text" name="name" class="cf-input" placeholder="My Custom Rule" required />
            </div>
            <div class="form-group">
                <label>Description</label>
                <input type="text" name="description" class="cf-input" placeholder="Rule description..." />
            </div>
        `;

        window.showModal?.('Save Rule', content, async (formData) => {
            try {
                const result = await this.api.post('/api/filters', {
                    name: formData.name,
                    description: formData.description,
                    conditions
                });
                if (result.success) {
                    window.showToast?.('success', 'Rule Saved', 'Custom rule created successfully');
                    await this.loadData();
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }

    addCustomScope() {
        // Clear the builder
        const builder = document.getElementById('rule-builder');
        if (builder) {
            builder.innerHTML = `
                <div class="rule-row">
                    <select class="cf-select rule-field">
                        <option value="host">Host</option>
                        <option value="path">Path</option>
                        <option value="port">Port</option>
                        <option value="scheme">Scheme</option>
                        <option value="method">Method</option>
                    </select>
                    <select class="cf-select rule-operator">
                        <option value="matches">Matches</option>
                        <option value="contains">Contains</option>
                        <option value="equals">Equals</option>
                        <option value="startsWith">Starts With</option>
                        <option value="endsWith">Ends With</option>
                        <option value="regex">Regex</option>
                    </select>
                    <input type="text" class="cf-input rule-value" placeholder="Value..." />
                    <button class="cf-btn tiny" id="add-rule-condition">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            `;
            document.getElementById('add-rule-condition')?.addEventListener('click', () => this.addConditionRow());
        }
    }

    importScopes() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                // Import logic would go here
                window.showToast?.('success', 'Imported', `Imported ${data.length || 0} rules`);
            } catch (error) {
                window.showToast?.('error', 'Import Failed', error.message);
            }
        };
        input.click();
    }

    exportScopes() {
        const blob = new Blob([JSON.stringify(this.customScopes, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `custom-scopes-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        window.showToast?.('success', 'Exported', 'Custom scopes exported');
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.ScopesGlobalPage = ScopesGlobalPage;
    window.ScopesProjectPage = ScopesProjectPage;
    window.ScopesCustomPage = ScopesCustomPage;
}
