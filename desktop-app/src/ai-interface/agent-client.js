/**
 * Autonomous Agent Client
 * Desktop app integration with the autonomous AI agent backend
 */

const axios = require('axios');
const EventEmitter = require('events');

class AgentClient extends EventEmitter {
    constructor(options = {}) {
        super();
        this.apiUrl = options.apiUrl || process.env.AI_SERVICE_URL || 'http://localhost:8001';
        this.agentUrl = `${this.apiUrl}/agent`;
        this.isConnected = false;
        this.eventSource = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        // Task tracking
        this.activeTasks = new Map();
        this.taskHistory = [];
        
        // Start connection check
        this.checkConnection();
    }

    /**
     * Check connection to agent service
     */
    async checkConnection() {
        try {
            const response = await axios.get(`${this.agentUrl}/health`, { timeout: 5000 });
            this.isConnected = response.data.status === 'healthy';
            
            if (this.isConnected) {
                this.emit('connected');
                this.reconnectAttempts = 0;
                console.log('✅ Agent service connected');
            }
            
            return this.isConnected;
        } catch (error) {
            this.isConnected = false;
            this.emit('disconnected', error.message);
            console.log('❌ Agent service unavailable:', error.message);
            return false;
        }
    }

    /**
     * Get agent status
     */
    async getStatus() {
        try {
            const response = await axios.get(`${this.agentUrl}/status`);
            return response.data;
        } catch (error) {
            console.error('Failed to get agent status:', error.message);
            throw error;
        }
    }

    /**
     * Create a new task
     */
    async createTask(type, description, parameters = {}, priority = 'normal') {
        try {
            const response = await axios.post(`${this.agentUrl}/tasks`, {
                type,
                description,
                parameters,
                priority,
                metadata: {
                    source: 'desktop-app',
                    timestamp: new Date().toISOString(),
                }
            });
            
            const task = response.data;
            this.activeTasks.set(task.id, task);
            this.emit('taskCreated', task);
            
            return task;
        } catch (error) {
            console.error('Failed to create task:', error.message);
            throw error;
        }
    }

    /**
     * Get task by ID
     */
    async getTask(taskId) {
        try {
            const response = await axios.get(`${this.agentUrl}/tasks/${taskId}`);
            return response.data;
        } catch (error) {
            console.error(`Failed to get task ${taskId}:`, error.message);
            throw error;
        }
    }

    /**
     * List all tasks
     */
    async listTasks(options = {}) {
        try {
            const params = new URLSearchParams();
            if (options.status) params.append('status', options.status);
            if (options.type) params.append('task_type', options.type);
            if (options.limit) params.append('limit', options.limit);
            if (options.offset) params.append('offset', options.offset);
            
            const response = await axios.get(`${this.agentUrl}/tasks?${params}`);
            return response.data;
        } catch (error) {
            console.error('Failed to list tasks:', error.message);
            throw error;
        }
    }

    /**
     * Cancel a task
     */
    async cancelTask(taskId) {
        try {
            const response = await axios.post(`${this.agentUrl}/tasks/${taskId}/cancel`);
            this.activeTasks.delete(taskId);
            this.emit('taskCancelled', taskId);
            return response.data;
        } catch (error) {
            console.error(`Failed to cancel task ${taskId}:`, error.message);
            throw error;
        }
    }

    /**
     * Retry a failed task
     */
    async retryTask(taskId) {
        try {
            const response = await axios.post(`${this.agentUrl}/tasks/${taskId}/retry`);
            return response.data;
        } catch (error) {
            console.error(`Failed to retry task ${taskId}:`, error.message);
            throw error;
        }
    }

    /**
     * Create a scheduled task
     */
    async createSchedule(options) {
        try {
            const response = await axios.post(`${this.agentUrl}/schedules`, {
                task_type: options.taskType,
                description: options.description,
                trigger_type: options.triggerType,
                parameters: options.parameters || {},
                cron_expression: options.cron,
                interval_seconds: options.interval,
                event_type: options.eventType,
                run_at: options.runAt,
                max_runs: options.maxRuns,
            });
            
            return response.data;
        } catch (error) {
            console.error('Failed to create schedule:', error.message);
            throw error;
        }
    }

