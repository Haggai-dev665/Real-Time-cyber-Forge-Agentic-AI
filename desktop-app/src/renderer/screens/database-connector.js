/**
 * Database Connector Screen
 * Provides interface for managing database connections and configurations
 */

class DatabaseConnectorScreen {
    constructor() {
        this.connections = new Map();
        this.queryHistory = [];
        this.init();
    }

    init() {
        this.loadDatabaseConfigs();
        this.setupEventListeners();
    }

    render() {
        return `
            <div class="screen-content database-connector-screen">
                <div class="screen-header">
                    <div class="header-content">
                        <h1>
                            <i class="fas fa-database"></i>
                            Database Connector
                        </h1>
                        <p>Manage database connections and execute queries</p>
                    </div>
                    <div class="header-actions">
                        <button class="btn btn-primary" id="add-connection-btn">
                            <i class="fas fa-plus"></i>
                            Add Connection
                        </button>
                        <button class="btn btn-secondary" id="test-all-connections-btn">
                            <i class="fas fa-link"></i>
                            Test All Connections
                        </button>
                    </div>
                </div>

                <div class="database-layout">
                    <!-- Connection Panel -->
                    <div class="connections-panel">
                        <h3>
                            <i class="fas fa-server"></i>
                            Database Connections
                        </h3>
                        <div class="connection-list" id="connection-list">
                            ${this.renderConnectionCard('primary-db', {
                                name: 'Primary PostgreSQL',
                                type: 'postgresql',
                                host: 'localhost',
                                port: 5432,
                                database: 'cyber_forge',
                                status: 'unknown'
                            })}
                            ${this.renderConnectionCard('redis-cache', {
                                name: 'Redis Cache',
                                type: 'redis',
                                host: 'localhost',
                                port: 6379,
                                database: '0',
                                status: 'unknown'
                            })}
                            ${this.renderConnectionCard('analytics-db', {
                                name: 'Analytics MongoDB',
                                type: 'mongodb',
                                host: 'localhost',
                                port: 27017,
                                database: 'analytics',
                                status: 'unknown'
                            })}
                        </div>
                    </div>

                    <!-- Query Panel -->
                    <div class="query-panel">
                        <div class="query-header">
                            <h3>
                                <i class="fas fa-terminal"></i>
                                Query Console
                            </h3>
                            <div class="query-actions">
                                <select id="active-connection">
                                    <option value="">Select Connection</option>
                                    <option value="primary-db">Primary PostgreSQL</option>
                                    <option value="redis-cache">Redis Cache</option>
                                    <option value="analytics-db">Analytics MongoDB</option>
                                </select>
                                <button class="btn btn-sm btn-primary" id="execute-query-btn">
                                    <i class="fas fa-play"></i>
                                    Execute
                                </button>
                                <button class="btn btn-sm btn-secondary" id="save-query-btn">
                                    <i class="fas fa-save"></i>
                                    Save
                                </button>
                            </div>
                        </div>
                        
                        <div class="query-editor">
                            <textarea id="query-input" placeholder="Enter your query here...
                            
Examples:
PostgreSQL: SELECT * FROM users WHERE created_at > NOW() - INTERVAL '1 day';
Redis: GET user:123
MongoDB: db.events.find({timestamp: {\$gte: new Date(Date.now() - 86400000)}})"></textarea>
                        </div>

                        <div class="query-results" id="query-results">
                            <div class="results-header">
                                <h4>Query Results</h4>
                                <div class="results-actions">
                                    <button class="btn btn-sm btn-ghost" id="export-results-btn">
                                        <i class="fas fa-download"></i>
                                        Export
                                    </button>
                                    <button class="btn btn-sm btn-ghost" id="clear-results-btn">
                                        <i class="fas fa-trash"></i>
                                        Clear
                                    </button>
                                </div>
                            </div>
                            <div class="results-content" id="results-content">
                                <p class="no-results">No query executed yet</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Query History -->
                <div class="query-history-panel">
                    <h3>
                        <i class="fas fa-history"></i>
                        Query History
                    </h3>
                    <div class="history-list" id="history-list">
                        <div class="no-history">No queries in history</div>
                    </div>
                </div>

                <!-- Connection Configuration Modal -->
                <div id="connection-config-modal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Database Connection Configuration</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <form id="connection-config-form">
                            <div class="form-group">
                                <label for="connection-name">Connection Name</label>
                                <input type="text" id="connection-name" required>
                            </div>
                            <div class="form-group">
                                <label for="database-type">Database Type</label>
                                <select id="database-type" required>
                                    <option value="postgresql">PostgreSQL</option>
                                    <option value="mysql">MySQL</option>
                                    <option value="mongodb">MongoDB</option>
                                    <option value="redis">Redis</option>
                                    <option value="sqlite">SQLite</option>
                                    <option value="elasticsearch">Elasticsearch</option>
                                </select>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="db-host">Host</label>
                                    <input type="text" id="db-host" value="localhost" required>
                                </div>
                                <div class="form-group">
                                    <label for="db-port">Port</label>
                                    <input type="number" id="db-port" value="5432" required>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="database-name">Database Name</label>
                                <input type="text" id="database-name" required>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="db-username">Username</label>
                                    <input type="text" id="db-username">
                                </div>
                                <div class="form-group">
                                    <label for="db-password">Password</label>
                                    <input type="password" id="db-password">
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="connection-options">Additional Options (JSON)</label>
                                <textarea id="connection-options" placeholder='{"ssl": true, "timeout": 30000}'></textarea>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" id="test-connection-btn">
                                    <i class="fas fa-link"></i>
                                    Test Connection
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save"></i>
                                    Save Connection
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    renderConnectionCard(id, config) {
        const statusClass = config.status === 'connected' ? 'success' : 
                           config.status === 'disconnected' ? 'error' : 'warning';
        
        const typeIcon = {
            'postgresql': 'fas fa-elephant',
            'mysql': 'fas fa-database',
            'mongodb': 'fas fa-leaf',
            'redis': 'fas fa-cube',
            'sqlite': 'fas fa-file-archive',
            'elasticsearch': 'fas fa-search'
        }[config.type] || 'fas fa-database';

        return `
            <div class="connection-card" data-connection-id="${id}">
                <div class="connection-header">
                    <div class="connection-info">
                        <i class="${typeIcon}"></i>
                        <div>
                            <h4>${config.name}</h4>
                            <span class="connection-details">${config.host}:${config.port}/${config.database}</span>
                        </div>
                    </div>
                    <div class="connection-status status-${statusClass}">
                        <i class="fas fa-circle"></i>
                        <span>${config.status}</span>
                    </div>
                </div>
                <div class="connection-actions">
                    <button class="btn btn-sm btn-ghost connect-btn" data-connection-id="${id}">
                        <i class="fas fa-plug"></i>
                        Connect
                    </button>
                    <button class="btn btn-sm btn-ghost edit-connection-btn" data-connection-id="${id}">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="btn btn-sm btn-ghost delete-connection-btn" data-connection-id="${id}">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.matches('#add-connection-btn')) {
                this.showConnectionConfigModal();
            }
            if (e.target.matches('#test-all-connections-btn')) {
                this.testAllConnections();
            }
            if (e.target.matches('#execute-query-btn')) {
                this.executeQuery();
            }
            if (e.target.matches('#save-query-btn')) {
                this.saveQuery();
            }
            if (e.target.matches('#export-results-btn')) {
                this.exportResults();
            }
            if (e.target.matches('#clear-results-btn')) {
                this.clearResults();
            }
            if (e.target.matches('.connect-btn')) {
                const connectionId = e.target.dataset.connectionId;
                this.connectToDatabase(connectionId);
            }
            if (e.target.matches('.edit-connection-btn')) {
                const connectionId = e.target.dataset.connectionId;
                this.editConnection(connectionId);
            }
            if (e.target.matches('.delete-connection-btn')) {
                const connectionId = e.target.dataset.connectionId;
                this.deleteConnection(connectionId);
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.matches('#database-type')) {
                this.updatePortForDatabaseType(e.target.value);
            }
        });

        document.addEventListener('submit', (e) => {
            if (e.target.matches('#connection-config-form')) {
                e.preventDefault();
                this.saveConnectionConfig();
            }
        });

        // Auto-resize query input
        document.addEventListener('input', (e) => {
            if (e.target.matches('#query-input')) {
                e.target.style.height = 'auto';
                e.target.style.height = (e.target.scrollHeight) + 'px';
            }
        });
    }

    async loadDatabaseConfigs() {
        try {
            const configs = await window.electronAPI.invoke('get-database-configs');
            this.connections = new Map(Object.entries(configs || {}));
            this.updateConnectionStatuses();
        } catch (error) {
            console.error('Failed to load database configs:', error);
        }
    }

    async updateConnectionStatuses() {
        for (const [id, config] of this.connections) {
            const status = await this.testDatabaseConnection(config);
            this.updateConnectionStatus(id, status);
        }
    }

    async testDatabaseConnection(config) {
        try {
            const result = await window.electronAPI.invoke('test-database-connection', config);
            return result.success ? 'connected' : 'disconnected';
        } catch (error) {
            console.error('Database connection test failed:', error);
            return 'disconnected';
        }
    }

    updateConnectionStatus(connectionId, status) {
        const card = document.querySelector(`[data-connection-id="${connectionId}"]`);
        if (card) {
            const statusElement = card.querySelector('.connection-status');
            const statusClass = status === 'connected' ? 'success' : 'error';
            statusElement.className = `connection-status status-${statusClass}`;
            statusElement.querySelector('span').textContent = status;
        }
    }

    showConnectionConfigModal(connectionConfig = null) {
        const modal = document.getElementById('connection-config-modal');
        if (connectionConfig) {
            // Fill form with existing config
            document.getElementById('connection-name').value = connectionConfig.name;
            document.getElementById('database-type').value = connectionConfig.type;
            document.getElementById('db-host').value = connectionConfig.host;
            document.getElementById('db-port').value = connectionConfig.port;
            document.getElementById('database-name').value = connectionConfig.database;
            document.getElementById('db-username').value = connectionConfig.username || '';
            document.getElementById('connection-options').value = JSON.stringify(connectionConfig.options || {}, null, 2);
        }
        modal.style.display = 'flex';
    }

    updatePortForDatabaseType(type) {
        const portDefaults = {
            'postgresql': 5432,
            'mysql': 3306,
            'mongodb': 27017,
            'redis': 6379,
            'sqlite': '',
            'elasticsearch': 9200
        };
        
        const portField = document.getElementById('db-port');
        portField.value = portDefaults[type] || '';
    }

    async executeQuery() {
        const connectionId = document.getElementById('active-connection').value;
        const query = document.getElementById('query-input').value.trim();
        
        if (!connectionId) {
            this.showError('Please select a database connection');
            return;
        }
        
        if (!query) {
            this.showError('Please enter a query');
            return;
        }

        const executeBtn = document.getElementById('execute-query-btn');
        executeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Executing...';
        executeBtn.disabled = true;

        try {
            const result = await window.electronAPI.invoke('execute-database-query', {
                connectionId,
                query
            });

            this.displayQueryResults(result);
            this.addToQueryHistory(connectionId, query, result);
        } catch (error) {
            this.displayQueryError(error.message);
        } finally {
            executeBtn.innerHTML = '<i class="fas fa-play"></i> Execute';
            executeBtn.disabled = false;
        }
    }

    displayQueryResults(result) {
        const resultsContent = document.getElementById('results-content');
        
        if (result.rows && result.rows.length > 0) {
            // Display table results
            const table = this.createResultsTable(result.rows, result.fields);
            resultsContent.innerHTML = `
                <div class="results-meta">
                    <span>Rows: ${result.rows.length}</span>
                    <span>Execution Time: ${result.executionTime || 'N/A'}</span>
                </div>
                ${table}
            `;
        } else if (result.result) {
            // Display non-tabular results
            resultsContent.innerHTML = `
                <div class="results-meta">
                    <span>Result: ${result.rowCount || 0} rows affected</span>
                    <span>Execution Time: ${result.executionTime || 'N/A'}</span>
                </div>
                <pre>${JSON.stringify(result.result, null, 2)}</pre>
            `;
        } else {
            resultsContent.innerHTML = '<p class="no-results">Query executed successfully, no results returned</p>';
        }
    }

    createResultsTable(rows, fields) {
        if (!rows || rows.length === 0) return '<p class="no-results">No data</p>';
        
        const headers = fields ? fields.map(field => field.name || field) : Object.keys(rows[0]);
        
        const headerRow = headers.map(header => `<th>${header}</th>`).join('');
        const dataRows = rows.map(row => {
            const cells = headers.map(header => {
                const value = row[header];
                return `<td>${value !== null && value !== undefined ? value : 'NULL'}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        return `
            <div class="results-table-container">
                <table class="results-table">
                    <thead>
                        <tr>${headerRow}</tr>
                    </thead>
                    <tbody>
                        ${dataRows}
                    </tbody>
                </table>
            </div>
        `;
    }

    displayQueryError(error) {
        const resultsContent = document.getElementById('results-content');
        resultsContent.innerHTML = `
            <div class="query-error">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Query Error</h4>
                <pre>${error}</pre>
            </div>
        `;
    }

    addToQueryHistory(connectionId, query, result) {
        const historyItem = {
            id: Date.now(),
            connectionId,
            query,
            timestamp: new Date().toISOString(),
            success: !result.error,
            rowCount: result.rows ? result.rows.length : result.rowCount || 0
        };
        
        this.queryHistory.unshift(historyItem);
        if (this.queryHistory.length > 50) {
            this.queryHistory = this.queryHistory.slice(0, 50);
        }
        
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        const historyList = document.getElementById('history-list');
        
        if (this.queryHistory.length === 0) {
            historyList.innerHTML = '<div class="no-history">No queries in history</div>';
            return;
        }

        const historyItems = this.queryHistory.map(item => `
            <div class="history-item ${item.success ? 'success' : 'error'}" data-history-id="${item.id}">
                <div class="history-header">
                    <span class="connection-name">${item.connectionId}</span>
                    <span class="timestamp">${new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <div class="history-query">${item.query.substring(0, 100)}${item.query.length > 100 ? '...' : ''}</div>
                <div class="history-meta">
                    <span class="row-count">${item.rowCount} rows</span>
                    <button class="btn btn-xs btn-ghost rerun-query" data-history-id="${item.id}">
                        <i class="fas fa-redo"></i>
                        Re-run
                    </button>
                </div>
            </div>
        `).join('');

        historyList.innerHTML = historyItems;
    }

    showError(message) {
        // Show error notification
        if (window.NotificationSystem) {
            window.NotificationSystem.showError(message);
        } else {
            alert(message);
        }
    }

    async testAllConnections() {
        const button = document.getElementById('test-all-connections-btn');
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
        button.disabled = true;

        try {
            await this.updateConnectionStatuses();
        } finally {
            button.innerHTML = '<i class="fas fa-link"></i> Test All Connections';
            button.disabled = false;
        }
    }

    async connectToDatabase(connectionId) {
        const config = this.connections.get(connectionId);
        if (!config) return;

        const button = document.querySelector(`[data-connection-id="${connectionId}"] .connect-btn`);
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
        button.disabled = true;

        try {
            const result = await window.electronAPI.invoke('connect-to-database', connectionId);
            this.updateConnectionStatus(connectionId, result.success ? 'connected' : 'disconnected');
            
            if (result.success) {
                // Set as active connection
                document.getElementById('active-connection').value = connectionId;
            }
        } catch (error) {
            this.updateConnectionStatus(connectionId, 'disconnected');
            this.showError(`Connection failed: ${error.message}`);
        } finally {
            button.innerHTML = '<i class="fas fa-plug"></i> Connect';
            button.disabled = false;
        }
    }

    editConnection(connectionId) {
        const config = this.connections.get(connectionId);
        if (config) {
            this.showConnectionConfigModal(config);
        }
    }

    async deleteConnection(connectionId) {
        if (confirm('Are you sure you want to delete this database connection?')) {
            try {
                await window.electronAPI.invoke('delete-database-config', connectionId);
                this.loadDatabaseConfigs();
            } catch (error) {
                this.showError(`Failed to delete connection: ${error.message}`);
            }
        }
    }

    async saveConnectionConfig() {
        const formData = new FormData(document.getElementById('connection-config-form'));
        const config = {
            name: formData.get('connection-name'),
            type: formData.get('database-type'),
            host: formData.get('db-host'),
            port: parseInt(formData.get('db-port')),
            database: formData.get('database-name'),
            username: formData.get('db-username'),
            password: formData.get('db-password'),
            options: JSON.parse(formData.get('connection-options') || '{}')
        };

        try {
            await window.electronAPI.invoke('save-database-config', config);
            this.loadDatabaseConfigs();
            document.getElementById('connection-config-modal').style.display = 'none';
        } catch (error) {
            this.showError(`Failed to save connection: ${error.message}`);
        }
    }

    saveQuery() {
        const query = document.getElementById('query-input').value.trim();
        if (!query) {
            this.showError('No query to save');
            return;
        }

        const name = prompt('Enter a name for this saved query:');
        if (name) {
            // Save query to local storage or backend
            const savedQueries = JSON.parse(localStorage.getItem('savedQueries') || '[]');
            savedQueries.push({
                id: Date.now(),
                name,
                query,
                createdAt: new Date().toISOString()
            });
            localStorage.setItem('savedQueries', JSON.stringify(savedQueries));
        }
    }

    exportResults() {
        const resultsContent = document.getElementById('results-content');
        const table = resultsContent.querySelector('table');
        
        if (table) {
            // Convert table to CSV
            let csv = '';
            const rows = table.querySelectorAll('tr');
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('th, td');
                const rowData = Array.from(cells).map(cell => `"${cell.textContent}"`).join(',');
                csv += rowData + '\n';
            });
            
            // Download CSV
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `query_results_${Date.now()}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        }
    }

    clearResults() {
        const resultsContent = document.getElementById('results-content');
        resultsContent.innerHTML = '<p class="no-results">No query executed yet</p>';
    }
}

// Register screen
window.DatabaseConnectorScreen = DatabaseConnectorScreen;