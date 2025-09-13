/**
 * Domain Intelligence Screen Component
 * Advanced domain analysis and intelligence gathering
 */

class DomainIntelligenceScreen {
    constructor() {
        this.isInitialized = false;
        this.analysisHistory = [];
        this.watchedDomains = [];
        this.domainData = new Map();
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('Initializing Domain Intelligence Screen...');
        await this.loadDomainData();
        this.setupEventListeners();
        this.isInitialized = true;
    }

    render() {
        return `
            <div class="screen domain-intelligence-screen">
                <div class="screen-header">
                    <div class="header-content">
                        <div class="header-title">
                            <i class="fas fa-globe-americas"></i>
                            <h1>Domain Intelligence Center</h1>
                            <span class="status-badge monitoring">Monitoring</span>
                        </div>
                        <div class="header-actions">
                            <button class="btn btn-primary" id="bulk-analysis-btn">
                                <i class="fas fa-layer-group"></i>
                                Bulk Analysis
                            </button>
                            <button class="btn btn-secondary" id="domain-watch-btn">
                                <i class="fas fa-eye"></i>
                                Watch Domain
                            </button>
                        </div>
                    </div>
                </div>

                <div class="screen-content">
                    <!-- Domain Analysis Input -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Domain Analysis</h2>
                        </div>
                        <div class="domain-input-section">
                            <div class="input-group large">
                                <input type="text" id="domain-input" placeholder="Enter domain name (e.g., example.com)" />
                                <button class="btn btn-primary" id="analyze-domain-btn">
                                    <i class="fas fa-search"></i>
                                    Analyze
                                </button>
                                <button class="btn btn-accent" id="deep-scan-btn">
                                    <i class="fas fa-microscope"></i>
                                    Deep Scan
                                </button>
                            </div>
                            <div class="analysis-options">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="check-subdomains" checked>
                                    <span class="checkmark"></span>
                                    Include Subdomains
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="check-certificates" checked>
                                    <span class="checkmark"></span>
                                    SSL Certificates
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="check-dns-records" checked>
                                    <span class="checkmark"></span>
                                    DNS Records
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="check-reputation" checked>
                                    <span class="checkmark"></span>
                                    Reputation Check
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="check-technologies" checked>
                                    <span class="checkmark"></span>
                                    Technology Stack
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Quick Analysis Cards -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Quick Intelligence</h2>
                        </div>
                        <div class="quick-intel-grid">
                            <div class="intel-card" data-action="phishing-check">
                                <div class="card-icon">
                                    <i class="fas fa-fish"></i>
                                </div>
                                <div class="card-content">
                                    <h3>Phishing Detection</h3>
                                    <p>Check for phishing indicators and suspicious patterns</p>
                                    <div class="card-stats">
                                        <span class="stat-value" id="phishing-detected">0</span>
                                        <span class="stat-label">Detected Today</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="intel-card" data-action="typosquatting-check">
                                <div class="card-icon">
                                    <i class="fas fa-clone"></i>
                                </div>
                                <div class="card-content">
                                    <h3>Typosquatting</h3>
                                    <p>Find domains that mimic legitimate ones</p>
                                    <div class="card-stats">
                                        <span class="stat-value" id="typosquats-found">0</span>
                                        <span class="stat-label">Suspects Found</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="intel-card" data-action="malware-hosting">
                                <div class="card-icon">
                                    <i class="fas fa-virus"></i>
                                </div>
                                <div class="card-content">
                                    <h3>Malware Hosting</h3>
                                    <p>Identify domains hosting malicious content</p>
                                    <div class="card-stats">
                                        <span class="stat-value" id="malware-hosts">0</span>
                                        <span class="stat-label">Active Threats</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="intel-card" data-action="c2-communication">
                                <div class="card-icon">
                                    <i class="fas fa-satellite-dish"></i>
                                </div>
                                <div class="card-content">
                                    <h3>C2 Communication</h3>
                                    <p>Detect command and control server patterns</p>
                                    <div class="card-stats">
                                        <span class="stat-value" id="c2-servers">0</span>
                                        <span class="stat-label">C2 Servers</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Analysis Results -->
                    <div class="content-section" id="analysis-results-section" style="display: none;">
                        <div class="section-header">
                            <h2>Analysis Results</h2>
                            <div class="header-controls">
                                <button class="btn btn-sm" id="export-results-btn">
                                    <i class="fas fa-download"></i>
                                    Export
                                </button>
                                <button class="btn btn-sm" id="share-results-btn">
                                    <i class="fas fa-share"></i>
                                    Share
                                </button>
                            </div>
                        </div>
                        <div class="analysis-results-container" id="analysis-results">
                            <!-- Results will be populated here -->
                        </div>
                    </div>

                    <!-- Watched Domains -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Monitored Domains</h2>
                            <div class="header-controls">
                                <select id="watch-filter">
                                    <option value="all">All Domains</option>
                                    <option value="suspicious">Suspicious</option>
                                    <option value="clean">Clean</option>
                                    <option value="new">New</option>
                                </select>
                                <button class="btn btn-sm" id="refresh-watch-btn">
                                    <i class="fas fa-sync-alt"></i>
                                    Refresh
                                </button>
                            </div>
                        </div>
                        <div class="watched-domains-container">
                            <div class="domains-table">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Domain</th>
                                            <th>Status</th>
                                            <th>Risk Score</th>
                                            <th>Last Check</th>
                                            <th>Changes</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="watched-domains-tbody">
                                        <!-- Watched domains will be populated here -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Recent Activity -->
                    <div class="content-section">
                        <div class="section-header">
                            <h2>Recent Domain Activity</h2>
                        </div>
                        <div class="activity-timeline" id="domain-activity-timeline">
                            <!-- Activity items will be populated here -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadDomainData() {
        try {
            // Load watched domains
            const watchedResponse = await fetch('/api/domain-intel/watched');
            const watchedData = await watchedResponse.json();
            
            if (watchedData.success) {
                this.watchedDomains = watchedData.domains;
                this.updateWatchedDomainsDisplay();
            }

            // Load recent activity
            const activityResponse = await fetch('/api/domain-intel/activity');
            const activityData = await activityResponse.json();
            
            if (activityData.success) {
                this.updateActivityTimeline(activityData.activities);
            }

            // Load statistics
            await this.loadStatistics();
            
        } catch (error) {
            console.error('Error loading domain data:', error);
            this.showNotification('Failed to load domain data', 'error');
        }
    }

    setupEventListeners() {
        // Domain analysis
        document.getElementById('analyze-domain-btn')?.addEventListener('click', () => {
            this.analyzeDomain();
        });

        document.getElementById('deep-scan-btn')?.addEventListener('click', () => {
            this.deepScanDomain();
        });

        // Quick intelligence cards
        document.querySelectorAll('.intel-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const action = card.dataset.action;
                this.runQuickIntelligence(action);
            });
        });

        // Bulk analysis
        document.getElementById('bulk-analysis-btn')?.addEventListener('click', () => {
            this.showBulkAnalysisModal();
        });

        // Domain watch
        document.getElementById('domain-watch-btn')?.addEventListener('click', () => {
            this.addDomainToWatch();
        });

        // Enter key for domain input
        document.getElementById('domain-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.analyzeDomain();
            }
        });

        // Filter watched domains
        document.getElementById('watch-filter')?.addEventListener('change', (e) => {
            this.filterWatchedDomains(e.target.value);
        });
    }

    async analyzeDomain() {
        const domainInput = document.getElementById('domain-input').value.trim();
        if (!domainInput) {
            this.showNotification('Please enter a domain name', 'warning');
            return;
        }

        // Validate domain format
        if (!this.isValidDomain(domainInput)) {
            this.showNotification('Please enter a valid domain name', 'warning');
            return;
        }

        const options = {
            checkSubdomains: document.getElementById('check-subdomains').checked,
            checkCertificates: document.getElementById('check-certificates').checked,
            checkDnsRecords: document.getElementById('check-dns-records').checked,
            checkReputation: document.getElementById('check-reputation').checked,
            checkTechnologies: document.getElementById('check-technologies').checked
        };

        try {
            this.showAnalysisLoading();
            
            const response = await fetch('/api/domain-intel/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    domain: domainInput,
                    options: options
                })
            });

            const result = await response.json();
            if (result.success) {
                this.displayAnalysisResults(result.analysis);
                this.addToHistory(result.analysis);
            } else {
                this.showNotification(result.message || 'Analysis failed', 'error');
            }
        } catch (error) {
            console.error('Error analyzing domain:', error);
            this.showNotification('Failed to analyze domain', 'error');
        } finally {
            this.hideAnalysisLoading();
        }
    }

    async deepScanDomain() {
        const domainInput = document.getElementById('domain-input').value.trim();
        if (!domainInput) {
            this.showNotification('Please enter a domain name', 'warning');
            return;
        }

        try {
            this.showAnalysisLoading();
            
            const response = await fetch('/api/domain-intel/deep-scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    domain: domainInput,
                    depth: 'comprehensive',
                    includeScreenshots: true,
                    scanPorts: true,
                    analyzeContent: true,
                    checkVulnerabilities: true
                })
            });

            const result = await response.json();
            if (result.success) {
                this.displayDeepScanResults(result.scan);
            }
        } catch (error) {
            console.error('Error performing deep scan:', error);
            this.showNotification('Failed to perform deep scan', 'error');
        } finally {
            this.hideAnalysisLoading();
        }
    }

    displayAnalysisResults(analysis) {
        const resultsContainer = document.getElementById('analysis-results');
        const resultsSection = document.getElementById('analysis-results-section');
        
        if (!resultsContainer || !resultsSection) return;

        resultsSection.style.display = 'block';
        
        resultsContainer.innerHTML = `
            <div class="analysis-summary">
                <div class="summary-header">
                    <h3>${analysis.domain}</h3>
                    <div class="risk-score ${this.getRiskScoreClass(analysis.riskScore)}">
                        Risk Score: ${analysis.riskScore}/100
                    </div>
                </div>
                <div class="summary-stats">
                    <div class="stat-item">
                        <span class="stat-value">${analysis.subdomains?.length || 0}</span>
                        <span class="stat-label">Subdomains</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${analysis.dnsRecords?.length || 0}</span>
                        <span class="stat-label">DNS Records</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${analysis.certificates?.length || 0}</span>
                        <span class="stat-label">Certificates</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${analysis.technologies?.length || 0}</span>
                        <span class="stat-label">Technologies</span>
                    </div>
                </div>
            </div>

            <div class="analysis-tabs">
                <div class="tab-buttons">
                    <button class="tab-btn active" data-tab="overview">Overview</button>
                    <button class="tab-btn" data-tab="dns">DNS Records</button>
                    <button class="tab-btn" data-tab="subdomains">Subdomains</button>
                    <button class="tab-btn" data-tab="certificates">Certificates</button>
                    <button class="tab-btn" data-tab="reputation">Reputation</button>
                    <button class="tab-btn" data-tab="technologies">Technologies</button>
                </div>
                
                <div class="tab-content">
                    <div class="tab-panel active" data-panel="overview">
                        ${this.renderOverviewPanel(analysis)}
                    </div>
                    <div class="tab-panel" data-panel="dns">
                        ${this.renderDNSPanel(analysis.dnsRecords)}
                    </div>
                    <div class="tab-panel" data-panel="subdomains">
                        ${this.renderSubdomainsPanel(analysis.subdomains)}
                    </div>
                    <div class="tab-panel" data-panel="certificates">
                        ${this.renderCertificatesPanel(analysis.certificates)}
                    </div>
                    <div class="tab-panel" data-panel="reputation">
                        ${this.renderReputationPanel(analysis.reputation)}
                    </div>
                    <div class="tab-panel" data-panel="technologies">
                        ${this.renderTechnologiesPanel(analysis.technologies)}
                    </div>
                </div>
            </div>
        `;

        this.setupTabSwitching();
    }

    renderOverviewPanel(analysis) {
        return `
            <div class="overview-panel">
                <div class="info-grid">
                    <div class="info-section">
                        <h4>Domain Information</h4>
                        <div class="info-items">
                            <div class="info-item">
                                <span class="label">Registrar:</span>
                                <span class="value">${analysis.whois?.registrar || 'Unknown'}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">Created:</span>
                                <span class="value">${analysis.whois?.createdDate || 'Unknown'}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">Expires:</span>
                                <span class="value">${analysis.whois?.expiresDate || 'Unknown'}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">Age:</span>
                                <span class="value">${analysis.domainAge || 'Unknown'} days</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="info-section">
                        <h4>Security Status</h4>
                        <div class="security-indicators">
                            <div class="indicator ${analysis.hasSSL ? 'good' : 'bad'}">
                                <i class="fas ${analysis.hasSSL ? 'fa-lock' : 'fa-unlock'}"></i>
                                <span>SSL Certificate: ${analysis.hasSSL ? 'Valid' : 'Invalid'}</span>
                            </div>
                            <div class="indicator ${analysis.isPhishing ? 'bad' : 'good'}">
                                <i class="fas ${analysis.isPhishing ? 'fa-exclamation-triangle' : 'fa-check'}"></i>
                                <span>Phishing: ${analysis.isPhishing ? 'Detected' : 'Not Detected'}</span>
                            </div>
                            <div class="indicator ${analysis.isMalware ? 'bad' : 'good'}">
                                <i class="fas ${analysis.isMalware ? 'fa-virus' : 'fa-shield-alt'}"></i>
                                <span>Malware: ${analysis.isMalware ? 'Detected' : 'Clean'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${analysis.screenshots ? `
                    <div class="info-section">
                        <h4>Website Screenshot</h4>
                        <div class="screenshot-container">
                            <img src="${analysis.screenshots.desktop}" alt="Website Screenshot" class="domain-screenshot" />
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderDNSPanel(dnsRecords) {
        if (!dnsRecords || dnsRecords.length === 0) {
            return '<div class="empty-state">No DNS records found</div>';
        }

        return `
            <div class="dns-panel">
                <table class="dns-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Value</th>
                            <th>TTL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dnsRecords.map(record => `
                            <tr>
                                <td><span class="dns-type">${record.type}</span></td>
                                <td class="dns-value">${record.value}</td>
                                <td>${record.ttl || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderSubdomainsPanel(subdomains) {
        if (!subdomains || subdomains.length === 0) {
            return '<div class="empty-state">No subdomains found</div>';
        }

        return `
            <div class="subdomains-panel">
                <div class="subdomains-grid">
                    ${subdomains.map(subdomain => `
                        <div class="subdomain-card">
                            <div class="subdomain-name">${subdomain.name}</div>
                            <div class="subdomain-info">
                                <span class="ip">${subdomain.ip || 'N/A'}</span>
                                <span class="status ${subdomain.active ? 'active' : 'inactive'}">
                                    ${subdomain.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div class="subdomain-actions">
                                <button class="btn btn-xs" onclick="domainIntelligenceScreen.analyzeDomainDeep('${subdomain.name}')">
                                    <i class="fas fa-search"></i>
                                    Analyze
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderCertificatesPanel(certificates) {
        if (!certificates || certificates.length === 0) {
            return '<div class="empty-state">No certificates found</div>';
        }

        return `
            <div class="certificates-panel">
                ${certificates.map(cert => `
                    <div class="certificate-card">
                        <div class="cert-header">
                            <h4>${cert.commonName}</h4>
                            <span class="cert-status ${cert.valid ? 'valid' : 'invalid'}">
                                ${cert.valid ? 'Valid' : 'Invalid'}
                            </span>
                        </div>
                        <div class="cert-details">
                            <div class="cert-info">
                                <span class="label">Issuer:</span>
                                <span class="value">${cert.issuer}</span>
                            </div>
                            <div class="cert-info">
                                <span class="label">Valid From:</span>
                                <span class="value">${cert.validFrom}</span>
                            </div>
                            <div class="cert-info">
                                <span class="label">Valid To:</span>
                                <span class="value">${cert.validTo}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderReputationPanel(reputation) {
        if (!reputation) {
            return '<div class="empty-state">No reputation data available</div>';
        }

        return `
            <div class="reputation-panel">
                <div class="reputation-sources">
                    ${reputation.sources.map(source => `
                        <div class="reputation-source">
                            <div class="source-header">
                                <span class="source-name">${source.name}</span>
                                <span class="source-score ${this.getReputationClass(source.score)}">
                                    ${source.score}
                                </span>
                            </div>
                            <div class="source-details">
                                <p>${source.details}</p>
                                <div class="source-categories">
                                    ${source.categories.map(cat => `
                                        <span class="category-tag">${cat}</span>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderTechnologiesPanel(technologies) {
        if (!technologies || technologies.length === 0) {
            return '<div class="empty-state">No technologies detected</div>';
        }

        return `
            <div class="technologies-panel">
                <div class="tech-categories">
                    ${this.groupTechnologiesByCategory(technologies).map(category => `
                        <div class="tech-category">
                            <h4>${category.name}</h4>
                            <div class="tech-items">
                                ${category.items.map(tech => `
                                    <div class="tech-item">
                                        <span class="tech-name">${tech.name}</span>
                                        <span class="tech-version">${tech.version || 'Unknown'}</span>
                                        <span class="tech-confidence">${tech.confidence}%</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    setupTabSwitching() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = btn.dataset.tab;
                
                // Update active tab button
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update active tab panel
                document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
                document.querySelector(`[data-panel="${tabName}"]`).classList.add('active');
            });
        });
    }

    updateWatchedDomainsDisplay() {
        const tbody = document.getElementById('watched-domains-tbody');
        if (!tbody) return;

        tbody.innerHTML = this.watchedDomains.map(domain => `
            <tr>
                <td>
                    <div class="domain-cell">
                        <span class="domain-name">${domain.name}</span>
                        ${domain.isNew ? '<span class="new-badge">NEW</span>' : ''}
                    </div>
                </td>
                <td>
                    <span class="status-badge ${domain.status.toLowerCase()}">${domain.status}</span>
                </td>
                <td>
                    <div class="risk-score-cell">
                        <span class="risk-value ${this.getRiskScoreClass(domain.riskScore)}">${domain.riskScore}</span>
                        <div class="risk-bar">
                            <div class="risk-fill" style="width: ${domain.riskScore}%"></div>
                        </div>
                    </div>
                </td>
                <td>${new Date(domain.lastCheck).toLocaleString()}</td>
                <td>
                    ${domain.changes > 0 ? `<span class="changes-count">${domain.changes}</span>` : '-'}
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-xs" onclick="domainIntelligenceScreen.analyzeDomainDeep('${domain.name}')">
                            <i class="fas fa-search"></i>
                        </button>
                        <button class="btn btn-xs" onclick="domainIntelligenceScreen.removeDomainWatch('${domain.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async loadStatistics() {
        try {
            const response = await fetch('/api/domain-intel/statistics');
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('phishing-detected').textContent = data.stats.phishingDetected;
                document.getElementById('typosquats-found').textContent = data.stats.typosquatsFound;
                document.getElementById('malware-hosts').textContent = data.stats.malwareHosts;
                document.getElementById('c2-servers').textContent = data.stats.c2Servers;
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    // Utility methods
    isValidDomain(domain) {
        const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
        return domainRegex.test(domain);
    }

    getRiskScoreClass(score) {
        if (score >= 70) return 'high';
        if (score >= 40) return 'medium';
        return 'low';
    }

    getReputationClass(score) {
        if (score >= 80) return 'good';
        if (score >= 40) return 'neutral';
        return 'bad';
    }

    groupTechnologiesByCategory(technologies) {
        const categories = {};
        technologies.forEach(tech => {
            const category = tech.category || 'Other';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(tech);
        });

        return Object.keys(categories).map(name => ({
            name: name,
            items: categories[name]
        }));
    }

    showAnalysisLoading() {
        const analyzeBtn = document.getElementById('analyze-domain-btn');
        const deepScanBtn = document.getElementById('deep-scan-btn');
        
        if (analyzeBtn) {
            analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
            analyzeBtn.disabled = true;
        }
        
        if (deepScanBtn) {
            deepScanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
            deepScanBtn.disabled = true;
        }
    }

    hideAnalysisLoading() {
        const analyzeBtn = document.getElementById('analyze-domain-btn');
        const deepScanBtn = document.getElementById('deep-scan-btn');
        
        if (analyzeBtn) {
            analyzeBtn.innerHTML = '<i class="fas fa-search"></i> Analyze';
            analyzeBtn.disabled = false;
        }
        
        if (deepScanBtn) {
            deepScanBtn.innerHTML = '<i class="fas fa-microscope"></i> Deep Scan';
            deepScanBtn.disabled = false;
        }
    }

    addToHistory(analysis) {
        this.analysisHistory.unshift({
            domain: analysis.domain,
            timestamp: new Date(),
            riskScore: analysis.riskScore,
            id: Date.now()
        });

        // Keep only last 50 analyses
        if (this.analysisHistory.length > 50) {
            this.analysisHistory = this.analysisHistory.slice(0, 50);
        }
    }

    showNotification(message, type = 'info') {
        if (window.notificationSystem) {
            window.notificationSystem.show(message, type);
        }
    }

    // Action methods
    async runQuickIntelligence(action) {
        console.log('Running quick intelligence:', action);
    }

    async analyzeDomainDeep(domain) {
        document.getElementById('domain-input').value = domain;
        await this.deepScanDomain();
    }

    async addDomainToWatch() {
        const domain = prompt('Enter domain to monitor:');
        if (domain && this.isValidDomain(domain)) {
            // Add domain to watch list
            console.log('Adding domain to watch:', domain);
        }
    }

    async removeDomainWatch(domainId) {
        console.log('Removing domain from watch:', domainId);
    }

    filterWatchedDomains(filter) {
        console.log('Filtering watched domains:', filter);
    }

    showBulkAnalysisModal() {
        console.log('Showing bulk analysis modal');
    }

    updateActivityTimeline(activities) {
        const timeline = document.getElementById('domain-activity-timeline');
        if (!timeline) return;

        timeline.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-time">${new Date(activity.timestamp).toLocaleString()}</div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-description">${activity.description}</div>
                </div>
                <div class="activity-type ${activity.type}">${activity.type}</div>
            </div>
        `).join('');
    }
}

// Initialize and export
const domainIntelligenceScreen = new DomainIntelligenceScreen();

// Auto-initialize when screen is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.domain-intelligence-screen')) {
        domainIntelligenceScreen.init();
    }
});