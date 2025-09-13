/**
 * Advanced Dashboard Charts and Animations
 * Handles real-time security analytics visualization
 */

class AdvancedDashboard {
    constructor() {
        this.charts = {};
        this.animationTimers = {};
        this.realTimeData = {
            threats: [],
            pages: [],
            activities: [],
            securityScore: 95
        };
        this.init();
    }

    init() {
        this.initializeCharts();
        this.startRealTimeUpdates();
        this.initializeAnimations();
        this.setupEventListeners();
    }

    initializeCharts() {
        // Initialize the main security chart
        this.createSecurityChart();
        
        // Initialize metric counters with animations
        this.animateCounters();
        
        // Start threat level animation
        this.animateThreatLevel();
    }

    createSecurityChart() {
        const canvas = document.getElementById('security-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Create gradient backgrounds
        const gradientBlue = ctx.createLinearGradient(0, 0, 0, 300);
        gradientBlue.addColorStop(0, 'rgba(0, 245, 255, 0.8)');
        gradientBlue.addColorStop(1, 'rgba(0, 245, 255, 0.1)');

        const gradientPurple = ctx.createLinearGradient(0, 0, 0, 300);
        gradientPurple.addColorStop(0, 'rgba(157, 78, 221, 0.8)');
        gradientPurple.addColorStop(1, 'rgba(157, 78, 221, 0.1)');

        const gradientRed = ctx.createLinearGradient(0, 0, 0, 300);
        gradientRed.addColorStop(0, 'rgba(255, 7, 58, 0.8)');
        gradientRed.addColorStop(1, 'rgba(255, 7, 58, 0.1)');

        // Generate sample data
        const timeLabels = this.generateTimeLabels();
        const threatsData = this.generateRandomData(24, 0, 10);
        const pagesData = this.generateRandomData(24, 50, 200);
        const securityData = this.generateRandomData(24, 80, 100);

        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            this.drawCustomChart(ctx, timeLabels, threatsData, pagesData, securityData);
        } else {
            this.createChartJS(ctx, timeLabels, threatsData, pagesData, securityData);
        }
    }

    drawCustomChart(ctx, timeLabels, threatsData, pagesData, securityData) {
        const canvas = ctx.canvas;
        const width = canvas.width;
        const height = canvas.height;
        const padding = 60;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw grid
        this.drawGrid(ctx, width, height, padding);

        // Draw data lines
        this.drawDataLine(ctx, threatsData, width, height, padding, '#ff073a', 'Threats');
        this.drawDataLine(ctx, pagesData, width, height, padding, '#00f5ff', 'Pages');
        this.drawDataLine(ctx, securityData, width, height, padding, '#9d4edd', 'Security Score');

        // Draw labels
        this.drawLabels(ctx, timeLabels, width, height, padding);
    }

