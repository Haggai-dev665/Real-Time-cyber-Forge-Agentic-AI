/**
 * CyberForge Agent UI Controller
 * Handles hierarchical sidebar, floating agent panel, and UI interactions
 */

(function() {
    'use strict';

    // =========================================
    // HIERARCHICAL SIDEBAR CONTROLLER
    // =========================================
    
    function initHierarchicalSidebar() {
        const parentSections = document.querySelectorAll('.sidebar-parent-section');
        
        parentSections.forEach(section => {
            const title = section.querySelector('.sidebar-parent-title');
            
            if (title) {
                title.addEventListener('click', () => {
                    // Toggle collapsed state
                    section.classList.toggle('collapsed');
                    
                    // Save state to localStorage
                    const sectionId = section.dataset.section;
                    const isCollapsed = section.classList.contains('collapsed');
                    localStorage.setItem(`sidebar-${sectionId}-collapsed`, isCollapsed);
                });
                
                // Restore saved state
                const sectionId = section.dataset.section;
                const savedState = localStorage.getItem(`sidebar-${sectionId}-collapsed`);
                if (savedState === 'true') {
                    section.classList.add('collapsed');
                }
            }
        });
    }

    // =========================================
    // FLOATING AGENT PANEL CONTROLLER
    // =========================================
    
    function initFloatingAgentPanel() {
        const panel = document.getElementById('agent-control-panel');
        const minimizeBtn = document.getElementById('agent-panel-minimize');
        const hideBtn = document.getElementById('agent-panel-hide');
        const toggleBtn = document.getElementById('agent-panel-toggle');
        const reasoningToggle = document.getElementById('reasoning-toggle');
        const reasoningContent = document.getElementById('agent-reasoning-content');
        const pauseBtn = document.getElementById('agent-pause-btn');
        const resumeBtn = document.getElementById('agent-resume-btn');
        const resyncBtn = document.getElementById('agent-resync-btn');
        
        if (!panel) return;
        
        // Make panel draggable
        makePanelDraggable(panel);
        
        // Minimize functionality
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                panel.classList.toggle('minimized');
                const icon = minimizeBtn.querySelector('i');
                if (panel.classList.contains('minimized')) {
                    icon.className = 'fas fa-window-maximize';
                } else {
                    icon.className = 'fas fa-window-minimize';
                }
                localStorage.setItem('agent-panel-minimized', panel.classList.contains('minimized'));
            });
        }
        
        // Hide functionality
        if (hideBtn) {
            hideBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                panel.classList.add('hidden');
                localStorage.setItem('agent-panel-hidden', 'true');
            });
        }
        
        // Show panel via sidebar link
        const sidebarAgentCenter = document.getElementById('sidebar-agent-center');
        if (sidebarAgentCenter) {
            sidebarAgentCenter.addEventListener('click', (e) => {
                e.preventDefault();
                panel.classList.remove('hidden');
                panel.classList.remove('minimized');
                localStorage.setItem('agent-panel-hidden', 'false');
            });
        }
        
        // Collapse/Expand functionality
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const body = document.getElementById('agent-panel-body');
                if (body) {
                    const isCollapsed = body.style.display === 'none';
                    body.style.display = isCollapsed ? 'block' : 'none';
                    const icon = toggleBtn.querySelector('i');
                    icon.className = isCollapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
                }
            });
        }
        
        // Reasoning summary toggle
        if (reasoningToggle && reasoningContent) {
            reasoningToggle.addEventListener('click', () => {
                reasoningContent.classList.toggle('collapsed');
                const chevron = reasoningToggle.querySelector('.reasoning-chevron');
                if (chevron) {
                    chevron.style.transform = reasoningContent.classList.contains('collapsed') 
                        ? 'rotate(0deg)' 
                        : 'rotate(90deg)';
                }
            });
        }
        
        // Agent control buttons
        if (pauseBtn && resumeBtn) {
            pauseBtn.addEventListener('click', () => {
                pauseBtn.style.display = 'none';
                resumeBtn.style.display = 'flex';
                updateAgentState('paused');
            });
            
            resumeBtn.addEventListener('click', () => {
                resumeBtn.style.display = 'none';
                pauseBtn.style.display = 'flex';
                updateAgentState('monitoring');
            });
        }
        
        if (resyncBtn) {
            resyncBtn.addEventListener('click', () => {
                // Add spinner
                const icon = resyncBtn.querySelector('i');
                const originalClass = icon.className;
                icon.className = 'fas fa-spinner fa-spin';
                
                // Simulate resync
                setTimeout(() => {
                    icon.className = originalClass;
                    showNotification('Resync Complete', 'Agent data synchronized successfully', 'success');
                }, 2000);
            });
        }
        
        // Restore saved panel state
        const isPanelHidden = localStorage.getItem('agent-panel-hidden') === 'true';
        const isPanelMinimized = localStorage.getItem('agent-panel-minimized') === 'true';
        
        if (isPanelHidden) {
            panel.classList.add('hidden');
        }
        if (isPanelMinimized) {
            panel.classList.add('minimized');
            if (minimizeBtn) {
                minimizeBtn.querySelector('i').className = 'fas fa-window-maximize';
            }
        }
    }
    
    // Make panel draggable
    function makePanelDraggable(panel) {
        const header = panel.querySelector('.agent-panel-header');
        if (!header) return;
        
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        
        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        
        function dragStart(e) {
            // Don't drag if clicking on buttons
            if (e.target.closest('button')) return;
            
            isDragging = true;
            initialX = e.clientX - panel.offsetLeft;
            initialY = e.clientY - panel.offsetTop;
            panel.style.cursor = 'grabbing';
        }
        
        function drag(e) {
            if (!isDragging) return;
            
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            // Keep panel within viewport
            const maxX = window.innerWidth - panel.offsetWidth;
            const maxY = window.innerHeight - panel.offsetHeight;
            
            currentX = Math.max(0, Math.min(currentX, maxX));
            currentY = Math.max(0, Math.min(currentY, maxY));
            
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            panel.style.left = currentX + 'px';
            panel.style.top = currentY + 'px';
        }
        
        function dragEnd() {
            if (isDragging) {
                isDragging = false;
                panel.style.cursor = '';
                
                // Save position
                localStorage.setItem('agent-panel-x', panel.style.left);
                localStorage.setItem('agent-panel-y', panel.style.top);
            }
        }
        
        // Restore saved position
        const savedX = localStorage.getItem('agent-panel-x');
        const savedY = localStorage.getItem('agent-panel-y');
        if (savedX && savedY) {
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            panel.style.left = savedX;
            panel.style.top = savedY;
        }
    }

    // =========================================
    // AGENT STATE MANAGEMENT
    // =========================================
    
    function updateAgentState(state) {
        const statusText = document.getElementById('agent-status-text');
        const statusDot = document.getElementById('agent-main-status');
        const pulse = document.getElementById('agent-pulse-indicator');
        const stateItems = document.querySelectorAll('.agent-state-item');
        
        // Remove all active states
        stateItems.forEach(item => item.classList.remove('active'));
        
        // Set active state
        const activeItem = document.querySelector(`.agent-state-item[data-state="${state}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
        
        // Update status text and indicators
        const stateConfig = {
            idle: { text: 'Idle', color: '#9E9E9E', pulseClass: 'idle' },
            monitoring: { text: 'Monitoring', color: '#4CAF50', pulseClass: '' },
            analyzing: { text: 'Analyzing', color: '#2196F3', pulseClass: '' },
            investigating: { text: 'Investigating', color: '#FF9800', pulseClass: '' },
            waiting: { text: 'Waiting', color: '#FFC107', pulseClass: '' },
            alert: { text: 'Alert', color: '#FF5722', pulseClass: 'alert' },
            error: { text: 'Error', color: '#F44336', pulseClass: 'error' }
        };
        
        const config = stateConfig[state] || stateConfig.monitoring;
        
        if (statusText) {
            statusText.textContent = config.text;
        }
        
        if (statusDot) {
            statusDot.style.background = config.color;
        }
        
        if (pulse) {
            pulse.className = 'agent-pulse ' + config.pulseClass;
            pulse.style.background = config.color;
        }
    }

    // =========================================
    // HEADER ENHANCEMENTS
    // =========================================
    
    function initHeaderEnhancements() {
        const themeToggle = document.getElementById('theme-toggle');
        const alertWidget = document.getElementById('header-alert-widget');
        const privacyMode = document.getElementById('header-privacy-mode');
        
        // Enhanced theme toggle with smooth transition
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.body.dataset.theme || 'dark';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                
                // Add transition class
                document.body.classList.add('theme-transitioning');
                
                // Change theme
                document.body.dataset.theme = newTheme;
                localStorage.setItem('theme', newTheme);
                
                // Update icon
                const icon = themeToggle.querySelector('i');
                if (newTheme === 'light') {
                    icon.className = 'fas fa-sun';
                } else {
                    icon.className = 'fas fa-moon';
                }
                
                // Remove transition class after animation
                setTimeout(() => {
                    document.body.classList.remove('theme-transitioning');
                }, 300);
            });
            
            // Initialize theme icon
            const savedTheme = localStorage.getItem('theme') || 'dark';
            const icon = themeToggle.querySelector('i');
            if (savedTheme === 'light') {
                icon.className = 'fas fa-sun';
            }
        }
        
        // Alert count click handler
        if (alertWidget) {
            alertWidget.addEventListener('click', () => {
                // Navigate to alerts screen
                const alertLink = document.querySelector('[data-screen="alerts"]');
                if (alertLink) {
                    alertLink.click();
                }
            });
        }
        
        // Privacy mode toggle
        if (privacyMode) {
            let isPrivate = localStorage.getItem('privacy-mode') === 'true';
            if (isPrivate) {
                privacyMode.classList.add('active');
            }
            
            privacyMode.addEventListener('click', () => {
                isPrivate = !isPrivate;
                privacyMode.classList.toggle('active');
                localStorage.setItem('privacy-mode', isPrivate);
                showNotification(
                    'Privacy Mode',
                    isPrivate ? 'Privacy mode enabled' : 'Privacy mode disabled',
                    'info'
                );
            });
        }
        
        // Update device identity
        const deviceName = document.getElementById('device-name');
        if (deviceName) {
            const savedDevice = localStorage.getItem('device-name') || 'Device-001';
            deviceName.textContent = savedDevice;
        }
    }

    // =========================================
    // NOTIFICATION SYSTEM
    // =========================================
    
    function showNotification(title, message, type = 'info') {
        // Use existing toast system if available
        if (typeof showToast === 'function') {
            showToast(type, title, message);
            return;
        }
        
        // Fallback notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // =========================================
    // AGENT DATA UPDATES
    // =========================================
    
    function updateAgentStats(stats) {
        if (stats.browsers !== undefined) {
            const el = document.getElementById('agent-browsers-count');
            if (el) el.textContent = stats.browsers;
        }
        
        if (stats.requests !== undefined) {
            const el = document.getElementById('agent-requests-count');
            if (el) el.textContent = stats.requests;
        }
        
        if (stats.threats !== undefined) {
            const el = document.getElementById('agent-threats-count');
            if (el) el.textContent = stats.threats;
            
            // Update header alert count
            const headerAlert = document.getElementById('header-alert-number');
            if (headerAlert) headerAlert.textContent = stats.threats;
        }
        
        if (stats.uptime !== undefined) {
            const el = document.getElementById('agent-uptime');
            if (el) el.textContent = stats.uptime;
        }
    }
    
    function addReasoningEntry(time, text) {
        const container = document.getElementById('agent-reasoning-content');
        if (!container) return;
        
        const entry = document.createElement('div');
        entry.className = 'reasoning-entry';
        entry.innerHTML = `
            <span class="reasoning-time">${time}</span>
            <span class="reasoning-text">${text}</span>
        `;
        
        container.insertBefore(entry, container.firstChild);
        
        // Keep only last 10 entries
        while (container.children.length > 10) {
            container.removeChild(container.lastChild);
        }
    }
    
    function addDecisionEntry(type, text, time) {
        const container = document.getElementById('agent-decisions-list');
        if (!container) return;
        
        const entry = document.createElement('div');
        entry.className = `decision-item decision-${type}`;
        entry.innerHTML = `
            <i class="fas fa-${type === 'blocked' ? 'ban' : 'check'}"></i>
            <span>${text}</span>
            <span class="decision-time">${time}</span>
        `;
        
        container.insertBefore(entry, container.firstChild);
        
        // Keep only last 5 entries
        while (container.children.length > 5) {
            container.removeChild(container.lastChild);
        }
    }

    // =========================================
    // INITIALIZATION
    // =========================================
    
    function init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }
        
        console.log('Initializing CyberForge Agent UI...');
        
        initHierarchicalSidebar();
        initFloatingAgentPanel();
        initHeaderEnhancements();
        
        // Set initial agent state
        updateAgentState('monitoring');
        
        // Expose functions globally for integration
        window.CyberForgeAgentUI = {
            updateAgentState,
            updateAgentStats,
            addReasoningEntry,
            addDecisionEntry,
            showNotification
        };
        
        console.log('CyberForge Agent UI initialized');
    }
    
    // Start initialization
    init();
})();
