/**
 * Chart Factory
 * Creates and manages charts using Chart.js
 */

class ChartFactory {
    constructor() {
        this.charts = new Map();
        this.defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim()
                    }
                },
                tooltip: {
                    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim(),
                    titleColor: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
                    bodyColor: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim(),
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim(),
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim()
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()
                    }
                },
                y: {
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim(),
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim()
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()
                    }
                }
            }
        };
        
        this.colors = {
            primary: '#00d4ff',
            secondary: '#7c3aed',
            success: '#039855',
            warning: '#DC6803',
            error: '#D92D20',
            info: '#1570EF'
        };
        
        this.init();
    }

    init() {
        // Listen for theme changes
        document.addEventListener('themeChanged', () => {
            this.updateChartsForTheme();
        });
    }

    createLineChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error('Canvas element not found:', canvasId);
            return null;
        }

        const config = {
            type: 'line',
            data: this.processLineData(data),
            options: {
                ...this.defaultOptions,
                ...options,
                elements: {
                    line: {
                        tension: 0.4,
                        borderWidth: 2
                    },
                    point: {
                        radius: 4,
                        hoverRadius: 6
                    }
                }
            }
        };

        const chart = new Chart(canvas, config);
        this.charts.set(canvasId, chart);
        return chart;
    }

    createAreaChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error('Canvas element not found:', canvasId);
            return null;
        }

        const processedData = this.processLineData(data);
        processedData.datasets.forEach(dataset => {
            dataset.fill = true;
            dataset.backgroundColor = this.addAlpha(dataset.borderColor, 0.1);
        });

        const config = {
            type: 'line',
            data: processedData,
            options: {
                ...this.defaultOptions,
                ...options,
                elements: {
                    line: {
                        tension: 0.4,
                        borderWidth: 2
                    },
                    point: {
                        radius: 0,
                        hoverRadius: 4
                    }
                }
            }
        };

        const chart = new Chart(canvas, config);
        this.charts.set(canvasId, chart);
        return chart;
    }

    createBarChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error('Canvas element not found:', canvasId);
            return null;
        }

        const config = {
            type: 'bar',
            data: this.processBarData(data),
            options: {
                ...this.defaultOptions,
                ...options,
                elements: {
                    bar: {
                        borderRadius: 4,
                        borderSkipped: false
                    }
                }
            }
        };

        const chart = new Chart(canvas, config);
        this.charts.set(canvasId, chart);
        return chart;
    }

    createDoughnutChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error('Canvas element not found:', canvasId);
            return null;
        }

        const config = {
            type: 'doughnut',
            data: this.processDoughnutData(data),
            options: {
                ...this.defaultOptions,
                ...options,
                cutout: '70%',
                elements: {
                    arc: {
                        borderWidth: 2,
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim()
                    }
                },
                plugins: {
                    ...this.defaultOptions.plugins,
                    legend: {
                        ...this.defaultOptions.plugins.legend,
                        position: 'bottom'
                    }
                }
            }
        };

        const chart = new Chart(canvas, config);
        this.charts.set(canvasId, chart);
        return chart;
    }

    createRadarChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error('Canvas element not found:', canvasId);
            return null;
        }

        const config = {
            type: 'radar',
            data: this.processRadarData(data),
            options: {
                ...this.defaultOptions,
                ...options,
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim()
                        },
                        angleLines: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim()
                        },
                        pointLabels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim()
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim(),
                            backdropColor: 'transparent'
                        }
                    }
                },
                elements: {
                    line: {
                        borderWidth: 2
                    },
                    point: {
                        radius: 4,
                        hoverRadius: 6
                    }
                }
            }
        };

        const chart = new Chart(canvas, config);
        this.charts.set(canvasId, chart);
        return chart;
    }

    createRealTimeChart(canvasId, options = {}) {
        const maxDataPoints = options.maxDataPoints || 50;
        const updateInterval = options.updateInterval || 1000;
        
        const initialData = {
            labels: [],
            datasets: [{
                label: options.label || 'Real-time Data',
                data: [],
                borderColor: this.colors.primary,
                backgroundColor: this.addAlpha(this.colors.primary, 0.1),
                fill: true,
                tension: 0.4
            }]
        };

        const chart = this.createLineChart(canvasId, initialData, {
            ...options,
            scales: {
                ...this.defaultOptions.scales,
                x: {
                    ...this.defaultOptions.scales.x,
                    display: options.showXAxis !== false
                },
                y: {
                    ...this.defaultOptions.scales.y,
                    beginAtZero: true
                }
            },
            plugins: {
                ...this.defaultOptions.plugins,
                legend: {
                    display: options.showLegend !== false
                }
            }
        });

        if (chart && options.autoUpdate) {
            const interval = setInterval(() => {
                this.addRealTimeDataPoint(canvasId, {
                    x: new Date(),
                    y: Math.random() * 100 // Replace with actual data source
                }, maxDataPoints);
            }, updateInterval);

            // Store interval for cleanup
            chart.updateInterval = interval;
        }

        return chart;
    }

    addRealTimeDataPoint(canvasId, dataPoint, maxPoints = 50) {
        const chart = this.charts.get(canvasId);
        if (!chart) return;

        const dataset = chart.data.datasets[0];
        dataset.data.push(dataPoint);
        chart.data.labels.push(dataPoint.x);

        // Remove old data points
        if (dataset.data.length > maxPoints) {
            dataset.data.shift();
            chart.data.labels.shift();
        }

        chart.update('none'); // No animation for real-time updates
    }

    updateChart(canvasId, newData) {
        const chart = this.charts.get(canvasId);
        if (!chart) return;

        chart.data = newData;
        chart.update();
    }

    destroyChart(canvasId) {
        const chart = this.charts.get(canvasId);
        if (chart) {
            if (chart.updateInterval) {
                clearInterval(chart.updateInterval);
            }
            chart.destroy();
            this.charts.delete(canvasId);
        }
    }

    // Data processing methods
    processLineData(data) {
        if (!data.datasets) {
            data.datasets = [];
        }

        data.datasets.forEach((dataset, index) => {
            if (!dataset.borderColor) {
                dataset.borderColor = this.getColorByIndex(index);
            }
            if (!dataset.backgroundColor) {
                dataset.backgroundColor = this.addAlpha(dataset.borderColor, 0.1);
            }
        });

        return data;
    }

    processBarData(data) {
        if (!data.datasets) {
            data.datasets = [];
        }

        data.datasets.forEach((dataset, index) => {
            if (!dataset.backgroundColor) {
                if (Array.isArray(dataset.data)) {
                    dataset.backgroundColor = dataset.data.map((_, i) => 
                        this.getColorByIndex(i % Object.keys(this.colors).length)
                    );
                } else {
                    dataset.backgroundColor = this.getColorByIndex(index);
                }
            }
            if (!dataset.borderColor) {
                dataset.borderColor = dataset.backgroundColor;
            }
        });

        return data;
    }

    processDoughnutData(data) {
        if (!data.datasets) {
            data.datasets = [{}];
        }

        data.datasets.forEach(dataset => {
            if (!dataset.backgroundColor) {
                dataset.backgroundColor = data.labels.map((_, index) => 
                    this.getColorByIndex(index)
                );
            }
            if (!dataset.borderColor) {
                dataset.borderColor = getComputedStyle(document.documentElement)
                    .getPropertyValue('--bg-primary').trim();
            }
        });

        return data;
    }

    processRadarData(data) {
        if (!data.datasets) {
            data.datasets = [];
        }

        data.datasets.forEach((dataset, index) => {
            if (!dataset.borderColor) {
                dataset.borderColor = this.getColorByIndex(index);
            }
            if (!dataset.backgroundColor) {
                dataset.backgroundColor = this.addAlpha(dataset.borderColor, 0.2);
            }
        });

        return data;
    }

    // Utility methods
    getColorByIndex(index) {
        const colorKeys = Object.keys(this.colors);
        const colorKey = colorKeys[index % colorKeys.length];
        return this.colors[colorKey];
    }

    addAlpha(color, alpha) {
        if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return color;
    }

    updateChartsForTheme() {
        // Update all charts when theme changes
        this.charts.forEach((chart, canvasId) => {
            const options = chart.options;
            
            // Update colors
            if (options.plugins.legend) {
                options.plugins.legend.labels.color = 
                    getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
            }
            
            if (options.plugins.tooltip) {
                options.plugins.tooltip.backgroundColor = 
                    getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim();
                options.plugins.tooltip.titleColor = 
                    getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
                options.plugins.tooltip.bodyColor = 
                    getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
                options.plugins.tooltip.borderColor = 
                    getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim();
            }
            
            if (options.scales) {
                ['x', 'y', 'r'].forEach(axis => {
                    if (options.scales[axis]) {
                        if (options.scales[axis].grid) {
                            options.scales[axis].grid.color = 
                                getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim();
                        }
                        if (options.scales[axis].ticks) {
                            options.scales[axis].ticks.color = 
                                getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();
                        }
                        if (options.scales[axis].pointLabels) {
                            options.scales[axis].pointLabels.color = 
                                getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
                        }
                    }
                });
            }
            
            chart.update();
        });
    }

    // Preset chart configurations
    createThreatChart(canvasId, threatData) {
        const data = {
            labels: threatData.map(item => item.date),
            datasets: [{
                label: 'Threats Detected',
                data: threatData.map(item => item.count),
                borderColor: this.colors.error,
                backgroundColor: this.addAlpha(this.colors.error, 0.1),
                fill: true
            }]
        };

        return this.createAreaChart(canvasId, data, {
            plugins: {
                title: {
                    display: true,
                    text: 'Threat Detection Timeline'
                }
            }
        });
    }

    createPerformanceChart(canvasId, performanceData) {
        const data = {
            labels: ['CPU', 'Memory', 'Network', 'Disk'],
            datasets: [{
                label: 'System Performance',
                data: performanceData,
                backgroundColor: [
                    this.colors.primary,
                    this.colors.secondary,
                    this.colors.success,
                    this.colors.warning
                ]
            }]
        };

        return this.createDoughnutChart(canvasId, data);
    }

    createSecurityScoreChart(canvasId, scoreData) {
        const data = {
            labels: ['Malware', 'Phishing', 'Network', 'System', 'Data'],
            datasets: [{
                label: 'Security Score',
                data: scoreData,
                borderColor: this.colors.primary,
                backgroundColor: this.addAlpha(this.colors.primary, 0.2)
            }]
        };

        return this.createRadarChart(canvasId, data);
    }

    // Cleanup
    destroy() {
        this.charts.forEach((chart, canvasId) => {
            this.destroyChart(canvasId);
        });
        this.charts.clear();
    }
}

// Export singleton instance
window.chartFactory = new ChartFactory();