    /**
     * List schedules
     */
    async listSchedules() {
        try {
            const response = await axios.get(`${this.agentUrl}/schedules`);
            return response.data;
        } catch (error) {
            console.error('Failed to list schedules:', error.message);
            throw error;
        }
    }

    /**
     * Pause a schedule
     */
    async pauseSchedule(scheduleId) {
        try {
            const response = await axios.post(`${this.agentUrl}/schedules/${scheduleId}/pause`);
            return response.data;
        } catch (error) {
            console.error(`Failed to pause schedule ${scheduleId}:`, error.message);
            throw error;
        }
    }

    /**
     * Resume a schedule
     */
    async resumeSchedule(scheduleId) {
        try {
            const response = await axios.post(`${this.agentUrl}/schedules/${scheduleId}/resume`);
            return response.data;
        } catch (error) {
            console.error(`Failed to resume schedule ${scheduleId}:`, error.message);
            throw error;
        }
    }

    /**
     * Delete a schedule
     */
    async deleteSchedule(scheduleId) {
        try {
            const response = await axios.delete(`${this.agentUrl}/schedules/${scheduleId}`);
            return response.data;
        } catch (error) {
            console.error(`Failed to delete schedule ${scheduleId}:`, error.message);
            throw error;
        }
    }

    /**
     * Create a goal and execute plan
     */
    async createGoal(description, context = {}, priority = 'normal') {
        try {
            const response = await axios.post(`${this.agentUrl}/goals`, {
                description,
                context,
                priority,
            });
            
            this.emit('goalCreated', response.data);
            return response.data;
        } catch (error) {
            console.error('Failed to create goal:', error.message);
            throw error;
        }
    }

    /**
     * Get goal status
     */
    async getGoal(goalId) {
        try {
            const response = await axios.get(`${this.agentUrl}/goals/${goalId}`);
            return response.data;
        } catch (error) {
            console.error(`Failed to get goal ${goalId}:`, error.message);
            throw error;
        }
    }

    /**
     * Store a memory
     */
    async storeMemory(content, type = 'semantic', metadata = {}) {
        try {
            const response = await axios.post(`${this.agentUrl}/memory`, {
                content,
                memory_type: type,
                metadata,
            });
            
            return response.data;
        } catch (error) {
            console.error('Failed to store memory:', error.message);
            throw error;
        }
    }

    /**
     * Search memory
     */
    async searchMemory(query, options = {}) {
        try {
            const response = await axios.post(`${this.agentUrl}/memory/search`, {
                query,
                memory_types: options.types,
                limit: options.limit || 10,
            });
            
            return response.data;
        } catch (error) {
            console.error('Failed to search memory:', error.message);
            throw error;
        }
    }

    /**
     * Get context for a query
     */
    async getContext(query, limit = 5) {
        try {
            const response = await axios.get(`${this.agentUrl}/memory/context`, {
                params: { query, limit }
            });
            
            return response.data;
        } catch (error) {
            console.error('Failed to get context:', error.message);
            throw error;
        }
    }

    /**
     * Get metrics
     */
    async getMetrics() {
        try {
            const response = await axios.get(`${this.agentUrl}/metrics`);
            return response.data;
        } catch (error) {
            console.error('Failed to get metrics:', error.message);
            throw error;
        }
    }

    /**
     * Get alerts
     */
    async getAlerts(options = {}) {
        try {
            const params = new URLSearchParams();
            if (options.severity) params.append('severity', options.severity);
            if (options.acknowledged !== undefined) {
                params.append('acknowledged', options.acknowledged);
            }
            
            const response = await axios.get(`${this.agentUrl}/alerts?${params}`);
            return response.data;
        } catch (error) {
            console.error('Failed to get alerts:', error.message);
            throw error;
        }
    }

