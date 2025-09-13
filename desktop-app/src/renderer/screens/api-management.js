/**
 * API Management Screen
 * Provides interface for managing backend API connections and configurations
 */

class APIManagementScreen {
    constructor() {
        this.apis = new Map();
        this.testResults = new Map();
        this.init();
    }

    init() {
        this.loadAPIConfigs();
        this.setupEventListeners();
    }

    render() {
        return `
            <div class="screen-content api-management-screen">
                <div class="screen-header">
                    <div class="header-content">
                        <h1>
                            <i class="fas fa-code"></i>
                            API Management
                        </h1>
                        <p>Configure and manage backend API connections</p>
                    </div>
                    <div class="header-actions">
                        <button class="btn btn-primary" id="add-api-btn">
                            <i class="fas fa-plus"></i>
                            Add API Endpoint
                        </button>
                        <button class="btn btn-secondary" id="test-all-apis-btn">
                            <i class="fas fa-vial"></i>
                            Test All APIs
                        </button>
                    </div>
                </div>

                <div class="api-grid">
                    <!-- Backend Services -->
                    <div class="api-category">
                        <h3>
                            <i class="fas fa-server"></i>
                            Backend Services
                        </h3>
                        <div class="api-cards" id="backend-apis">
                            ${this.renderAPICard('backend-health', {
                                name: 'Backend Health Check',
                                url: 'http://localhost:8000/health',
                                method: 'GET',
                                status: 'unknown',
                                description: 'Main backend service health monitoring'
                            })}
                            ${this.renderAPICard('backend-websocket', {
                                name: 'WebSocket Connection',
                                url: 'ws://localhost:8000/ws',
                                method: 'WS',
                                status: 'unknown',
                                description: 'Real-time communication channel'
                            })}
                            ${this.renderAPICard('backend-analytics', {
                                name: 'Analytics API',
                                url: 'http://localhost:8000/api/analytics',
                                method: 'POST',
                                status: 'unknown',
                                description: 'Send browsing data for analysis'
                            })}
                        </div>
                    </div>

                    <!-- ML Services -->
                    <div class="api-category">
                        <h3>
                            <i class="fas fa-brain"></i>
                            Machine Learning Services
                        </h3>
                        <div class="api-cards" id="ml-apis">
                            ${this.renderAPICard('ml-health', {
                                name: 'ML Service Health',
                                url: 'http://127.0.0.1:8001/health',
                                method: 'GET',
                                status: 'unknown',
                                description: 'AI/ML service availability check'
                            })}
                            ${this.renderAPICard('ml-analyze', {
                                name: 'AI Analysis',
                                url: 'http://127.0.0.1:8001/analyze',
                                method: 'POST',
                                status: 'unknown',
                                description: 'AI-powered content analysis'
                            })}
                            ${this.renderAPICard('ml-threat-scan', {
                                name: 'Threat Scanning',
                                url: 'http://127.0.0.1:8001/scan-threats',
                                method: 'POST',
                                status: 'unknown',
                                description: 'AI threat detection and scanning'
                            })}
                            ${this.renderAPICard('ml-url-analysis', {
                                name: 'URL Analysis',
                                url: 'http://127.0.0.1:8001/analyze-url',
                                method: 'POST',
                                status: 'unknown',
                                description: 'Deep URL security analysis'
                            })}
                        </div>
                    </div>

                    <!-- External Services -->
                    <div class="api-category">
                        <h3>
                            <i class="fas fa-globe"></i>
                            External Services
                        </h3>
                        <div class="api-cards" id="external-apis">
                            ${this.renderAPICard('virustotal', {
                                name: 'VirusTotal API',
                                url: 'https://www.virustotal.com/vtapi/v2/',
                                method: 'POST',
                                status: 'unknown',
                                description: 'Malware and URL reputation checking'
                            })}
                            ${this.renderAPICard('shodan', {
                                name: 'Shodan Search API',
                                url: 'https://api.shodan.io/',
                                method: 'GET',
                                status: 'unknown',
                                description: 'Internet device and vulnerability search'
                            })}
                        </div>
                    </div>
                </div>

                <!-- API Configuration Modal -->
                <div id="api-config-modal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Configure API Endpoint</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <form id="api-config-form">
                            <div class="form-group">
                                <label for="api-name">API Name</label>
                                <input type="text" id="api-name" required>
                            </div>
                            <div class="form-group">
                                <label for="api-url">URL Endpoint</label>
                                <input type="url" id="api-url" required>
                            </div>
                            <div class="form-group">
                                <label for="api-method">HTTP Method</label>
                                <select id="api-method">
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="DELETE">DELETE</option>
                                    <option value="WS">WebSocket</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="api-headers">Headers (JSON)</label>
                                <textarea id="api-headers" placeholder='{"Content-Type": "application/json"}'></textarea>
                            </div>
                            <div class="form-group">
                                <label for="api-auth">Authentication</label>
                                <select id="api-auth">
                                    <option value="none">None</option>
                                    <option value="bearer">Bearer Token</option>
                                    <option value="api-key">API Key</option>
                                    <option value="basic">Basic Auth</option>
                                </select>
                            </div>
                            <div class="form-group auth-field" id="auth-token-field" style="display: none;">
                                <label for="auth-token">Token/Key</label>
                                <input type="password" id="auth-token">
                            </div>
                            <div class="form-group">
                                <label for="api-description">Description</label>
                                <textarea id="api-description"></textarea>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" id="test-api-btn">
                                    <i class="fas fa-vial"></i>
                                    Test Connection
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save"></i>
                                    Save Configuration
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- API Test Results -->
                <div class="api-test-results" id="api-test-results" style="display: none;">
                    <h3>Test Results</h3>
                    <div class="test-output">
                        <pre id="test-output-content"></pre>
                    </div>
                </div>
            </div>
        `;
    }

