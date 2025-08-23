/**
 * Enhanced Cyber Forge AI Desktop Application
 * Main UI Controller with AI Task Management and Real-time Features
 */

class EnhancedCyberForgeUI {
    constructor() {
        this.currentTab = 'dashboard';
        this.isConnected = false;
        this.aiServiceUrl = 'http://localhost:8001';
        this.backendUrl = 'ws://localhost:8000';
        this.websocket = null;
        this.tasks = new Map();
        this.activities = [];
        this.insights = [];
        this.taskUpdateInterval = null;
        
        // Initialize advanced screens
        this.mlDashboard = null;
        this.analyticsScreen = null;
        
        this.metrics = {
            pagesCount: 0,
            threatsCount: 0,
            riskScore: 20,
            insightsCount: 0,
            activeTasksCount: 0
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupElectronAPI();
        this.initializeUI();
        await this.connectToServices();
        this.startPeriodicUpdates();
        this.loadInitialData();
    }

    setupEventListeners() {
        // Enhanced tab navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const tabName = e.target.closest('.nav-item').dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Global search
        const globalSearch = document.getElementById('global-search');
        globalSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleGlobalSearch(e.target.value);
            }
        });

        // Enhanced chat functionality
        this.setupChatEventListeners();
        
        // Task management
        this.setupTaskEventListeners();
        
        // Network scanning
        this.setupNetworkScanEventListeners();
        
        // Dataset management
        this.setupDatasetEventListeners();
        
        // Quick actions
        this.setupQuickActionListeners();
        
        // Settings
        this.setupSettingsEventListeners();
        
        // Modal handling
        this.setupModalEventListeners();
    }

    setupChatEventListeners() {
        const chatInput = document.getElementById('chat-input');
        const sendButton = document.getElementById('send-message');
        const clearChat = document.getElementById('clear-chat');
        
        sendButton.addEventListener('click', () => this.sendChatMessage());
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
        
        if (clearChat) {
            clearChat.addEventListener('click', () => this.clearChatHistory());
        }

        // Quick chat actions
        document.querySelectorAll('.quick-chat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.handleQuickChatAction(action);
            });
        });
    }

    setupTaskEventListeners() {
        const createTaskBtn = document.getElementById('create-task-btn');
        const taskModal = document.getElementById('task-modal');
        const taskForm = document.getElementById('task-form');
        const closeTaskModal = document.getElementById('close-task-modal');
        const cancelTask = document.getElementById('cancel-task');

        if (createTaskBtn) {
            createTaskBtn.addEventListener('click', () => this.openTaskModal());
        }

        if (closeTaskModal) {
            closeTaskModal.addEventListener('click', () => this.closeTaskModal());
        }

        if (cancelTask) {
            cancelTask.addEventListener('click', () => this.closeTaskModal());
        }

        if (taskForm) {
            taskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createAITask();
            });
        }

        // Task type change handler
        const taskTypeSelect = document.getElementById('task-type');
        if (taskTypeSelect) {
            taskTypeSelect.addEventListener('change', (e) => {
                this.updateTaskParameters(e.target.value);
            });
        }

        // Task filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterTasks(e.target.dataset.filter);
            });
        });
    }

    setupNetworkScanEventListeners() {
        const startScanBtn = document.getElementById('start-network-scan');
        
        if (startScanBtn) {
            startScanBtn.addEventListener('click', () => this.startNetworkScan());
        }
    }

    setupDatasetEventListeners() {
        const refreshDatasets = document.getElementById('refresh-datasets');
        
        if (refreshDatasets) {
            refreshDatasets.addEventListener('click', () => this.loadDatasets());
        }

        // Dataset category selection
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                this.filterDatasetsByCategory(category);
            });
        });
    }

    setupQuickActionListeners() {
        const quickNetworkScan = document.getElementById('quick-network-scan');
        const quickWebsiteAnalysis = document.getElementById('quick-website-analysis');
        const quickThreatScan = document.getElementById('quick-threat-scan');

        if (quickNetworkScan) {
            quickNetworkScan.addEventListener('click', () => this.quickCreateTask('network_scan'));
        }

        if (quickWebsiteAnalysis) {
            quickWebsiteAnalysis.addEventListener('click', () => this.quickCreateTask('website_analysis'));
        }

        if (quickThreatScan) {
            quickThreatScan.addEventListener('click', () => this.quickCreateTask('threat_detection'));
        }
    }

    setupSettingsEventListeners() {
        // Enhanced settings handling
        const settings = [
            'monitoring-enabled',
            'threat-alerts', 
            'ai-insights',
            'auto-tasks',
            'desktop-notifications',
            'sound-alerts'
        ];

        settings.forEach(settingId => {
            const element = document.getElementById(settingId);
            if (element) {
                element.addEventListener('change', (e) => {
                    this.updateSetting(settingId.replace('-', '_'), e.target.checked);
                });
            }
        });

        // URL settings
        const backendUrl = document.getElementById('backend-url');
        const aiServiceUrl = document.getElementById('ai-service-url');
        const maxConcurrentTasks = document.getElementById('max-concurrent-tasks');

        if (backendUrl) {
            backendUrl.addEventListener('change', (e) => {
                this.backendUrl = e.target.value;
                this.updateSetting('backend_url', e.target.value);
            });
        }

        if (aiServiceUrl) {
            aiServiceUrl.addEventListener('change', (e) => {
                this.aiServiceUrl = e.target.value;
                this.updateSetting('ai_service_url', e.target.value);
            });
        }

        if (maxConcurrentTasks) {
            maxConcurrentTasks.addEventListener('change', (e) => {
                this.updateSetting('max_concurrent_tasks', parseInt(e.target.value));
            });
        }

        const saveSettings = document.getElementById('save-settings');
        if (saveSettings) {
            saveSettings.addEventListener('click', () => this.saveAllSettings());
        }
    }

    setupModalEventListeners() {
        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    setupElectronAPI() {
        if (window.electronAPI) {
            window.electronAPI.onBackendMessage((message) => {
                this.handleBackendMessage(message);
            });
        }
    }

    async connectToServices() {
        try {
            // Test AI service connection
            const response = await fetch(`${this.aiServiceUrl}/health`);
            if (response.ok) {
                this.updateConnectionStatus('ai', true);
                this.showNotification('Success', 'Connected to AI service', 'success');
            }
        } catch (error) {
            console.error('Failed to connect to AI service:', error);
            this.updateConnectionStatus('ai', false);
            this.showNotification('Warning', 'AI service unavailable', 'warning');
        }

        // Setup WebSocket connection for real-time updates
        this.setupWebSocketConnection();
    }

    setupWebSocketConnection() {
        try {
            this.websocket = new WebSocket(this.backendUrl);
            
            this.websocket.onopen = () => {
                this.updateConnectionStatus('backend', true);
                this.isConnected = true;
                this.showNotification('Success', 'Connected to backend service', 'success');
            };
            
            this.websocket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleWebSocketMessage(message);
            };
            
            this.websocket.onclose = () => {
                this.updateConnectionStatus('backend', false);
                this.isConnected = false;
                setTimeout(() => this.setupWebSocketConnection(), 5000); // Reconnect after 5s
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('backend', false);
            };
        } catch (error) {
            console.error('Failed to setup WebSocket:', error);
            this.updateConnectionStatus('backend', false);
        }
    }

    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'task_update':
                this.handleTaskUpdate(message.data);
                break;
            case 'threat_alert':
                this.handleThreatAlert(message.data);
                break;
            case 'activity_update':
                this.addActivity(message.data);
                break;
            case 'metrics_update':
                this.updateMetrics(message.data);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    initializeUI() {
        this.updateMetrics();
        this.updateConnectionStatus('monitor', true);
        this.addActivity({
            title: 'System Initialized',
            description: 'Cyber Forge AI is ready for operation',
            icon: 'fas fa-power-off',
            time: new Date().toLocaleTimeString()
        });
    }

    switchTab(tabName) {
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;

        // Load tab-specific data
        this.loadTabData(tabName);
    }

    async loadTabData(tabName) {
        switch (tabName) {
            case 'tasks':
                await this.loadTasks();
                break;
            case 'datasets':
                await this.loadDatasets();
                break;
            case 'threats':
                await this.loadThreats();
                break;
            case 'network':
                this.initializeNetworkTab();
                break;
            case 'dashboard':
                this.refreshDashboard();
                break;
            case 'ml-dashboard':
                await this.initializeMLDashboard();
                break;
            case 'analytics':
                await this.initializeAnalytics();
                break;
            case 'profile':
                this.initializeProfile();
                break;
        }
    }

    async loadTasks() {
        try {
            this.showLoading(true);
            const response = await fetch(`${this.aiServiceUrl}/ai/tasks`);
            const data = await response.json();
            
            this.tasks.clear();
            data.tasks.forEach(task => {
                this.tasks.set(task.id, task);
            });
            
            this.renderTasks();
            this.updateTaskCount();
        } catch (error) {
            console.error('Failed to load tasks:', error);
            this.showNotification('Error', 'Failed to load tasks', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    renderTasks(filter = 'all') {
        const tasksGrid = document.getElementById('tasks-grid');
        if (!tasksGrid) return;

        const filteredTasks = Array.from(this.tasks.values()).filter(task => {
            if (filter === 'all') return true;
            return task.status === filter;
        });

        tasksGrid.innerHTML = filteredTasks.map(task => this.createTaskCard(task)).join('');
    }

    createTaskCard(task) {
        const progressWidth = task.progress || 0;
        const priorityColor = this.getPriorityColor(task.priority);
        const statusClass = task.status.replace('_', '-');
        
        return `
            <div class="task-card" data-task-id="${task.id}">
                <div class="task-header">
                    <div>
                        <div class="task-title">${task.title}</div>
                        <div class="task-type" style="background: ${priorityColor}20; color: ${priorityColor}">
                            ${task.type.replace('_', ' ').toUpperCase()}
                        </div>
                    </div>
                    <div class="task-actions">
                        ${this.getTaskActionButtons(task)}
                    </div>
                </div>
                <div class="task-description">${task.description}</div>
                <div class="task-footer">
                    <div class="task-status ${statusClass}">${task.status.replace('_', ' ').toUpperCase()}</div>
                    <div class="task-time">${new Date(task.created_at).toLocaleString()}</div>
                </div>
                <div class="task-progress">
                    <div class="task-progress-bar" style="width: ${progressWidth}%"></div>
                </div>
            </div>
        `;
    }

    getTaskActionButtons(task) {
        let buttons = '';
        
        if (task.status === 'pending') {
            buttons += `<button class="btn-icon" onclick="ui.startTask('${task.id}')" title="Start Task">
                <i class="fas fa-play"></i>
            </button>`;
        }
        
        if (task.status === 'in_progress') {
            buttons += `<button class="btn-icon" onclick="ui.cancelTask('${task.id}')" title="Cancel Task">
                <i class="fas fa-stop"></i>
            </button>`;
        }
        
        buttons += `<button class="btn-icon" onclick="ui.viewTaskDetails('${task.id}')" title="View Details">
            <i class="fas fa-eye"></i>
        </button>`;
        
        return buttons;
    }

    getPriorityColor(priority) {
        const colors = {
            low: '#00b894',
            medium: '#fdcb6e',
            high: '#e17055',
            critical: '#d63031'
        };
        return colors[priority] || colors.medium;
    }

    async createAITask() {
        const form = document.getElementById('task-form');
        const formData = new FormData(form);
        
        const taskData = {
            task_type: formData.get('task-type'),
            title: formData.get('task-title'),
            description: formData.get('task-description'),
            priority: formData.get('task-priority'),
            parameters: this.getTaskParameters()
        };

        try {
            this.showLoading(true);
            const response = await fetch(`${this.aiServiceUrl}/ai/create-task`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taskData)
            });

            const result = await response.json();
            
            if (response.ok) {
                this.showNotification('Success', `Task "${taskData.title}" created successfully`, 'success');
                this.closeTaskModal();
                await this.loadTasks();
                this.addActivity({
                    title: 'Task Created',
                    description: `New ${taskData.task_type} task: ${taskData.title}`,
                    icon: 'fas fa-plus',
                    time: new Date().toLocaleTimeString()
                });
            } else {
                throw new Error(result.detail || 'Failed to create task');
            }
        } catch (error) {
            console.error('Failed to create task:', error);
            this.showNotification('Error', 'Failed to create task: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    getTaskParameters() {
        const taskType = document.getElementById('task-type').value;
        const parameters = {};
        
        // Collect parameters based on task type
        switch (taskType) {
            case 'network_scan':
                parameters.target = document.getElementById('scan-target')?.value || '127.0.0.1';
                parameters.ports = document.getElementById('scan-ports')?.value || '22,80,443';
                parameters.scan_type = document.getElementById('scan-type')?.value || 'tcp';
                break;
            case 'website_analysis':
                parameters.url = document.getElementById('website-url')?.value || '';
                break;
            case 'dataset_analysis':
                parameters.dataset_name = document.getElementById('dataset-name')?.value || '';
                parameters.analysis_type = document.getElementById('analysis-type')?.value || 'summary';
                break;
        }
        
        return parameters;
    }

    updateTaskParameters(taskType) {
        const parametersDiv = document.getElementById('task-parameters');
        if (!parametersDiv) return;

        let parametersHTML = '';
        
        switch (taskType) {
            case 'network_scan':
                parametersHTML = `
                    <div class="form-group">
                        <label for="scan-target">Target:</label>
                        <input type="text" id="scan-target" placeholder="IP address or hostname" value="127.0.0.1">
                    </div>
                    <div class="form-group">
                        <label for="scan-ports">Ports:</label>
                        <input type="text" id="scan-ports" placeholder="22,80,443 or 1-1000" value="22,80,443">
                    </div>
                    <div class="form-group">
                        <label for="scan-type">Scan Type:</label>
                        <select id="scan-type">
                            <option value="tcp">TCP Connect</option>
                            <option value="syn">SYN Scan</option>
                            <option value="udp">UDP Scan</option>
                        </select>
                    </div>
                `;
                break;
            case 'website_analysis':
                parametersHTML = `
                    <div class="form-group">
                        <label for="website-url">Website URL:</label>
                        <input type="url" id="website-url" placeholder="https://example.com" required>
                    </div>
                `;
                break;
            case 'dataset_analysis':
                parametersHTML = `
                    <div class="form-group">
                        <label for="dataset-name">Dataset:</label>
                        <select id="dataset-name">
                            <option value="network-intrusion-detection">Network Intrusion Detection</option>
                            <option value="nsl-kdd">NSL-KDD</option>
                            <option value="port-scanning">Port Scanning</option>
                            <option value="malware-detection">Malware Detection</option>
                            <option value="phishing-websites">Phishing Websites</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="analysis-type">Analysis Type:</label>
                        <select id="analysis-type">
                            <option value="summary">Summary Statistics</option>
                            <option value="security_insights">Security Insights</option>
                            <option value="threat_detection">Threat Detection</option>
                        </select>
                    </div>
                `;
                break;
        }
        
        parametersDiv.innerHTML = parametersHTML;
    }

    async startTask(taskId) {
        try {
            const response = await fetch(`${this.aiServiceUrl}/ai/tasks/${taskId}/start`, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.showNotification('Success', 'Task started successfully', 'success');
                await this.loadTasks();
            } else {
                throw new Error('Failed to start task');
            }
        } catch (error) {
            console.error('Failed to start task:', error);
            this.showNotification('Error', 'Failed to start task', 'error');
        }
    }

    async cancelTask(taskId) {
        try {
            const response = await fetch(`${this.aiServiceUrl}/ai/tasks/${taskId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showNotification('Success', 'Task cancelled successfully', 'success');
                await this.loadTasks();
            } else {
                throw new Error('Failed to cancel task');
            }
        } catch (error) {
            console.error('Failed to cancel task:', error);
            this.showNotification('Error', 'Failed to cancel task', 'error');
        }
    }

    async viewTaskDetails(taskId) {
        try {
            const response = await fetch(`${this.aiServiceUrl}/ai/tasks/${taskId}`);
            const task = await response.json();
            
            // Show task details in a modal or expand card
            this.showTaskDetailsModal(task);
        } catch (error) {
            console.error('Failed to load task details:', error);
            this.showNotification('Error', 'Failed to load task details', 'error');
        }
    }

    showTaskDetailsModal(task) {
        // Create and show task details modal
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Task Details: ${task.title}</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="task-details-content">
                    <div class="detail-group">
                        <label>Type:</label>
                        <span>${task.type}</span>
                    </div>
                    <div class="detail-group">
                        <label>Status:</label>
                        <span class="task-status ${task.status}">${task.status}</span>
                    </div>
                    <div class="detail-group">
                        <label>Priority:</label>
                        <span>${task.priority}</span>
                    </div>
                    <div class="detail-group">
                        <label>Progress:</label>
                        <span>${task.progress}%</span>
                    </div>
                    <div class="detail-group">
                        <label>Description:</label>
                        <p>${task.description}</p>
                    </div>
                    ${task.result ? `
                        <div class="detail-group">
                            <label>Result:</label>
                            <pre>${JSON.stringify(task.result, null, 2)}</pre>
                        </div>
                    ` : ''}
                    ${task.error ? `
                        <div class="detail-group">
                            <label>Error:</label>
                            <span class="error">${task.error}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    quickCreateTask(taskType) {
        // Open task modal with pre-filled type
        this.openTaskModal();
        document.getElementById('task-type').value = taskType;
        this.updateTaskParameters(taskType);
        
        // Pre-fill some common titles
        const titles = {
            network_scan: 'Quick Network Security Scan',
            website_analysis: 'Website Security Analysis',
            threat_detection: 'Threat Detection Scan'
        };
        
        document.getElementById('task-title').value = titles[taskType] || '';
    }

    openTaskModal() {
        const modal = document.getElementById('task-modal');
        if (modal) {
            modal.classList.add('active');
            // Reset form
            document.getElementById('task-form').reset();
            this.updateTaskParameters('network_scan');
        }
    }

    closeTaskModal() {
        const modal = document.getElementById('task-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    filterTasks(filter) {
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        // Re-render tasks with filter
        this.renderTasks(filter);
    }

    async sendChatMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        if (!message) return;
        
        // Add user message to chat
        this.addChatMessage(message, 'user');
        chatInput.value = '';
        
        try {
            // Send to enhanced AI service
            const response = await fetch(`${this.aiServiceUrl}/analyze-enhanced`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: message,
                    context: {
                        type: 'chat_interaction',
                        current_tab: this.currentTab,
                        metrics: this.metrics
                    },
                    conversation_history: this.getChatHistory()
                })
            });

            const result = await response.json();
            
            // Add AI response to chat
            this.addChatMessage(result.response, 'ai');
            
            // Show insights if available
            if (result.insights && result.insights.length > 0) {
                this.addInsights(result.insights);
            }
            
        } catch (error) {
            console.error('Chat error:', error);
            this.addChatMessage('Sorry, I encountered an error. Please try again.', 'ai');
        }
    }

    addChatMessage(message, sender) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        
        const avatar = sender === 'ai' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <p>${message}</p>
            </div>
            <div class="message-time">
                <span>${new Date().toLocaleTimeString()}</span>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    getChatHistory() {
        const messages = document.querySelectorAll('.chat-message');
        return Array.from(messages).slice(-10).map(msg => {
            const isUser = msg.classList.contains('user');
            const content = msg.querySelector('.message-content p').textContent;
            return {
                role: isUser ? 'user' : 'assistant',
                content: content
            };
        });
    }

    clearChatHistory() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            // Keep the initial AI greeting
            const greeting = chatMessages.querySelector('.chat-message.ai');
            chatMessages.innerHTML = '';
            if (greeting) {
                chatMessages.appendChild(greeting);
            }
        }
    }

    handleQuickChatAction(action) {
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.value = action;
            this.sendChatMessage();
        }
    }

    handleGlobalSearch(query) {
        if (query.toLowerCase().includes('task')) {
            this.switchTab('tasks');
        } else if (query.toLowerCase().includes('scan') || query.toLowerCase().includes('network')) {
            this.switchTab('network');
        } else if (query.toLowerCase().includes('dataset')) {
            this.switchTab('datasets');
        } else if (query.toLowerCase().includes('threat')) {
            this.switchTab('threats');
        } else {
            // Send to AI chat
            this.switchTab('chat');
            document.getElementById('chat-input').value = query;
            this.sendChatMessage();
        }
    }

    async startNetworkScan() {
        const target = document.getElementById('scan-target').value;
        const ports = document.getElementById('scan-ports').value;
        const scanType = document.getElementById('scan-type').value;
        
        // Create a task for network scanning
        await this.createAITaskProgrammatically({
            task_type: 'network_scan',
            title: `Network Scan - ${target}`,
            description: `Scanning ${target} for open ports: ${ports}`,
            priority: 'high',
            parameters: {
                target: target,
                ports: ports.split(',').map(p => parseInt(p.trim())),
                scan_type: scanType
            }
        });
    }

    async createAITaskProgrammatically(taskData) {
        try {
            this.showLoading(true);
            const response = await fetch(`${this.aiServiceUrl}/ai/create-task`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taskData)
            });

            const result = await response.json();
            
            if (response.ok) {
                this.showNotification('Success', `Task "${taskData.title}" created and started`, 'success');
                await this.loadTasks();
                this.addActivity({
                    title: 'Task Created',
                    description: `${taskData.title}`,
                    icon: 'fas fa-play',
                    time: new Date().toLocaleTimeString()
                });
            } else {
                throw new Error(result.detail || 'Failed to create task');
            }
        } catch (error) {
            console.error('Failed to create task:', error);
            this.showNotification('Error', 'Failed to create task: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadDatasets() {
        try {
            const response = await fetch(`${this.aiServiceUrl}/datasets/available`);
            const data = await response.json();
            
            this.renderDatasets(data.datasets);
        } catch (error) {
            console.error('Failed to load datasets:', error);
            this.showNotification('Error', 'Failed to load datasets', 'error');
        }
    }

    renderDatasets(datasets) {
        const datasetsGrid = document.getElementById('datasets-grid');
        if (!datasetsGrid) return;

        let html = '';
        
        Object.entries(datasets).forEach(([category, categoryDatasets]) => {
            categoryDatasets.forEach(dataset => {
                html += this.createDatasetCard(dataset, category);
            });
        });
        
        datasetsGrid.innerHTML = html;
    }

    createDatasetCard(dataset, category) {
        return `
            <div class="dataset-card" data-dataset="${dataset.name}">
                <div class="dataset-header">
                    <h4>${dataset.name}</h4>
                    <span class="dataset-category">${category}</span>
                </div>
                <p class="dataset-description">${dataset.description}</p>
                <div class="dataset-features">
                    <strong>Features:</strong>
                    <ul>
                        ${dataset.features.map(feature => `<li>${feature}</li>`).join('')}
                    </ul>
                </div>
                <div class="dataset-actions">
                    <button class="btn-primary" onclick="ui.downloadDataset('${dataset.name}')">
                        <i class="fas fa-download"></i>
                        Download
                    </button>
                    <button class="btn-secondary" onclick="ui.analyzeDataset('${dataset.name}')">
                        <i class="fas fa-chart-bar"></i>
                        Analyze
                    </button>
                </div>
            </div>
        `;
    }

    async downloadDataset(datasetName) {
        try {
            this.showLoading(true);
            const response = await fetch(`${this.aiServiceUrl}/datasets/${datasetName}/download`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showNotification('Success', `Dataset "${datasetName}" downloaded successfully`, 'success');
                this.addActivity({
                    title: 'Dataset Downloaded',
                    description: `${datasetName} is now available for analysis`,
                    icon: 'fas fa-download',
                    time: new Date().toLocaleTimeString()
                });
            } else {
                throw new Error(result.detail || 'Failed to download dataset');
            }
        } catch (error) {
            console.error('Failed to download dataset:', error);
            this.showNotification('Error', 'Failed to download dataset: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async analyzeDataset(datasetName) {
        // Create dataset analysis task
        await this.createAITaskProgrammatically({
            task_type: 'dataset_analysis',
            title: `Dataset Analysis - ${datasetName}`,
            description: `Analyzing ${datasetName} for security insights`,
            priority: 'medium',
            parameters: {
                dataset_name: datasetName,
                analysis_type: 'security_insights'
            }
        });
    }

    updateMetrics(newMetrics = null) {
        if (newMetrics) {
            this.metrics = { ...this.metrics, ...newMetrics };
        }
        
        // Update metric displays
        const updates = {
            'pages-count': this.metrics.pagesCount,
            'threats-count': this.metrics.threatsCount,
            'insights-count': this.metrics.insightsCount,
            'active-tasks-count': this.metrics.activeTasksCount
        };
        
        Object.entries(updates).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
        
        // Update risk assessment
        this.updateRiskAssessment();
        this.updateTaskCount();
    }

    updateRiskAssessment() {
        const riskScore = this.metrics.riskScore || 20;
        const riskLevel = riskScore < 30 ? 'Low' : riskScore < 70 ? 'Medium' : 'High';
        
        const riskLevelElement = document.getElementById('risk-level');
        const riskScoreElement = document.getElementById('risk-score-number');
        const riskProgress = document.getElementById('risk-progress');
        
        if (riskLevelElement) {
            riskLevelElement.textContent = riskLevel;
            riskLevelElement.className = `risk-badge ${riskLevel.toLowerCase()}`;
        }
        
        if (riskScoreElement) {
            riskScoreElement.textContent = riskScore;
        }
        
        if (riskProgress) {
            const circumference = 2 * Math.PI * 45;
            const offset = circumference - (riskScore / 100) * circumference;
            riskProgress.style.strokeDashoffset = offset;
        }
    }

    updateTaskCount() {
        const activeTasksCount = Array.from(this.tasks.values()).filter(task => 
            task.status === 'in_progress' || task.status === 'pending'
        ).length;
        
        const taskCountElement = document.getElementById('task-count');
        if (taskCountElement) {
            taskCountElement.textContent = activeTasksCount;
        }
        
        this.metrics.activeTasksCount = activeTasksCount;
    }

    updateConnectionStatus(service, isConnected) {
        const statusElement = document.getElementById(`${service}-status`);
        if (statusElement) {
            const dot = statusElement.querySelector('.status-dot');
            if (dot) {
                dot.style.backgroundColor = isConnected ? 'var(--success-color)' : 'var(--danger-color)';
                dot.style.boxShadow = isConnected ? 
                    '0 0 10px rgba(0, 184, 148, 0.5)' : 
                    '0 0 10px rgba(225, 112, 85, 0.5)';
            }
        }
    }

    addActivity(activity) {
        this.activities.unshift(activity);
        if (this.activities.length > 50) {
            this.activities = this.activities.slice(0, 50);
        }
        
        this.renderActivities();
    }

    renderActivities() {
        const activityFeed = document.getElementById('activity-feed');
        if (!activityFeed) return;
        
        activityFeed.innerHTML = this.activities.slice(0, 10).map(activity => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-description">${activity.description}</div>
                </div>
                <div class="activity-time">${activity.time}</div>
            </div>
        `).join('');
    }

    addInsights(insights) {
        insights.forEach(insight => {
            this.insights.unshift({
                text: insight,
                time: new Date().toLocaleTimeString(),
                id: Date.now() + Math.random()
            });
        });
        
        if (this.insights.length > 20) {
            this.insights = this.insights.slice(0, 20);
        }
        
        this.renderInsights();
        this.metrics.insightsCount = this.insights.length;
        this.updateMetrics();
    }

    renderInsights() {
        const insightsContainer = document.getElementById('ai-insights');
        if (!insightsContainer) return;
        
        insightsContainer.innerHTML = this.insights.slice(0, 5).map(insight => `
            <div class="insight-item">
                <div class="insight-text">${insight.text}</div>
                <div class="insight-time">${insight.time}</div>
            </div>
        `).join('');
    }

    showNotification(title, message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        `;
        
        document.getElementById('notification-container').appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    showLoading(show) {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) {
            spinner.classList.toggle('active', show);
        }
    }

    updateSetting(setting, value) {
        console.log(`Setting ${setting} updated to:`, value);
        
        if (window.electronAPI) {
            window.electronAPI.sendToBackend({
                type: 'setting_update',
                setting: setting,
                value: value
            });
        }
        
        // Store locally
        localStorage.setItem(`cyberforge_${setting}`, JSON.stringify(value));
    }

    saveAllSettings() {
        this.showNotification('Success', 'Settings saved successfully', 'success');
    }

    startPeriodicUpdates() {
        // Update tasks every 30 seconds
        this.taskUpdateInterval = setInterval(async () => {
            if (this.currentTab === 'tasks') {
                await this.loadTasks();
            }
        }, 30000);
        
        // Update metrics every 60 seconds
        setInterval(() => {
            this.updateMetrics();
        }, 60000);
    }

    async loadInitialData() {
        // Load initial datasets info
        if (this.currentTab === 'datasets') {
            await this.loadDatasets();
        }
        
        // Load initial tasks
        await this.loadTasks();
        
        // Generate initial insights
        this.addInsights([
            "System monitoring is active and running smoothly",
            "All security services are operational",
            "No immediate threats detected"
        ]);
    }

    refreshDashboard() {
        this.updateMetrics();
        this.renderActivities();
        this.renderInsights();
    }

    initializeNetworkTab() {
        // Set default values for network scanning
        const target = document.getElementById('scan-target');
        const ports = document.getElementById('scan-ports');
        
        if (target && !target.value) {
            target.value = '127.0.0.1';
        }
        
        if (ports && !ports.value) {
            ports.value = '22,23,53,80,443,993,995';
        }
    }

    async loadThreats() {
        // Load threat data
        // This would typically fetch from backend
        console.log('Loading threats...');
    }

    filterDatasetsByCategory(category) {
        console.log('Filtering datasets by category:', category);
        // Implement dataset filtering
    }

    handleTaskUpdate(taskData) {
        if (this.tasks.has(taskData.id)) {
            this.tasks.set(taskData.id, { ...this.tasks.get(taskData.id), ...taskData });
            this.renderTasks();
            this.updateTaskCount();
        }
    }

    handleThreatAlert(alertData) {
        this.showNotification('Security Alert', alertData.message, 'warning');
        this.addActivity({
            title: 'Threat Detected',
            description: alertData.message,
            icon: 'fas fa-exclamation-triangle',
            time: new Date().toLocaleTimeString()
        });
    }

    handleBackendMessage(message) {
        console.log('Backend message:', message);
        // Handle messages from Electron backend
    }

    // Initialize ML Dashboard
    async initializeMLDashboard() {
        try {
            if (!this.mlDashboard && typeof MLDashboardScreen !== 'undefined') {
                this.mlDashboard = new MLDashboardScreen(this);
                await this.mlDashboard.initialize();
                console.log('✅ ML Dashboard initialized');
            } else if (this.mlDashboard) {
                // Dashboard already initialized, just refresh
                await this.mlDashboard.loadAvailableModels();
            }
        } catch (error) {
            console.error('Failed to initialize ML Dashboard:', error);
            this.showNotification('Error', 'Failed to load ML Dashboard', 'error');
        }
    }

    // Initialize Real-time Analytics
    async initializeAnalytics() {
        try {
            if (!this.analyticsScreen && typeof RealTimeAnalyticsScreen !== 'undefined') {
                this.analyticsScreen = new RealTimeAnalyticsScreen(this);
                await this.analyticsScreen.initialize();
                console.log('✅ Real-time Analytics initialized');
            } else if (this.analyticsScreen) {
                // Analytics already initialized, just refresh
                await this.analyticsScreen.loadHistoricalData('24h');
            }
        } catch (error) {
            console.error('Failed to initialize Analytics:', error);
            this.showNotification('Error', 'Failed to load Analytics', 'error');
        }
    }

    initializeProfile() {
        // Initialize profile interactions
        this.setupProfileInteractions();
        this.updateProfileStats();
        this.animateProfileElements();
    }

    setupProfileInteractions() {
        // Profile preference toggles
        document.querySelectorAll('.preference-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                toggle.classList.toggle('active');
                
                // Get preference info
                const preferenceGroup = toggle.closest('.preference-group');
                const title = preferenceGroup.querySelector('.preference-title').textContent;
                const isActive = toggle.classList.contains('active');
                
                // Show toast notification
                if (window.advancedThemeSystem && window.advancedThemeSystem.notificationSystem) {
                    window.advancedThemeSystem.notificationSystem.toast(
                        `${title} ${isActive ? 'enabled' : 'disabled'}`,
                        'info'
                    );
                }
                
                // Save preference (you could implement actual saving here)
                this.updateSetting(title.toLowerCase().replace(/\s+/g, '_'), isActive);
            });
        });

        // Profile avatar click
        const profileAvatar = document.querySelector('.profile-avatar');
        if (profileAvatar) {
            profileAvatar.addEventListener('click', () => {
                if (window.advancedThemeSystem && window.advancedThemeSystem.notificationSystem) {
                    window.advancedThemeSystem.notificationSystem.toast(
                        'Avatar customization coming soon!',
                        'info'
                    );
                }
            });
        }

        // Achievement clicks
        document.querySelectorAll('.achievement').forEach(achievement => {
            achievement.addEventListener('click', () => {
                const title = achievement.querySelector('.achievement-title').textContent;
                const description = achievement.querySelector('.achievement-description').textContent;
                const isUnlocked = achievement.classList.contains('unlocked');
                
                if (window.advancedThemeSystem && window.advancedThemeSystem.notificationSystem) {
                    window.advancedThemeSystem.notificationSystem.show(
                        isUnlocked ? `🏆 ${title}` : `🔒 ${title}`,
                        description,
                        isUnlocked ? 'success' : 'info',
                        4000
                    );
                }
            });
        });
    }

    updateProfileStats() {
        // Update profile statistics with current data
        const threatsBlocked = document.getElementById('profile-threats-blocked');
        const scansCompleted = document.getElementById('profile-scans-completed');
        const uptime = document.getElementById('profile-uptime');

        if (threatsBlocked) {
            this.animateCounter(threatsBlocked, parseInt(threatsBlocked.textContent) || 0, this.metrics.threatsCount + 247);
        }
        
        if (scansCompleted) {
            this.animateCounter(scansCompleted, parseInt(scansCompleted.textContent) || 0, 156);
        }
        
        if (uptime) {
            // Calculate uptime based on connection status
            const uptimeValue = this.isConnected ? 99.8 : 95.2;
            uptime.textContent = uptimeValue + '%';
        }
    }

    animateCounter(element, start, end, duration = 1500) {
        const startTime = performance.now();
        const difference = end - start;

        const step = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth animation
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(start + difference * easeOut);
            
            element.textContent = current.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };
        
        requestAnimationFrame(step);
    }

    animateProfileElements() {
        // Add stagger animation to profile elements
        const staggerItems = document.querySelectorAll('.profile-screen .stagger-item');
        staggerItems.forEach((item, index) => {
            setTimeout(() => {
                item.style.animation = `staggerFadeIn 0.6s ease-out forwards`;
            }, index * 100);
        });

        // Animate achievement progress bars
        setTimeout(() => {
            document.querySelectorAll('.achievement-progress-fill').forEach(fill => {
                const width = fill.style.width || '0%';
                fill.style.width = '0%';
                setTimeout(() => {
                    fill.style.width = width;
                }, 100);
            });
        }, 500);

        // Animate security progress
        const securityProgress = document.querySelector('.security-progress-fill');
        if (securityProgress) {
            setTimeout(() => {
                securityProgress.style.width = '0%';
                setTimeout(() => {
                    securityProgress.style.width = '85%';
                }, 100);
            }, 300);
        }
    }

    // Cleanup
    destroy() {
        if (this.taskUpdateInterval) {
            clearInterval(this.taskUpdateInterval);
        }
        
        if (this.websocket) {
            this.websocket.close();
        }

        // Cleanup advanced screens
        if (this.mlDashboard) {
            this.mlDashboard.destroy();
        }
        
        if (this.analyticsScreen) {
            this.analyticsScreen.destroy();
        }
    }
}

// Initialize the enhanced UI
const ui = new EnhancedCyberForgeUI();

// Export for global access
window.ui = ui;

// Handle page unload
window.addEventListener('beforeunload', () => {
    ui.destroy();
});