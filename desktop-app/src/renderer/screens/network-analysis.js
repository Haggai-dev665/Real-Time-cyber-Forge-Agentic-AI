/**
 * Network Analysis Screen
 */

class NetworkAnalysisScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        this.container.innerHTML = this.createHTML();
        this.initializeComponents();
        
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
    }

    createHTML() {
        return `
            <div class="network-analysis-screen">
                <div class="analysis-header">
                    <h2><i class="fas fa-network-wired"></i> Network Analysis</h2>
                    <p>Real-time network traffic analysis and monitoring</p>
                </div>
                
                <div class="analysis-content">
                    <div class="network-stats">
                        <div class="stat-card">
                            <h3>1,245</h3>
                            <p>Active Connections</p>
                        </div>
                        <div class="stat-card">
                            <h3>2.4 GB</h3>
                            <p>Traffic Today</p>
                        </div>
                        <div class="stat-card">
                            <h3>12</h3>
                            <p>Anomalies Detected</p>
                        </div>
                    </div>
                    
                    <div class="traffic-chart">
                        <canvas id="network-traffic-chart"></canvas>
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        // Initialize chart
        const ctx = document.getElementById('network-traffic-chart');
        if (ctx) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                    datasets: [{
                        label: 'Network Traffic',
                        data: [12, 19, 15, 25, 22, 18],
                        borderColor: '#00f5ff',
                        tension: 0.4
                    }]
                },
                options: { responsive: true }
            });
        }
    }
}

window.NetworkAnalysisScreen = NetworkAnalysisScreen;