    renderAPICard(id, config) {
        const statusClass = config.status === 'online' ? 'success' : 
                           config.status === 'offline' ? 'error' : 'warning';
        
        return `
            <div class="api-card" data-api-id="${id}">
                <div class="api-card-header">
                    <div class="api-info">
                        <h4>${config.name}</h4>
                        <span class="api-method method-${config.method.toLowerCase()}">${config.method}</span>
                    </div>
                    <div class="api-status status-${statusClass}">
                        <i class="fas fa-circle"></i>
                        <span>${config.status}</span>
                    </div>
                </div>
                <div class="api-card-content">
                    <p class="api-url">${config.url}</p>
                    <p class="api-description">${config.description}</p>
                </div>
                <div class="api-card-actions">
                    <button class="btn btn-sm btn-ghost test-api-btn" data-api-id="${id}">
                        <i class="fas fa-play"></i>
                        Test
                    </button>
                    <button class="btn btn-sm btn-ghost edit-api-btn" data-api-id="${id}">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="btn btn-sm btn-ghost delete-api-btn" data-api-id="${id}">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.matches('#add-api-btn')) {
                this.showAPIConfigModal();
            }
            if (e.target.matches('#test-all-apis-btn')) {
                this.testAllAPIs();
            }
            if (e.target.matches('.test-api-btn')) {
                const apiId = e.target.dataset.apiId;
                this.testAPI(apiId);
            }
            if (e.target.matches('.edit-api-btn')) {
                const apiId = e.target.dataset.apiId;
                this.editAPI(apiId);
            }
            if (e.target.matches('.delete-api-btn')) {
                const apiId = e.target.dataset.apiId;
                this.deleteAPI(apiId);
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.matches('#api-auth')) {
                this.toggleAuthFields(e.target.value);
            }
        });

        document.addEventListener('submit', (e) => {
            if (e.target.matches('#api-config-form')) {
                e.preventDefault();
                this.saveAPIConfig();
            }
        });
    }

    async loadAPIConfigs() {
        // Load API configurations from storage
        try {
            const configs = await window.electronAPI.invoke('get-api-configs');
            this.apis = new Map(Object.entries(configs || {}));
            this.updateAPIStatuses();
        } catch (error) {
            console.error('Failed to load API configs:', error);
        }
    }

    async updateAPIStatuses() {
        // Test all APIs and update their status
        for (const [id, config] of this.apis) {
            const status = await this.testAPIConnection(config);
            this.updateAPIStatus(id, status);
        }
    }

    async testAPIConnection(config) {
        try {
            const response = await fetch(config.url, {
                method: config.method === 'WS' ? 'GET' : config.method,
                headers: config.headers || {},
                signal: AbortSignal.timeout(5000)
            });
            return response.ok ? 'online' : 'offline';
        } catch (error) {
            return 'offline';
        }
    }

    updateAPIStatus(apiId, status) {
        const card = document.querySelector(`[data-api-id="${apiId}"]`);
        if (card) {
            const statusElement = card.querySelector('.api-status');
            statusElement.className = `api-status status-${status === 'online' ? 'success' : 'error'}`;
            statusElement.querySelector('span').textContent = status;
        }
    }

    showAPIConfigModal(apiConfig = null) {
        const modal = document.getElementById('api-config-modal');
        if (apiConfig) {
            // Fill form with existing config
            document.getElementById('api-name').value = apiConfig.name;
            document.getElementById('api-url').value = apiConfig.url;
            document.getElementById('api-method').value = apiConfig.method;
            document.getElementById('api-headers').value = JSON.stringify(apiConfig.headers || {}, null, 2);
            document.getElementById('api-description').value = apiConfig.description;
        }
        modal.style.display = 'flex';
    }

    async testAPI(apiId) {
        const config = this.apis.get(apiId);
        if (!config) return;

        const button = document.querySelector(`[data-api-id="${apiId}"] .test-api-btn`);
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
        button.disabled = true;

        try {
            const result = await this.testAPIConnection(config);
            this.updateAPIStatus(apiId, result);
            this.showTestResults(apiId, result);
        } catch (error) {
            this.updateAPIStatus(apiId, 'error');
            this.showTestResults(apiId, 'error', error.message);
        } finally {
            button.innerHTML = '<i class="fas fa-play"></i> Test';
            button.disabled = false;
        }
    }

    async testAllAPIs() {
        const button = document.getElementById('test-all-apis-btn');
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
        button.disabled = true;

        try {
            await this.updateAPIStatuses();
        } finally {
            button.innerHTML = '<i class="fas fa-vial"></i> Test All APIs';
            button.disabled = false;
        }
    }

    showTestResults(apiId, status, error = null) {
        const resultsContainer = document.getElementById('api-test-results');
        const outputContent = document.getElementById('test-output-content');
        
        const timestamp = new Date().toISOString();
        const result = {
            apiId,
            status,
            timestamp,
            error: error || null
        };

        outputContent.textContent = JSON.stringify(result, null, 2);
        resultsContainer.style.display = 'block';
    }

    toggleAuthFields(authType) {
        const tokenField = document.getElementById('auth-token-field');
        tokenField.style.display = authType === 'none' ? 'none' : 'block';
        
        const label = tokenField.querySelector('label');
        switch (authType) {
            case 'bearer':
                label.textContent = 'Bearer Token';
                break;
            case 'api-key':
                label.textContent = 'API Key';
                break;
            case 'basic':
                label.textContent = 'Base64 Credentials';
                break;
        }
    }

    async saveAPIConfig() {
        const formData = new FormData(document.getElementById('api-config-form'));
        const config = {
            name: formData.get('api-name'),
            url: formData.get('api-url'),
            method: formData.get('api-method'),
            headers: JSON.parse(formData.get('api-headers') || '{}'),
            auth: formData.get('api-auth'),
            description: formData.get('api-description')
        };

        try {
            await window.electronAPI.invoke('save-api-config', config);
            this.loadAPIConfigs();
            document.getElementById('api-config-modal').style.display = 'none';
        } catch (error) {
            console.error('Failed to save API config:', error);
        }
    }

    editAPI(apiId) {
        const config = this.apis.get(apiId);
        if (config) {
            this.showAPIConfigModal(config);
        }
    }

    async deleteAPI(apiId) {
        if (confirm('Are you sure you want to delete this API configuration?')) {
            try {
                await window.electronAPI.invoke('delete-api-config', apiId);
                this.loadAPIConfigs();
            } catch (error) {
                console.error('Failed to delete API config:', error);
            }
        }
    }
}

// Register screen
window.APIManagementScreen = APIManagementScreen;