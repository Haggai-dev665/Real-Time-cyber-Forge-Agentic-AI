/**
 * Testing Section Pages - Workflows, Assistant
 * Connected to backend API for real data
 */

// ========================================
// WORKFLOW PAGES
// ========================================

class WorkflowsActivePage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 5000;
        this.workflows = [];
    }

    createHTML() {
        return `
            <div class="page-content workflows-active-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-project-diagram"></i>
                        <h2>Active Workflows</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="create-workflow">
                            <i class="fas fa-plus"></i> New Workflow
                        </button>
                    </div>
                </div>

                <div class="workflows-stats" id="workflows-stats">
                    <div class="stat-card">
                        <div class="stat-value" id="active-count">0</div>
                        <div class="stat-label">Running</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="paused-count">0</div>
                        <div class="stat-label">Paused</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="completed-count">0</div>
                        <div class="stat-label">Completed Today</div>
                    </div>
                </div>

                <div class="workflows-list" id="workflows-list">
                    <div class="loading-placeholder">Loading workflows...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('create-workflow')?.addEventListener('click', () => this.createWorkflow());
    }

    async loadData() {
        try {
            const result = await this.api.getWorkflows();
            if (result.success) {
                this.workflows = result.data?.data?.workflows || [];
                this.updateStats();
                this.renderWorkflows();
            }
        } catch (error) {
            console.error('Failed to load workflows:', error);
        }
    }

    updateStats() {
        const running = this.workflows.filter(w => w.status === 'running').length;
        const paused = this.workflows.filter(w => w.status === 'paused').length;
        const completed = this.workflows.filter(w => w.status === 'completed').length;

        document.getElementById('active-count').textContent = running;
        document.getElementById('paused-count').textContent = paused;
        document.getElementById('completed-count').textContent = completed;
    }

    renderWorkflows() {
        const container = document.getElementById('workflows-list');
        if (!container) return;

        const active = this.workflows.filter(w => w.status === 'running' || w.status === 'paused');

        if (!active.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-project-diagram"></i>
                    <p>No active workflows</p>
                    <button class="caido-btn primary" onclick="document.getElementById('create-workflow').click()">
                        Create Workflow
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = active.map(workflow => `
            <div class="workflow-card ${workflow.status}" data-workflow-id="${workflow.id}">
                <div class="workflow-header">
                    <h4>${workflow.name}</h4>
                    <span class="workflow-status">${workflow.status}</span>
                </div>
                <div class="workflow-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${workflow.progress || 0}%"></div>
                    </div>
                    <span class="progress-text">${workflow.progress || 0}%</span>
                </div>
                <div class="workflow-info">
                    <span><i class="fas fa-clock"></i> Started: ${this.formatDate(workflow.startedAt)}</span>
                    <span><i class="fas fa-tasks"></i> Step ${workflow.currentStep || 1}/${workflow.totalSteps || 1}</span>
                </div>
                <div class="workflow-actions">
                    ${workflow.status === 'running' ? `
                        <button class="caido-btn small warning" data-action="pause">
                            <i class="fas fa-pause"></i> Pause
                        </button>
                    ` : `
                        <button class="caido-btn small success" data-action="resume">
                            <i class="fas fa-play"></i> Resume
                        </button>
                    `}
                    <button class="caido-btn small danger" data-action="stop">
                        <i class="fas fa-stop"></i> Stop
                    </button>
                    <button class="caido-btn small" data-action="view">
                        <i class="fas fa-eye"></i> View
                    </button>
                </div>
            </div>
        `).join('');

        this.bindWorkflowActions();
    }

    bindWorkflowActions() {
        document.querySelectorAll('.workflow-card').forEach(card => {
            const workflowId = card.dataset.workflowId;

            card.querySelector('[data-action="pause"]')?.addEventListener('click', () => {
                this.updateWorkflowStatus(workflowId, 'paused');
            });

            card.querySelector('[data-action="resume"]')?.addEventListener('click', () => {
                this.updateWorkflowStatus(workflowId, 'running');
            });

            card.querySelector('[data-action="stop"]')?.addEventListener('click', () => {
                this.updateWorkflowStatus(workflowId, 'stopped');
            });
        });
    }

    async updateWorkflowStatus(workflowId, status) {
        try {
            const result = await this.api.put(`/api/workflows/${workflowId}`, { status });
            if (result.success) {
                await this.loadData();
            }
        } catch (error) {
            window.showToast?.('error', 'Failed', error.message);
        }
    }

    createWorkflow() {
        const content = `
            <div class="form-group">
                <label>Workflow Name</label>
                <input type="text" name="name" class="caido-input" required />
            </div>
            <div class="form-group">
                <label>Template</label>
                <select name="template" class="caido-select">
                    <option value="blank">Blank Workflow</option>
                    <option value="auth-test">Authentication Testing</option>
                    <option value="sqli-test">SQL Injection Testing</option>
                    <option value="xss-test">XSS Testing</option>
                    <option value="api-fuzzing">API Fuzzing</option>
                </select>
            </div>
        `;

        window.showModal?.('Create Workflow', content, async (formData) => {
            try {
                const result = await this.api.post('/api/workflows', {
                    name: formData.name,
                    template: formData.template,
                    status: 'paused',
                    steps: []
                });
                if (result.success) {
                    window.showToast?.('success', 'Created', 'Workflow created');
                    await this.loadData();
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }
}

class WorkflowsTemplatesPage extends BasePage {
    constructor() {
        super();
        this.templates = [
            { id: 'auth-test', name: 'Authentication Testing', description: 'Test login, session management, and access control', icon: 'key' },
            { id: 'sqli-test', name: 'SQL Injection Testing', description: 'Automated SQL injection payload testing', icon: 'database' },
            { id: 'xss-test', name: 'XSS Testing', description: 'Cross-site scripting vulnerability testing', icon: 'code' },
            { id: 'api-fuzzing', name: 'API Fuzzing', description: 'Fuzz API endpoints with various payloads', icon: 'random' },
            { id: 'ssrf-test', name: 'SSRF Testing', description: 'Server-side request forgery testing', icon: 'server' },
            { id: 'dir-enum', name: 'Directory Enumeration', description: 'Discover hidden directories and files', icon: 'folder-open' },
            { id: 'param-mining', name: 'Parameter Mining', description: 'Discover hidden parameters', icon: 'search' },
            { id: 'header-injection', name: 'Header Injection', description: 'Test for header injection vulnerabilities', icon: 'heading' }
        ];
    }

    createHTML() {
        return `
            <div class="page-content workflows-templates-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-puzzle-piece"></i>
                        <h2>Workflow Templates</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn" id="import-template">
                            <i class="fas fa-upload"></i> Import
                        </button>
                    </div>
                </div>

                <div class="templates-grid" id="templates-grid">
                    <!-- Templates will be rendered here -->
                </div>
            </div>
        `;
    }

    async loadData() {
        this.renderTemplates();
    }

    renderTemplates() {
        const container = document.getElementById('templates-grid');
        if (!container) return;

        container.innerHTML = this.templates.map(template => `
            <div class="template-card" data-template-id="${template.id}">
                <div class="template-icon">
                    <i class="fas fa-${template.icon}"></i>
                </div>
                <h4>${template.name}</h4>
                <p>${template.description}</p>
                <div class="template-actions">
                    <button class="caido-btn small primary" data-action="use">
                        <i class="fas fa-play"></i> Use Template
                    </button>
                    <button class="caido-btn small" data-action="preview">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.template-card [data-action="use"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const templateId = e.target.closest('.template-card').dataset.templateId;
                this.useTemplate(templateId);
            });
        });
    }

    async useTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;

        const content = `
            <div class="form-group">
                <label>Workflow Name</label>
                <input type="text" name="name" class="caido-input" value="${template.name}" />
            </div>
            <div class="form-group">
                <label>Target Scope</label>
                <input type="text" name="scope" class="caido-input" placeholder="*.example.com" />
            </div>
        `;

        window.showModal?.('Create from Template', content, async (formData) => {
            try {
                const result = await this.api.post('/api/workflows', {
                    name: formData.name,
                    template: templateId,
                    scope: formData.scope,
                    status: 'paused'
                });
                if (result.success) {
                    window.showToast?.('success', 'Created', 'Workflow created from template');
                    window.pageController?.navigateTo('workflows-active');
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });
    }
}