    /**
     * Acknowledge an alert
     */
    async acknowledgeAlert(alertId) {
        try {
            const response = await axios.post(`${this.agentUrl}/alerts/${alertId}/acknowledge`);
            return response.data;
        } catch (error) {
            console.error(`Failed to acknowledge alert ${alertId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get agent health
     */
    async getHealth() {
        try {
            const response = await axios.get(`${this.agentUrl}/health`);
            return response.data;
        } catch (error) {
            console.error('Failed to get health:', error.message);
            throw error;
        }
    }

    /**
     * Start the agent
     */
    async startAgent() {
        try {
            const response = await axios.post(`${this.agentUrl}/start`);
            this.emit('agentStarted');
            return response.data;
        } catch (error) {
            console.error('Failed to start agent:', error.message);
            throw error;
        }
    }

    /**
     * Stop the agent
     */
    async stopAgent() {
        try {
            const response = await axios.post(`${this.agentUrl}/stop`);
            this.emit('agentStopped');
            return response.data;
        } catch (error) {
            console.error('Failed to stop agent:', error.message);
            throw error;
        }
    }

    /**
     * Pause the agent
     */
    async pauseAgent() {
        try {
            const response = await axios.post(`${this.agentUrl}/pause`);
            this.emit('agentPaused');
            return response.data;
        } catch (error) {
            console.error('Failed to pause agent:', error.message);
            throw error;
        }
    }

    /**
     * Resume the agent
     */
    async resumeAgent() {
        try {
            const response = await axios.post(`${this.agentUrl}/resume`);
            this.emit('agentResumed');
            return response.data;
        } catch (error) {
            console.error('Failed to resume agent:', error.message);
            throw error;
        }
    }

    // ========== Convenience Methods for Common Tasks ==========

    /**
     * Analyze a URL for security threats
     */
    async analyzeUrl(url) {
        return this.createTask('website_analysis', `Analyze URL: ${url}`, {
            target: url,
            analysis_type: 'security',
        }, 'high');
    }

    /**
     * Scan network for vulnerabilities
     */
    async scanNetwork(target, ports = '1-1000') {
        return this.createTask('network_scan', `Scan network: ${target}`, {
            target,
            ports,
        }, 'high');
    }

    /**
     * Detect threats in data
     */
    async detectThreats(data) {
        return this.createTask('threat_detection', 'Detect security threats', {
            data,
        }, 'high');
    }

    /**
     * Generate security report
     */
    async generateReport(reportType, data) {
        return this.createTask('report_generation', `Generate ${reportType} report`, {
            report_type: reportType,
            data,
        });
    }

    /**
     * Monitor system health
     */
    async monitorSystem() {
        return this.createTask('system_monitor', 'Monitor system health', {});
    }

    /**
     * Create a comprehensive security audit
     */
    async securityAudit(target) {
        return this.createGoal(
            `Perform comprehensive security audit of ${target}`,
            { target },
            'high'
        );
    }

    /**
     * Schedule daily security scan
     */
    async scheduleDailyScan(target, time = '0 2 * * *') {
        return this.createSchedule({
            taskType: 'network_scan',
            description: `Daily security scan of ${target}`,
            triggerType: 'cron',
            cron: time,
            parameters: { target },
        });
    }

    /**
     * Schedule continuous monitoring
     */
    async enableContinuousMonitoring() {
        return this.createSchedule({
            taskType: 'system_monitor',
            description: 'Continuous system monitoring',
            triggerType: 'continuous',
            parameters: {},
        });
    }

    // ========== Browsing Activity Integration ==========

    /**
     * Analyze browsing patterns for threats
     */
    async analyzeBrowsingPatterns(pages) {
        // Store browsing data in memory for context
        await this.storeMemory(
            `Browsing session: ${pages.length} pages visited`,
            'episodic',
            { pages: pages.slice(-20), timestamp: new Date().toISOString() }
        );
        
        return this.createTask('data_analysis', 'Analyze browsing patterns', {
            data: { pages: pages.slice(-50) },
            analysis_type: 'browsing_security',
        });
    }

    /**
     * Evaluate URL before visiting
     */
    async preVisitCheck(url) {
        // Quick threat detection
        return this.createTask('threat_detection', `Pre-visit security check: ${url}`, {
            target: url,
            check_type: 'pre_visit',
        }, 'critical');
    }

    /**
     * Store browsing event for learning
     */
    async recordBrowsingEvent(event) {
        return this.storeMemory(
            `Browsing event: ${event.type} on ${event.url}`,
            'episodic',
            event
        );
    }

    // ========== Cleanup ==========

    /**
     * Disconnect and cleanup
     */
    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.isConnected = false;
        this.activeTasks.clear();
        this.emit('disconnected', 'Client disconnected');
    }
}

// Factory function
function createAgentClient(options = {}) {
    return new AgentClient(options);
}

module.exports = { AgentClient, createAgentClient };
