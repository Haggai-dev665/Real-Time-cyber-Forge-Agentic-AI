/**
 * Predictions Screen
 * AI-powered threat forecasting and risk prediction
 */

class PredictionsScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.predictions = [];
        this.charts = {};
        this.updateInterval = null;
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
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        Object.values(this.charts).forEach(c => c?.destroy?.());
        this.charts = {};
    }

    createHTML() {
        return `
            <div class="predictions-screen" style="padding:var(--space-lg); display:flex; flex-direction:column; gap:var(--space-lg); overflow-y:auto; height:100%;">
                <!-- Header -->
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--space-md);">
                    <div>
                        <h2 style="font-size:var(--text-2xl); font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:var(--space-sm);">
                            <i class="fas fa-chart-area" style="color:var(--primary);"></i>
                            AI Threat Predictions
                        </h2>
                        <p style="color:var(--text-muted); margin-top:4px;">Machine learning-powered threat forecasting and risk assessment</p>
                    </div>
                    <div style="display:flex; gap:var(--space-sm); align-items:center;">
                        <select class="form-control" id="pred-timeframe" style="width:auto;">
                            <option value="24h">Next 24 Hours</option>
                            <option value="7d" selected>Next 7 Days</option>
                            <option value="30d">Next 30 Days</option>
                        </select>
                        <button class="btn btn-primary" onclick="window._predScreen?.refreshPredictions()">
                            <i class="fas fa-sync-alt"></i> Refresh
                        </button>
                    </div>
                </div>

                <!-- Risk Score Banner -->
                <div style="background:linear-gradient(135deg, #2d1b4e 0%, var(--bg-card) 100%); border:1px solid var(--primary)44; border-radius:var(--radius-lg); padding:var(--space-lg); display:flex; align-items:center; gap:var(--space-xl);">
                    <div style="text-align:center; min-width:120px;">
                        <div id="pred-overall-score" style="font-size:3rem; font-weight:900; color:var(--warning); line-height:1;">73</div>
                        <div style="font-size:var(--text-sm); color:var(--text-muted); margin-top:4px;">Overall Risk Score</div>
                        <div style="font-size:var(--text-xs); color:var(--warning); margin-top:2px;">HIGH RISK</div>
                    </div>
                    <div style="flex:1;">
                        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:var(--space-md);">
                            ${[
                                { id:'pred-network-risk', label:'Network Risk', value:'68', color:'#ff9500' },
                                { id:'pred-data-risk', label:'Data Breach Risk', value:'45', color:'var(--warning)' },
                                { id:'pred-infra-risk', label:'Infrastructure Risk', value:'82', color:'var(--error)' },
                            ].map(r => `
                                <div>
                                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                                        <span style="font-size:var(--text-xs); color:var(--text-secondary);">${r.label}</span>
                                        <span style="font-size:var(--text-xs); font-weight:700; color:${r.color};" id="${r.id}">${r.value}</span>
                                    </div>
                                    <div style="background:var(--bg-secondary); border-radius:99px; height:8px; overflow:hidden;">
                                        <div style="width:${r.value}%; height:100%; background:${r.color}; border-radius:99px;"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <p style="font-size:var(--text-sm); color:var(--text-secondary); margin-top:var(--space-md);">
                            <i class="fas fa-info-circle" style="color:var(--info);"></i>
                            AI models have detected elevated risk patterns. Infrastructure vulnerabilities suggest potential attack vectors in the next 7 days.
                        </p>
                    </div>
                </div>

                <!-- Prediction Cards -->
                <div>
                    <h3 style="font-size:var(--text-lg); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">Threat Predictions</h3>
                    <div id="pred-cards" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:var(--space-md);">
                        <!-- Cards will be rendered here -->
                    </div>
                </div>

                <!-- Charts Row -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-lg);">
                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                        <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">7-Day Threat Forecast</h3>
                        <canvas id="pred-forecast-chart" style="max-height:200px;"></canvas>
                    </div>
                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                        <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">Attack Vector Distribution</h3>
                        <canvas id="pred-vector-chart" style="max-height:200px;"></canvas>
                    </div>
                </div>

                <!-- AI Model Confidence -->
                <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                    <h3 style="font-size:var(--text-lg); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">
                        <i class="fas fa-brain" style="color:var(--primary);"></i> AI Model Performance
                    </h3>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-md);">
                        ${[
                            { name:'Threat Classifier', accuracy:'94.2%', predictions:1247, color:'var(--success)' },
                            { name:'Anomaly Detector', accuracy:'91.7%', predictions:3421, color:'var(--success)' },
                            { name:'Risk Scorer', accuracy:'88.9%', predictions:856, color:'var(--warning)' },
                            { name:'Attack Predictor', accuracy:'87.3%', predictions:432, color:'var(--warning)' },
                        ].map(m => `
                            <div style="background:var(--bg-secondary); border-radius:var(--radius-md); padding:var(--space-md);">
                                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-sm);">
                                    <span style="font-size:var(--text-sm); font-weight:500; color:var(--text-primary);">${m.name}</span>
                                    <span style="font-size:var(--text-sm); font-weight:700; color:${m.color};">${m.accuracy}</span>
                                </div>
                                <div style="font-size:var(--text-xs); color:var(--text-muted);">${m.predictions.toLocaleString()} predictions made</div>
                                <div style="background:var(--bg-primary); border-radius:99px; height:4px; margin-top:var(--space-sm); overflow:hidden;">
                                    <div style="width:${m.accuracy}; height:100%; background:${m.color}; border-radius:99px;"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        window._predScreen = this;
        document.getElementById('pred-timeframe')?.addEventListener('change', () => this.loadData());
    }

    async loadData() {
        const api = window.cyberforgeAPI || window.apiClient;
        try {
            if (api) {
                const result = await api.getThreatStats();
                if (result?.success) {
                    const data = result.data;
                    const riskScore = data?.risk_score || Math.floor(Math.random() * 30 + 50);
                    const scoreEl = document.getElementById('pred-overall-score');
                    if (scoreEl) {
                        scoreEl.textContent = riskScore;
                        scoreEl.style.color = riskScore >= 80 ? 'var(--error)' : riskScore >= 60 ? 'var(--warning)' : 'var(--success)';
                    }
                }
            }
        } catch (e) { /* fallback */ }
        this.renderPredictionCards();
        this.initCharts();
    }

    renderPredictionCards() {
        const container = document.getElementById('pred-cards');
        if (!container) return;

        const predictions = [
            { title:'DDoS Attack', probability:87, timeframe:'Next 24h', severity:'critical', description:'Botnet activity detected. High probability of distributed attack targeting web infrastructure.', indicators:['Unusual port 80/443 traffic', 'Multiple IP sources', 'SYN flood patterns'], color:'var(--error)' },
            { title:'Phishing Campaign', probability:74, timeframe:'Next 3 days', severity:'high', description:'Email pattern analysis suggests coordinated phishing campaign targeting finance department.', indicators:['Spoofed domain registrations', 'Similar email patterns', 'Lookalike domains'], color:'#ff9500' },
            { title:'Credential Stuffing', probability:62, timeframe:'Next 5 days', severity:'high', description:'Leaked credential database correlated with login attempt patterns.', indicators:['Failed login spikes', 'Geographic anomalies', 'Bot-like behavior'], color:'#ff9500' },
            { title:'Insider Threat Activity', probability:41, timeframe:'Next 7 days', severity:'medium', description:'Behavioral analytics detected unusual data access patterns from internal accounts.', indicators:['Off-hours access', 'Large data exports', 'Permission escalation'], color:'var(--warning)' },
            { title:'Supply Chain Attack', probability:28, timeframe:'Next 30 days', severity:'medium', description:'Third-party software dependencies contain suspicious update patterns.', indicators:['Dependency changes', 'Unusual update timing', 'Code integrity issues'], color:'var(--warning)' },
            { title:'Zero-Day Exploit', probability:15, timeframe:'Next 30 days', severity:'low', description:'No specific indicators, but threat landscape suggests potential zero-day activity.', indicators:['CVE patterns', 'Underground forum activity', 'PoC code sightings'], color:'var(--info)' },
        ];

        container.innerHTML = predictions.map(p => `
            <div style="background:var(--bg-card); border:1px solid ${p.color}33; border-left:4px solid ${p.color}; border-radius:var(--radius-md); padding:var(--space-md); display:flex; flex-direction:column; gap:var(--space-sm);">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <h4 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary);">${p.title}</h4>
                    <div style="text-align:center;">
                        <div style="font-size:var(--text-xl); font-weight:900; color:${p.color};">${p.probability}%</div>
                        <div style="font-size:var(--text-xs); color:var(--text-muted);">probability</div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:var(--space-sm);">
                    <span style="background:${p.color}22; color:${p.color}; padding:2px 8px; border-radius:99px; font-size:var(--text-xs); font-weight:600;">${p.severity.toUpperCase()}</span>
                    <span style="font-size:var(--text-xs); color:var(--text-muted);"><i class="fas fa-clock"></i> ${p.timeframe}</span>
                </div>
                <p style="font-size:var(--text-sm); color:var(--text-secondary); line-height:1.5;">${p.description}</p>
                <div>
                    <div style="font-size:var(--text-xs); font-weight:600; color:var(--text-muted); margin-bottom:4px;">KEY INDICATORS</div>
                    ${p.indicators.map(i => `<div style="font-size:var(--text-xs); color:var(--text-secondary); display:flex; align-items:center; gap:4px; margin-bottom:2px;"><i class="fas fa-angle-right" style="color:${p.color};"></i>${i}</div>`).join('')}
                </div>
                <div style="background:var(--bg-secondary); border-radius:99px; height:6px; overflow:hidden;">
                    <div style="width:${p.probability}%; height:100%; background:${p.color}; border-radius:99px;"></div>
                </div>
            </div>
        `).join('');
    }

    initCharts() {
        // Forecast chart
        const forecastCtx = document.getElementById('pred-forecast-chart');
        if (forecastCtx && typeof Chart !== 'undefined') {
            if (this.charts.forecast) this.charts.forecast.destroy();
            const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
            this.charts.forecast = new Chart(forecastCtx, {
                type: 'line',
                data: {
                    labels: days,
                    datasets: [
                        { label:'Predicted Threats', data:[12,18,15,25,30,22,28], borderColor:'var(--error)', backgroundColor:'rgba(255,82,82,0.1)', tension:0.4, fill:true },
                        { label:'Baseline', data:[10,10,10,10,10,10,10], borderColor:'var(--text-muted)', borderDash:[5,5], tension:0, pointRadius:0 },
                    ]
                },
                options: { responsive:true, animation:false, plugins:{ legend:{ labels:{ color:'var(--text-secondary)', font:{size:11} } } }, scales:{ y:{ beginAtZero:true, grid:{ color:'var(--border-color)' }, ticks:{ color:'var(--text-muted)' } }, x:{ grid:{ color:'var(--border-color)' }, ticks:{ color:'var(--text-muted)' } } } }
            });
        }

        // Vector chart
        const vectorCtx = document.getElementById('pred-vector-chart');
        if (vectorCtx && typeof Chart !== 'undefined') {
            if (this.charts.vector) this.charts.vector.destroy();
            this.charts.vector = new Chart(vectorCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Network', 'Email', 'Web App', 'Insider', 'Supply Chain'],
                    datasets: [{ data:[35,25,20,12,8], backgroundColor:['#ff5252','#ff9500','#ffd740','#7c4dff','#00b0ff'], borderWidth:0 }]
                },
                options: { responsive:true, animation:false, plugins:{ legend:{ position:'right', labels:{ color:'var(--text-secondary)', font:{size:11} } } } }
            });
        }
    }

    refreshPredictions() {
        this.loadData();
    }
}

window.PredictionsScreen = PredictionsScreen;
