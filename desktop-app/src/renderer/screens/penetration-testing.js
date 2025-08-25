/**
 * Penetration Testing Screen
 * Penetration testing tools and vulnerability assessment
 */

class PenetrationTestingScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.activeTests = [];
        this.testHistory = [];
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        this.container.innerHTML = this.createHTML();
        this.initializeComponents();
        await this.loadTestData();
        
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
    }

    createHTML() {
        return `
            <div class="penetration-testing-screen">
                <!-- Header -->
                <div class="pentest-header">
                    <div class="header-info">
                        <h2><i class="fas fa-user-ninja"></i> Penetration Testing</h2>
                        <p>Ethical hacking and vulnerability assessment tools</p>
                    </div>
                    <div class="header-controls">
                        <button class="btn btn-primary" id="new-test-btn">
                            <i class="fas fa-play"></i> New Test
                        </button>
                        <button class="btn btn-secondary" id="scan-templates-btn">
                            <i class="fas fa-file-alt"></i> Templates
                        </button>
                    </div>
                </div>

                <!-- Testing Tools -->
                <div class="testing-tools">
                    <h3>Testing Tools</h3>
                    <div class="tools-grid">
                        <div class="tool-card">
                            <div class="tool-icon">
                                <i class="fas fa-search"></i>
                            </div>
                            <div class="tool-content">
                                <h4>Port Scanner</h4>
                                <p>Discover open ports and services</p>
                                <button class="btn btn-sm btn-primary" onclick="pentestScreen.launchTool('portscan')">Launch</button>
                            </div>
                        </div>

                        <div class="tool-card">
                            <div class="tool-icon">
                                <i class="fas fa-bug"></i>
                            </div>
                            <div class="tool-content">
                                <h4>Vulnerability Scanner</h4>
                                <p>Automated vulnerability assessment</p>
                                <button class="btn btn-sm btn-primary" onclick="pentestScreen.launchTool('vulnscan')">Launch</button>
                            </div>
                        </div>

                        <div class="tool-card">
                            <div class="tool-icon">
                                <i class="fas fa-globe"></i>
                            </div>
                            <div class="tool-content">
                                <h4>Web App Scanner</h4>
                                <p>Web application security testing</p>
                                <button class="btn btn-sm btn-primary" onclick="pentestScreen.launchTool('webscan')">Launch</button>
                            </div>
                        </div>

                        <div class="tool-card">
                            <div class="tool-icon">
                                <i class="fas fa-wifi"></i>
                            </div>
                            <div class="tool-content">
                                <h4>Network Scanner</h4>
                                <p>Network discovery and mapping</p>
                                <button class="btn btn-sm btn-primary" onclick="pentestScreen.launchTool('netscan')">Launch</button>
                            </div>
                        </div>

                        <div class="tool-card">
                            <div class="tool-icon">
                                <i class="fas fa-key"></i>
                            </div>
                            <div class="tool-content">
                                <h4>Password Tester</h4>
                                <p>Password strength and brute force testing</p>
                                <button class="btn btn-sm btn-primary" onclick="pentestScreen.launchTool('passtest')">Launch</button>
                            </div>
                        </div>

                        <div class="tool-card">
                            <div class="tool-icon">
                                <i class="fas fa-code"></i>
                            </div>
                            <div class="tool-content">
                                <h4>Payload Generator</h4>
                                <p>Generate custom exploit payloads</p>
                                <button class="btn btn-sm btn-primary" onclick="pentestScreen.launchTool('payload')">Launch</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Active Tests -->
                <div class="active-tests">
                    <h3>Active Tests</h3>
                    <div class="tests-container" id="active-tests-container">
                        <!-- Active tests will be populated here -->
                    </div>
                </div>

                <!-- Test Results -->
                <div class="test-results">
                    <h3>Recent Test Results</h3>
                    <div class="results-table" id="results-table">
                        <!-- Results table will be populated here -->
                    </div>
                </div>

                <!-- Vulnerability Database -->
                <div class="vulnerability-db">
                    <h3>Vulnerability Database</h3>
                    <div class="vuln-search">
                        <input type="text" placeholder="Search vulnerabilities..." class="form-control" id="vuln-search">
                        <button class="btn btn-primary">Search CVE</button>
                    </div>
                    <div class="vuln-list" id="vuln-list">
                        <!-- Vulnerability list will be populated here -->
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const newTestBtn = document.getElementById('new-test-btn');
        if (newTestBtn) {
            newTestBtn.addEventListener('click', () => this.createNewTest());
        }

        const templatesBtn = document.getElementById('scan-templates-btn');
        if (templatesBtn) {
            templatesBtn.addEventListener('click', () => this.showScanTemplates());
        }
    }

    async loadTestData() {
        this.activeTests = [
            {
                id: 'PT-2024-001',
                type: 'Port Scan',
                target: '192.168.1.0/24',
                status: 'running',
                progress: 67,
                startTime: new Date(),
                estimatedTime: '15 minutes'
            },
            {
                id: 'PT-2024-002',
                type: 'Web App Scan',
                target: 'https://example.com',
                status: 'running',
                progress: 23,
                startTime: new Date(Date.now() - 600000),
                estimatedTime: '45 minutes'
            }
        ];

        this.testHistory = [
            {
                id: 'PT-2024-003',
                type: 'Vulnerability Scan',
                target: '10.0.0.100',
                status: 'completed',
                findings: 12,
                severity: 'high',
                completedTime: new Date(Date.now() - 3600000)
            },
            {
                id: 'PT-2024-004',
                type: 'Network Scan',
                target: '192.168.0.0/16',
                status: 'completed',
                findings: 5,
                severity: 'medium',
                completedTime: new Date(Date.now() - 7200000)
            }
        ];

        this.renderActiveTests();
        this.renderTestResults();
        this.renderVulnerabilityDatabase();
    }

    renderActiveTests() {
        const container = document.getElementById('active-tests-container');
        if (!container) return;

        if (this.activeTests.length === 0) {
            container.innerHTML = '<div class="no-tests"><p>No active tests running</p></div>';
            return;
        }

        container.innerHTML = this.activeTests.map(test => `
            <div class="test-card running">
                <div class="test-header">
                    <h4>${test.type}</h4>
                    <span class="test-status ${test.status}">${test.status.toUpperCase()}</span>
                </div>
                <div class="test-details">
                    <div class="test-target">Target: ${test.target}</div>
                    <div class="test-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${test.progress}%"></div>
                        </div>
                        <span class="progress-text">${test.progress}% - ${test.estimatedTime} remaining</span>
                    </div>
                </div>
                <div class="test-actions">
                    <button class="btn btn-sm btn-warning" onclick="pentestScreen.pauseTest('${test.id}')">
                        <i class="fas fa-pause"></i> Pause
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="pentestScreen.stopTest('${test.id}')">
                        <i class="fas fa-stop"></i> Stop
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="pentestScreen.viewTestLogs('${test.id}')">
                        <i class="fas fa-file-alt"></i> Logs
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderTestResults() {
        const table = document.getElementById('results-table');
        if (!table) return;

        table.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Test ID</th>
                        <th>Type</th>
                        <th>Target</th>
                        <th>Findings</th>
                        <th>Severity</th>
                        <th>Completed</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.testHistory.map(test => `
                        <tr>
                            <td>${test.id}</td>
                            <td>${test.type}</td>
                            <td>${test.target}</td>
                            <td>${test.findings}</td>
                            <td><span class="severity-badge ${test.severity}">${test.severity.toUpperCase()}</span></td>
                            <td>${test.completedTime.toLocaleString()}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="pentestScreen.viewResults('${test.id}')">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="pentestScreen.downloadReport('${test.id}')">
                                    <i class="fas fa-download"></i> Report
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    renderVulnerabilityDatabase() {
        const vulnList = document.getElementById('vuln-list');
        if (!vulnList) return;

        const vulnerabilities = [
            {
                cve: 'CVE-2024-0001',
                title: 'Remote Code Execution in Web Framework',
                severity: 'critical',
                score: 9.8,
                published: '2024-01-15'
            },
            {
                cve: 'CVE-2024-0002',
                title: 'SQL Injection in Database Driver',
                severity: 'high',
                score: 8.1,
                published: '2024-01-12'
            },
            {
                cve: 'CVE-2024-0003',
                title: 'Cross-Site Scripting in Admin Panel',
                severity: 'medium',
                score: 6.4,
                published: '2024-01-10'
            }
        ];

        vulnList.innerHTML = vulnerabilities.map(vuln => `
            <div class="vuln-item">
                <div class="vuln-header">
                    <span class="cve-id">${vuln.cve}</span>
                    <span class="cvss-score">${vuln.score}</span>
                    <span class="severity-badge ${vuln.severity}">${vuln.severity.toUpperCase()}</span>
                </div>
                <div class="vuln-title">${vuln.title}</div>
                <div class="vuln-meta">
                    <span>Published: ${vuln.published}</span>
                    <button class="btn btn-sm btn-secondary">View Details</button>
                </div>
            </div>
        `).join('');
    }

    launchTool(toolType) {
        if (window.modal) {
            let modalContent = '';
            let modalTitle = '';

            switch (toolType) {
                case 'portscan':
                    modalTitle = 'Port Scanner';
                    modalContent = `
                        <div class="tool-form">
                            <div class="form-group">
                                <label>Target</label>
                                <input type="text" id="port-target" class="form-control" placeholder="192.168.1.1 or 192.168.1.0/24">
                            </div>
                            <div class="form-group">
                                <label>Port Range</label>
                                <input type="text" id="port-range" class="form-control" placeholder="1-65535" value="1-1000">
                            </div>
                            <div class="form-group">
                                <label>Scan Type</label>
                                <select id="scan-type" class="form-control">
                                    <option value="tcp">TCP Connect</option>
                                    <option value="syn">SYN Stealth</option>
                                    <option value="udp">UDP Scan</option>
                                    <option value="comprehensive">Comprehensive</option>
                                </select>
                            </div>
                        </div>
                    `;
                    break;
                case 'vulnscan':
                    modalTitle = 'Vulnerability Scanner';
                    modalContent = `
                        <div class="tool-form">
                            <div class="form-group">
                                <label>Target</label>
                                <input type="text" id="vuln-target" class="form-control" placeholder="IP address or hostname">
                            </div>
                            <div class="form-group">
                                <label>Scan Profile</label>
                                <select id="scan-profile" class="form-control">
                                    <option value="quick">Quick Scan</option>
                                    <option value="standard">Standard Scan</option>
                                    <option value="comprehensive">Comprehensive Scan</option>
                                    <option value="custom">Custom Profile</option>
                                </select>
                            </div>
                        </div>
                    `;
                    break;
                case 'webscan':
                    modalTitle = 'Web Application Scanner';
                    modalContent = `
                        <div class="tool-form">
                            <div class="form-group">
                                <label>Target URL</label>
                                <input type="url" id="web-target" class="form-control" placeholder="https://example.com">
                            </div>
                            <div class="form-group">
                                <label>Authentication</label>
                                <select id="auth-type" class="form-control">
                                    <option value="none">No Authentication</option>
                                    <option value="basic">Basic Auth</option>
                                    <option value="form">Form-based</option>
                                    <option value="cookie">Cookie-based</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Scan Scope</label>
                                <div class="checkbox-group">
                                    <label><input type="checkbox" checked> SQL Injection</label>
                                    <label><input type="checkbox" checked> XSS</label>
                                    <label><input type="checkbox" checked> CSRF</label>
                                    <label><input type="checkbox"> Directory Traversal</label>
                                </div>
                            </div>
                        </div>
                    `;
                    break;
                default:
                    modalTitle = 'Tool Configuration';
                    modalContent = '<p>Tool configuration interface coming soon!</p>';
            }

            window.modal.show({
                title: modalTitle,
                content: modalContent,
                actions: [
                    {
                        text: 'Cancel',
                        class: 'btn-secondary',
                        action: () => window.modal.hide()
                    },
                    {
                        text: 'Start Test',
                        class: 'btn-primary',
                        action: () => {
                            this.startTest(toolType);
                            window.modal.hide();
                        }
                    }
                ]
            });
        }
    }

    startTest(toolType) {
        const testId = `PT-2024-${String(this.activeTests.length + this.testHistory.length + 1).padStart(3, '0')}`;
        
        const newTest = {
            id: testId,
            type: this.getToolDisplayName(toolType),
            target: this.getTargetFromForm(toolType),
            status: 'running',
            progress: 0,
            startTime: new Date(),
            estimatedTime: this.getEstimatedTime(toolType)
        };

        this.activeTests.push(newTest);
        this.renderActiveTests();
        this.simulateTestProgress(testId);
    }

    getToolDisplayName(toolType) {
        const names = {
            portscan: 'Port Scan',
            vulnscan: 'Vulnerability Scan',
            webscan: 'Web App Scan',
            netscan: 'Network Scan',
            passtest: 'Password Test',
            payload: 'Payload Generation'
        };
        return names[toolType] || 'Unknown Test';
    }

    getTargetFromForm(toolType) {
        const inputs = {
            portscan: '#port-target',
            vulnscan: '#vuln-target',
            webscan: '#web-target'
        };
        const input = document.querySelector(inputs[toolType]);
        return input ? input.value : 'Unknown Target';
    }

    getEstimatedTime(toolType) {
        const times = {
            portscan: '15 minutes',
            vulnscan: '30 minutes',
            webscan: '45 minutes',
            netscan: '20 minutes',
            passtest: '60 minutes',
            payload: '5 minutes'
        };
        return times[toolType] || '30 minutes';
    }

    simulateTestProgress(testId) {
        const test = this.activeTests.find(t => t.id === testId);
        if (!test) return;

        const updateProgress = () => {
            if (test.status !== 'running') return;
            
            test.progress = Math.min(test.progress + Math.random() * 15, 100);
            
            if (test.progress >= 100) {
                test.status = 'completed';
                this.moveTestToHistory(testId);
            }
            
            this.renderActiveTests();
            
            if (test.status === 'running') {
                setTimeout(updateProgress, 2000);
            }
        };

        updateProgress();
    }

    moveTestToHistory(testId) {
        const testIndex = this.activeTests.findIndex(t => t.id === testId);
        if (testIndex === -1) return;

        const test = this.activeTests.splice(testIndex, 1)[0];
        
        const historyEntry = {
            id: test.id,
            type: test.type,
            target: test.target,
            status: 'completed',
            findings: Math.floor(Math.random() * 20),
            severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
            completedTime: new Date()
        };

        this.testHistory.unshift(historyEntry);
        this.renderTestResults();
    }

    createNewTest() {
        alert('Custom test creation interface coming soon!');
    }

    showScanTemplates() {
        alert('Scan templates interface coming soon!');
    }

    pauseTest(testId) {
        const test = this.activeTests.find(t => t.id === testId);
        if (test) {
            test.status = 'paused';
            this.renderActiveTests();
        }
    }

    stopTest(testId) {
        const testIndex = this.activeTests.findIndex(t => t.id === testId);
        if (testIndex !== -1) {
            this.activeTests.splice(testIndex, 1);
            this.renderActiveTests();
        }
    }

    viewTestLogs(testId) {
        alert(`Viewing logs for test ${testId}`);
    }

    viewResults(testId) {
        alert(`Viewing detailed results for test ${testId}`);
    }

    downloadReport(testId) {
        alert(`Downloading report for test ${testId}`);
    }
}

// Export to global scope
window.PenetrationTestingScreen = PenetrationTestingScreen;
window.pentestScreen = new PenetrationTestingScreen();