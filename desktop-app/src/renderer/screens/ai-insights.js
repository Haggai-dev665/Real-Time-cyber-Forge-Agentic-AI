/**
 * AI Insights Screen
 * AI-powered security insights and recommendations
 */

class AIInsightsScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.insights = [];
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        this.container.innerHTML = this.createHTML();
        this.initializeComponents();
        await this.loadInsights();
        
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
    }

    createHTML() {
        return `
            <div class="ai-insights-screen">
                <div class="insights-header">
                    <h2><i class="fas fa-lightbulb"></i> AI Insights</h2>
                    <p>AI-powered security insights and recommendations</p>
                </div>
                
                <div class="insights-content">
                    <div class="insights-grid" id="insights-grid">
                        <!-- Insights will be populated here -->
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        // Setup event listeners
    }

    async loadInsights() {
        if (!window.apiClient) {
            this.insights = [];
            return;
        }

        try {
            const response = await window.apiClient.getAIInsights('latest security insights');
            if (response.success) {
                const items = response.data?.insights || response.data || [];
                this.insights = items.map((insight, idx) => ({
                    id: insight.id || idx,
                    title: insight.title || insight.name || 'Insight',
                    type: (insight.type || 'info').toLowerCase(),
                    description: insight.description || insight.summary || 'No description provided.',
                    confidence: insight.confidence ?? 0,
                    timestamp: insight.timestamp ? new Date(insight.timestamp) : new Date()
                }));
            }
        } catch (error) {
            console.error('Failed to load AI insights:', error);
        }

        this.renderInsights();
    }

    renderInsights() {
        const grid = document.getElementById('insights-grid');
        grid.innerHTML = this.insights.map(insight => `
            <div class="insight-card ${insight.type}">
                <h3>${insight.title}</h3>
                <p>${insight.description}</p>
                <div class="insight-meta">
                    <span>Confidence: ${insight.confidence}%</span>
                    <span>${insight.timestamp.toLocaleString()}</span>
                </div>
            </div>
        `).join('');
    }
}

window.AIInsightsScreen = AIInsightsScreen;