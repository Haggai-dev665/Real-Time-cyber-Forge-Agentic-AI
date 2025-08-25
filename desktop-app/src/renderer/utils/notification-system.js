/**
 * Advanced Notification System
 * Handles toast notifications, alerts, and system messages
 */

class NotificationSystem {
    constructor() {
        this.container = null;
        this.notifications = new Map();
        this.defaultDuration = 5000;
        this.maxNotifications = 5;
        this.nextId = 1;
        
        this.init();
    }

    init() {
        this.createContainer();
        this.setupStyles();
    }

    createContainer() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    setupStyles() {
        // Styles are defined in CSS, but we can add dynamic positioning here
        this.container.style.position = 'fixed';
        this.container.style.top = 'calc(var(--header-height) + 1rem)';
        this.container.style.right = '1rem';
        this.container.style.zIndex = 'var(--z-toast)';
        this.container.style.maxWidth = '400px';
        this.container.style.pointerEvents = 'none';
    }

    show(type = 'info', title, message, options = {}) {
        const id = this.nextId++;
        const notification = this.createNotification(id, type, title, message, options);
        
        // Add to container
        this.container.appendChild(notification.element);
        this.notifications.set(id, notification);
        
        // Trigger enter animation
        requestAnimationFrame(() => {
            notification.element.classList.add('show');
        });
        
        // Auto-hide after duration
        if (options.duration !== 0) {
            const duration = options.duration || this.defaultDuration;
            notification.timeoutId = setTimeout(() => {
                this.hide(id);
            }, duration);
        }
        
        // Manage notification count
        this.enforceMaxNotifications();
        
        return id;
    }

    createNotification(id, type, title, message, options) {
        const element = document.createElement('div');
        element.className = `toast toast-${type}`;
        element.dataset.id = id;
        element.style.pointerEvents = 'auto';
        
        const icon = this.getTypeIcon(type);
        const hasActions = options.actions && options.actions.length > 0;
        const isClosable = options.closable !== false;
        
        element.innerHTML = `
            <div class="toast-content">
                <div class="toast-header">
                    <div class="toast-icon">
                        <i class="${icon}"></i>
                    </div>
                    <div class="toast-title">${title}</div>
                    ${isClosable ? '<button class="toast-close" aria-label="Close"><i class="fas fa-times"></i></button>' : ''}
                </div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
                ${hasActions ? this.createActionsHTML(options.actions) : ''}
                ${options.progress ? '<div class="toast-progress"><div class="toast-progress-bar"></div></div>' : ''}
            </div>
        `;
        
        // Setup event listeners
        this.setupNotificationEvents(element, id, options);
        
        return {
            id,
            element,
            type,
            title,
            message,
            options,
            timeoutId: null
        };
    }

    createActionsHTML(actions) {
        const actionsHTML = actions.map(action => 
            `<button class="toast-action" data-action="${action.id}">${action.label}</button>`
        ).join('');
        
        return `<div class="toast-actions">${actionsHTML}</div>`;
    }

