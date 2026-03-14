/**
 * Compliance Screen
 * Regulatory compliance management and framework assessment
 */

class ComplianceScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.frameworks = [];
        this.controls = [];
        this.activeFramework = null;
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        container.innerHTML = this.createHTML();
        this.initializeComponents();
        await this.loadData();
        container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
    }

    createHTML() {
        return `
            <div class="compliance-screen" style="padding:var(--space-lg); display:flex; flex-direction:column; gap:var(--space-lg); overflow-y:auto; height:100%;">
                <!-- Header -->
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--space-md);">
                    <div>
                        <h2 style="font-size:var(--text-2xl); font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:var(--space-sm);">
                            <i class="fas fa-clipboard-check" style="color:var(--success);"></i>
                            Compliance Center
                        </h2>
                        <p style="color:var(--text-muted); margin-top:4px;">Regulatory framework compliance tracking and audit management</p>
                    </div>
                    <div style="display:flex; gap:var(--space-sm);">
                        <button class="btn btn-secondary" onclick="window._complianceScreen?.runAudit()">
                            <i class="fas fa-play"></i> Run Audit
                        </button>
                        <button class="btn btn-primary" onclick="window._complianceScreen?.generateReport()">
                            <i class="fas fa-file-pdf"></i> Generate Report
                        </button>
                    </div>
                </div>

                <!-- Overall Compliance Score -->
                <div style="background:linear-gradient(135deg, var(--bg-card) 0%, #0d2e1f 100%); border:1px solid var(--success)33; border-radius:var(--radius-lg); padding:var(--space-lg); display:flex; align-items:center; gap:var(--space-xl); flex-wrap:wrap;">
                    <div style="text-align:center; min-width:120px;">
                        <div id="comp-overall-score" style="font-size:3rem; font-weight:900; color:var(--success); line-height:1;">84%</div>
                        <div style="font-size:var(--text-sm); color:var(--text-muted); margin-top:4px;">Overall Compliance</div>
                        <div style="font-size:var(--text-xs); color:var(--success); margin-top:2px;">GOOD STANDING</div>
                    </div>
                    <div style="flex:1; display:grid; grid-template-columns:repeat(3, 1fr); gap:var(--space-md);">
                        ${[
                            { id:'comp-passing', label:'Passing Controls', val:'247', color:'var(--success)' },
                            { id:'comp-failing', label:'Failing Controls', val:'31', color:'var(--error)' },
                            { id:'comp-review', label:'Under Review', val:'18', color:'var(--warning)' },
                        ].map(s => `
                            <div style="text-align:center; background:var(--bg-secondary)88; border-radius:var(--radius-md); padding:var(--space-md);">
                                <div id="${s.id}" style="font-size:var(--text-xl); font-weight:700; color:${s.color};">${s.val}</div>
                                <div style="font-size:var(--text-xs); color:var(--text-muted);">${s.label}</div>
                            </div>
                        `).join('')}
                    </div>
                    <div style="flex:2; min-width:250px;">
                        <p style="font-size:var(--text-sm); color:var(--text-secondary); margin-bottom:var(--space-sm);">
                            Last audit: <strong style="color:var(--text-primary);">January 22, 2024</strong> · Next scheduled: <strong style="color:var(--text-primary);">February 22, 2024</strong>
                        </p>
                        <p style="font-size:var(--text-sm); color:var(--text-secondary);">
                            <i class="fas fa-info-circle" style="color:var(--warning);"></i>
                            31 controls require immediate attention. 5 critical failures may affect SOC 2 certification.
                        </p>
                    </div>
                </div>

                <!-- Framework Grid -->
                <div>
                    <h3 style="font-size:var(--text-lg); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">Compliance Frameworks</h3>
                    <div id="comp-frameworks" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:var(--space-md);">
                        <!-- Populated by JS -->
                    </div>
                </div>

                <!-- Controls Table -->
                <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-md); flex-wrap:wrap; gap:var(--space-sm);">
                        <h3 style="font-size:var(--text-lg); font-weight:600; color:var(--text-primary);">
                            <i class="fas fa-list-check" style="color:var(--primary);"></i> Controls Assessment
                        </h3>
                        <div style="display:flex; gap:var(--space-sm);">
                            <select class="form-control" id="comp-framework-filter" style="width:auto;" onchange="window._complianceScreen?.filterControls(this.value)">
                                <option value="all">All Frameworks</option>
                                <option value="SOC2">SOC 2</option>
                                <option value="ISO27001">ISO 27001</option>
                                <option value="GDPR">GDPR</option>
                                <option value="HIPAA">HIPAA</option>
                                <option value="NIST">NIST CSF</option>
                                <option value="PCI-DSS">PCI-DSS</option>
                            </select>
                            <select class="form-control" id="comp-status-filter" style="width:auto;" onchange="window._complianceScreen?.filterControls()">
                                <option value="all">All Status</option>
                                <option value="pass">Passing</option>
                                <option value="fail">Failing</option>
                                <option value="review">Under Review</option>
                            </select>
                        </div>
                    </div>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:var(--text-sm);">
                            <thead>
                                <tr style="border-bottom:2px solid var(--border-color);">
                                    <th style="padding:var(--space-sm) var(--space-md); text-align:left; color:var(--text-muted); font-weight:600;">Control ID</th>
                                    <th style="padding:var(--space-sm) var(--space-md); text-align:left; color:var(--text-muted); font-weight:600;">Framework</th>
                                    <th style="padding:var(--space-sm) var(--space-md); text-align:left; color:var(--text-muted); font-weight:600;">Control Name</th>
                                    <th style="padding:var(--space-sm) var(--space-md); text-align:center; color:var(--text-muted); font-weight:600;">Category</th>
                                    <th style="padding:var(--space-sm) var(--space-md); text-align:center; color:var(--text-muted); font-weight:600;">Status</th>
                                    <th style="padding:var(--space-sm) var(--space-md); text-align:left; color:var(--text-muted); font-weight:600;">Last Check</th>
                                    <th style="padding:var(--space-sm) var(--space-md); text-align:center; color:var(--text-muted); font-weight:600;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="comp-controls-tbody">
                                <!-- Populated by JS -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        window._complianceScreen = this;
    }

    async loadData() {
        const api = window.cyberforgeAPI || window.apiClient;
        try {
            if (api) {
                const result = await api.getThreatStats();
                if (result?.success) {
                    const score = result.data?.compliance_score || 84;
                    const el = document.getElementById('comp-overall-score');
                    if (el) el.textContent = score + '%';
                }
            }
        } catch (e) { /* fallback */ }
        this.loadMockData();
    }

    loadMockData() {
        this.frameworks = [
            { name:'SOC 2 Type II', icon:'shield-alt', score:91, status:'compliant', lastAudit:'Jan 15, 2024', nextAudit:'Jul 15, 2024', controls:48, passing:44, color:'var(--success)' },
            { name:'ISO 27001', icon:'certificate', score:87, status:'compliant', lastAudit:'Dec 10, 2023', nextAudit:'Dec 10, 2024', controls:114, passing:99, color:'var(--success)' },
            { name:'GDPR', icon:'user-shield', score:78, status:'partial', lastAudit:'Jan 20, 2024', nextAudit:'Apr 20, 2024', controls:99, passing:77, color:'var(--warning)' },
            { name:'HIPAA', icon:'hospital-alt', score:72, status:'partial', lastAudit:'Nov 5, 2023', nextAudit:'Feb 5, 2024', controls:75, passing:54, color:'var(--warning)' },
            { name:'NIST CSF', icon:'flag-usa', score:85, status:'compliant', lastAudit:'Jan 10, 2024', nextAudit:'Apr 10, 2024', controls:108, passing:92, color:'var(--success)' },
            { name:'PCI-DSS', icon:'credit-card', score:69, status:'at-risk', lastAudit:'Jan 18, 2024', nextAudit:'Feb 18, 2024', controls:281, passing:194, color:'var(--error)' },
        ];

        this.controls = [
            { id:'SOC2-CC6.1', framework:'SOC2', name:'Logical and Physical Access Controls', category:'Access Control', status:'pass', lastCheck:'2024-01-22' },
            { id:'SOC2-CC7.2', framework:'SOC2', name:'System Monitoring and Detection', category:'Monitoring', status:'pass', lastCheck:'2024-01-22' },
            { id:'SOC2-CC9.1', framework:'SOC2', name:'Risk Assessment Process', category:'Risk Mgmt', status:'review', lastCheck:'2024-01-20' },
            { id:'ISO-A.12.1', framework:'ISO27001', name:'Operational Procedures and Responsibilities', category:'Operations', status:'pass', lastCheck:'2024-01-21' },
            { id:'GDPR-A32', framework:'GDPR', name:'Security of Processing - Encryption', category:'Data Security', status:'fail', lastCheck:'2024-01-19' },
            { id:'GDPR-A33', framework:'GDPR', name:'Breach Notification (72h)', category:'Incident Resp', status:'fail', lastCheck:'2024-01-18' },
            { id:'HIPAA-164.312', framework:'HIPAA', name:'Technical Safeguards - Access Control', category:'Access Control', status:'pass', lastCheck:'2024-01-22' },
            { id:'NIST-ID.AM-1', framework:'NIST', name:'Physical Device Inventory', category:'Identify', status:'pass', lastCheck:'2024-01-20' },
            { id:'PCI-REQ3.4', framework:'PCI-DSS', name:'Protection of Stored Cardholder Data', category:'Data Protection', status:'fail', lastCheck:'2024-01-17' },
            { id:'PCI-REQ6.3', framework:'PCI-DSS', name:'Security Vulnerabilities in Software', category:'Vulnerability', status:'fail', lastCheck:'2024-01-15' },
        ];

        this.renderFrameworks();
        this.renderControls(this.controls);
    }

    renderFrameworks() {
        const container = document.getElementById('comp-frameworks');
        if (!container) return;

        container.innerHTML = this.frameworks.map(f => `
            <div onclick="window._complianceScreen?.selectFramework('${f.name}')"
                 style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg); cursor:pointer; transition:all var(--transition-fast);"
                 onmouseenter="this.style.borderColor='${f.color}'; this.style.transform='translateY(-2px)'"
                 onmouseleave="this.style.borderColor='var(--border-color)'; this.style.transform=''">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-md);">
                    <div style="display:flex; align-items:center; gap:var(--space-sm);">
                        <div style="width:36px; height:36px; border-radius:var(--radius-sm); background:${f.color}22; display:flex; align-items:center; justify-content:center; color:${f.color};">
                            <i class="fas fa-${f.icon}"></i>
                        </div>
                        <span style="font-size:var(--text-base); font-weight:600; color:var(--text-primary);">${f.name}</span>
                    </div>
                    <div style="font-size:var(--text-xl); font-weight:900; color:${f.color};">${f.score}%</div>
                </div>
                <div style="background:var(--bg-secondary); border-radius:99px; height:8px; overflow:hidden; margin-bottom:var(--space-md);">
                    <div style="width:${f.score}%; height:100%; background:${f.color}; border-radius:99px; transition:width 0.5s ease;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:var(--text-xs); color:var(--text-muted);">
                    <span><i class="fas fa-check-circle" style="color:var(--success);"></i> ${f.passing}/${f.controls} controls</span>
                    <span style="background:${f.color}22; color:${f.color}; padding:2px 8px; border-radius:99px; text-transform:uppercase; font-weight:600;">${f.status}</span>
                </div>
                <div style="margin-top:var(--space-sm); font-size:var(--text-xs); color:var(--text-muted);">
                    Next audit: ${f.nextAudit}
                </div>
            </div>
        `).join('');
    }

    renderControls(controls) {
        const tbody = document.getElementById('comp-controls-tbody');
        if (!tbody) return;

        const statusColors = { pass:'var(--success)', fail:'var(--error)', review:'var(--warning)' };
        const statusLabels = { pass:'PASSING', fail:'FAILING', review:'REVIEW' };

        tbody.innerHTML = controls.map(c => `
            <tr style="border-bottom:1px solid var(--border-color);"
                onmouseenter="this.style.background='var(--bg-hover)'"
                onmouseleave="this.style.background=''">
                <td style="padding:var(--space-sm) var(--space-md); font-family:var(--font-mono); font-size:var(--text-xs); color:var(--primary);">${c.id}</td>
                <td style="padding:var(--space-sm) var(--space-md);">
                    <span style="background:var(--bg-secondary); padding:2px 8px; border-radius:99px; font-size:var(--text-xs); color:var(--text-secondary);">${c.framework}</span>
                </td>
                <td style="padding:var(--space-sm) var(--space-md); color:var(--text-primary); font-weight:500;">${c.name}</td>
                <td style="padding:var(--space-sm) var(--space-md); text-align:center; color:var(--text-muted); font-size:var(--text-xs);">${c.category}</td>
                <td style="padding:var(--space-sm) var(--space-md); text-align:center;">
                    <span style="background:${statusColors[c.status]}22; color:${statusColors[c.status]}; padding:2px 8px; border-radius:99px; font-size:var(--text-xs); font-weight:600;">${statusLabels[c.status]}</span>
                </td>
                <td style="padding:var(--space-sm) var(--space-md); color:var(--text-muted); font-size:var(--text-sm);">${c.lastCheck}</td>
                <td style="padding:var(--space-sm) var(--space-md); text-align:center;">
                    <button class="btn btn-sm btn-secondary" onclick="window._complianceScreen?.viewControl('${c.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    filterControls(frameworkFilter) {
        const fw = frameworkFilter || document.getElementById('comp-framework-filter')?.value || 'all';
        const status = document.getElementById('comp-status-filter')?.value || 'all';

        const filtered = this.controls.filter(c => {
            if (fw !== 'all' && c.framework !== fw) return false;
            if (status !== 'all' && c.status !== status) return false;
            return true;
        });
        this.renderControls(filtered);
    }

    selectFramework(name) {
        const fw = this.frameworks.find(f => f.name === name);
        if (!fw) return;
        const select = document.getElementById('comp-framework-filter');
        if (select) {
            const key = name.replace(' Type II','').replace(' CSF','');
            select.value = key;
            this.filterControls(key);
        }
    }

    viewControl(id) {
        const c = this.controls.find(x => x.id === id);
        if (c) alert(`Control: ${c.id}\nFramework: ${c.framework}\nName: ${c.name}\nCategory: ${c.category}\nStatus: ${c.status}\nLast Checked: ${c.lastCheck}`);
    }

    runAudit() {
        alert('Starting compliance audit...\nThis will check all 296 controls across 6 frameworks.\nEstimated time: 15-20 minutes.');
    }

    generateReport() {
        alert('Generating compliance report...\nExporting comprehensive compliance status for all frameworks.');
    }
}

window.ComplianceScreen = ComplianceScreen;
