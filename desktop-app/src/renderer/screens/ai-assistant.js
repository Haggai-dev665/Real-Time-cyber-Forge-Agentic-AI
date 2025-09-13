/**
 * AI Assistant Screen
 * Interactive chat interface with AI/ML services
 */

class AIAssistantScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.chatHistory = [];
        this.currentConversationId = null;
        this.isTyping = false;
        this.suggestions = [
            "Analyze this suspicious URL for threats",
            "What are the latest cybersecurity trends?",
            "Help me understand this security alert",
            "Recommend security best practices",
            "Check system vulnerabilities",
            "Explain this malware signature"
        ];
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        // Create AI assistant HTML
        this.container.innerHTML = this.createHTML();
        
        // Initialize components
        this.initializeComponents();
        
        // Load chat history
        await this.loadChatHistory();
        
        // Handle initial query if provided
        if (options.query) {
            document.getElementById('chat-input').value = options.query;
            this.sendMessage();
        }
        
        // Add entrance animation
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
    }

    createHTML() {
        return `
            <div class="ai-assistant-screen">
                <!-- Header -->
                <div class="ai-header">
                    <div class="ai-status">
                        <div class="ai-avatar">
                            <i class="fas fa-robot"></i>
                            <div class="status-indicator" id="ai-status-indicator"></div>
                        </div>
                        <div class="ai-info">
                            <h2>AI Assistant</h2>
                            <p class="ai-status-text" id="ai-status-text">Ready to help</p>
                        </div>
                    </div>
                    
                    <div class="ai-controls">
                        <button class="btn btn-secondary btn-sm" id="clear-chat-btn">
                            <i class="fas fa-trash"></i> Clear Chat
                        </button>
                        <button class="btn btn-secondary btn-sm" id="export-chat-btn">
                            <i class="fas fa-download"></i> Export
                        </button>
                        <button class="btn btn-secondary btn-sm" id="settings-btn">
                            <i class="fas fa-cog"></i> Settings
                        </button>
                    </div>
                </div>

                <!-- Main Chat Area -->
                <div class="chat-container">
                    <!-- Chat Messages -->
                    <div class="chat-messages" id="chat-messages">
                        <div class="welcome-message">
                            <div class="welcome-avatar">
                                <i class="fas fa-robot"></i>
                            </div>
                            <div class="welcome-content">
                                <h3>Hello! I'm your AI Security Assistant</h3>
                                <p>I can help you with cybersecurity analysis, threat detection, security best practices, and more. Ask me anything!</p>
                                
                                <div class="suggestion-chips">
                                    <h4>Try asking:</h4>
                                    <div class="chips-container">
                                        ${this.suggestions.map(suggestion => 
                                            `<button class="suggestion-chip" data-suggestion="${suggestion}">${suggestion}</button>`
                                        ).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Typing Indicator -->
                    <div class="typing-indicator" id="typing-indicator" style="display: none;">
                        <div class="typing-avatar">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="typing-content">
                            <div class="typing-dots">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                            <span class="typing-text">AI is thinking...</span>
                        </div>
                    </div>

                    <!-- Chat Input -->
                    <div class="chat-input-container">
                        <div class="input-actions">
                            <button class="input-action-btn" id="attach-file-btn" title="Attach File">
                                <i class="fas fa-paperclip"></i>
                            </button>
                            <button class="input-action-btn" id="voice-input-btn" title="Voice Input">
                                <i class="fas fa-microphone"></i>
                            </button>
                        </div>
                        
                        <div class="input-wrapper">
                            <textarea 
                                id="chat-input" 
                                placeholder="Ask me about cybersecurity, threat analysis, or any security concerns..."
                                rows="1"
                            ></textarea>
                            <button class="send-btn" id="send-btn" disabled>
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>

                        <div class="input-suggestions" id="input-suggestions" style="display: none;">
                            <!-- Dynamic suggestions will appear here -->
                        </div>
                    </div>
                </div>

                <!-- Sidebar -->
                <div class="ai-sidebar">
                    <!-- Quick Actions -->
                    <div class="sidebar-section">
                        <h3>Quick Actions</h3>
                        <div class="quick-actions-grid">
                            <button class="quick-action" data-action="analyze-url">
                                <i class="fas fa-link"></i>
                                <span>Analyze URL</span>
                            </button>
                            <button class="quick-action" data-action="scan-file">
                                <i class="fas fa-file-alt"></i>
                                <span>Scan File</span>
                            </button>
                            <button class="quick-action" data-action="threat-report">
                                <i class="fas fa-shield-alt"></i>
                                <span>Threat Report</span>
                            </button>
                            <button class="quick-action" data-action="security-tips">
                                <i class="fas fa-lightbulb"></i>
                                <span>Security Tips</span>
                            </button>
                        </div>
                    </div>

                    <!-- Recent Conversations -->
                    <div class="sidebar-section">
                        <h3>Recent Conversations</h3>
                        <div class="conversation-list" id="conversation-list">
                            <div class="conversation-item active">
                                <div class="conversation-title">Current Session</div>
                                <div class="conversation-time">Now</div>
                            </div>
                        </div>
                    </div>

                    <!-- AI Capabilities -->
                    <div class="sidebar-section">
                        <h3>AI Capabilities</h3>
                        <div class="capabilities-list">
                            <div class="capability-item">
                                <i class="fas fa-microscope"></i>
                                <span>Threat Analysis</span>
                            </div>
                            <div class="capability-item">
                                <i class="fas fa-bug"></i>
                                <span>Vulnerability Assessment</span>
                            </div>
                            <div class="capability-item">
                                <i class="fas fa-shield-alt"></i>
                                <span>Security Recommendations</span>
                            </div>
                            <div class="capability-item">
                                <i class="fas fa-chart-line"></i>
                                <span>Risk Evaluation</span>
                            </div>
                            <div class="capability-item">
                                <i class="fas fa-code"></i>
                                <span>Code Security Review</span>
                            </div>
                            <div class="capability-item">
                                <i class="fas fa-network-wired"></i>
                                <span>Network Analysis</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        this.setupEventListeners();
        this.checkAIStatus();
        this.initializeInput();
    }

    setupEventListeners() {
        // Chat input
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');

        chatInput.addEventListener('input', () => this.handleInputChange());
        chatInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        sendBtn.addEventListener('click', () => this.sendMessage());

        // Auto-resize textarea
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        });

        // Suggestion chips
        document.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const suggestion = e.target.dataset.suggestion;
                chatInput.value = suggestion;
                this.sendMessage();
            });
        });

        // Header controls
        document.getElementById('clear-chat-btn').addEventListener('click', () => this.clearChat());
        document.getElementById('export-chat-btn').addEventListener('click', () => this.exportChat());
        document.getElementById('settings-btn').addEventListener('click', () => this.showSettings());

        // Input actions
        document.getElementById('attach-file-btn').addEventListener('click', () => this.attachFile());
        document.getElementById('voice-input-btn').addEventListener('click', () => this.toggleVoiceInput());

        // Quick actions
        document.querySelectorAll('.quick-action').forEach(action => {
            action.addEventListener('click', (e) => {
                const actionType = e.currentTarget.dataset.action;
                this.handleQuickAction(actionType);
            });
        });
    }

    handleInputChange() {
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        
        const hasText = chatInput.value.trim().length > 0;
        sendBtn.disabled = !hasText;
        
        // Show input suggestions
        if (hasText && chatInput.value.length > 2) {
            this.showInputSuggestions(chatInput.value);
        } else {
            this.hideInputSuggestions();
        }
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    async sendMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        if (!message || this.isTyping) return;

        // Add user message to chat
        this.addMessage('user', message);
        
        // Clear input
        chatInput.value = '';
        chatInput.style.height = 'auto';
        this.handleInputChange();

        // Show typing indicator
        this.showTyping();

        try {
            // Send to AI service
            const response = await this.sendToAI(message);
            
            // Hide typing indicator
            this.hideTyping();
            
            // Add AI response
            this.addMessage('ai', response.message, response.metadata);
            
        } catch (error) {
            this.hideTyping();
            this.addMessage('ai', 'I apologize, but I\'m having trouble connecting to the AI service right now. Please try again in a moment.', { error: true });
            console.error('AI request failed:', error);
        }
    }

    async sendToAI(message) {
        // Try backend AI endpoint first
        if (window.apiClient) {
            try {
                const response = await window.apiClient.chatWithAI(message, this.currentConversationId);
                if (response.success) {
                    this.currentConversationId = response.conversationId;
                    return {
                        message: response.response,
                        metadata: {
                            confidence: response.confidence,
                            sources: response.sources,
                            source: response.source || 'backend'
                        }
                    };
                }
            } catch (error) {
                console.error('Backend AI request failed:', error);
            }
        }

        // Fallback to ML service via IPC (electron API)
        if (window.electronAPI && window.electronAPI.mlService && window.electronAPI.mlService.chat) {
            try {
                const response = await window.electronAPI.mlService.chat(
                    message,
                    this.currentConversationId,
                    'chat'
                );
                
                if (response.success && response.data) {
                    this.currentConversationId = response.data.conversation_id || this.currentConversationId;
                    return {
                        message: response.data.response || 'I received your message.',
                        metadata: { source: 'ml-service-ipc' }
                    };
                }
            } catch (error) {
                console.error('ML service IPC request failed:', error);
            }
        }

        // Fallback to ML service direct HTTP call
        if (window.apiClient) {
            try {
                const response = await window.apiClient.mlAnalyze(message, 'chat');
                if (response.success) {
                    return {
                        message: response.response || response.result || 'I received your message but couldn\'t generate a proper response.',
                        metadata: { source: 'ml-service-direct' }
                    };
                }
            } catch (error) {
                console.error('ML service direct request failed:', error);
            }
        }

        // Ultimate fallback with intelligent responses
        return this.generateFallbackResponse(message);
    }

    generateFallbackResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        // Cybersecurity related responses
        if (lowerMessage.includes('threat') || lowerMessage.includes('malware')) {
            return {
                message: "I understand you're asking about cybersecurity threats. While I'm currently offline, I recommend checking the Threat Center for the latest threat intelligence and running a system scan.",
                metadata: { fallback: true, suggestion: 'threat-center' }
            };
        }
        
        if (lowerMessage.includes('analyze') || lowerMessage.includes('scan')) {
            return {
                message: "You can use our Deep Analysis tools to scan URLs, files, and network traffic. Would you like me to guide you to the analysis section?",
                metadata: { fallback: true, suggestion: 'deep-analysis' }
            };
        }
        
        if (lowerMessage.includes('vulnerability') || lowerMessage.includes('security')) {
            return {
                message: "For vulnerability assessments and security recommendations, check out our Vulnerability Scanner and Security Tools. I can help you navigate there when I'm back online.",
                metadata: { fallback: true, suggestion: 'vulnerability-scanner' }
            };
        }
        
        // General response
        return {
            message: "I'm currently experiencing connection issues with the AI services. However, you can still access all the security tools through the navigation menu. I'll be back online shortly to provide more detailed assistance.",
            metadata: { fallback: true }
        };
    }

    addMessage(type, content, metadata = {}) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}-message`;
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (type === 'user') {
            messageDiv.innerHTML = `
                <div class="message-content">
                    <div class="message-text">${this.formatMessage(content)}</div>
                    <div class="message-meta">
                        <span class="message-time">${timestamp}</span>
                    </div>
                </div>
                <div class="message-avatar">
                    <i class="fas fa-user"></i>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <div class="message-text">${this.formatMessage(content)}</div>
                    ${this.createMessageMetadata(metadata)}
                    <div class="message-meta">
                        <span class="message-time">${timestamp}</span>
                        <div class="message-actions">
                            <button class="message-action" title="Copy">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="message-action" title="Like">
                                <i class="fas fa-thumbs-up"></i>
                            </button>
                            <button class="message-action" title="Dislike">
                                <i class="fas fa-thumbs-down"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Add to chat history
        this.chatHistory.push({
            type,
            content,
            metadata,
            timestamp: new Date()
        });
        
        // Animate message appearance
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(20px)';
        requestAnimationFrame(() => {
            messageDiv.style.transition = 'all 0.3s ease';
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
        });
    }

    createMessageMetadata(metadata) {
        if (!metadata || Object.keys(metadata).length === 0) return '';
        
        let metadataHTML = '';
        
        if (metadata.confidence) {
            metadataHTML += `<div class="message-confidence">Confidence: ${Math.round(metadata.confidence * 100)}%</div>`;
        }
        
        if (metadata.sources) {
            metadataHTML += `<div class="message-sources">Sources: ${metadata.sources.join(', ')}</div>`;
        }
        
        if (metadata.suggestion) {
            metadataHTML += `
                <div class="message-suggestion">
                    <button class="suggestion-btn" data-action="${metadata.suggestion}">
                        <i class="fas fa-external-link-alt"></i> Go to ${this.formatScreenName(metadata.suggestion)}
                    </button>
                </div>
            `;
        }
        
        if (metadata.error) {
            metadataHTML += `<div class="message-error">Connection error - working offline</div>`;
        }
        
        return metadataHTML;
    }

    formatMessage(content) {
        // Basic markdown-style formatting
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    formatScreenName(screenName) {
        return screenName.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    showTyping() {
        this.isTyping = true;
        const typingIndicator = document.getElementById('typing-indicator');
        typingIndicator.style.display = 'flex';
        this.scrollToBottom();
    }

    hideTyping() {
        this.isTyping = false;
        const typingIndicator = document.getElementById('typing-indicator');
        typingIndicator.style.display = 'none';
    }

    scrollToBottom() {
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showInputSuggestions(query) {
        // TODO: Implement input suggestions based on query
    }

    hideInputSuggestions() {
        const suggestions = document.getElementById('input-suggestions');
        suggestions.style.display = 'none';
    }

    initializeInput() {
        const chatInput = document.getElementById('chat-input');
        chatInput.focus();
    }

    async checkAIStatus() {
        const statusIndicator = document.getElementById('ai-status-indicator');
        const statusText = document.getElementById('ai-status-text');
        
        try {
            // Check ML service health
            if (window.apiClient) {
                const health = await window.apiClient.mlHealthCheck();
                if (health.success) {
                    statusIndicator.className = 'status-indicator online';
                    statusText.textContent = 'AI services online';
                    return;
                }
            }
            
            // Fallback status
            statusIndicator.className = 'status-indicator offline';
            statusText.textContent = 'AI services offline - limited functionality';
            
        } catch (error) {
            statusIndicator.className = 'status-indicator offline';
            statusText.textContent = 'AI services offline - limited functionality';
        }
    }

    async loadChatHistory() {
        // TODO: Load previous chat sessions from storage
    }

    // Event handlers
    clearChat() {
        const chatMessages = document.getElementById('chat-messages');
        const userMessages = chatMessages.querySelectorAll('.chat-message');
        userMessages.forEach(msg => msg.remove());
        
        this.chatHistory = [];
        window.notificationSystem?.success('Chat Cleared', 'Chat history has been cleared');
    }

    exportChat() {
        if (this.chatHistory.length === 0) {
            window.notificationSystem?.warning('No Chat History', 'There are no messages to export');
            return;
        }
        
        const chatText = this.chatHistory.map(msg => 
            `[${msg.timestamp.toLocaleString()}] ${msg.type.toUpperCase()}: ${msg.content}`
        ).join('\n\n');
        
        const blob = new Blob([chatText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-chat-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    showSettings() {
        window.modal?.show({
            title: 'AI Assistant Settings',
            content: `
                <div class="settings-form">
                    <div class="form-group">
                        <label class="form-label">AI Model</label>
                        <select class="form-input">
                            <option value="gpt-4">GPT-4 (Recommended)</option>
                            <option value="gpt-3.5">GPT-3.5 Turbo</option>
                            <option value="local">Local Model</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Response Style</label>
                        <select class="form-input">
                            <option value="detailed">Detailed Explanations</option>
                            <option value="concise">Concise Answers</option>
                            <option value="technical">Technical Focus</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">
                            <input type="checkbox" checked> Enable typing indicator
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-label">
                            <input type="checkbox" checked> Auto-save conversations
                        </label>
                    </div>
                </div>
            `,
            actions: [
                { label: 'Cancel', class: 'btn-secondary' },
                { label: 'Save Settings', class: 'btn-primary' }
            ]
        });
    }

    attachFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '*/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileUpload(file);
            }
        };
        input.click();
    }

    async handleFileUpload(file) {
        const chatInput = document.getElementById('chat-input');
        chatInput.value = `Analyze this file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        
        // TODO: Implement file upload and analysis
        window.notificationSystem?.info('File Upload', 'File analysis feature coming soon!');
    }

    toggleVoiceInput() {
        // TODO: Implement voice input
        window.notificationSystem?.info('Voice Input', 'Voice input feature coming soon!');
    }

    handleQuickAction(action) {
        const actions = {
            'analyze-url': () => window.app?.showScreen('deep-analysis'),
            'scan-file': () => window.app?.showScreen('malware-detection'),
            'threat-report': () => window.app?.showScreen('threat-center'),
            'security-tips': () => {
                const tips = [
                    "Use strong, unique passwords for all accounts",
                    "Enable two-factor authentication where possible",
                    "Keep software and systems updated",
                    "Be cautious with email attachments and links",
                    "Regularly backup important data",
                    "Use reputable antivirus software"
                ];
                const chatInput = document.getElementById('chat-input');
                chatInput.value = "Can you provide detailed cybersecurity best practices and tips?";
                this.sendMessage();
            }
        };
        
        if (actions[action]) {
            actions[action]();
        }
    }

    destroy() {
        // Cleanup if needed
    }
}

// Export for global access
window.AIAssistantScreen = AIAssistantScreen;