    setupNotificationEvents(element, id, options) {
        // Close button
        const closeBtn = element.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hide(id);
            });
        }
        
        // Action buttons
        const actionBtns = element.querySelectorAll('.toast-action');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionId = btn.dataset.action;
                const action = options.actions?.find(a => a.id === actionId);
                if (action && action.handler) {
                    action.handler(id, actionId);
                }
                if (action && action.closeOnClick !== false) {
                    this.hide(id);
                }
            });
        });
        
        // Click to dismiss (if enabled)
        if (options.clickToDismiss !== false) {
            element.addEventListener('click', () => {
                this.hide(id);
            });
        }
        
        // Hover to pause auto-hide
        if (options.pauseOnHover !== false) {
            element.addEventListener('mouseenter', () => {
                this.pauseAutoHide(id);
            });
            
            element.addEventListener('mouseleave', () => {
                this.resumeAutoHide(id, options.duration || this.defaultDuration);
            });
        }
    }

    hide(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;
        
        // Clear timeout
        if (notification.timeoutId) {
            clearTimeout(notification.timeoutId);
        }
        
        // Trigger exit animation
        notification.element.classList.add('removing');
        
        // Remove after animation
        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            this.notifications.delete(id);
        }, 300);
    }

    hideAll() {
        this.notifications.forEach((_, id) => {
            this.hide(id);
        });
    }

    pauseAutoHide(id) {
        const notification = this.notifications.get(id);
        if (notification && notification.timeoutId) {
            clearTimeout(notification.timeoutId);
            notification.timeoutId = null;
        }
    }

    resumeAutoHide(id, duration) {
        const notification = this.notifications.get(id);
        if (notification && !notification.timeoutId) {
            notification.timeoutId = setTimeout(() => {
                this.hide(id);
            }, duration);
        }
    }

    updateProgress(id, progress) {
        const notification = this.notifications.get(id);
        if (notification) {
            const progressBar = notification.element.querySelector('.toast-progress-bar');
            if (progressBar) {
                progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
            }
        }
    }

    update(id, updates) {
        const notification = this.notifications.get(id);
        if (!notification) return;
        
        if (updates.title) {
            const titleEl = notification.element.querySelector('.toast-title');
            if (titleEl) titleEl.textContent = updates.title;
        }
        
        if (updates.message) {
            const messageEl = notification.element.querySelector('.toast-message');
            if (messageEl) messageEl.textContent = updates.message;
        }
        
        if (updates.type && updates.type !== notification.type) {
            notification.element.className = `toast toast-${updates.type}`;
            const iconEl = notification.element.querySelector('.toast-icon i');
            if (iconEl) iconEl.className = this.getTypeIcon(updates.type);
        }
    }

    enforceMaxNotifications() {
        const notificationIds = Array.from(this.notifications.keys()).sort((a, b) => a - b);
        while (notificationIds.length > this.maxNotifications) {
            const oldestId = notificationIds.shift();
            this.hide(oldestId);
        }
    }

    getTypeIcon(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle',
            loading: 'fas fa-spinner fa-spin'
        };
        return icons[type] || icons.info;
    }

    // Convenience methods
    success(title, message, options = {}) {
        return this.show('success', title, message, options);
    }

    error(title, message, options = {}) {
        return this.show('error', title, message, options);
    }

    warning(title, message, options = {}) {
        return this.show('warning', title, message, options);
    }

    info(title, message, options = {}) {
        return this.show('info', title, message, options);
    }

    loading(title, message, options = {}) {
        return this.show('loading', title, message, { 
            duration: 0, 
            progress: true,
            closable: false,
            ...options 
        });
    }

    // Special notification types
    showConnectionStatus(isConnected) {
        const id = 'connection-status';
        this.hide(id); // Remove existing
        
        const type = isConnected ? 'success' : 'error';
        const title = isConnected ? 'Connected' : 'Connection Lost';
        const message = isConnected ? 
            'Real-time features are now available' : 
            'Some features may be limited. Attempting to reconnect...';
        
        return this.show(type, title, message, {
            duration: isConnected ? 3000 : 0,
            clickToDismiss: isConnected
        });
    }

    showAnalysisComplete(analysisData) {
        const riskLevel = this.getRiskLevel(analysisData.riskScore);
        const type = riskLevel === 'high' ? 'error' : riskLevel === 'medium' ? 'warning' : 'success';
        
        return this.show(type, 'Analysis Complete', 
            `${analysisData.url || 'Target'} analyzed - Risk: ${riskLevel}`, {
            actions: [
                {
                    id: 'view',
                    label: 'View Details',
                    handler: () => {
                        // Navigate to analysis details
                        window.app?.showScreen('deep-analysis', { analysisId: analysisData.id });
                    }
                }
            ]
        });
    }

    showThreatAlert(threatData) {
        return this.show('error', 'Threat Detected', 
            `${threatData.type}: ${threatData.description}`, {
            duration: 0,
            actions: [
                {
                    id: 'investigate',
                    label: 'Investigate',
                    handler: () => {
                        window.app?.showScreen('threat-center', { threatId: threatData.id });
                    }
                },
                {
                    id: 'dismiss',
                    label: 'Dismiss',
                    handler: (notificationId) => {
                        // Handle threat dismissal
                        window.apiClient?.dismissThreat(threatData.id, 'user_dismissed', 'Dismissed from notification');
                    }
                }
            ]
        });
    }

    showUpdateAvailable(updateData) {
        return this.show('info', 'Update Available', 
            `Version ${updateData.version} is ready to install`, {
            duration: 0,
            actions: [
                {
                    id: 'install',
                    label: 'Install Now',
                    handler: () => {
                        // Handle update installation
                        window.electron?.installUpdate();
                    }
                },
                {
                    id: 'later',
                    label: 'Later',
                    handler: () => {}
                }
            ]
        });
    }

    // Utility methods
    getRiskLevel(score) {
        if (score >= 70) return 'high';
        if (score >= 40) return 'medium';
        return 'low';
    }

    // Cleanup
    destroy() {
        this.hideAll();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// CSS styles for notifications (injected dynamically)
const notificationStyles = `
.toast-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.toast {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    transform: translateX(100%);
    opacity: 0;
    transition: all 0.3s ease-out;
    max-width: 100%;
    position: relative;
}

.toast.show {
    transform: translateX(0);
    opacity: 1;
}

.toast.removing {
    transform: translateX(100%);
    opacity: 0;
}

.toast-content {
    padding: 1rem;
}

.toast-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
}

.toast-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.toast-title {
    flex: 1;
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.875rem;
}

.toast-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: var(--radius-sm);
    transition: var(--transition-fast);
    margin: -0.25rem -0.25rem -0.25rem 0;
}

.toast-close:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
}

.toast-message {
    color: var(--text-secondary);
    font-size: 0.813rem;
    line-height: 1.4;
    margin-bottom: 0.75rem;
}

.toast-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
}

.toast-action {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.375rem 0.75rem;
    transition: var(--transition-fast);
}

.toast-action:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
}

.toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--bg-tertiary);
}

.toast-progress-bar {
    height: 100%;
    background: var(--primary);
    width: 0%;
    transition: width 0.3s ease;
}

/* Type-specific styles */
.toast-success .toast-icon { color: var(--success); }
.toast-success { border-left: 4px solid var(--success); }

.toast-error .toast-icon { color: var(--error); }
.toast-error { border-left: 4px solid var(--error); }

.toast-warning .toast-icon { color: var(--warning); }
.toast-warning { border-left: 4px solid var(--warning); }

.toast-info .toast-icon { color: var(--info); }
.toast-info { border-left: 4px solid var(--info); }

.toast-loading .toast-icon { color: var(--primary); }
.toast-loading { border-left: 4px solid var(--primary); }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Export singleton instance
window.notificationSystem = new NotificationSystem();