class WorkflowsSchedulePage extends BasePage {
    constructor() {
        super();
        this.scheduled = [];
    }

    createHTML() {
        return `
            <div class="page-content workflows-schedule-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-calendar-alt"></i>
                        <h2>Scheduled Workflows</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="schedule-workflow">
                            <i class="fas fa-plus"></i> Schedule
                        </button>
                    </div>
                </div>

                <div class="schedule-list" id="schedule-list">
                    <div class="loading-placeholder">Loading scheduled workflows...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('schedule-workflow')?.addEventListener('click', () => this.scheduleWorkflow());
    }

    async loadData() {
        try {
            const result = await this.api.getWorkflows();
            if (result.success) {
                this.scheduled = (result.data?.data?.workflows || []).filter(w => w.schedule);
                this.renderSchedule();
            }
        } catch (error) {
            console.error('Failed to load schedule:', error);
        }
    }

    renderSchedule() {
        const container = document.getElementById('schedule-list');
        if (!container) return;

        if (!this.scheduled.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-alt"></i>
                    <p>No scheduled workflows</p>
                    <p class="subtext">Schedule workflows to run automatically</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.scheduled.map(workflow => `
            <div class="schedule-card">
                <div class="schedule-info">
                    <h4>${workflow.name}</h4>
                    <div class="schedule-timing">
                        <i class="fas fa-clock"></i>
                        ${workflow.schedule?.cron || workflow.schedule?.interval || 'Not set'}
                    </div>
                    <div class="schedule-next">
                        Next run: ${workflow.nextRun ? this.formatDate(workflow.nextRun) : 'Unknown'}
                    </div>
                </div>
                <div class="schedule-toggle">
                    <label class="switch">
                        <input type="checkbox" ${workflow.schedule?.enabled ? 'checked' : ''} />
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
        `).join('');
    }

    scheduleWorkflow() {
        const content = `
            <div class="form-group">
                <label>Select Workflow</label>
                <select name="workflowId" class="caido-select" id="schedule-workflow-select">
                    <option value="">Loading...</option>
                </select>
            </div>
            <div class="form-group">
                <label>Schedule Type</label>
                <select name="scheduleType" class="caido-select">
                    <option value="interval">Interval</option>
                    <option value="cron">Cron Expression</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                </select>
            </div>
            <div class="form-group">
                <label>Value</label>
                <input type="text" name="value" class="caido-input" placeholder="e.g., 30m or 0 0 * * *" />
            </div>
        `;

        window.showModal?.('Schedule Workflow', content, async (formData) => {
            try {
                const result = await this.api.put(`/api/workflows/${formData.workflowId}`, {
                    schedule: {
                        type: formData.scheduleType,
                        value: formData.value,
                        enabled: true
                    }
                });
                if (result.success) {
                    window.showToast?.('success', 'Scheduled', 'Workflow scheduled');
                    await this.loadData();
                }
            } catch (error) {
                window.showToast?.('error', 'Failed', error.message);
            }
        });

        // Load workflows for dropdown
        this.api.getWorkflows().then(result => {
            const select = document.getElementById('schedule-workflow-select');
            if (select && result.success) {
                const workflows = result.data?.data?.workflows || [];
                select.innerHTML = workflows.map(w => 
                    `<option value="${w.id}">${w.name}</option>`
                ).join('') || '<option value="">No workflows</option>';
            }
        });
    }
}

// ========================================
// ASSISTANT PAGES
// ========================================

class AssistantChatPage extends BasePage {
    constructor() {
        super();
        this.messages = [];
        this.sessionId = null;
    }

    createHTML() {
        return `
            <div class="page-content assistant-chat-page">
                <div class="chat-container">
                    <div class="chat-header">
                        <div class="assistant-info">
                            <i class="fas fa-robot"></i>
                            <span>Security Assistant</span>
                            <span class="status online">Online</span>
                        </div>
                        <button class="caido-btn small" id="new-chat">
                            <i class="fas fa-plus"></i> New Chat
                        </button>
                    </div>
                    
                    <div class="chat-messages" id="chat-messages">
                        <div class="welcome-message">
                            <i class="fas fa-robot"></i>
                            <h3>Security Assistant</h3>
                            <p>I can help you with security testing, vulnerability analysis, and more.</p>
                            <div class="quick-actions">
                                <button class="quick-action" data-prompt="Analyze the current request for vulnerabilities">
                                    <i class="fas fa-search"></i> Analyze Request
                                </button>
                                <button class="quick-action" data-prompt="Generate test payloads for the selected endpoint">
                                    <i class="fas fa-bomb"></i> Generate Payloads
                                </button>
                                <button class="quick-action" data-prompt="Explain the current response">
                                    <i class="fas fa-info-circle"></i> Explain Response
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="chat-input-container">
                        <textarea id="chat-input" placeholder="Ask me anything about security testing..." rows="1"></textarea>
                        <button class="caido-btn primary" id="send-message">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('send-message')?.addEventListener('click', () => this.sendMessage());
        document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        document.getElementById('new-chat')?.addEventListener('click', () => this.newChat());

        document.querySelectorAll('.quick-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.dataset.prompt;
                document.getElementById('chat-input').value = prompt;
                this.sendMessage();
            });
        });
    }

    async loadData() {
        try {
            const result = await this.api.get('/api/ai/chat/history');
            if (result.success && result.data?.messages) {
                this.messages = result.data.messages;
                this.renderMessages();
            }
        } catch (error) {
            console.log('No chat history');
        }
    }

    renderMessages() {
        const container = document.getElementById('chat-messages');
        if (!container || !this.messages.length) return;

        container.innerHTML = this.messages.map(msg => `
            <div class="chat-message ${msg.role}">
                <div class="message-avatar">
                    <i class="fas fa-${msg.role === 'user' ? 'user' : 'robot'}"></i>
                </div>
                <div class="message-content">
                    <div class="message-text">${this.formatMessage(msg.content)}</div>
                    <div class="message-time">${this.formatDate(msg.timestamp)}</div>
                </div>
            </div>
        `).join('');

        container.scrollTop = container.scrollHeight;
    }

    formatMessage(content) {
        // Simple markdown-like formatting
        return content
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input?.value?.trim();
        if (!message) return;

        // Add user message
        this.messages.push({ role: 'user', content: message, timestamp: new Date() });
        this.renderMessages();
        input.value = '';

        // Show typing indicator
        const container = document.getElementById('chat-messages');
        container.innerHTML += `
            <div class="chat-message assistant typing">
                <div class="message-avatar"><i class="fas fa-robot"></i></div>
                <div class="message-content">
                    <div class="typing-indicator"><span></span><span></span><span></span></div>
                </div>
            </div>
        `;
        container.scrollTop = container.scrollHeight;

        try {
            const result = await this.api.post('/api/ai/chat', {
                message,
                sessionId: this.sessionId,
                context: {
                    currentPage: window.pageController?.currentPage,
                    // Add more context as needed
                }
            });

            // Remove typing indicator
            const typingEl = container.querySelector('.typing');
            if (typingEl) typingEl.remove();

            if (result.success && result.data?.response) {
                this.sessionId = result.data.sessionId;
                this.messages.push({
                    role: 'assistant',
                    content: result.data.response,
                    timestamp: new Date()
                });
                this.renderMessages();
            } else {
                throw new Error('No response from assistant');
            }
        } catch (error) {
            const typingEl = container.querySelector('.typing');
            if (typingEl) typingEl.remove();

            this.messages.push({
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date()
            });
            this.renderMessages();
        }
    }

    newChat() {
        this.messages = [];
        this.sessionId = null;
        document.getElementById('chat-messages').innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-robot"></i>
                <h3>Security Assistant</h3>
                <p>Started a new conversation.</p>
            </div>
        `;
    }
}

class AssistantSuggestionsPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 30000;
        this.suggestions = [];
    }

    createHTML() {
        return `
            <div class="page-content assistant-suggestions-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-lightbulb"></i>
                        <h2>AI Suggestions</h2>
                    </div>
                    <div class="page-actions">
                        <button class="caido-btn primary" id="generate-suggestions">
                            <i class="fas fa-sync"></i> Generate New
                        </button>
                    </div>
                </div>

                <div class="suggestions-list" id="suggestions-list">
                    <div class="loading-placeholder">Analyzing your requests...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('generate-suggestions')?.addEventListener('click', () => this.generateSuggestions());
    }

    async loadData() {
        try {
            const result = await this.api.get('/api/ai/suggestions');
            if (result.success) {
                this.suggestions = result.data?.suggestions || [];
                this.renderSuggestions();
            }
        } catch (error) {
            this.renderDefaultSuggestions();
        }
    }

    renderSuggestions() {
        const container = document.getElementById('suggestions-list');
        if (!container) return;

        if (!this.suggestions.length) {
            this.renderDefaultSuggestions();
            return;
        }

        container.innerHTML = this.suggestions.map((suggestion, i) => `
            <div class="suggestion-card" data-suggestion-id="${i}">
                <div class="suggestion-icon ${suggestion.severity || 'info'}">
                    <i class="fas fa-${this.getSuggestionIcon(suggestion.type)}"></i>
                </div>
                <div class="suggestion-content">
                    <h4>${suggestion.title}</h4>
                    <p>${suggestion.description}</p>
                    ${suggestion.endpoint ? `<code>${suggestion.endpoint}</code>` : ''}
                </div>
                <div class="suggestion-actions">
                    <button class="caido-btn small primary" data-action="apply">
                        <i class="fas fa-check"></i> Apply
                    </button>
                    <button class="caido-btn small" data-action="dismiss">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderDefaultSuggestions() {
        const container = document.getElementById('suggestions-list');
        if (!container) return;

        container.innerHTML = `
            <div class="suggestion-card">
                <div class="suggestion-icon warning">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="suggestion-content">
                    <h4>Test for SQL Injection</h4>
                    <p>Several endpoints accept user input without apparent sanitization. Consider testing with SQL injection payloads.</p>
                </div>
                <div class="suggestion-actions">
                    <button class="caido-btn small primary">
                        <i class="fas fa-play"></i> Run Test
                    </button>
                </div>
            </div>
            <div class="suggestion-card">
                <div class="suggestion-icon info">
                    <i class="fas fa-cookie"></i>
                </div>
                <div class="suggestion-content">
                    <h4>Check Cookie Security</h4>
                    <p>Some cookies are missing HttpOnly and Secure flags. Review session management.</p>
                </div>
                <div class="suggestion-actions">
                    <button class="caido-btn small primary">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                </div>
            </div>
        `;
    }

    getSuggestionIcon(type) {
        const icons = {
            'vulnerability': 'bug',
            'performance': 'tachometer-alt',
            'security': 'shield-alt',
            'best-practice': 'check-circle'
        };
        return icons[type] || 'lightbulb';
    }

    async generateSuggestions() {
        window.showToast?.('info', 'Analyzing', 'Generating AI suggestions...');
        await this.loadData();
        window.showToast?.('success', 'Complete', 'Suggestions updated');
    }
}

class AssistantActionsPage extends BasePage {
    constructor() {
        super();
        this.actions = [
            { id: 'scan-vulnerabilities', name: 'Scan for Vulnerabilities', icon: 'bug', description: 'Automated vulnerability scanning' },
            { id: 'generate-payloads', name: 'Generate Payloads', icon: 'bomb', description: 'AI-powered payload generation' },
            { id: 'analyze-headers', name: 'Analyze Headers', icon: 'heading', description: 'Security header analysis' },
            { id: 'find-secrets', name: 'Find Secrets', icon: 'key', description: 'Detect exposed secrets' },
            { id: 'map-api', name: 'Map API', icon: 'sitemap', description: 'Automatic API discovery' },
            { id: 'auth-test', name: 'Test Authentication', icon: 'lock', description: 'Authentication bypass testing' }
        ];
    }

    createHTML() {
        return `
            <div class="page-content assistant-actions-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-bolt"></i>
                        <h2>Quick Actions</h2>
                    </div>
                </div>

                <div class="actions-grid" id="actions-grid">
                    <!-- Actions will be rendered here -->
                </div>

                <div class="action-output" id="action-output">
                    <div class="empty-state small">
                        <p>Select an action to run</p>
                    </div>
                </div>
            </div>
        `;
    }

    async loadData() {
        this.renderActions();
    }

    renderActions() {
        const container = document.getElementById('actions-grid');
        if (!container) return;

        container.innerHTML = this.actions.map(action => `
            <div class="action-card" data-action-id="${action.id}">
                <div class="action-icon">
                    <i class="fas fa-${action.icon}"></i>
                </div>
                <div class="action-info">
                    <h4>${action.name}</h4>
                    <p>${action.description}</p>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', () => {
                this.runAction(card.dataset.actionId);
            });
        });
    }

    async runAction(actionId) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action) return;

        const output = document.getElementById('action-output');
        output.innerHTML = `
            <div class="action-running">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Running ${action.name}...</p>
            </div>
        `;

        try {
            const result = await this.api.post('/api/ai/action', { action: actionId });
            
            output.innerHTML = `
                <div class="action-result">
                    <h4>${action.name} - Complete</h4>
                    <pre>${JSON.stringify(result.data || { status: 'completed' }, null, 2)}</pre>
                </div>
            `;
        } catch (error) {
            output.innerHTML = `
                <div class="action-result error">
                    <h4>${action.name} - Error</h4>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.WorkflowsActivePage = WorkflowsActivePage;
    window.WorkflowsTemplatesPage = WorkflowsTemplatesPage;
    window.WorkflowsSchedulePage = WorkflowsSchedulePage;
    window.AssistantChatPage = AssistantChatPage;
    window.AssistantSuggestionsPage = AssistantSuggestionsPage;
    window.AssistantActionsPage = AssistantActionsPage;
}
