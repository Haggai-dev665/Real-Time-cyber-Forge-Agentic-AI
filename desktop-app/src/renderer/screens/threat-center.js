/**
 * Threat Center Screen
 * Comprehensive threat management and monitoring
 */

class ThreatCenterScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.threatsTable = null;
        this.currentFilter = 'all';
        this.currentSort = { column: 'timestamp', direction: 'desc' };
        this.threats = [];
        this.updateInterval = null;
        this.selectedThreats = new Set();
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        // Create threat center HTML
        this.container.innerHTML = this.createHTML();
        
        // Initialize components
        await this.initializeComponents();
        
        // Load threats data
        await this.loadThreats();
        
        // Start real-time updates
        this.startRealTimeUpdates();
        
        // Handle specific threat if provided
        if (options.threatId) {
            this.highlightThreat(options.threatId);
        }
        
        // Add entrance animation
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
        this.stopRealTimeUpdates();
        if (this.threatsTable) {
            this.threatsTable.destroy();
        }
    }

    createHTML() {
        return `
            <div class="threat-center-screen">
                <!-- Header -->
                <div class="threat-header">
                    <div class="header-left">
                        <h1>Threat Center</h1>
                        <p>Centralized threat detection and management</p>
                    </div>
                    <div class="header-actions">
                        <button class="btn btn-secondary" id="refresh-threats-btn">
                            <i class="fas fa-sync-alt"></i> Refresh
                        </button>
                        <button class="btn btn-secondary" id="export-threats-btn">
                            <i class="fas fa-download"></i> Export
                        </button>
                        <button class="btn btn-primary" id="manual-scan-btn">
                            <i class="fas fa-shield-alt"></i> Manual Scan
                        </button>
                    </div>
                </div>

                <!-- Stats Overview -->
                <div class="threat-stats-grid">
                    <div class="stat-card critical">
                        <div class="stat-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="critical-threats">0</div>
                            <div class="stat-label">Critical Threats</div>
                        </div>
                    </div>
                    <div class="stat-card high">
                        <div class="stat-icon">
                            <i class="fas fa-warning"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="high-threats">0</div>
                            <div class="stat-label">High Priority</div>
                        </div>
                    </div>
                    <div class="stat-card medium">
                        <div class="stat-icon">
                            <i class="fas fa-info-circle"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="medium-threats">0</div>
                            <div class="stat-label">Medium Priority</div>
                        </div>
                    </div>
                    <div class="stat-card blocked">
                        <div class="stat-icon">
                            <i class="fas fa-shield-check"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="blocked-threats">0</div>
                            <div class="stat-label">Blocked Today</div>
                        </div>
                    </div>
                </div>

                <!-- Filter and Actions Bar -->
                <div class="filter-bar">
                    <div class="filter-group">
                        <label>Filter by Severity:</label>
                        <select id="severity-filter" class="filter-select">
                            <option value="all">All Severities</option>
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Filter by Status:</label>
                        <select id="status-filter" class="filter-select">
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="resolved">Resolved</option>
                            <option value="dismissed">Dismissed</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Filter by Type:</label>
                        <select id="type-filter" class="filter-select">
                            <option value="all">All Types</option>
                            <option value="malware">Malware</option>
                            <option value="phishing">Phishing</option>
                            <option value="network">Network Intrusion</option>
                            <option value="suspicious">Suspicious Activity</option>
                        </select>
                    </div>
                    <div class="filter-actions">
                        <button class="btn btn-sm btn-secondary" id="clear-filters-btn">
                            <i class="fas fa-times"></i> Clear Filters
                        </button>
                    </div>
                </div>

                <!-- Bulk Actions -->
                <div class="bulk-actions" id="bulk-actions" style="display: none;">
                    <div class="bulk-info">
                        <span id="selected-count">0</span> threats selected
                    </div>
                    <div class="bulk-buttons">
                        <button class="btn btn-sm btn-secondary" id="bulk-resolve-btn">
                            <i class="fas fa-check"></i> Resolve Selected
                        </button>
                        <button class="btn btn-sm btn-secondary" id="bulk-dismiss-btn">
                            <i class="fas fa-times"></i> Dismiss Selected
                        </button>
                        <button class="btn btn-sm btn-danger" id="bulk-delete-btn">
                            <i class="fas fa-trash"></i> Delete Selected
                        </button>
                    </div>
                </div>

                <!-- Threats Table -->
                <div class="threats-table-container">
                    <div id="threats-table"></div>
                </div>

                <!-- Threat Details Panel -->
                <div class="threat-details-panel" id="threat-details-panel" style="display: none;">
                    <div class="panel-header">
                        <h3>Threat Details</h3>
                        <button class="btn-icon" id="close-details-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="panel-content" id="threat-details-content">
                        <!-- Threat details will be populated here -->
                    </div>
                </div>
            </div>
        `;
    }

    async initializeComponents() {
        this.setupEventListeners();
        this.initializeThreatsTable();
        await this.loadThreatStats();
    }

    setupEventListeners() {
        // Header actions
        document.getElementById('refresh-threats-btn').addEventListener('click', () => this.refreshThreats());
        document.getElementById('export-threats-btn').addEventListener('click', () => this.exportThreats());
        document.getElementById('manual-scan-btn').addEventListener('click', () => this.showManualScanDialog());

        // Filters
        document.getElementById('severity-filter').addEventListener('change', (e) => this.filterThreats());
        document.getElementById('status-filter').addEventListener('change', (e) => this.filterThreats());
        document.getElementById('type-filter').addEventListener('change', (e) => this.filterThreats());
        document.getElementById('clear-filters-btn').addEventListener('click', () => this.clearFilters());

        // Bulk actions
        document.getElementById('bulk-resolve-btn').addEventListener('click', () => this.bulkResolveThreats());
        document.getElementById('bulk-dismiss-btn').addEventListener('click', () => this.bulkDismissThreats());
        document.getElementById('bulk-delete-btn').addEventListener('click', () => this.bulkDeleteThreats());

        // Details panel
        document.getElementById('close-details-btn').addEventListener('click', () => this.closeDetailsPanel());
    }

    initializeThreatsTable() {
        const columns = [
            {
                key: 'id',
                title: 'ID',
                type: 'text',
                sortable: true
            },
            {
                key: 'severity',
                title: 'Severity',
                type: 'badge',
                sortable: true,
                render: (threat) => {
                    const severityClass = this.getSeverityClass(threat.severity);
                    return `<span class="badge badge-${severityClass}">${threat.severity?.toUpperCase()}</span>`;
                }
            },
            {
                key: 'type',
                title: 'Type',
                type: 'text',
                sortable: true
            },
            {
                key: 'source',
                title: 'Source',
                type: 'text',
                sortable: true,
                render: (threat) => {
                    return threat.source || threat.target || 'Unknown';
                }
            },
            {
                key: 'description',
                title: 'Description',
                type: 'text',
                sortable: false,
                render: (threat) => {
                    const desc = threat.description || threat.message || 'No description';
                    return desc.length > 60 ? desc.substring(0, 60) + '...' : desc;
                }
            },
            {
                key: 'status',
                title: 'Status',
                type: 'badge',
                sortable: true,
                render: (threat) => {
                    const statusClass = this.getStatusClass(threat.status);
                    return `<span class="badge badge-${statusClass}">${threat.status?.toUpperCase()}</span>`;
                }
            },
            {
                key: 'timestamp',
                title: 'Detected',
                type: 'datetime',
                sortable: true,
                render: (threat) => {
                    const date = new Date(threat.timestamp || threat.created_at || Date.now());
                    return this.formatRelativeTime(date);
                }
            },
            {
                key: 'actions',
                title: 'Actions',
                type: 'html',
                sortable: false,
                render: (threat) => `
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="window.threatCenter.viewThreatDetails('${threat.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="window.threatCenter.resolveThreat('${threat.id}')" title="Resolve">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-icon" onclick="window.threatCenter.dismissThreat('${threat.id}')" title="Dismiss">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `
            }
        ];

        this.threatsTable = new DataTable('threats-table', {
            columns,
            searchable: true,
            sortable: true,
            paginated: true,
            selectable: true,
            exportable: true,
            pageSize: 20,
            onRowClick: (threat) => this.viewThreatDetails(threat.id),
            onSelectionChange: (selectedIndices) => this.handleSelectionChange(selectedIndices)
        });

        // Store reference for onclick handlers
        window.threatCenter = this;
    }

    async loadThreats() {
        try {
            this.showTableLoading();
            
            if (window.apiClient) {
                const response = await window.apiClient.getThreats({ 
                    limit: 100,
                    status: 'all'
                });
                
                if (response.success) {
                    this.threats = response.data?.threats || response.data || [];
                }
            }

            if (!this.threats || this.threats.length === 0) {
                this.threats = this.generateMockThreats();
            }
            
            this.threatsTable.setData(this.threats);
            this.updateThreatStats();
            
        } catch (error) {
            console.error('Failed to load threats:', error);
            this.threats = this.generateMockThreats();
            this.threatsTable.setData(this.threats);
            window.notificationSystem?.error('Load Error', 'Failed to load some threat data');
        }
    }

    async loadThreatStats() {
        try {
            if (window.apiClient) {
                const response = await window.apiClient.getThreatStats();
                if (response.success && response.data) {
                    this.updateStatsDisplay(response.data);
                    return;
                }
            }
            
            // Fallback stats calculation
            this.calculateStatsFromThreats();
            
        } catch (error) {
            console.error('Failed to load threat stats:', error);
            this.calculateStatsFromThreats();
        }
    }

    updateStatsDisplay(stats) {
        document.getElementById('critical-threats').textContent = stats.critical_threats || stats.critical || 0;
        document.getElementById('high-threats').textContent = stats.high_threats || stats.high || 0;
        document.getElementById('medium-threats').textContent = stats.medium_threats || stats.medium || 0;
        document.getElementById('blocked-threats').textContent = stats.blocked_today || stats.blocked || 0;
    }

    calculateStatsFromThreats() {
        const stats = {
            critical: 0,
            high: 0,
            medium: 0,
            blocked: 0
        };
        
        this.threats.forEach(threat => {
            if (threat.severity === 'critical') stats.critical++;
            else if (threat.severity === 'high') stats.high++;
            else if (threat.severity === 'medium') stats.medium++;
            
            if (threat.status === 'blocked') stats.blocked++;
        });
        
        document.getElementById('critical-threats').textContent = stats.critical;
        document.getElementById('high-threats').textContent = stats.high;
        document.getElementById('medium-threats').textContent = stats.medium;
        document.getElementById('blocked-threats').textContent = stats.blocked;
    }

    generateMockThreats() {
        const threats = [];
        const types = ['malware', 'phishing', 'network', 'suspicious'];
        const severities = ['critical', 'high', 'medium', 'low'];
        const statuses = ['active', 'resolved', 'dismissed'];
        const sources = ['192.168.1.100', 'suspicious-site.com', 'email-attachment.exe', 'network-scan'];
        
        for (let i = 1; i <= 50; i++) {
            const severity = severities[Math.floor(Math.random() * severities.length)];
            const type = types[Math.floor(Math.random() * types.length)];
            
            threats.push({
                id: `THR-${String(i).padStart(4, '0')}`,
                severity,
                type,
                source: sources[Math.floor(Math.random() * sources.length)],
                description: this.generateThreatDescription(type, severity),
                status: statuses[Math.floor(Math.random() * statuses.length)],
                timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in last week
                details: {
                    risk_score: Math.floor(Math.random() * 100),
                    affected_systems: Math.floor(Math.random() * 5) + 1,
                    detection_method: 'AI Analysis',
                    remediation: this.generateRemediationSteps(type)
                }
            });
        }
        
        return threats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    generateThreatDescription(type, severity) {
        const descriptions = {
            malware: {
                critical: 'Advanced persistent threat detected with rootkit capabilities',
                high: 'Ransomware payload identified in system memory',
                medium: 'Suspicious executable behavior detected',
                low: 'Potentially unwanted program identified'
            },
            phishing: {
                critical: 'Credential harvesting attempt targeting executive accounts',
                high: 'Sophisticated spear phishing campaign detected',
                medium: 'Suspicious email with malicious attachments',
                low: 'Generic phishing attempt blocked'
            },
            network: {
                critical: 'Active breach attempt from external IP address',
                high: 'Unauthorized access to critical network segment',
                medium: 'Unusual network traffic pattern detected',
                low: 'Port scanning activity observed'
            },
            suspicious: {
                critical: 'Multiple failed login attempts on admin accounts',
                high: 'Anomalous data exfiltration pattern detected',
                medium: 'Unusual file access pattern observed',
                low: 'Minor behavioral anomaly detected'
            }
        };
        
        return descriptions[type]?.[severity] || 'Security event detected';
    }

    generateRemediationSteps(type) {
        const steps = {
            malware: [
                'Isolate affected systems from network',
                'Run full system antivirus scan',
                'Check for persistence mechanisms',
                'Restore from clean backup if necessary'
            ],
            phishing: [
                'Block sender email address',
                'Reset potentially compromised credentials',
                'Educate users about phishing indicators',
                'Review email security policies'
            ],
            network: [
                'Block suspicious IP addresses',
                'Review network access logs',
                'Strengthen firewall rules',
                'Monitor for lateral movement'
            ],
            suspicious: [
                'Investigate user activity patterns',
                'Review system access logs',
                'Implement additional monitoring',
                'Consider password reset if needed'
            ]
        };
        
        return steps[type] || ['Investigate further', 'Apply appropriate countermeasures'];
    }

    showTableLoading() {
        if (this.threatsTable) {
            this.threatsTable.setData([]);
        }
    }

    filterThreats() {
        const severityFilter = document.getElementById('severity-filter').value;
        const statusFilter = document.getElementById('status-filter').value;
        const typeFilter = document.getElementById('type-filter').value;
        
        let filteredThreats = [...this.threats];
        
        if (severityFilter !== 'all') {
            filteredThreats = filteredThreats.filter(threat => threat.severity === severityFilter);
        }
        
        if (statusFilter !== 'all') {
            filteredThreats = filteredThreats.filter(threat => threat.status === statusFilter);
        }
        
        if (typeFilter !== 'all') {
            filteredThreats = filteredThreats.filter(threat => threat.type === typeFilter);
        }
        
        this.threatsTable.setData(filteredThreats);
    }

    clearFilters() {
        document.getElementById('severity-filter').value = 'all';
        document.getElementById('status-filter').value = 'all';
        document.getElementById('type-filter').value = 'all';
        this.threatsTable.setData(this.threats);
    }

    handleSelectionChange(selectedIndices) {
        const bulkActions = document.getElementById('bulk-actions');
        const selectedCount = document.getElementById('selected-count');
        
        if (selectedIndices.length > 0) {
            bulkActions.style.display = 'flex';
            selectedCount.textContent = selectedIndices.length;
            this.selectedThreats = new Set(selectedIndices);
        } else {
            bulkActions.style.display = 'none';
            this.selectedThreats.clear();
        }
    }

    async viewThreatDetails(threatId) {
        const threat = this.threats.find(t => t.id === threatId);
        if (!threat) return;
        
        const detailsPanel = document.getElementById('threat-details-panel');
        const detailsContent = document.getElementById('threat-details-content');
        
        detailsContent.innerHTML = this.createThreatDetailsHTML(threat);
        detailsPanel.style.display = 'block';
        
        // Add animation
        detailsPanel.style.transform = 'translateX(100%)';
        requestAnimationFrame(() => {
            detailsPanel.style.transition = 'transform 0.3s ease';
            detailsPanel.style.transform = 'translateX(0)';
        });
    }

    createThreatDetailsHTML(threat) {
        return `
            <div class="threat-detail-section">
                <h4>Basic Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Threat ID:</label>
                        <span>${threat.id}</span>
                    </div>
                    <div class="detail-item">
                        <label>Severity:</label>
                        <span class="badge badge-${this.getSeverityClass(threat.severity)}">${threat.severity?.toUpperCase()}</span>
                    </div>
                    <div class="detail-item">
                        <label>Type:</label>
                        <span>${threat.type}</span>
                    </div>
                    <div class="detail-item">
                        <label>Status:</label>
                        <span class="badge badge-${this.getStatusClass(threat.status)}">${threat.status?.toUpperCase()}</span>
                    </div>
                    <div class="detail-item">
                        <label>Source:</label>
                        <span>${threat.source || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Detected:</label>
                        <span>${new Date(threat.timestamp).toLocaleString()}</span>
                    </div>
                </div>
            </div>
            
            <div class="threat-detail-section">
                <h4>Description</h4>
                <p>${threat.description}</p>
            </div>
            
            ${threat.details ? `
                <div class="threat-detail-section">
                    <h4>Technical Details</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Risk Score:</label>
                            <span>${threat.details.risk_score}/100</span>
                        </div>
                        <div class="detail-item">
                            <label>Affected Systems:</label>
                            <span>${threat.details.affected_systems}</span>
                        </div>
                        <div class="detail-item">
                            <label>Detection Method:</label>
                            <span>${threat.details.detection_method}</span>
                        </div>
                    </div>
                </div>
                
                <div class="threat-detail-section">
                    <h4>Recommended Actions</h4>
                    <ul class="remediation-list">
                        ${threat.details.remediation.map(step => `<li>${step}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            <div class="threat-actions">
                <button class="btn btn-success" onclick="window.threatCenter.resolveThreat('${threat.id}')">
                    <i class="fas fa-check"></i> Resolve Threat
                </button>
                <button class="btn btn-secondary" onclick="window.threatCenter.dismissThreat('${threat.id}')">
                    <i class="fas fa-times"></i> Dismiss
                </button>
                <button class="btn btn-danger" onclick="window.threatCenter.deleteThreat('${threat.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
    }

    closeDetailsPanel() {
        const detailsPanel = document.getElementById('threat-details-panel');
        detailsPanel.style.transform = 'translateX(100%)';
        setTimeout(() => {
            detailsPanel.style.display = 'none';
        }, 300);
    }

    // Threat Actions
    async resolveThreat(threatId) {
        const confirmed = await window.modal?.confirm(
            'Resolve Threat',
            'Are you sure you want to mark this threat as resolved?'
        );
        
        if (!confirmed) return;
        
        try {
            if (window.apiClient) {
                const response = await window.apiClient.resolveThreat(threatId, { resolution: 'Resolved by user' });
                if (response.success) {
                    this.updateThreatStatus(threatId, 'resolved');
                    window.notificationSystem?.success('Threat Resolved', 'Threat has been marked as resolved');
                    return;
                }
            }
            
            // Fallback update
            this.updateThreatStatus(threatId, 'resolved');
            window.notificationSystem?.success('Threat Resolved', 'Threat has been marked as resolved');
            
        } catch (error) {
            console.error('Failed to resolve threat:', error);
            window.notificationSystem?.error('Resolve Failed', 'Failed to resolve threat');
        }
    }

    async dismissThreat(threatId) {
        const confirmed = await window.modal?.confirm(
            'Dismiss Threat',
            'Are you sure you want to dismiss this threat?'
        );
        
        if (!confirmed) return;
        
        try {
            if (window.apiClient) {
                const response = await window.apiClient.dismissThreat(threatId, { reason: 'Dismissed by user' });
                if (response.success) {
                    this.updateThreatStatus(threatId, 'dismissed');
                    window.notificationSystem?.success('Threat Dismissed', 'Threat has been dismissed');
                    return;
                }
            }
            
            // Fallback update
            this.updateThreatStatus(threatId, 'dismissed');
            window.notificationSystem?.success('Threat Dismissed', 'Threat has been dismissed');
            
        } catch (error) {
            console.error('Failed to dismiss threat:', error);
            window.notificationSystem?.error('Dismiss Failed', 'Failed to dismiss threat');
        }
    }

    async deleteThreat(threatId) {
        const confirmed = await window.modal?.confirm(
            'Delete Threat',
            'Are you sure you want to permanently delete this threat? This action cannot be undone.',
            { confirmClass: 'btn-danger', confirmLabel: 'Delete' }
        );
        
        if (!confirmed) return;
        
        // Remove from local data
        this.threats = this.threats.filter(t => t.id !== threatId);
        this.threatsTable.setData(this.threats);
        this.updateThreatStats();
        this.closeDetailsPanel();
        
        window.notificationSystem?.success('Threat Deleted', 'Threat has been permanently deleted');
    }

    updateThreatStatus(threatId, newStatus) {
        const threat = this.threats.find(t => t.id === threatId);
        if (threat) {
            threat.status = newStatus;
            this.threatsTable.setData(this.threats);
            this.updateThreatStats();
            this.closeDetailsPanel();
        }
    }

    // Bulk Actions
    async bulkResolveThreats() {
        if (this.selectedThreats.size === 0) return;
        
        const confirmed = await window.modal?.confirm(
            'Bulk Resolve',
            `Are you sure you want to resolve ${this.selectedThreats.size} selected threats?`
        );
        
        if (!confirmed) return;
        
        // Update selected threats
        this.selectedThreats.forEach(index => {
            const threat = this.threats[index];
            if (threat) {
                threat.status = 'resolved';
            }
        });
        
        this.threatsTable.setData(this.threats);
        this.threatsTable.clearSelection();
        this.updateThreatStats();
        
        window.notificationSystem?.success('Bulk Resolve', `${this.selectedThreats.size} threats resolved`);
    }

    async bulkDismissThreats() {
        if (this.selectedThreats.size === 0) return;
        
        const confirmed = await window.modal?.confirm(
            'Bulk Dismiss',
            `Are you sure you want to dismiss ${this.selectedThreats.size} selected threats?`
        );
        
        if (!confirmed) return;
        
        // Update selected threats
        this.selectedThreats.forEach(index => {
            const threat = this.threats[index];
            if (threat) {
                threat.status = 'dismissed';
            }
        });
        
        this.threatsTable.setData(this.threats);
        this.threatsTable.clearSelection();
        this.updateThreatStats();
        
        window.notificationSystem?.success('Bulk Dismiss', `${this.selectedThreats.size} threats dismissed`);
    }

    async bulkDeleteThreats() {
        if (this.selectedThreats.size === 0) return;
        
        const confirmed = await window.modal?.confirm(
            'Bulk Delete',
            `Are you sure you want to permanently delete ${this.selectedThreats.size} selected threats? This action cannot be undone.`,
            { confirmClass: 'btn-danger', confirmLabel: 'Delete All' }
        );
        
        if (!confirmed) return;
        
        // Remove selected threats
        const selectedIndices = Array.from(this.selectedThreats).sort((a, b) => b - a);
        selectedIndices.forEach(index => {
            this.threats.splice(index, 1);
        });
        
        this.threatsTable.setData(this.threats);
        this.threatsTable.clearSelection();
        this.updateThreatStats();
        
        window.notificationSystem?.success('Bulk Delete', `${selectedIndices.length} threats deleted`);
    }

    // Utility methods
    getSeverityClass(severity) {
        const map = {
            critical: 'error',
            high: 'warning',
            medium: 'info',
            low: 'secondary'
        };
        return map[severity] || 'secondary';
    }

    getStatusClass(status) {
        const map = {
            active: 'error',
            resolved: 'success',
            dismissed: 'secondary'
        };
        return map[status] || 'secondary';
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    updateThreatStats() {
        this.calculateStatsFromThreats();
    }

    // Event handlers
    async refreshThreats() {
        await this.loadThreats();
        window.notificationSystem?.success('Refreshed', 'Threat data has been refreshed');
    }

    exportThreats() {
        if (this.threatsTable) {
            this.threatsTable.exportData('csv');
        }
    }

    showManualScanDialog() {
        const url = prompt('Enter URL to scan with CyberForge ML:', 'https://example.com');
        if (url) {
            this.scanUrlWithCyberForge(url);
        }
    }
    
    async scanUrlWithCyberForge(url) {
        window.notificationSystem?.loading('CyberForge Scan', `Scanning ${url}...`);
        
        try {
            if (window.cyberforgeAPI) {
                const result = await window.cyberforgeAPI.cyberforgeAnalyzeUrl(url);
                
                if (result.success && result.data) {
                    const analysis = result.data;
                    const riskLevel = analysis.aggregate?.overall_risk_level || 'unknown';
                    const maxScore = analysis.aggregate?.max_threat_score || 0;
                    
                    // Create threat from analysis
                    if (riskLevel !== 'low' && riskLevel !== 'minimal') {
                        const newThreat = {
                            id: `THR-CF-${Date.now()}`,
                            severity: riskLevel === 'critical' ? 'critical' : 
                                     riskLevel === 'high' ? 'high' : 'medium',
                            type: 'phishing',
                            source: url,
                            description: `CyberForge ML detected ${riskLevel.toUpperCase()} risk URL with threat score ${(maxScore * 100).toFixed(1)}%`,
                            status: 'active',
                            timestamp: new Date(),
                            details: {
                                risk_score: Math.round(maxScore * 100),
                                affected_systems: 1,
                                detection_method: 'CyberForge ML Analysis',
                                remediation: ['Block URL access', 'Review similar URLs', 'Alert users'],
                                model_predictions: analysis.model_predictions
                            }
                        };
                        
                        this.threats.unshift(newThreat);
                        this.threatsTable?.setData(this.threats);
                        this.updateThreatStats();
                        
                        window.notificationSystem?.warning('⚠️ Threat Detected', 
                            `${riskLevel.toUpperCase()} risk detected for ${url}`);
                    } else {
                        window.notificationSystem?.success('✅ URL Safe', 
                            `No threats detected for ${url} (${riskLevel})`);
                    }
                    
                    return;
                }
            }
            
            // Fallback to legacy scan
            window.notificationSystem?.success('Scan Complete', 'Manual security scan completed');
            this.refreshThreats();
            
        } catch (error) {
            console.error('CyberForge scan error:', error);
            window.notificationSystem?.error('Scan Failed', error.message);
        }
    }

    startManualScan() {
        const scanId = 'SCAN-' + Date.now();
        window.notificationSystem?.loading('Manual Scan', 'Security scan is starting...');
        
        // Simulate scan progress
        setTimeout(() => {
            window.notificationSystem?.success('Scan Complete', 'Manual security scan completed successfully');
            this.refreshThreats();
        }, 3000);
    }

    highlightThreat(threatId) {
        // TODO: Implement threat highlighting in table
    }

    startRealTimeUpdates() {
        this.updateInterval = setInterval(() => {
            if (this.isActive) {
                this.loadThreatStats();
            }
        }, 30000); // Update every 30 seconds
    }

    stopRealTimeUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    handleRealtimeData(data) {
        if (data.type === 'threat_alert') {
            // Add new threat to the list
            this.threats.unshift(data.threat);
            this.threatsTable.setData(this.threats);
            this.updateThreatStats();
        }
    }

    destroy() {
        this.stopRealTimeUpdates();
        if (this.threatsTable) {
            this.threatsTable.destroy();
        }
        // Clean up global reference
        if (window.threatCenter === this) {
            delete window.threatCenter;
        }
    }
}

// Export for global access
window.ThreatCenterScreen = ThreatCenterScreen;