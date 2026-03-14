/**
 * Digital Forensics Screen
 * Advanced digital forensics investigation and evidence analysis
 */

class DigitalForensicsScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.cases = [];
        this.activeCase = null;
        this.evidence = [];
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
            <div class="digital-forensics-screen" style="padding:var(--space-lg); display:flex; flex-direction:column; gap:var(--space-lg); overflow-y:auto; height:100%;">
                <!-- Header -->
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--space-md);">
                    <div>
                        <h2 style="font-size:var(--text-2xl); font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:var(--space-sm);">
                            <i class="fas fa-search-plus" style="color:var(--primary);"></i>
                            Digital Forensics
                        </h2>
                        <p style="color:var(--text-muted); margin-top:4px;">Advanced forensic investigation, evidence analysis, and incident reconstruction</p>
                    </div>
                    <div style="display:flex; gap:var(--space-sm);">
                        <button class="btn btn-secondary" onclick="window._dfScreen?.exportReport()">
                            <i class="fas fa-file-pdf"></i> Export Report
                        </button>
                        <button class="btn btn-primary" onclick="window._dfScreen?.newCase()">
                            <i class="fas fa-folder-plus"></i> New Case
                        </button>
                    </div>
                </div>

                <!-- Stats -->
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:var(--space-md);">
                    ${[
                        { id:'df-cases', label:'Active Cases', icon:'folder-open', color:'var(--primary)' },
                        { id:'df-evidence', label:'Evidence Items', icon:'database', color:'#ff9500' },
                        { id:'df-artifacts', label:'Artifacts Found', icon:'fingerprint', color:'var(--warning)' },
                        { id:'df-analyzed', label:'Files Analyzed', icon:'file-search', color:'var(--success)' },
                    ].map(s => `
                        <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:var(--space-md); display:flex; align-items:center; gap:var(--space-md);">
                            <div style="width:40px; height:40px; border-radius:50%; background:${s.color}22; display:flex; align-items:center; justify-content:center; color:${s.color}; font-size:var(--text-lg); flex-shrink:0;">
                                <i class="fas fa-${s.icon}"></i>
                            </div>
                            <div>
                                <div id="${s.id}" style="font-size:var(--text-xl); font-weight:700; color:var(--text-primary);">0</div>
                                <div style="font-size:var(--text-xs); color:var(--text-muted);">${s.label}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Main Content -->
                <div style="display:grid; grid-template-columns:300px 1fr; gap:var(--space-lg);">
                    <!-- Case List -->
                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg); display:flex; flex-direction:column; gap:var(--space-md);">
                        <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary);">
                            <i class="fas fa-folder" style="color:var(--primary);"></i> Cases
                        </h3>
                        <input type="text" class="form-control" placeholder="Search cases..." id="df-case-search" />
                        <div id="df-case-list" style="display:flex; flex-direction:column; gap:var(--space-xs);">
                            <!-- Cases loaded here -->
                        </div>
                    </div>

                    <!-- Investigation Panel -->
                    <div style="display:flex; flex-direction:column; gap:var(--space-lg);">
                        <!-- Investigation Tools -->
                        <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                            <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">
                                <i class="fas fa-tools" style="color:var(--primary);"></i> Investigation Tools
                            </h3>
                            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:var(--space-sm);">
                                ${[
                                    { icon:'hdd', label:'Disk Imaging', id:'tool-disk' },
                                    { icon:'memory', label:'Memory Dump', id:'tool-mem' },
                                    { icon:'network-wired', label:'Network Forensics', id:'tool-net' },
                                    { icon:'file-code', label:'File Analysis', id:'tool-file' },
                                    { icon:'history', label:'Timeline Builder', id:'tool-timeline' },
                                    { icon:'key', label:'Hash Verifier', id:'tool-hash' },
                                    { icon:'mobile-alt', label:'Mobile Forensics', id:'tool-mobile' },
                                    { icon:'cloud', label:'Cloud Forensics', id:'tool-cloud' },
                                ].map(t => `
                                    <button id="${t.id}" onclick="window._dfScreen?.launchTool('${t.id}')" style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:var(--space-md); cursor:pointer; text-align:center; transition:all var(--transition-fast); color:var(--text-secondary);"
                                        onmouseenter="this.style.borderColor='var(--primary)'; this.style.color='var(--primary)'"
                                        onmouseleave="this.style.borderColor='var(--border-color)'; this.style.color='var(--text-secondary)'">
                                        <i class="fas fa-${t.icon}" style="font-size:1.5rem; display:block; margin-bottom:var(--space-xs);"></i>
                                        <span style="font-size:var(--text-xs); font-weight:500;">${t.label}</span>
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Evidence Timeline -->
                        <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-md);">
                                <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary);">
                                    <i class="fas fa-stream" style="color:var(--primary);"></i> Evidence Timeline
                                </h3>
                                <div style="display:flex; gap:var(--space-sm);">
                                    <select class="form-control" id="df-timeline-filter" style="width:auto;" onchange="window._dfScreen?.filterTimeline(this.value)">
                                        <option value="all">All Events</option>
                                        <option value="file">File Access</option>
                                        <option value="network">Network</option>
                                        <option value="process">Process</option>
                                        <option value="registry">Registry</option>
                                    </select>
                                </div>
                            </div>
                            <div id="df-timeline" style="position:relative; padding-left:var(--space-xl);">
                                <!-- Timeline items loaded here -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        window._dfScreen = this;
        document.getElementById('df-case-search')?.addEventListener('input', (e) => this.filterCases(e.target.value));
    }

    async loadData() {
        this.cases = [
            { id:'FOR-2024-001', title:'Data Exfiltration Investigation', status:'active', priority:'critical', created:'2024-01-20', analyst:'J. Smith', evidence:12 },
            { id:'FOR-2024-002', title:'Ransomware Incident Analysis', status:'active', priority:'high', created:'2024-01-19', analyst:'M. Johnson', evidence:28 },
            { id:'FOR-2024-003', title:'Insider Threat Investigation', status:'in_review', priority:'high', created:'2024-01-18', analyst:'K. Williams', evidence:45 },
            { id:'FOR-2024-004', title:'Phishing Campaign Source Trace', status:'closed', priority:'medium', created:'2024-01-15', analyst:'J. Smith', evidence:8 },
        ];
        this.evidence = [
            { time:'2024-01-22 14:32:15', type:'file', event:'Suspicious executable accessed: malware.exe', source:'System32', severity:'critical' },
            { time:'2024-01-22 14:33:22', type:'network', event:'Outbound connection to known C2 server: 185.220.101.45', source:'Firewall', severity:'critical' },
            { time:'2024-01-22 14:35:01', type:'process', event:'PowerShell spawned with encoded command', source:'Process Monitor', severity:'high' },
            { time:'2024-01-22 14:36:45', type:'registry', event:'Registry key modified: HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', source:'Registry Monitor', severity:'high' },
            { time:'2024-01-22 14:38:12', type:'file', event:'Large file encrypted: documents.zip.locked (2.4GB)', source:'File Monitor', severity:'critical' },
            { time:'2024-01-22 14:39:30', type:'network', event:'DNS query for suspicious domain: update-service.xyz', source:'DNS Log', severity:'medium' },
            { time:'2024-01-22 14:41:00', type:'process', event:'Scheduled task created for persistence', source:'Task Scheduler', severity:'high' },
        ];
        this.renderCases();
        this.renderTimeline(this.evidence);
        this.updateStats();
    }

    _esc(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    renderCases() {
        const container = document.getElementById('df-case-list');
        if (!container) return;

        const priorityColor = { critical:'var(--error)', high:'#ff9500', medium:'var(--warning)', low:'var(--info)' };
        const statusColor = { active:'var(--success)', in_review:'var(--warning)', closed:'var(--text-muted)' };

        container.innerHTML = this.cases.map((c, idx) => `
            <div onclick="window._dfScreen?.selectCaseByIdx(${idx})" style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:var(--space-sm) var(--space-md); cursor:pointer; transition:all var(--transition-fast);"
                onmouseenter="this.style.borderColor='var(--primary)'"
                onmouseleave="this.style.borderColor='var(--border-color)'">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:2px;">
                    <span style="font-size:var(--text-xs); font-family:var(--font-mono); color:var(--primary);">${this._esc(c.id)}</span>
                    <span style="font-size:var(--text-xs); color:${statusColor[c.status]}; text-transform:uppercase;">${this._esc(c.status.replace('_',' '))}</span>
                </div>
                <div style="font-size:var(--text-sm); font-weight:500; color:var(--text-primary); margin-bottom:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this._esc(c.title)}</div>
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <span style="font-size:var(--text-xs); color:${priorityColor[c.priority]};">${this._esc(c.priority)} priority</span>
                    <span style="font-size:var(--text-xs); color:var(--text-muted);">${c.evidence} items</span>
                </div>
            </div>
        `).join('');
    }

    renderTimeline(events) {
        const container = document.getElementById('df-timeline');
        if (!container) return;

        const typeColors = { file:'var(--primary)', network:'var(--error)', process:'var(--warning)', registry:'#ff9500', default:'var(--info)' };
        const typeIcons = { file:'file-alt', network:'network-wired', process:'microchip', registry:'edit', default:'circle' };

        container.innerHTML = `<div style="position:absolute; left:12px; top:0; bottom:0; width:2px; background:var(--border-color);"></div>` +
        events.map(e => {
            const color = typeColors[e.type] || typeColors.default;
            const icon = typeIcons[e.type] || typeIcons.default;
            return `
                <div style="position:relative; margin-bottom:var(--space-md); padding-left:var(--space-lg);">
                    <div style="position:absolute; left:-6px; top:4px; width:12px; height:12px; border-radius:50%; background:${color}; border:2px solid var(--bg-card);"></div>
                    <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid ${color}; border-radius:var(--radius-sm); padding:var(--space-sm) var(--space-md);">
                        <div style="display:flex; align-items:center; gap:var(--space-sm); margin-bottom:4px;">
                            <i class="fas fa-${icon}" style="color:${color}; font-size:var(--text-xs);"></i>
                            <span style="font-size:var(--text-xs); font-family:var(--font-mono); color:var(--text-muted);">${e.time}</span>
                            <span style="font-size:var(--text-xs); background:${color}22; color:${color}; padding:1px 6px; border-radius:99px;">${e.type}</span>
                        </div>
                        <div style="font-size:var(--text-sm); color:var(--text-secondary);">${e.event}</div>
                        <div style="font-size:var(--text-xs); color:var(--text-muted); margin-top:2px;">Source: ${e.source}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    filterTimeline(type) {
        const filtered = type === 'all' ? this.evidence : this.evidence.filter(e => e.type === type);
        this.renderTimeline(filtered);
    }

    filterCases(query) {
        const q = query.toLowerCase();
        const filtered = this.cases.filter(c => c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
        const container = document.getElementById('df-case-list');
        if (container) {
            const orig = this.cases;
            this.cases = filtered;
            this.renderCases();
            this.cases = orig;
        }
    }

    updateStats() {
        const el = (id) => document.getElementById(id);
        const active = this.cases.filter(c => c.status === 'active').length;
        const totalEvidence = this.cases.reduce((sum, c) => sum + c.evidence, 0);
        if (el('df-cases')) el('df-cases').textContent = active;
        if (el('df-evidence')) el('df-evidence').textContent = totalEvidence;
        if (el('df-artifacts')) el('df-artifacts').textContent = this.evidence.length;
        if (el('df-analyzed')) el('df-analyzed').textContent = Math.floor(totalEvidence * 2.3);
    }

    selectCaseByIdx(idx) {
        const c = this.cases[idx];
        if (!c) return;
        console.log('Selected case:', c);
    }

    selectCase(id) {
        const c = this.cases.find(x => x.id === id);
        if (!c) return;
        console.log('Selected case:', c);
    }

    launchTool(toolId) {
        const toolNames = {
            'tool-disk': 'Disk Imaging',
            'tool-mem': 'Memory Dump Analysis',
            'tool-net': 'Network Forensics',
            'tool-file': 'File Analysis',
            'tool-timeline': 'Timeline Builder',
            'tool-hash': 'Hash Verifier',
            'tool-mobile': 'Mobile Forensics',
            'tool-cloud': 'Cloud Forensics',
        };
        alert(`Launching: ${toolNames[toolId] || toolId}\n\nThis tool integrates with the CyberForge backend for advanced forensic analysis.`);
    }

    newCase() {
        const title = prompt('Enter case title:');
        if (title) {
            const newCase = {
                id: `FOR-2024-${String(this.cases.length + 1).padStart(3,'0')}`,
                title,
                status: 'active',
                priority: 'medium',
                created: new Date().toISOString().split('T')[0],
                analyst: 'Current User',
                evidence: 0,
            };
            this.cases.unshift(newCase);
            this.renderCases();
            this.updateStats();
        }
    }

    exportReport() {
        alert('Generating forensics report...\nExporting case data, evidence timeline, and chain of custody documentation.');
    }
}

window.DigitalForensicsScreen = DigitalForensicsScreen;
