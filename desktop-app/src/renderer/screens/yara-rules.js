/**
 * YARA Rules Screen Component
 * Advanced YARA rule management and analysis
 */

class YaraRulesScreen {
    constructor() {
        this.isInitialized = false;
        this.yaraRules = [];
        this.scanResults = [];
        this.rulesets = [];
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('Initializing YARA Rules Screen...');
        await this.loadYaraData();
        this.setupEventListeners();
        this.isInitialized = true;
    }

    render() {
        return `
            <div class="screen yara-rules-screen">
                <div class="screen-header">
                    <div class="header-content">
                        <div class="header-title">
                            <i class="fas fa-code-branch"></i>
                            <h1>YARA Rules Management</h1>
                            <span class="status-badge active">Active</span>
                        </div>
                        <div class="header-actions">
                            <button class="btn btn-primary" id="create-rule-btn">
                                <i class="fas fa-plus"></i>
                                Create Rule
                            </button>
                            <button class="btn btn-secondary" id="import-rules-btn">
                                <i class="fas fa-upload"></i>
                                Import Rules
                            </button>
                            <button class="btn btn-accent" id="scan-with-rules-btn">
                                <i class="fas fa-search"></i>
                                Scan
                            </button>
                        </div>
                    </div>
                </div>

                <div class="screen-content">
                    <!-- Quick Actions -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Quick Actions</h2>
                        </div>
                        <div class="quick-actions-grid">
                            <div class="action-card" data-action="malware-detection">
                                <div class="action-icon">
                                    <i class="fas fa-virus"></i>
                                </div>
                                <div class="action-content">
                                    <h3>Malware Detection</h3>
                                    <p>Use YARA rules to detect known malware patterns</p>
                                    <div class="action-stats">
                                        <span class="stat-value" id="malware-rules-count">0</span>
                                        <span class="stat-label">Active Rules</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="action-card" data-action="file-classification">
                                <div class="action-icon">
                                    <i class="fas fa-file-code"></i>
                                </div>
                                <div class="action-content">
                                    <h3>File Classification</h3>
                                    <p>Classify files based on content and structure</p>
                                    <div class="action-stats">
                                        <span class="stat-value" id="classifier-rules-count">0</span>
                                        <span class="stat-label">Classifier Rules</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="action-card" data-action="threat-hunting">
                                <div class="action-icon">
                                    <i class="fas fa-crosshairs"></i>
                                </div>
                                <div class="action-content">
                                    <h3>Threat Hunting</h3>
                                    <p>Hunt for specific threat indicators and patterns</p>
                                    <div class="action-stats">
                                        <span class="stat-value" id="hunting-rules-count">0</span>
                                        <span class="stat-label">Hunting Rules</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="action-card" data-action="memory-analysis">
                                <div class="action-icon">
                                    <i class="fas fa-memory"></i>
                                </div>
                                <div class="action-content">
                                    <h3>Memory Analysis</h3>
                                    <p>Analyze memory dumps for malicious patterns</p>
                                    <div class="action-stats">
                                        <span class="stat-value" id="memory-rules-count">0</span>
                                        <span class="stat-label">Memory Rules</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Rule Editor -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Rule Editor</h2>
                            <div class="header-controls">
                                <select id="rule-template">
                                    <option value="">Select Template</option>
                                    <option value="malware">Malware Detection</option>
                                    <option value="packer">Packer Detection</option>
                                    <option value="document">Document Analysis</option>
                                    <option value="network">Network Pattern</option>
                                </select>
                                <button class="btn btn-sm" id="validate-rule-btn">
                                    <i class="fas fa-check"></i>
                                    Validate
                                </button>
                                <button class="btn btn-sm" id="test-rule-btn">
                                    <i class="fas fa-play"></i>
                                    Test
                                </button>
                            </div>
                        </div>
                        <div class="rule-editor-container">
                            <div class="editor-toolbar">
                                <div class="editor-info">
                                    <span id="rule-name">New Rule</span>
                                    <span class="rule-status" id="rule-status">Not Saved</span>
                                </div>
                                <div class="editor-actions">
                                    <button class="btn btn-xs" id="save-rule-btn">
                                        <i class="fas fa-save"></i>
                                        Save
                                    </button>
                                    <button class="btn btn-xs" id="load-rule-btn">
                                        <i class="fas fa-folder-open"></i>
                                        Load
                                    </button>
                                    <button class="btn btn-xs" id="clear-editor-btn">
                                        <i class="fas fa-trash"></i>
                                        Clear
                                    </button>
                                </div>
                            </div>
                            <div class="code-editor">
                                <textarea id="yara-rule-editor" placeholder="Enter your YARA rule here...">rule ExampleRule
{
    meta:
        description = "Example YARA rule"
        author = "CyberForge AI"
        date = "2024-01-01"
        
    strings:
        $string1 = "suspicious_string"
        $hex1 = { 4D 5A 90 00 }
        
    condition:
        $string1 or $hex1
}</textarea>
                            </div>
                            <div class="editor-status">
                                <div class="syntax-status" id="syntax-status">
                                    <i class="fas fa-check-circle text-success"></i>
                                    <span>Syntax OK</span>
                                </div>
                                <div class="rule-info">
                                    <span>Lines: <span id="line-count">10</span></span>
                                    <span>Characters: <span id="char-count">234</span></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Rule Library -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Rule Library</h2>
                            <div class="header-controls">
                                <input type="text" id="rule-search" placeholder="Search rules..." />
                                <select id="rule-category-filter">
                                    <option value="all">All Categories</option>
                                    <option value="malware">Malware</option>
                                    <option value="packer">Packers</option>
                                    <option value="document">Documents</option>
                                    <option value="network">Network</option>
                                    <option value="custom">Custom</option>
                                </select>
                                <button class="btn btn-sm" id="refresh-rules-btn">
                                    <i class="fas fa-sync-alt"></i>
                                    Refresh
                                </button>
                            </div>
                        </div>
                        <div class="rules-grid" id="rules-grid">
                            <!-- Rules will be populated here -->
                        </div>
                    </div>

                    <!-- Scan Results -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Recent Scan Results</h2>
                            <div class="header-controls">
                                <select id="results-filter">
                                    <option value="all">All Results</option>
                                    <option value="matches">Matches Found</option>
                                    <option value="no-matches">No Matches</option>
                                    <option value="errors">Errors</option>
                                </select>
                                <button class="btn btn-sm" id="export-results-btn">
                                    <i class="fas fa-download"></i>
                                    Export
                                </button>
                            </div>
                        </div>
                        <div class="scan-results-container">
                            <table class="data-table" id="scan-results-table">
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Target</th>
                                        <th>Rules Used</th>
                                        <th>Matches</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="scan-results-tbody">
                                    <!-- Results will be populated here -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Rule Statistics -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Statistics</h2>
                        </div>
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-icon">
                                    <i class="fas fa-code"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value" id="total-rules">0</div>
                                    <div class="stat-label">Total Rules</div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon">
                                    <i class="fas fa-play"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value" id="active-rules">0</div>
                                    <div class="stat-label">Active Rules</div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon">
                                    <i class="fas fa-search"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value" id="total-scans">0</div>
                                    <div class="stat-label">Total Scans</div>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value" id="matches-found">0</div>
                                    <div class="stat-label">Matches Found</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadYaraData() {
        try {
            // Load YARA rules
            const rulesResponse = await fetch('/api/yara/rules');
            const rulesData = await rulesResponse.json();
            
            if (rulesData.success) {
                this.yaraRules = rulesData.rules;
                this.updateRulesGrid();
            }

            // Load scan results
            const resultsResponse = await fetch('/api/yara/scan-results');
            const resultsData = await resultsResponse.json();
            
            if (resultsData.success) {
                this.scanResults = resultsData.results;
                this.updateScanResultsTable();
            }

            // Load statistics
            await this.loadStatistics();
            
        } catch (error) {
            console.error('Error loading YARA data:', error);
            this.showNotification('Failed to load YARA data', 'error');
        }
    }

    setupEventListeners() {
        // Create rule button
        document.getElementById('create-rule-btn')?.addEventListener('click', () => {
            this.createNewRule();
        });

        // Import rules button
        document.getElementById('import-rules-btn')?.addEventListener('click', () => {
            this.showImportModal();
        });

        // Scan button
        document.getElementById('scan-with-rules-btn')?.addEventListener('click', () => {
            this.showScanModal();
        });

        // Rule template selection
        document.getElementById('rule-template')?.addEventListener('change', (e) => {
            this.loadRuleTemplate(e.target.value);
        });

        // Editor actions
        document.getElementById('validate-rule-btn')?.addEventListener('click', () => {
            this.validateRule();
        });

        document.getElementById('test-rule-btn')?.addEventListener('click', () => {
            this.testRule();
        });

        document.getElementById('save-rule-btn')?.addEventListener('click', () => {
            this.saveRule();
        });

        document.getElementById('load-rule-btn')?.addEventListener('click', () => {
            this.loadRule();
        });

        document.getElementById('clear-editor-btn')?.addEventListener('click', () => {
            this.clearEditor();
        });

        // Search and filters
        document.getElementById('rule-search')?.addEventListener('input', (e) => {
            this.searchRules(e.target.value);
        });

        document.getElementById('rule-category-filter')?.addEventListener('change', (e) => {
            this.filterRulesByCategory(e.target.value);
        });

        document.getElementById('results-filter')?.addEventListener('change', (e) => {
            this.filterScanResults(e.target.value);
        });

        // Editor change tracking
        document.getElementById('yara-rule-editor')?.addEventListener('input', () => {
            this.updateEditorStats();
            this.validateSyntax();
        });

        // Quick actions
        document.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const action = card.dataset.action;
                this.handleQuickAction(action);
            });
        });
    }

    createNewRule() {
        const editor = document.getElementById('yara-rule-editor');
        const template = `rule NewRule
{
    meta:
        description = "New YARA rule"
        author = "CyberForge AI"
        date = "${new Date().toISOString().split('T')[0]}"
        
    strings:
        $string1 = "example_string"
        
    condition:
        $string1
}`;
        
        editor.value = template;
        this.updateEditorStats();
        document.getElementById('rule-name').textContent = 'New Rule';
        document.getElementById('rule-status').textContent = 'Not Saved';
    }

    loadRuleTemplate(templateType) {
        if (!templateType) return;
        
        const templates = {
            malware: `rule MalwareDetection
{
    meta:
        description = "Generic malware detection rule"
        author = "CyberForge AI"
        date = "${new Date().toISOString().split('T')[0]}"
        
    strings:
        $mz = { 4D 5A }
        $pe = "This program cannot be run in DOS mode"
        $suspicious = "CreateRemoteThread" nocase
        
    condition:
        $mz at 0 and $pe and $suspicious
}`,
            packer: `rule PackerDetection
{
    meta:
        description = "Detect packed executables"
        author = "CyberForge AI"
        date = "${new Date().toISOString().split('T')[0]}"
        
    strings:
        $upx = "UPX"
        $aspack = "aSPack"
        $fsg = "FSG"
        
    condition:
        any of them
}`,
            document: `rule SuspiciousDocument
{
    meta:
        description = "Detect suspicious document features"
        author = "CyberForge AI"
        date = "${new Date().toISOString().split('T')[0]}"
        
    strings:
        $macro = "Sub Auto"
        $shell = "Shell" nocase
        $download = "URLDownloadToFile"
        
    condition:
        $macro and ($shell or $download)
}`,
            network: `rule NetworkPattern
{
    meta:
        description = "Detect network-based patterns"
        author = "CyberForge AI"
        date = "${new Date().toISOString().split('T')[0]}"
        
    strings:
        $http = "HTTP/"
        $user_agent = "User-Agent:"
        $suspicious_ua = "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)"
        
    condition:
        $http and $user_agent and $suspicious_ua
}`
        };
        
        const editor = document.getElementById('yara-rule-editor');
        editor.value = templates[templateType] || '';
        this.updateEditorStats();
    }

    async validateRule() {
        const ruleContent = document.getElementById('yara-rule-editor').value;
        
        try {
            const response = await fetch('/api/yara/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rule: ruleContent })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Rule syntax is valid', 'success');
                this.updateSyntaxStatus(true);
            } else {
                this.showNotification(`Syntax error: ${result.error}`, 'error');
                this.updateSyntaxStatus(false, result.error);
            }
        } catch (error) {
            console.error('Error validating rule:', error);
            this.showNotification('Failed to validate rule', 'error');
        }
    }

    async testRule() {
        const ruleContent = document.getElementById('yara-rule-editor').value;
        
        try {
            const response = await fetch('/api/yara/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    rule: ruleContent,
                    testData: 'sample_test_data' // Would be configurable
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(`Test completed: ${result.matches} matches found`, 'info');
            } else {
                this.showNotification(`Test failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error testing rule:', error);
            this.showNotification('Failed to test rule', 'error');
        }
    }

    async saveRule() {
        const ruleContent = document.getElementById('yara-rule-editor').value;
        const ruleName = this.extractRuleName(ruleContent) || 'UnnamedRule';
        
        try {
            const response = await fetch('/api/yara/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: ruleName,
                    content: ruleContent,
                    category: 'custom',
                    enabled: true
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Rule saved successfully', 'success');
                document.getElementById('rule-status').textContent = 'Saved';
                await this.loadYaraData(); // Refresh the rules list
            } else {
                this.showNotification(`Failed to save rule: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error saving rule:', error);
            this.showNotification('Failed to save rule', 'error');
        }
    }

    extractRuleName(ruleContent) {
        const match = ruleContent.match(/rule\s+(\w+)/);
        return match ? match[1] : null;
    }

    updateRulesGrid() {
        const container = document.getElementById('rules-grid');
        if (!container) return;

        container.innerHTML = this.yaraRules.map(rule => `
            <div class="rule-card" data-rule-id="${rule.id}">
                <div class="rule-header">
                    <div class="rule-info">
                        <h3>${rule.name}</h3>
                        <div class="rule-meta">
                            <span class="rule-category">${rule.category}</span>
                            <span class="rule-author">${rule.author || 'Unknown'}</span>
                        </div>
                    </div>
                    <div class="rule-status ${rule.enabled ? 'enabled' : 'disabled'}">
                        ${rule.enabled ? 'Enabled' : 'Disabled'}
                    </div>
                </div>
                <div class="rule-description">
                    <p>${rule.description || 'No description available'}</p>
                </div>
                <div class="rule-stats">
                    <div class="rule-stat">
                        <span class="stat-label">Created:</span>
                        <span class="stat-value">${new Date(rule.created).toLocaleDateString()}</span>
                    </div>
                    <div class="rule-stat">
                        <span class="stat-label">Used:</span>
                        <span class="stat-value">${rule.usageCount || 0} times</span>
                    </div>
                    <div class="rule-stat">
                        <span class="stat-label">Matches:</span>
                        <span class="stat-value">${rule.matchCount || 0}</span>
                    </div>
                </div>
                <div class="rule-actions">
                    <button class="btn btn-xs" onclick="yaraRulesScreen.editRule('${rule.id}')">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="btn btn-xs" onclick="yaraRulesScreen.testSingleRule('${rule.id}')">
                        <i class="fas fa-play"></i>
                        Test
                    </button>
                    <button class="btn btn-xs" onclick="yaraRulesScreen.toggleRule('${rule.id}')">
                        <i class="fas ${rule.enabled ? 'fa-pause' : 'fa-play'}"></i>
                        ${rule.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button class="btn btn-xs btn-danger" onclick="yaraRulesScreen.deleteRule('${rule.id}')">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateScanResultsTable() {
        const tbody = document.getElementById('scan-results-tbody');
        if (!tbody) return;

        tbody.innerHTML = this.scanResults.map(result => `
            <tr>
                <td>${new Date(result.timestamp).toLocaleString()}</td>
                <td>
                    <div class="scan-target">
                        <strong>${result.target}</strong>
                        <small>${result.targetType}</small>
                    </div>
                </td>
                <td>
                    <span class="rules-count">${result.rulesUsed || 0} rules</span>
                </td>
                <td>
                    <div class="matches-info">
                        <span class="matches-count ${result.matches > 0 ? 'has-matches' : 'no-matches'}">
                            ${result.matches || 0}
                        </span>
                        ${result.matches > 0 ? '<i class="fas fa-exclamation-triangle text-warning"></i>' : ''}
                    </div>
                </td>
                <td>
                    <span class="scan-status ${result.status.toLowerCase()}">${result.status}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-xs" onclick="yaraRulesScreen.viewScanDetails('${result.id}')">
                            <i class="fas fa-eye"></i>
                            Details
                        </button>
                        <button class="btn btn-xs" onclick="yaraRulesScreen.downloadReport('${result.id}')">
                            <i class="fas fa-download"></i>
                            Report
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async loadStatistics() {
        try {
            const response = await fetch('/api/yara/statistics');
            const data = await response.json();
            
            if (data.success) {
                const stats = data.statistics;
                document.getElementById('total-rules').textContent = stats.totalRules || 0;
                document.getElementById('active-rules').textContent = stats.activeRules || 0;
                document.getElementById('total-scans').textContent = stats.totalScans || 0;
                document.getElementById('matches-found').textContent = stats.matchesFound || 0;
                
                document.getElementById('malware-rules-count').textContent = stats.malwareRules || 0;
                document.getElementById('classifier-rules-count').textContent = stats.classifierRules || 0;
                document.getElementById('hunting-rules-count').textContent = stats.huntingRules || 0;
                document.getElementById('memory-rules-count').textContent = stats.memoryRules || 0;
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    updateEditorStats() {
        const editor = document.getElementById('yara-rule-editor');
        const content = editor.value;
        
        document.getElementById('line-count').textContent = content.split('\n').length;
        document.getElementById('char-count').textContent = content.length;
    }

    updateSyntaxStatus(isValid, error = null) {
        const statusElement = document.getElementById('syntax-status');
        
        if (isValid) {
            statusElement.innerHTML = '<i class="fas fa-check-circle text-success"></i><span>Syntax OK</span>';
        } else {
            statusElement.innerHTML = `<i class="fas fa-times-circle text-error"></i><span>Syntax Error${error ? ': ' + error : ''}</span>`;
        }
    }

    validateSyntax() {
        const content = document.getElementById('yara-rule-editor').value;
        
        // Basic syntax validation (would be more comprehensive in real implementation)
        const hasRuleKeyword = /rule\s+\w+/.test(content);
        const hasCondition = /condition\s*:/.test(content);
        const hasBalancedBraces = (content.match(/{/g) || []).length === (content.match(/}/g) || []).length;
        
        const isValid = hasRuleKeyword && hasCondition && hasBalancedBraces;
        this.updateSyntaxStatus(isValid);
    }

    clearEditor() {
        document.getElementById('yara-rule-editor').value = '';
        document.getElementById('rule-name').textContent = 'New Rule';
        document.getElementById('rule-status').textContent = 'Not Saved';
        this.updateEditorStats();
        this.updateSyntaxStatus(true);
    }

    showNotification(message, type = 'info') {
        if (window.notificationSystem) {
            window.notificationSystem.show(message, type);
        }
    }

    // Action methods
    async editRule(ruleId) {
        const rule = this.yaraRules.find(r => r.id === ruleId);
        if (rule) {
            document.getElementById('yara-rule-editor').value = rule.content;
            document.getElementById('rule-name').textContent = rule.name;
            document.getElementById('rule-status').textContent = 'Loaded';
            this.updateEditorStats();
        }
    }

    async testSingleRule(ruleId) {
        console.log('Testing single rule:', ruleId);
    }

    async toggleRule(ruleId) {
        console.log('Toggling rule:', ruleId);
    }

    async deleteRule(ruleId) {
        if (confirm('Are you sure you want to delete this rule?')) {
            console.log('Deleting rule:', ruleId);
        }
    }

    async viewScanDetails(resultId) {
        console.log('Viewing scan details:', resultId);
    }

    async downloadReport(resultId) {
        console.log('Downloading report:', resultId);
    }

    handleQuickAction(action) {
        console.log('Quick action:', action);
    }

    searchRules(query) {
        console.log('Searching rules:', query);
    }

    filterRulesByCategory(category) {
        console.log('Filtering rules by category:', category);
    }

    filterScanResults(filter) {
        console.log('Filtering scan results:', filter);
    }

    showImportModal() {
        console.log('Showing import modal');
    }

    showScanModal() {
        console.log('Showing scan modal');
    }

    loadRule() {
        console.log('Loading rule');
    }
}

// Initialize and export
const yaraRulesScreen = new YaraRulesScreen();

// Auto-initialize when screen is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.yara-rules-screen')) {
        yaraRulesScreen.init();
    }
});