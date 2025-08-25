class BrowserSelectionDialog {
    constructor() {
        this.selectedBrowsers = [];
        this.availableBrowsers = [];
        this.isOpen = false;
    }

    async show() {
        return new Promise((resolve) => {
            this.createDialog();
            this.isOpen = true;
            
            // Set up event listeners
            this.setupEventListeners(resolve);
            
            // Request available browsers from main process
            window.electronAPI.getBrowserList().then(browsers => {
                this.availableBrowsers = browsers;
                this.renderBrowserList();
            });
        });
    }

    createDialog() {
        // Remove existing dialog if any
        const existingDialog = document.getElementById('browser-selection-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        const dialog = document.createElement('div');
        dialog.id = 'browser-selection-dialog';
        dialog.className = 'browser-dialog-overlay';
        
        dialog.innerHTML = `
            <div class="browser-dialog-container">
                <div class="browser-dialog-header">
                    <h2><i class="fas fa-globe"></i> Select Browsers to Monitor</h2>
                    <p>Choose which browsers you want to monitor for security analysis</p>
                </div>
                
                <div class="browser-dialog-content">
                    <div class="browser-detection-status">
                        <i class="fas fa-search"></i>
                        <span>Detecting installed browsers...</span>
                    </div>
                    
                    <div class="browser-list" id="browser-list">
                        <!-- Browser list will be populated here -->
                    </div>
                    
                    <div class="browser-selection-info">
                        <div class="info-card">
                            <i class="fas fa-info-circle"></i>
                            <div>
                                <h4>What happens when you select browsers?</h4>
                                <ul>
                                    <li>✓ Real-time monitoring of visited URLs</li>
                                    <li>✓ IP address resolution for each site</li>
                                    <li>✓ Security analysis and threat detection</li>
                                    <li>✓ Response time and performance metrics</li>
                                    <li>✓ SSL certificate validation</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="browser-dialog-footer">
                    <button class="btn btn-secondary" id="cancel-browser-selection">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button class="btn btn-primary" id="confirm-browser-selection" disabled>
                        <i class="fas fa-check"></i> Start Monitoring
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);
        
        // Add CSS if not already present
        this.addDialogStyles();
        
        // Animate in
        requestAnimationFrame(() => {
            dialog.classList.add('show');
        });
    }

    renderBrowserList() {
        const browserList = document.getElementById('browser-list');
        const detectionStatus = document.querySelector('.browser-detection-status');
        
        if (this.availableBrowsers.length === 0) {
            detectionStatus.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <span>No supported browsers detected. Please install Chrome, Firefox, or Edge.</span>
            `;
            return;
        }
        
        detectionStatus.style.display = 'none';
        
        browserList.innerHTML = this.availableBrowsers.map(browser => `
            <div class="browser-item" data-browser="${browser.name}">
                <div class="browser-info">
                    <div class="browser-icon">
                        <i class="fab fa-${browser.icon}"></i>
                    </div>
                    <div class="browser-details">
                        <h4>${browser.name}</h4>
                        <p>${browser.executablePath || browser.command || 'System default'}</p>
                        <span class="browser-status installed">
                            <i class="fas fa-check-circle"></i> Installed
                        </span>
                    </div>
                </div>
                <div class="browser-checkbox">
                    <input type="checkbox" id="browser-${browser.name}" value="${browser.name}">
                    <label for="browser-${browser.name}"></label>
                </div>
            </div>
        `).join('');
        
        // Update selection count
        this.updateSelectionCount();
    }

    setupEventListeners(resolve) {
        const dialog = document.getElementById('browser-selection-dialog');
        const cancelBtn = document.getElementById('cancel-browser-selection');
        const confirmBtn = document.getElementById('confirm-browser-selection');
        
        // Cancel button
        cancelBtn.addEventListener('click', () => {
            this.close();
            resolve({ cancelled: true, browsers: [] });
        });
        
        // Confirm button
        confirmBtn.addEventListener('click', () => {
            this.close();
            resolve({ cancelled: false, browsers: this.selectedBrowsers });
        });
        
        // Browser selection
        dialog.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                this.handleBrowserSelection(e);
            }
        });
        
        // Click outside to close
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                this.close();
                resolve({ cancelled: true, browsers: [] });
            }
        });
        
        // Escape key to close
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.close();
                document.removeEventListener('keydown', handleEscape);
                resolve({ cancelled: true, browsers: [] });
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    handleBrowserSelection(e) {
        const browserName = e.target.value;
        const isChecked = e.target.checked;
        
        if (isChecked) {
            const browser = this.availableBrowsers.find(b => b.name === browserName);
            if (browser && !this.selectedBrowsers.some(b => b.name === browserName)) {
                this.selectedBrowsers.push(browser);
            }
        } else {
            this.selectedBrowsers = this.selectedBrowsers.filter(b => b.name !== browserName);
        }
        
        this.updateSelectionCount();
    }

    updateSelectionCount() {
        const confirmBtn = document.getElementById('confirm-browser-selection');
        const count = this.selectedBrowsers.length;
        
        if (count > 0) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `
                <i class="fas fa-check"></i> 
                Start Monitoring (${count} browser${count > 1 ? 's' : ''})
            `;
        } else {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = `
                <i class="fas fa-check"></i> 
                Start Monitoring
            `;
        }
    }

    close() {
        const dialog = document.getElementById('browser-selection-dialog');
        if (dialog) {
            dialog.classList.remove('show');
            setTimeout(() => {
                dialog.remove();
            }, 300);
        }
        this.isOpen = false;
    }

    addDialogStyles() {
        if (document.getElementById('browser-dialog-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'browser-dialog-styles';
        styles.textContent = `
            .browser-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(5px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }
            
            .browser-dialog-overlay.show {
                opacity: 1;
                visibility: visible;
            }
            
            .browser-dialog-container {
                background: var(--card-bg, #1a1a1a);
                border-radius: 16px;
                border: 1px solid var(--border-color, #333);
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                transform: scale(0.9);
                transition: transform 0.3s ease;
            }
            
            .browser-dialog-overlay.show .browser-dialog-container {
                transform: scale(1);
            }
            
            .browser-dialog-header {
                padding: 24px 24px 16px 24px;
                border-bottom: 1px solid var(--border-color, #333);
                text-align: center;
            }
            
            .browser-dialog-header h2 {
                margin: 0 0 8px 0;
                color: var(--text-primary, #fff);
                font-size: 1.5em;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
            }
            
            .browser-dialog-header p {
                margin: 0;
                color: var(--text-secondary, #aaa);
                font-size: 0.9em;
            }
            
            .browser-dialog-content {
                padding: 24px;
                max-height: 50vh;
                overflow-y: auto;
            }
            
            .browser-detection-status {
                text-align: center;
                padding: 20px;
                color: var(--text-secondary, #aaa);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
            }
            
            .browser-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .browser-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px;
                border: 2px solid var(--border-color, #333);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                background: var(--bg-secondary, #222);
            }
            
            .browser-item:hover {
                border-color: var(--primary-color, #00d4ff);
                background: var(--bg-hover, #2a2a2a);
            }
            
            .browser-info {
                display: flex;
                align-items: center;
                gap: 16px;
                flex: 1;
            }
            
            .browser-icon {
                font-size: 2em;
                width: 48px;
                height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background: var(--primary-color, #00d4ff);
                color: var(--bg-primary, #000);
            }
            
            .browser-details h4 {
                margin: 0 0 4px 0;
                color: var(--text-primary, #fff);
                font-size: 1.1em;
            }
            
            .browser-details p {
                margin: 0 0 8px 0;
                color: var(--text-secondary, #aaa);
                font-size: 0.85em;
                font-family: monospace;
            }
            
            .browser-status {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 0.8em;
                padding: 4px 8px;
                border-radius: 12px;
                background: var(--success-color, #00ff88);
                color: var(--bg-primary, #000);
            }
            
            .browser-checkbox input[type="checkbox"] {
                width: 24px;
                height: 24px;
                cursor: pointer;
            }
            
            .browser-selection-info {
                margin-top: 24px;
            }
            
            .info-card {
                background: var(--bg-info, #1a2332);
                border: 1px solid var(--border-info, #2a3441);
                border-radius: 8px;
                padding: 16px;
                display: flex;
                gap: 12px;
            }
            
            .info-card i {
                color: var(--info-color, #64b5f6);
                font-size: 1.2em;
                margin-top: 2px;
            }
            
            .info-card h4 {
                margin: 0 0 8px 0;
                color: var(--text-primary, #fff);
                font-size: 0.95em;
            }
            
            .info-card ul {
                margin: 0;
                padding-left: 16px;
                color: var(--text-secondary, #aaa);
                font-size: 0.85em;
            }
            
            .info-card li {
                margin-bottom: 4px;
            }
            
            .browser-dialog-footer {
                padding: 16px 24px 24px 24px;
                border-top: 1px solid var(--border-color, #333);
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }
            
            .browser-dialog-footer .btn {
                padding: 12px 24px;
                border-radius: 8px;
                border: none;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .browser-dialog-footer .btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .browser-dialog-footer .btn-secondary {
                background: var(--bg-secondary, #444);
                color: var(--text-primary, #fff);
            }
            
            .browser-dialog-footer .btn-primary {
                background: var(--primary-color, #00d4ff);
                color: var(--bg-primary, #000);
            }
            
            .browser-dialog-footer .btn:hover:not(:disabled) {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3);
            }
        `;
        
        document.head.appendChild(styles);
    }
}

// Global instance
window.browserSelectionDialog = new BrowserSelectionDialog();