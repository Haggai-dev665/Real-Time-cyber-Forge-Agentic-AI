/**
 * Risk Assessment Screen
 * Security risk assessment and management
 */

class RiskAssessmentScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.riskData = {};
        this.assessments = [];
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        this.container.innerHTML = this.createHTML();
        this.initializeComponents();
        await this.loadRiskData();
        
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
    }

    createHTML() {
        return `
            <div class="risk-assessment-screen">
                <!-- Header -->
                <div class="risk-header">
                    <div class="header-info">
                        <h2><i class="fas fa-balance-scale"></i> Risk Assessment</h2>
                        <p>Comprehensive security risk analysis and management</p>
                    </div>
                    <div class="header-controls">
                        <button class="btn btn-primary" id="new-assessment-btn">
                            <i class="fas fa-plus"></i> New Assessment
                        </button>
                        <button class="btn btn-secondary" id="export-report-btn">
                            <i class="fas fa-download"></i> Export Report
                        </button>
                    </div>
                </div>

                <!-- Risk Overview -->
                <div class="risk-overview">
                    <div class="risk-score-card">
                        <div class="score-circle">
                            <div class="score-value" id="overall-score">0</div>
                            <div class="score-label">Risk Score</div>
                        </div>
                        <div class="score-breakdown">
                            <div class="risk-level critical">
                                <span class="count" id="critical-risks">0</span>
                                <span class="label">Critical</span>
                            </div>
                            <div class="risk-level high">
                                <span class="count" id="high-risks">0</span>
                                <span class="label">High</span>
                            </div>
                            <div class="risk-level medium">
                                <span class="count" id="medium-risks">0</span>
                                <span class="label">Medium</span>
                            </div>
                            <div class="risk-level low">
                                <span class="count" id="low-risks">0</span>
                                <span class="label">Low</span>
                            </div>
                        </div>
                    </div>

                    <div class="risk-trends">
                        <h3>Risk Trends</h3>
                        <canvas id="risk-trends-chart"></canvas>
                    </div>
                </div>

                <!-- Risk Categories -->
                <div class="risk-categories">
                    <h3>Risk Categories</h3>
                    <div class="categories-grid">
                        <div class="category-card">
                            <div class="category-icon">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                            <div class="category-content">
                                <h4>Cybersecurity</h4>
                                <div class="risk-meter">
                                    <div class="meter-fill" style="width: 75%"></div>
                                </div>
                                <span class="risk-value">7.5/10</span>
                            </div>
                        </div>

                        <div class="category-card">
                            <div class="category-icon">
                                <i class="fas fa-database"></i>
                            </div>
                            <div class="category-content">
                                <h4>Data Protection</h4>
                                <div class="risk-meter">
                                    <div class="meter-fill" style="width: 60%"></div>
                                </div>
                                <span class="risk-value">6.0/10</span>
                            </div>
                        </div>

                        <div class="category-card">
                            <div class="category-icon">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="category-content">
                                <h4>Access Control</h4>
                                <div class="risk-meter">
                                    <div class="meter-fill" style="width: 85%"></div>
                                </div>
                                <span class="risk-value">8.5/10</span>
                            </div>
                        </div>

                        <div class="category-card">
                            <div class="category-icon">
                                <i class="fas fa-network-wired"></i>
                            </div>
                            <div class="category-content">
                                <h4>Network Security</h4>
                                <div class="risk-meter">
                                    <div class="meter-fill" style="width: 70%"></div>
                                </div>
                                <span class="risk-value">7.0/10</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Risk Assessment Table -->
                <div class="risk-assessments">
                    <h3>Risk Assessments</h3>
                    <div class="assessments-table" id="assessments-table">
                        <!-- Table will be populated here -->
                    </div>
                </div>

                <!-- Risk Mitigation -->
                <div class="risk-mitigation">
                    <h3>Risk Mitigation Recommendations</h3>
                    <div class="mitigation-list" id="mitigation-list">
                        <!-- Recommendations will be populated here -->
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        this.setupEventListeners();
        this.initializeCharts();
    }

    setupEventListeners() {
        const newAssessmentBtn = document.getElementById('new-assessment-btn');
        if (newAssessmentBtn) {
            newAssessmentBtn.addEventListener('click', () => this.createNewAssessment());
        }

        const exportReportBtn = document.getElementById('export-report-btn');
        if (exportReportBtn) {
            exportReportBtn.addEventListener('click', () => this.exportReport());
        }
    }

    initializeCharts() {
        const trendsCtx = document.getElementById('risk-trends-chart');
        if (trendsCtx) {
            new Chart(trendsCtx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Overall Risk Score',
                        data: [6.5, 7.2, 6.8, 7.5, 7.1, 6.9],
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Critical Risks',
                        data: [3, 5, 4, 6, 4, 3],
                        borderColor: '#feca57',
                        backgroundColor: 'rgba(254, 202, 87, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 10
                        }
                    }
                }
            });
        }
    }

    async loadRiskData() {
        // Simulate loading risk data
        this.riskData = {
            overallScore: 6.9,
            criticalRisks: 3,
            highRisks: 8,
            mediumRisks: 15,
            lowRisks: 24
        };

        this.assessments = [
            {
                id: 'RA-2024-001',
                name: 'Network Infrastructure Assessment',
                date: new Date('2024-01-20'),
                scope: 'Network Infrastructure',
                riskLevel: 'high',
                score: 7.5,
                status: 'completed',
                assessor: 'Security Team Alpha'
            },
            {
                id: 'RA-2024-002',
                name: 'Application Security Review',
                date: new Date('2024-01-18'),
                scope: 'Web Applications',
                riskLevel: 'medium',
                score: 6.2,
                status: 'completed',
                assessor: 'SOC Analyst 1'
            },
            {
                id: 'RA-2024-003',
                name: 'Employee Access Audit',
                date: new Date('2024-01-15'),
                scope: 'Access Control',
                riskLevel: 'low',
                score: 4.1,
                status: 'in-progress',
                assessor: 'Compliance Team'
            }
        ];

        this.updateRiskOverview();
        this.renderAssessmentsTable();
        this.renderMitigationRecommendations();
    }

    updateRiskOverview() {
        document.getElementById('overall-score').textContent = this.riskData.overallScore.toFixed(1);
        document.getElementById('critical-risks').textContent = this.riskData.criticalRisks;
        document.getElementById('high-risks').textContent = this.riskData.highRisks;
        document.getElementById('medium-risks').textContent = this.riskData.mediumRisks;
        document.getElementById('low-risks').textContent = this.riskData.lowRisks;
    }

    renderAssessmentsTable() {
        const table = document.getElementById('assessments-table');
        if (!table) return;

        table.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Assessment ID</th>
                        <th>Name</th>
                        <th>Date</th>
                        <th>Scope</th>
                        <th>Risk Level</th>
                        <th>Score</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.assessments.map(assessment => `
                        <tr>
                            <td>${assessment.id}</td>
                            <td>${assessment.name}</td>
                            <td>${assessment.date.toLocaleDateString()}</td>
                            <td>${assessment.scope}</td>
                            <td><span class="risk-badge ${assessment.riskLevel}">${assessment.riskLevel.toUpperCase()}</span></td>
                            <td>${assessment.score}/10</td>
                            <td><span class="status-badge ${assessment.status}">${assessment.status.toUpperCase()}</span></td>
                            <td>
                                <button class="btn btn-sm btn-secondary" onclick="riskAssessmentScreen.viewAssessment('${assessment.id}')">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                <button class="btn btn-sm btn-primary" onclick="riskAssessmentScreen.editAssessment('${assessment.id}')">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    renderMitigationRecommendations() {
        const mitigationList = document.getElementById('mitigation-list');
        if (!mitigationList) return;

        const recommendations = [
            {
                priority: 'critical',
                title: 'Implement Multi-Factor Authentication',
                description: 'Deploy MFA across all critical systems to reduce unauthorized access risk',
                effort: 'Medium',
                impact: 'High'
            },
            {
                priority: 'high',
                title: 'Update Network Segmentation',
                description: 'Improve network segmentation to limit lateral movement of threats',
                effort: 'High',
                impact: 'High'
            },
            {
                priority: 'medium',
                title: 'Enhanced Employee Training',
                description: 'Conduct additional security awareness training for all employees',
                effort: 'Low',
                impact: 'Medium'
            },
            {
                priority: 'medium',
                title: 'Vulnerability Patch Management',
                description: 'Implement automated patch management system for critical vulnerabilities',
                effort: 'Medium',
                impact: 'Medium'
            }
        ];

        mitigationList.innerHTML = recommendations.map(rec => `
            <div class="mitigation-item ${rec.priority}">
                <div class="mitigation-header">
                    <h4>${rec.title}</h4>
                    <span class="priority-badge ${rec.priority}">${rec.priority.toUpperCase()}</span>
                </div>
                <p class="mitigation-description">${rec.description}</p>
                <div class="mitigation-meta">
                    <span class="effort">Effort: ${rec.effort}</span>
                    <span class="impact">Impact: ${rec.impact}</span>
                    <button class="btn btn-sm btn-primary">Implement</button>
                </div>
            </div>
        `).join('');
    }

    createNewAssessment() {
        if (window.modal) {
            window.modal.show({
                title: 'Create New Risk Assessment',
                content: `
                    <div class="assessment-form">
                        <div class="form-group">
                            <label>Assessment Name</label>
                            <input type="text" id="assessment-name" class="form-control" placeholder="Enter assessment name">
                        </div>
                        
                        <div class="form-group">
                            <label>Scope</label>
                            <select id="assessment-scope" class="form-control">
                                <option value="network">Network Infrastructure</option>
                                <option value="applications">Web Applications</option>
                                <option value="data">Data Protection</option>
                                <option value="access">Access Control</option>
                                <option value="physical">Physical Security</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Assessor</label>
                            <select id="assessment-assessor" class="form-control">
                                <option value="Security Team Alpha">Security Team Alpha</option>
                                <option value="SOC Analyst 1">SOC Analyst 1</option>
                                <option value="SOC Analyst 2">SOC Analyst 2</option>
                                <option value="Compliance Team">Compliance Team</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Assessment Type</label>
                            <select id="assessment-type" class="form-control">
                                <option value="automated">Automated Scan</option>
                                <option value="manual">Manual Review</option>
                                <option value="hybrid">Hybrid Assessment</option>
                            </select>
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
                        text: 'Start Assessment',
                        class: 'btn-primary',
                        action: () => {
                            this.startNewAssessment();
                            window.modal.hide();
                        }
                    }
                ]
            });
        }
    }

    startNewAssessment() {
        const name = document.getElementById('assessment-name')?.value || 'New Assessment';
        const scope = document.getElementById('assessment-scope')?.value || 'network';
        const assessor = document.getElementById('assessment-assessor')?.value || 'Security Team';
        const type = document.getElementById('assessment-type')?.value || 'automated';

        const newAssessment = {
            id: `RA-2024-${String(this.assessments.length + 1).padStart(3, '0')}`,
            name,
            date: new Date(),
            scope,
            riskLevel: 'medium',
            score: 0,
            status: 'in-progress',
            assessor,
            type
        };

        this.assessments.unshift(newAssessment);
        this.renderAssessmentsTable();
        
        alert(`Assessment ${newAssessment.id} has been started. Results will be available shortly.`);
    }

    viewAssessment(assessmentId) {
        const assessment = this.assessments.find(a => a.id === assessmentId);
        if (assessment) {
            alert(`Viewing assessment details for ${assessment.name}`);
        }
    }

    editAssessment(assessmentId) {
        const assessment = this.assessments.find(a => a.id === assessmentId);
        if (assessment) {
            alert(`Editing assessment ${assessment.name}`);
        }
    }

    exportReport() {
        const reportData = {
            overview: this.riskData,
            assessments: this.assessments,
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `risk-assessment-report-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Export to global scope
window.RiskAssessmentScreen = RiskAssessmentScreen;
window.riskAssessmentScreen = new RiskAssessmentScreen();