    drawGrid(ctx, width, height, padding) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        // Vertical lines
        for (let i = 0; i <= 6; i++) {
            const x = padding + (i * (width - 2 * padding)) / 6;
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, height - padding);
            ctx.stroke();
        }

        // Horizontal lines
        for (let i = 0; i <= 5; i++) {
            const y = padding + (i * (height - 2 * padding)) / 5;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }
    }

    drawDataLine(ctx, data, width, height, padding, color, label) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        const maxValue = Math.max(...data);
        const stepX = (width - 2 * padding) / (data.length - 1);
        const stepY = (height - 2 * padding) / maxValue;

        ctx.beginPath();
        data.forEach((value, index) => {
            const x = padding + index * stepX;
            const y = height - padding - value * stepY;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Reset shadow
        ctx.shadowBlur = 0;

        // Draw data points
        ctx.fillStyle = color;
        data.forEach((value, index) => {
            const x = padding + index * stepX;
            const y = height - padding - value * stepY;
            
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    drawLabels(ctx, timeLabels, width, height, padding) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';

        // X-axis labels (time)
        timeLabels.forEach((label, index) => {
            if (index % 4 === 0) { // Show every 4th label
                const x = padding + (index * (width - 2 * padding)) / (timeLabels.length - 1);
                ctx.fillText(label, x, height - padding + 20);
            }
        });
    }

    generateTimeLabels() {
        const labels = [];
        for (let i = 23; i >= 0; i--) {
            const hour = (new Date().getHours() - i + 24) % 24;
            labels.push(`${hour.toString().padStart(2, '0')}:00`);
        }
        return labels;
    }

    generateRandomData(length, min, max) {
        return Array.from({length}, () => Math.floor(Math.random() * (max - min + 1)) + min);
    }

    animateCounters() {
        const counters = [
            { id: 'pages-count', target: 1247 },
            { id: 'threats-count', target: 3 },
            { id: 'insights-count', target: 156 },
            { id: 'active-tasks-count', target: 7 },
            { id: 'quick-pages', target: 1247 },
            { id: 'quick-threats', target: 3 },
            { id: 'quick-score', target: 95 }
        ];

        counters.forEach(counter => {
            this.animateCounter(counter.id, counter.target);
        });
    }

    animateCounter(elementId, targetValue) {
        const element = document.getElementById(elementId);
        if (!element) return;

        let currentValue = 0;
        const increment = targetValue / 60; // 60 frames for smooth animation
        const duration = 2000; // 2 seconds
        const frameTime = duration / 60;

        const timer = setInterval(() => {
            currentValue += increment;
            if (currentValue >= targetValue) {
                currentValue = targetValue;
                clearInterval(timer);
            }
            element.textContent = Math.floor(currentValue);
        }, frameTime);
    }

    animateThreatLevel() {
        const threatLevel = document.querySelector('.threat-level');
        if (!threatLevel) return;

        // Add pulsing animation for threat level
        setInterval(() => {
            threatLevel.style.transform = 'scale(1.05)';
            setTimeout(() => {
                threatLevel.style.transform = 'scale(1)';
            }, 1000);
        }, 3000);
    }

    startRealTimeUpdates() {
        // Update activity feed every 10 seconds
        setInterval(() => {
            this.addRandomActivity();
        }, 10000);

        // Update metrics every 30 seconds
        setInterval(() => {
            this.updateMetrics();
        }, 30000);

        // Update chart data every 60 seconds
        setInterval(() => {
            this.updateChartData();
        }, 60000);
    }

    addRandomActivity() {
        const activities = [
            {
                type: 'info',
                icon: 'fas fa-globe',
                title: 'New page scanned',
                description: 'Security analysis completed for new webpage',
                time: 'Just now'
            },
            {
                type: 'success',
                icon: 'fas fa-shield-alt',
                title: 'Threat blocked',
                description: 'Malicious script detected and blocked',
                time: 'Just now'
            },
            {
                type: 'warning',
                icon: 'fas fa-exclamation-triangle',
                title: 'Suspicious activity',
                description: 'Unusual network pattern detected',
                time: 'Just now'
            },
            {
                type: 'info',
                icon: 'fas fa-brain',
                title: 'AI insight generated',
                description: 'New security recommendation available',
                time: 'Just now'
            }
        ];

        const activity = activities[Math.floor(Math.random() * activities.length)];
        this.addActivityToFeed(activity);
    }

    addActivityToFeed(activity) {
        const activityFeed = document.getElementById('activity-feed');
        if (!activityFeed) return;

        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.style.opacity = '0';
        activityItem.style.transform = 'translateY(20px)';

        activityItem.innerHTML = `
            <div class="activity-icon ${activity.type}">
                <i class="${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-description">${activity.description}</div>
                <div class="activity-time">${activity.time}</div>
            </div>
        `;

        activityFeed.insertBefore(activityItem, activityFeed.firstChild);

        // Animate in
        setTimeout(() => {
            activityItem.style.opacity = '1';
            activityItem.style.transform = 'translateY(0)';
        }, 100);

        // Remove old activities (keep only last 10)
        const activities = activityFeed.querySelectorAll('.activity-item');
        if (activities.length > 10) {
            activities[activities.length - 1].remove();
        }
    }

    updateMetrics() {
        // Simulate metric updates
        const metrics = [
            { id: 'pages-count', change: Math.floor(Math.random() * 10) },
            { id: 'threats-count', change: Math.floor(Math.random() * 3) },
            { id: 'insights-count', change: Math.floor(Math.random() * 5) },
            { id: 'active-tasks-count', change: Math.floor(Math.random() * 3) - 1 }
        ];

        metrics.forEach(metric => {
            const element = document.getElementById(metric.id);
            if (element) {
                const currentValue = parseInt(element.textContent) || 0;
                const newValue = Math.max(0, currentValue + metric.change);
                this.animateCounter(metric.id, newValue);
            }
        });
    }

    updateChartData() {
        // Update chart with new data point
        if (this.charts.securityChart) {
            // Add new data point and remove oldest
            // This would update the Chart.js instance if available
        }
    }

    initializeAnimations() {
        // Add entrance animations to dashboard elements
        const elements = document.querySelectorAll('.metric-card, .chart-container, .activity-feed, .threat-overview');
        elements.forEach((element, index) => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(30px)';
            
            setTimeout(() => {
                element.style.transition = 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, index * 200);
        });
    }

    setupEventListeners() {
        // Chart period selector
        const chartButtons = document.querySelectorAll('.chart-btn');
        chartButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                chartButtons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                this.updateChartPeriod(e.target.dataset.period);
            });
        });

        // Clear activity feed
        const clearButton = document.getElementById('clear-activity');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                const activityFeed = document.getElementById('activity-feed');
                if (activityFeed) {
                    activityFeed.innerHTML = '';
                    this.addActivityToFeed({
                        type: 'info',
                        icon: 'fas fa-info',
                        title: 'Activity cleared',
                        description: 'Activity feed has been cleared',
                        time: 'Just now'
                    });
                }
            });
        }
    }

    updateChartPeriod(period) {
        // Update chart data based on selected period
        console.log(`Updating chart for period: ${period}`);
        // Implementation would fetch data for the selected time period
        // and update the chart accordingly
    }

    // Method to add real-time threat data
    addThreatData(threatData) {
        this.realTimeData.threats.push(threatData);
        this.updateThreatOverview();
    }

    // Method to add real-time page data
    addPageData(pageData) {
        this.realTimeData.pages.push(pageData);
        this.updatePageMetrics();
    }

    updateThreatOverview() {
        const threatCounts = {
            malware: this.realTimeData.threats.filter(t => t.type === 'malware').length,
            phishing: this.realTimeData.threats.filter(t => t.type === 'phishing').length,
            suspicious: this.realTimeData.threats.filter(t => t.type === 'suspicious').length,
            blocked: this.realTimeData.threats.filter(t => t.status === 'blocked').length
        };

        // Update threat category counts
        Object.keys(threatCounts).forEach(category => {
            const element = document.querySelector(`.threat-category:nth-child(${Object.keys(threatCounts).indexOf(category) + 1}) .category-count`);
            if (element) {
                element.textContent = threatCounts[category];
                // Update color based on count
                if (threatCounts[category] === 0) {
                    element.style.background = 'var(--cyber-green)';
                } else if (threatCounts[category] < 5) {
                    element.style.background = 'var(--cyber-orange)';
                } else {
                    element.style.background = 'var(--cyber-red)';
                }
            }
        });
    }

    updatePageMetrics() {
        const pagesCount = this.realTimeData.pages.length;
        const element = document.getElementById('pages-count');
        if (element) {
            this.animateCounter('pages-count', pagesCount);
        }
    }
}

// Initialize the advanced dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.advancedDashboard = new AdvancedDashboard();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedDashboard;
}
