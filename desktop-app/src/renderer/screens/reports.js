/**
 * Reports Screen
 * Comprehensive security report generation and management
 */

class ReportsScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.reports = [];
        this.selectedReport = null;
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
            <div class="reports-screen" style="padding:var(--space-lg); display:flex; flex-direction:column; gap:var(--space-lg); overflow-y:auto; height:100%;">
                <!-- Header -->
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--space-md);">
                    <div>
                        <h2 style="font-size:var(--text-2xl); font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:var(--space-sm);">
                            <i class="fas fa-file-alt" style="color:var(--primary);"></i>
                            Security Reports
                        </h2>
                        <p style="color:var(--text-muted); margin-top:4px;">Generate, manage, and schedule comprehensive security reports</p>
                    </div>
                    <button class="btn btn-primary" onclick="window._reportsScreen?.generateReport()">
                        <i class="fas fa-plus"></i> Generate Report
                    </button>
                </div>

                <!-- Report Type Cards -->
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:var(--space-md);">
                    ${[
                        { id:'r-threat', title:'Threat Summary', icon:'shield-alt', color:'var(--error)', desc:'Overview of all detected threats and their status', count:'14 reports' },
                        { id:'r-vulns', title:'Vulnerability Report', icon:'bug', color:'var(--warning)', desc:'CVE findings and remediation status', count:'8 reports' },
                        { id:'r-compliance', title:'Compliance Report', icon:'clipboard-check', color:'var(--success)', desc:'Regulatory compliance status across frameworks', count:'6 reports' },
                        { id:'r-incident', title:'Incident Report', icon:'fire-extinguisher', color:'#ff9500', desc:'Security incident timeline and response', count:'3 reports' },
                        { id:'r-executive', title:'Executive Summary', icon:'chart-pie', color:'var(--primary)', desc:'High-level security posture overview', count:'12 reports' },
                        { id:'r-forensics', title:'Forensics Report', icon:'search-plus', color:'var(--info)', desc:'Digital forensics investigation findings', count:'5 reports' },
                    ].map(r => `
                        <div onclick="window._reportsScreen?.selectType('${r.id}')" 
                             style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:var(--space-md); cursor:pointer; transition:all var(--transition-fast);"
                             onmouseenter="this.style.borderColor='${r.color}'; this.style.transform='translateY(-2px)'"
                             onmouseleave="this.style.borderColor='var(--border-color)'; this.style.transform=''">
                            <div style="display:flex; align-items:center; gap:var(--space-sm); margin-bottom:var(--space-sm);">
                                <div style="width:36px; height:36px; border-radius:var(--radius-sm); background:${r.color}22; display:flex; align-items:center; justify-content:center; color:${r.color};">
                                    <i class="fas fa-${r.icon}"></i>
                                </div>
                                <div>
                                    <div style="font-size:var(--text-sm); font-weight:600; color:var(--text-primary);">${r.title}</div>
                                    <div style="font-size:var(--text-xs); color:var(--text-muted);">${r.count}</div>
                                </div>
                            </div>
                            <p style="font-size:var(--text-xs); color:var(--text-secondary); line-height:1.5;">${r.desc}</p>
                        </div>
                    `).join('')}
                </div>

                <!-- Recent Reports Table -->
                <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-md); flex-wrap:wrap; gap:var(--space-sm);">
                        <h3 style="font-size:var(--text-lg); font-weight:600; color:var(--text-primary);">
                            <i class="fas fa-history" style="color:var(--primary);"></i> Recent Reports
                        </h3>
                        <div style="display:flex; gap:var(--space-sm);">
                            <select class="form-control" id="reports-type-filter" style="width:auto;" onchange="window._reportsScreen?.filterReports(this.value)">
                                <option value="all">All Types</option>
                                <option value="threat">Threat Summary</option>
                                <option value="vulnerability">Vulnerability</option>
                                <option value="compliance">Compliance</option>
                                <option value="incident">Incident</option>
                                <option value="executive">Executive</option>
                            </select>
                            <input type="text" class="form-control" placeholder="Search reports..." id="reports-search" style="width:180px;" />
                        </div>
                    </div>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:var(--text-sm);">
                            <thead>
                                <tr style="border-bottom:2px solid var(--border-color);">
                                    <th style="padding:var(--space-sm) var(--space-md); text-align:left; color:var(--text-muted); font-weight:600;">Report Name</th>
                                    <th style="padding:var(--space-sm) var(--space-md); text-align:left; color:var(--text-muted); font-weight:600;">Type</th>
                                    <th style="padding:var(--space-sm) var(--space-md); text-align:left; color:var(--text-muted); font-weight:600;">Generated</th>
                                    <th style="padding:var(--space-sm) var(--space-md); text-align:left; color:var(--text-muted); font-weight:600;">Period</th>
                                    <th style="padding:var(--space-sm) var(--space-md); text-align:center; color:var(--text-muted); font-weight:600;">Size</th>
                                    <th style="padding:var(--space-sm) var(--space-md); text-align:center; color:var(--text-muted); font-weight:600;">Status</th>
                                    <th style="padding:var(--space-sm) var(--space-md); text-align:center; color:var(--text-muted); font-weight:600;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="reports-tbody">
                                <!-- Reports loaded here -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Scheduled Reports -->
                <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-md);">
                        <h3 style="font-size:var(--text-lg); font-weight:600; color:var(--text-primary);">
                            <i class="fas fa-calendar-alt" style="color:var(--primary);"></i> Scheduled Reports
                        </h3>
                        <button class="btn btn-secondary btn-sm" onclick="window._reportsScreen?.addSchedule()">
                            <i class="fas fa-plus"></i> Add Schedule
                        </button>
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:var(--space-md);" id="reports-schedules">
                        ${[
                            { name:'Weekly Threat Summary', schedule:'Every Monday 08:00', next:'2024-01-29', recipients:'security@company.com', active:true },
                            { name:'Monthly Executive Report', schedule:'1st of month 09:00', next:'2024-02-01', recipients:'executives@company.com', active:true },
                            { name:'Daily Incident Alert', schedule:'Daily 06:00', next:'Tomorrow 06:00', recipients:'soc@company.com', active:false },
                        ].map(s => `
                            <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:var(--space-md);">
                                <div style="display:flex; align-items:start; justify-content:space-between; margin-bottom:var(--space-sm);">
                                    <div>
                                        <div style="font-size:var(--text-sm); font-weight:600; color:var(--text-primary);">${s.name}</div>
                                        <div style="font-size:var(--text-xs); color:var(--text-muted); margin-top:2px;">${s.schedule}</div>
                                    </div>
                                    <div style="width:32px; height:18px; border-radius:99px; background:${s.active ? 'var(--success)' : 'var(--bg-card)'}; border:1px solid var(--border-color); position:relative; cursor:pointer; flex-shrink:0;">
                                        <div style="width:12px; height:12px; border-radius:50%; background:${s.active ? 'white' : 'var(--text-muted)'}; position:absolute; top:2px; ${s.active ? 'right:2px' : 'left:2px'}; transition:all 0.2s;"></div>
                                    </div>
                                </div>
                                <div style="font-size:var(--text-xs); color:var(--text-secondary);">
                                    <i class="fas fa-clock" style="color:var(--primary);"></i> Next: ${s.next}
                                </div>
                                <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                    <i class="fas fa-envelope" style="color:var(--primary);"></i> ${s.recipients}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        window._reportsScreen = this;
        document.getElementById('reports-search')?.addEventListener('input', (e) => this.searchReports(e.target.value));
    }

    async loadData() {
        const api = window.cyberforgeAPI || window.apiClient;
        try {
            if (api) {
                const result = await api.getThreats({ limit: 5 });
                if (result?.success) {
                    this.loadMockData(); return;
                }
            }
        } catch (e) { /* fallback */ }
        this.loadMockData();
    }

    loadMockData() {
        this.reports = [
            { name:'Weekly Threat Summary - Jan 22', type:'threat', date:'2024-01-22', period:'Jan 15–22', size:'2.4 MB', status:'ready' },
            { name:'Vulnerability Assessment Report', type:'vulnerability', date:'2024-01-20', period:'Jan 2024', size:'5.1 MB', status:'ready' },
            { name:'GDPR Compliance Report Q1', type:'compliance', date:'2024-01-18', period:'Q1 2024', size:'1.8 MB', status:'ready' },
            { name:'Incident Report INC-2024-001', type:'incident', date:'2024-01-17', period:'Jan 17', size:'890 KB', status:'ready' },
            { name:'Executive Security Briefing', type:'executive', date:'2024-01-15', period:'Jan 2024', size:'3.2 MB', status:'ready' },
            { name:'Network Security Analysis', type:'threat', date:'2024-01-10', period:'Jan 1–10', size:'4.7 MB', status:'ready' },
            { name:'SOC 2 Type II Compliance', type:'compliance', date:'2024-01-05', period:'2023 Annual', size:'12.1 MB', status:'ready' },
        ];
        this.renderReports(this.reports);
    }

    renderReports(reports) {
        const tbody = document.getElementById('reports-tbody');
        if (!tbody) return;

        const typeColors = { threat:'var(--error)', vulnerability:'var(--warning)', compliance:'var(--success)', incident:'#ff9500', executive:'var(--primary)', forensics:'var(--info)' };

        tbody.innerHTML = reports.map(r => `
            <tr style="border-bottom:1px solid var(--border-color);"
                onmouseenter="this.style.background='var(--bg-hover)'"
                onmouseleave="this.style.background=''">
                <td style="padding:var(--space-sm) var(--space-md);">
                    <div style="display:flex; align-items:center; gap:var(--space-sm);">
                        <i class="fas fa-file-pdf" style="color:var(--error);"></i>
                        <span style="font-weight:500; color:var(--text-primary);">${r.name}</span>
                    </div>
                </td>
                <td style="padding:var(--space-sm) var(--space-md);">
                    <span style="background:${typeColors[r.type] || 'var(--text-muted)'}22; color:${typeColors[r.type] || 'var(--text-muted)'}; padding:2px 8px; border-radius:99px; font-size:var(--text-xs); font-weight:500; text-transform:capitalize;">${r.type}</span>
                </td>
                <td style="padding:var(--space-sm) var(--space-md); color:var(--text-secondary); font-size:var(--text-sm);">${r.date}</td>
                <td style="padding:var(--space-sm) var(--space-md); color:var(--text-secondary); font-size:var(--text-sm);">${r.period}</td>
                <td style="padding:var(--space-sm) var(--space-md); text-align:center; color:var(--text-muted); font-size:var(--text-sm);">${r.size}</td>
                <td style="padding:var(--space-sm) var(--space-md); text-align:center;">
                    <span style="background:var(--success)22; color:var(--success); padding:2px 8px; border-radius:99px; font-size:var(--text-xs);">${r.status}</span>
                </td>
                <td style="padding:var(--space-sm) var(--space-md); text-align:center;">
                    <button class="btn btn-sm btn-primary" onclick="window._reportsScreen?.downloadReport('${r.name}')" style="margin-right:4px;" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="window._reportsScreen?.viewReport('${r.name}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    filterReports(type) {
        const filtered = type === 'all' ? this.reports : this.reports.filter(r => r.type === type);
        this.renderReports(filtered);
    }

    searchReports(query) {
        const q = query.toLowerCase();
        const filtered = this.reports.filter(r => r.name.toLowerCase().includes(q) || r.type.toLowerCase().includes(q));
        this.renderReports(filtered);
    }

    selectType(id) {
        const typeMap = { 'r-threat':'threat', 'r-vulns':'vulnerability', 'r-compliance':'compliance', 'r-incident':'incident', 'r-executive':'executive', 'r-forensics':'forensics' };
        const type = typeMap[id];
        if (type) {
            const select = document.getElementById('reports-type-filter');
            if (select) select.value = type;
            this.filterReports(type);
        }
    }

    generateReport() {
        const type = prompt('Report type (threat/vulnerability/compliance/incident/executive):');
        if (!type) return;
        const newReport = {
            name: `${type.charAt(0).toUpperCase()+type.slice(1)} Report - ${new Date().toLocaleDateString()}`,
            type: type,
            date: new Date().toISOString().split('T')[0],
            period: new Date().toLocaleDateString('en-US', { month:'long', year:'numeric' }),
            size: `${(Math.random()*4+1).toFixed(1)} MB`,
            status: 'generating',
        };
        this.reports.unshift(newReport);
        this.renderReports(this.reports);
        setTimeout(() => {
            newReport.status = 'ready';
            this.renderReports(this.reports);
        }, 3000);
    }

    downloadReport(name) {
        alert(`Downloading: ${name}`);
    }

    viewReport(name) {
        alert(`Viewing report: ${name}\n\nOpening report viewer...`);
    }

    addSchedule() {
        alert('Opening schedule configuration...');
    }
}

window.ReportsScreen = ReportsScreen;
