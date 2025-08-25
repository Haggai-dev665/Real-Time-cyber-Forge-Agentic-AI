/**
 * Reports Screen
 */

class ReportsScreen {
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
            <div class="reports-screen">
                <div class="reports-header">
                    <h2><i class="fas fa-chart-bar"></i> Security Reports</h2>
                    <p>Generate and view security analysis reports</p>
                </div>
                
                <div class="reports-content">
                    <div class="report-types">
                        <button class="report-btn"><i class="fas fa-shield-alt"></i> Threat Summary</button>
                        <button class="report-btn"><i class="fas fa-chart-line"></i> Performance Report</button>
                        <button class="report-btn"><i class="fas fa-exclamation-triangle"></i> Incident Report</button>
                        <button class="report-btn"><i class="fas fa-clipboard-check"></i> Compliance Report</button>
                    </div>
                    
                    <div class="recent-reports">
                        <h3>Recent Reports</h3>
                        <div class="report-item">
                            <span class="report-name">Weekly Threat Summary</span>
                            <span class="report-date">2024-01-22</span>
                            <button class="btn btn-sm btn-secondary">Download</button>
                        </div>
                        <div class="report-item">
                            <span class="report-name">Security Performance</span>
                            <span class="report-date">2024-01-20</span>
                            <button class="btn btn-sm btn-secondary">Download</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        // Setup event listeners
    }
}

window.ReportsScreen = ReportsScreen;