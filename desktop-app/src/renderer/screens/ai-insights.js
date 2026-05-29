/**
 * AI Insights Screen
 * AI-powered security insights, recommendations, and intelligence analysis
 */

class AIInsightsScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.insights = [];
        this.updateInterval = null;
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        container.innerHTML = this.createHTML();
        this.initializeComponents();
        await this.loadInsights();
        container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    createHTML() {
        return `
            <div class="ai-insights-screen" style="padding:var(--space-lg); display:flex; flex-direction:column; gap:var(--space-lg); overflow-y:auto; height:100%;">
                <!-- Header -->
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--space-md);">
                    <div>
                        <h2 style="font-size:var(--text-2xl); font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:var(--space-sm);">
                            <i class="fas fa-lightbulb" style="color:var(--warning);"></i>
                            AI Security Insights
                        </h2>
                        <p style="color:var(--text-muted); margin-top:4px;">AI-powered security intelligence, recommendations, and behavioral insights</p>
                    </div>
                    <div style="display:flex; gap:var(--space-sm); align-items:center;">
                        <select class="form-control" id="insights-category" style="width:auto;" onchange="window._insightsScreen?.filterByCategory(this.value)">
                            <option value="all">All Categories</option>
                            <option value="threat">Threat Detection</option>
                            <option value="behavior">Behavioral Analysis</option>
                            <option value="recommendation">Recommendations</option>
                            <option value="prediction">Predictions</option>
                        </select>
                        <button class="btn btn-primary" onclick="window._insightsScreen?.refreshInsights()">
                            <i class="fas fa-sync-alt"></i> Refresh
                        </button>
                    </div>
                </div>

                <!-- AI Status Panel -->
                <div style="background:linear-gradient(135deg, #1a0f2e 0%, var(--bg-card) 100%); border:1px solid var(--primary)44; border-radius:var(--radius-lg); padding:var(--space-lg);">
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:var(--space-md);">
                        ${[
                            { id:'insight-count', label:'Active Insights', val:'24', icon:'brain', color:'var(--primary)' },
                            { id:'insight-critical', label:'Critical Alerts', val:'3', icon:'exclamation-circle', color:'var(--error)' },
                            { id:'insight-recommendations', label:'Recommendations', val:'12', icon:'lightbulb', color:'var(--warning)' },
                            { id:'insight-confidence', label:'Avg. Confidence', val:'94%', icon:'percent', color:'var(--success)' },
                            { id:'insight-processed', label:'Events Processed', val:'1.2M', icon:'database', color:'var(--info)' },
                        ].map(s => `
                            <div style="display:flex; align-items:center; gap:var(--space-md);">
                                <div style="width:40px; height:40px; border-radius:50%; background:${s.color}22; display:flex; align-items:center; justify-content:center; color:${s.color}; font-size:var(--text-lg); flex-shrink:0;">
                                    <i class="fas fa-${s.icon}"></i>
                                </div>
                                <div>
                                    <div id="${s.id}" style="font-size:var(--text-xl); font-weight:700; color:var(--text-primary);">${s.val}</div>
                                    <div style="font-size:var(--text-xs); color:var(--text-muted);">${s.label}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Featured Insight -->
                <div id="insights-featured" style="background:var(--bg-card); border:2px solid var(--error)44; border-radius:var(--radius-lg); padding:var(--space-lg);">
                    <!-- Featured insight loaded here -->
                </div>

                <!-- Insights Grid -->
                <div>
                    <h3 style="font-size:var(--text-lg); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">All Insights</h3>
                    <div id="insights-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:var(--space-md);">
                        <!-- Insight cards loaded here -->
                    </div>
                </div>

                <!-- AI Model Activity -->
                <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                    <h3 style="font-size:var(--text-lg); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">
                        <i class="fas fa-robot" style="color:var(--primary);"></i> AI Model Activity
                    </h3>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:var(--space-md);">
                        ${[
                            { name:'Threat Classifier', events:8247, lastUpdate:'2 min ago', accuracy:'94.2%', color:'var(--primary)' },
                            { name:'Anomaly Detector', events:12891, lastUpdate:'1 min ago', accuracy:'91.7%', color:'var(--success)' },
                            { name:'Pattern Analyzer', events:5632, lastUpdate:'5 min ago', accuracy:'89.1%', color:'#F69D39' },
                            { name:'Behavior Engine', events:3421, lastUpdate:'3 min ago', accuracy:'87.5%', color:'var(--warning)' },
                        ].map(m => `
                            <div style="background:var(--bg-secondary); border-radius:var(--radius-md); padding:var(--space-md);">
                                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-sm);">
                                    <span style="font-size:var(--text-sm); font-weight:500; color:var(--text-primary);">${m.name}</span>
                                    <span style="width:8px; height:8px; border-radius:50%; background:${m.color}; display:inline-block;"></span>
                                </div>
                                <div style="display:flex; justify-content:space-between; margin-bottom:var(--space-xs);">
                                    <span style="font-size:var(--text-xs); color:var(--text-muted);">${m.events.toLocaleString()} events</span>
                                    <span style="font-size:var(--text-xs); font-weight:700; color:${m.color};">${m.accuracy}</span>
                                </div>
                                <div style="background:var(--bg-primary); border-radius:99px; height:4px; overflow:hidden; margin-bottom:var(--space-xs);">
                                    <div style="width:${m.accuracy}; height:100%; background:${m.color}; border-radius:99px;"></div>
                                </div>
                                <div style="font-size:var(--text-xs); color:var(--text-muted);">Updated ${m.lastUpdate}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        window._insightsScreen = this;
    }

    async loadInsights() {
        const api = window.cyberforgeAPI || window.apiClient;
        try {
            if (api) {
                const result = await api.getThreatStats();
                if (result?.success && result.data) {
                    const data = result.data;
                    const el = (id) => document.getElementById(id);
                    if (el('insight-count')) el('insight-count').textContent = data.total_threats || 24;
                    if (el('insight-critical')) el('insight-critical').textContent = data.critical || 3;
                }
            }
        } catch (e) { /* fallback */ }
        this.loadMockInsights();
    }

    loadMockInsights() {
        this.insights = [
            { id:1, category:'threat', title:'Advanced Persistent Threat (APT) Activity Detected', severity:'critical', confidence:97, description:'AI analysis identified lateral movement patterns consistent with an Advanced Persistent Threat. Multiple compromised credentials detected, suspicious process injection, and encrypted C2 communication channels active.', tags:['APT','Lateral Movement','C2'], time:'5 min ago', recommendation:'Isolate affected systems immediately and initiate incident response protocol.' },
            { id:2, category:'behavior', title:'Insider Threat Behavioral Pattern', severity:'high', confidence:89, description:'Behavioral baseline deviation detected for 3 user accounts. Anomalous data access patterns, off-hours logins, and unusual data transfer volumes suggest potential insider threat or compromised accounts.', tags:['Insider Threat','UEBA','Data Access'], time:'18 min ago', recommendation:'Review user activity logs and consider temporary access restriction.' },
            { id:3, category:'recommendation', title:'Patch Critical CVE-2024-1234 Immediately', severity:'critical', confidence:99, description:'System analysis detected unpatched OpenSSH vulnerability CVE-2024-1234 on 8 production servers. CVSS score 9.8. Active exploitation of this vulnerability detected in the wild.', tags:['Vulnerability','Patch Management'], time:'1 hour ago', recommendation:'Apply security patch immediately. Estimated remediation time: 30 minutes per server.' },
            { id:4, category:'prediction', title:'Phishing Campaign Expected in 24-48 Hours', severity:'high', confidence:78, description:'AI threat intelligence correlated external threat feeds, dark web activity, and recent email patterns to predict an incoming targeted phishing campaign against finance and HR departments.', tags:['Phishing','Social Engineering','Email'], time:'2 hours ago', recommendation:'Brief staff on phishing awareness and update email security filters.' },
            { id:5, category:'behavior', title:'DNS Tunneling Attempt Blocked', severity:'medium', confidence:95, description:'Machine learning models detected DNS query patterns consistent with data exfiltration via DNS tunneling. 847 suspicious queries blocked. Source identified as workstation WS-2024-045.', tags:['DNS Tunneling','Data Exfil','Network'], time:'3 hours ago', recommendation:'Investigate workstation WS-2024-045 and audit DNS query logs.' },
            { id:6, category:'recommendation', title:'Enable Multi-Factor Authentication', severity:'medium', confidence:99, description:'Analysis shows 23% of privileged accounts lack MFA. Risk assessment indicates this significantly increases breach probability. Enabling MFA would reduce account compromise risk by 99.9%.', tags:['MFA','Access Control','IAM'], time:'6 hours ago', recommendation:'Enforce MFA for all privileged accounts within 48 hours.' },
        ];

        this.renderFeaturedInsight(this.insights[0]);
        this.renderInsights(this.insights);
    }

    renderFeaturedInsight(insight) {
        const container = document.getElementById('insights-featured');
        if (!container || !insight) return;

        const colors = { critical:'var(--error)', high:'#F69D39', medium:'var(--warning)', low:'var(--info)' };
        const color = colors[insight.severity] || 'var(--primary)';

        container.style.borderColor = color + '44';
        container.innerHTML = `
            <div style="display:flex; align-items:start; justify-content:space-between; margin-bottom:var(--space-md);">
                <div style="display:flex; align-items:center; gap:var(--space-sm);">
                    <div style="background:${color}22; color:${color}; padding:4px 10px; border-radius:99px; font-size:var(--text-xs); font-weight:700; text-transform:uppercase;">🔥 Featured Insight</div>
                    <div style="background:${color}22; color:${color}; padding:4px 10px; border-radius:99px; font-size:var(--text-xs); font-weight:600; text-transform:uppercase;">${insight.severity}</div>
                </div>
                <span style="font-size:var(--text-xs); color:var(--text-muted);">${insight.time}</span>
            </div>
            <h3 style="font-size:var(--text-xl); font-weight:700; color:var(--text-primary); margin-bottom:var(--space-sm);">${insight.title}</h3>
            <p style="font-size:var(--text-sm); color:var(--text-secondary); line-height:1.6; margin-bottom:var(--space-md);">${insight.description}</p>
            <div style="background:${color}11; border:1px solid ${color}33; border-radius:var(--radius-md); padding:var(--space-md); margin-bottom:var(--space-md);">
                <div style="font-size:var(--text-xs); font-weight:600; color:${color}; margin-bottom:4px;">RECOMMENDED ACTION</div>
                <p style="font-size:var(--text-sm); color:var(--text-secondary);">${insight.recommendation}</p>
            </div>
            <div style="display:flex; align-items:center; gap:var(--space-md);">
                <div style="display:flex; gap:var(--space-xs);">${insight.tags.map(t => `<span style="background:var(--bg-secondary); color:var(--text-muted); padding:2px 8px; border-radius:99px; font-size:var(--text-xs);">${t}</span>`).join('')}</div>
                <span style="margin-left:auto; font-size:var(--text-sm); color:${color}; font-weight:700;">${insight.confidence}% confidence</span>
            </div>
        `;
    }

    renderInsights(insights) {
        const container = document.getElementById('insights-grid');
        if (!container) return;

        const colors = { critical:'var(--error)', high:'#F69D39', medium:'var(--warning)', low:'var(--info)' };
        const categoryIcons = { threat:'shield-alt', behavior:'user-check', recommendation:'lightbulb', prediction:'chart-line' };

        container.innerHTML = insights.map(insight => {
            const color = colors[insight.severity] || 'var(--primary)';
            const icon = categoryIcons[insight.category] || 'lightbulb';
            return `
                <div onclick="window._insightsScreen?.expandInsight(${insight.id})"
                     style="background:var(--bg-card); border:1px solid var(--border-color); border-top:3px solid ${color}; border-radius:var(--radius-md); padding:var(--space-md); cursor:pointer; transition:all var(--transition-fast);"
                     onmouseenter="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md)'"
                     onmouseleave="this.style.transform=''; this.style.boxShadow=''">
                    <div style="display:flex; align-items:start; justify-content:space-between; margin-bottom:var(--space-sm);">
                        <div style="display:flex; align-items:center; gap:var(--space-sm);">
                            <div style="width:30px; height:30px; border-radius:50%; background:${color}22; display:flex; align-items:center; justify-content:center; color:${color}; font-size:var(--text-sm); flex-shrink:0;">
                                <i class="fas fa-${icon}"></i>
                            </div>
                            <span style="background:${color}22; color:${color}; padding:2px 8px; border-radius:99px; font-size:var(--text-xs); font-weight:600; text-transform:uppercase;">${insight.severity}</span>
                        </div>
                        <span style="font-size:var(--text-xs); color:var(--text-muted);">${insight.time}</span>
                    </div>
                    <h4 style="font-size:var(--text-sm); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-xs); line-height:1.4;">${insight.title}</h4>
                    <p style="font-size:var(--text-xs); color:var(--text-secondary); line-height:1.5; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${insight.description}</p>
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-top:var(--space-sm);">
                        <div style="display:flex; gap:4px;">${insight.tags.slice(0,2).map(t => `<span style="background:var(--bg-secondary); color:var(--text-muted); padding:1px 6px; border-radius:99px; font-size:10px;">${t}</span>`).join('')}</div>
                        <span style="font-size:var(--text-xs); font-weight:700; color:${color};">${insight.confidence}%</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    filterByCategory(category) {
        const filtered = category === 'all' ? this.insights : this.insights.filter(i => i.category === category);
        this.renderInsights(filtered);
    }

    expandInsight(id) {
        const insight = this.insights.find(i => i.id === id);
        if (insight) this.renderFeaturedInsight(insight);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    refreshInsights() {
        this.loadInsights();
    }
}

window.AIInsightsScreen = AIInsightsScreen;
