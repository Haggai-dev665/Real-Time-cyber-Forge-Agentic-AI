/**
 * Incident Response Screen
 * Incident response management and coordination
 */

class IncidentResponseScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.incidents = [];
        this.activeIncident = null;
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        this.container.innerHTML = this.createHTML();
        this.initializeComponents();
        await this.loadIncidents();
        
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
    }

    createHTML() {
        return `
            <div class="incident-response-screen">
                <!-- Header -->
                <div class="incident-header">
                    <div class="header-info">
                        <h2><i class="fas fa-exclamation-triangle"></i> Incident Response</h2>
                        <p>Manage and coordinate security incident response</p>
                    </div>
                    <div class="header-controls">
                        <button class="btn btn-danger" id="create-incident-btn">
                            <i class="fas fa-plus"></i> New Incident
                        </button>
                        <button class="btn btn-secondary" id="escalate-btn">
                            <i class="fas fa-arrow-up"></i> Escalate
                        </button>
                    </div>
                </div>

                <!-- Incident Status Board -->
                <div class="status-board">
                    <div class="status-column critical">
                        <h3>Critical <span class="count" id="critical-count">0</span></h3>
                        <div class="incident-cards" id="critical-incidents"></div>
                    </div>
                    <div class="status-column high">
                        <h3>High <span class="count" id="high-count">0</span></h3>
                        <div class="incident-cards" id="high-incidents"></div>
                    </div>
                    <div class="status-column medium">
                        <h3>Medium <span class="count" id="medium-count">0</span></h3>
                        <div class="incident-cards" id="medium-incidents"></div>
                    </div>
                    <div class="status-column resolved">
                        <h3>Resolved <span class="count" id="resolved-count">0</span></h3>
                        <div class="incident-cards" id="resolved-incidents"></div>
                    </div>
                </div>

                <!-- Incident Details Panel -->
                <div class="incident-details-panel" id="details-panel">
                    <div class="no-selection">
                        <i class="fas fa-clipboard-list"></i>
                        <p>Select an incident to view details</p>
                    </div>
                </div>

                <!-- Response Timeline -->
                <div class="response-timeline">
                    <h3>Response Timeline</h3>
                    <div class="timeline-container" id="timeline-container">
                        <!-- Timeline items will be populated here -->
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const createBtn = document.getElementById('create-incident-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.createIncident());
        }

        const escalateBtn = document.getElementById('escalate-btn');
        if (escalateBtn) {
            escalateBtn.addEventListener('click', () => this.escalateIncident());
        }
    }

    async loadIncidents() {
        this.incidents = [
            {
                id: 'INC-2024-001',
                title: 'Data Breach - Customer Database',
                severity: 'critical',
                status: 'active',
                assignee: 'Security Team Alpha',
                created: new Date('2024-01-22T10:30:00'),
                lastUpdate: new Date('2024-01-22T14:30:00'),
                description: 'Unauthorized access detected to customer database server',
                affectedSystems: ['DB-PROD-01', 'WEB-APP-02'],
                responseActions: [
                    { time: '10:30', action: 'Incident detected', status: 'completed' },
                    { time: '10:35', action: 'Security team notified', status: 'completed' },
                    { time: '10:45', action: 'Systems isolated', status: 'completed' },
                    { time: '11:00', action: 'Forensic analysis started', status: 'in-progress' }
                ]
            },
            {
                id: 'INC-2024-002',
                title: 'Malware Detection - Executive Workstation',
                severity: 'high',
                status: 'active',
                assignee: 'SOC Analyst 1',
                created: new Date('2024-01-22T12:15:00'),
                lastUpdate: new Date('2024-01-22T13:45:00'),
                description: 'Advanced persistent threat detected on executive workstation',
                affectedSystems: ['WS-EXEC-03'],
                responseActions: [
                    { time: '12:15', action: 'Malware detected', status: 'completed' },
                    { time: '12:20', action: 'Workstation quarantined', status: 'completed' },
                    { time: '12:30', action: 'Malware analysis initiated', status: 'in-progress' }
                ]
            },
            {
                id: 'INC-2024-003',
                title: 'Phishing Campaign - Email Security',
                severity: 'medium',
                status: 'active',
                assignee: 'Email Security Team',
                created: new Date('2024-01-22T09:00:00'),
                lastUpdate: new Date('2024-01-22T11:30:00'),
                description: 'Coordinated phishing campaign targeting employees',
                affectedSystems: ['EMAIL-GATEWAY'],
                responseActions: [
                    { time: '09:00', action: 'Phishing emails detected', status: 'completed' },
                    { time: '09:15', action: 'Email filters updated', status: 'completed' },
                    { time: '09:30', action: 'User awareness sent', status: 'completed' }
                ]
            }
        ];

        this.renderIncidents();
    }

    renderIncidents() {
        // Count incidents by severity
        const counts = {
            critical: 0,
            high: 0,
            medium: 0,
            resolved: 0
        };

        // Clear all containers
        ['critical', 'high', 'medium', 'resolved'].forEach(severity => {
            const container = document.getElementById(`${severity}-incidents`);
            if (container) container.innerHTML = '';
        });

        // Render incidents in appropriate columns
        this.incidents.forEach(incident => {
            counts[incident.severity]++;
            
            const container = document.getElementById(`${incident.severity}-incidents`);
            if (container) {
                const card = document.createElement('div');
                card.className = `incident-card ${incident.severity}`;
                card.dataset.incidentId = incident.id;
                card.innerHTML = `
                    <div class="card-header">
                        <span class="incident-id">${incident.id}</span>
                        <span class="incident-time">${incident.created.toLocaleTimeString()}</span>
                    </div>
                    <h4 class="incident-title">${incident.title}</h4>
                    <div class="incident-meta">
                        <span class="assignee">${incident.assignee}</span>
                        <span class="affected-count">${incident.affectedSystems.length} systems</span>
                    </div>
                    <div class="incident-status">
                        <span class="status-badge ${incident.status}">${incident.status.toUpperCase()}</span>
                    </div>
                `;

                card.addEventListener('click', () => this.selectIncident(incident.id));
                container.appendChild(card);
            }
        });

        // Update counts
        Object.keys(counts).forEach(severity => {
            const countElement = document.getElementById(`${severity}-count`);
            if (countElement) {
                countElement.textContent = counts[severity];
            }
        });
    }

    selectIncident(incidentId) {
        this.activeIncident = this.incidents.find(inc => inc.id === incidentId);
        if (!this.activeIncident) return;

        // Highlight selected incident
        document.querySelectorAll('.incident-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-incident-id="${incidentId}"]`).classList.add('selected');

        // Show incident details
        this.showIncidentDetails();
        this.updateTimeline();
    }

    showIncidentDetails() {
        const detailsPanel = document.getElementById('details-panel');
        detailsPanel.innerHTML = `
            <div class="incident-detail-content">
                <div class="detail-header">
                    <h3>${this.activeIncident.title}</h3>
                    <div class="incident-badges">
                        <span class="severity-badge ${this.activeIncident.severity}">
                            ${this.activeIncident.severity.toUpperCase()}
                        </span>
                        <span class="status-badge ${this.activeIncident.status}">
                            ${this.activeIncident.status.toUpperCase()}
                        </span>
                    </div>
                </div>
                
                <div class="detail-description">
                    <p>${this.activeIncident.description}</p>
                </div>
                
                <div class="detail-info">
                    <div class="info-grid">
                        <div class="info-item">
                            <label>Incident ID</label>
                            <span>${this.activeIncident.id}</span>
                        </div>
                        <div class="info-item">
                            <label>Assignee</label>
                            <span>${this.activeIncident.assignee}</span>
                        </div>
                        <div class="info-item">
                            <label>Created</label>
                            <span>${this.activeIncident.created.toLocaleString()}</span>
                        </div>
                        <div class="info-item">
                            <label>Last Update</label>
                            <span>${this.activeIncident.lastUpdate.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
                
                <div class="affected-systems">
                    <h4>Affected Systems</h4>
                    <div class="systems-list">
                        ${this.activeIncident.affectedSystems.map(system => 
                            `<span class="system-tag">${system}</span>`
                        ).join('')}
                    </div>
                </div>
                
                <div class="incident-actions">
                    <button class="btn btn-primary" onclick="incidentResponseScreen.updateIncident()">
                        <i class="fas fa-edit"></i> Update
                    </button>
                    <button class="btn btn-warning" onclick="incidentResponseScreen.escalateIncident()">
                        <i class="fas fa-arrow-up"></i> Escalate
                    </button>
                    <button class="btn btn-success" onclick="incidentResponseScreen.resolveIncident()">
                        <i class="fas fa-check"></i> Resolve
                    </button>
                </div>
            </div>
        `;
    }

    updateTimeline() {
        const timelineContainer = document.getElementById('timeline-container');
        if (!timelineContainer || !this.activeIncident) return;

        timelineContainer.innerHTML = this.activeIncident.responseActions.map(action => `
            <div class="timeline-item ${action.status}">
                <div class="timeline-marker">
                    <i class="fas fa-${action.status === 'completed' ? 'check' : 'clock'}"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-time">${action.time}</div>
                    <div class="timeline-action">${action.action}</div>
                    <div class="timeline-status">${action.status.replace('-', ' ').toUpperCase()}</div>
                </div>
            </div>
        `).join('');
    }

    createIncident() {
        if (window.modal) {
            window.modal.show({
                title: 'Create New Incident',
                content: `
                    <div class="incident-form">
                        <div class="form-group">
                            <label>Incident Title</label>
                            <input type="text" id="incident-title" class="form-control" placeholder="Brief description of the incident">
                        </div>
                        
                        <div class="form-group">
                            <label>Severity</label>
                            <select id="incident-severity" class="form-control">
                                <option value="critical">Critical</option>
                                <option value="high">High</option>
                                <option value="medium" selected>Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Description</label>
                            <textarea id="incident-description" class="form-control" rows="3" placeholder="Detailed description of the incident"></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label>Assignee</label>
                            <select id="incident-assignee" class="form-control">
                                <option value="Security Team Alpha">Security Team Alpha</option>
                                <option value="SOC Analyst 1">SOC Analyst 1</option>
                                <option value="SOC Analyst 2">SOC Analyst 2</option>
                                <option value="Incident Response Team">Incident Response Team</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Affected Systems (comma-separated)</label>
                            <input type="text" id="affected-systems" class="form-control" placeholder="SYS-01, SYS-02">
                        </div>
                    </div>
                `,
                actions: [
                    {
                        text: 'Cancel',
                        class: 'btn-secondary',
                        action: () => window.modal.hide()
                    },
                    {
                        text: 'Create Incident',
                        class: 'btn-danger',
                        action: () => {
                            this.saveNewIncident();
                            window.modal.hide();
                        }
                    }
                ]
            });
        }
    }

    saveNewIncident() {
        const title = document.getElementById('incident-title')?.value || 'New Incident';
        const severity = document.getElementById('incident-severity')?.value || 'medium';
        const description = document.getElementById('incident-description')?.value || 'No description provided';
        const assignee = document.getElementById('incident-assignee')?.value || 'Security Team';
        const affectedSystems = document.getElementById('affected-systems')?.value.split(',').map(s => s.trim()).filter(s => s) || [];

        const newIncident = {
            id: `INC-2024-${String(this.incidents.length + 1).padStart(3, '0')}`,
            title,
            severity,
            status: 'active',
            assignee,
            created: new Date(),
            lastUpdate: new Date(),
            description,
            affectedSystems,
            responseActions: [
                { time: new Date().toLocaleTimeString(), action: 'Incident created', status: 'completed' }
            ]
        };

        this.incidents.unshift(newIncident);
        this.renderIncidents();
    }

    escalateIncident() {
        if (this.activeIncident) {
            alert(`Escalating incident ${this.activeIncident.id} to management team...`);
        } else {
            alert('Please select an incident to escalate.');
        }
    }

    updateIncident() {
        if (this.activeIncident) {
            alert('Update incident interface coming soon!');
        }
    }

    resolveIncident() {
        if (this.activeIncident) {
            this.activeIncident.status = 'resolved';
            this.activeIncident.lastUpdate = new Date();
            this.activeIncident.responseActions.push({
                time: new Date().toLocaleTimeString(),
                action: 'Incident resolved',
                status: 'completed'
            });
            
            this.renderIncidents();
            this.showIncidentDetails();
            this.updateTimeline();
        }
    }
}

// Export to global scope
window.IncidentResponseScreen = IncidentResponseScreen;
window.incidentResponseScreen = new IncidentResponseScreen();