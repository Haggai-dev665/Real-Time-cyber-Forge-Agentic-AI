/**
 * Modal Component
 * Reusable modal dialog system
 */

class Modal {
    constructor() {
        this.container = null;
        this.modals = new Map();
        this.nextId = 1;
        this.init();
    }

    init() {
        this.container = document.getElementById('modal-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'modal-container';
            this.container.className = 'modal-container';
            document.body.appendChild(this.container);
        }
    }

    show(options = {}) {
        const id = this.nextId++;
        const modal = this.createModal(id, options);
        
        // Add to DOM
        this.container.appendChild(modal.overlay);
        this.modals.set(id, modal);
        
        // Show with animation
        requestAnimationFrame(() => {
            modal.overlay.classList.add('show');
        });
        
        // Handle keyboard events
        this.setupKeyboardHandlers(id);
        
        // Focus management
        this.manageFocus(modal.element);
        
        return id;
    }

    createModal(id, options) {
        const {
            title = '',
            content = '',
            size = 'medium',
            closable = true,
            actions = [],
            className = '',
            onClose = null
        } = options;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.dataset.modalId = id;

        // Create modal
        const element = document.createElement('div');
        element.className = `modal modal-${size} ${className}`;
        
        // Create header
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `
            <h3 class="modal-title">${title}</h3>
            ${closable ? '<button class="modal-close" aria-label="Close modal"><i class="fas fa-times"></i></button>' : ''}
        `;

        // Create body
        const body = document.createElement('div');
        body.className = 'modal-body';
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            body.appendChild(content);
        }

        // Create footer (if actions provided)
        let footer = null;
        if (actions.length > 0) {
            footer = document.createElement('div');
            footer.className = 'modal-footer';
            
            actions.forEach(action => {
                const button = document.createElement('button');
                button.className = `btn ${action.class || 'btn-secondary'}`;
                button.textContent = action.label;
                button.addEventListener('click', () => {
                    const result = action.handler ? action.handler(id) : true;
                    if (result !== false && action.closeOnClick !== false) {
                        this.hide(id);
                    }
                });
                footer.appendChild(button);
            });
        }

        // Assemble modal
        element.appendChild(header);
        element.appendChild(body);
        if (footer) element.appendChild(footer);
        
        overlay.appendChild(element);

        // Setup event listeners
        this.setupModalEvents(overlay, element, id, { onClose, closable });

        return {
            id,
            overlay,
            element,
            header,
            body,
            footer,
            options
        };
    }

    setupModalEvents(overlay, element, id, { onClose, closable }) {
        // Close button
        if (closable) {
            const closeBtn = element.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.hide(id));
            }
            
            // Click overlay to close
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hide(id);
                }
            });
        }

        // Store close handler
        if (onClose) {
            overlay.dataset.onClose = onClose;
        }
    }

    setupKeyboardHandlers(id) {
        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                this.hide(id);
            }
            if (e.key === 'Tab') {
                this.trapFocus(e, id);
            }
        };

        document.addEventListener('keydown', keyHandler);
        
        // Store for cleanup
        const modal = this.modals.get(id);
        if (modal) {
            modal.keyHandler = keyHandler;
        }
    }

    trapFocus(e, id) {
        const modal = this.modals.get(id);
        if (!modal) return;

        const focusableElements = modal.element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        }
    }

    manageFocus(element) {
        // Store current focus
        this.previousActiveElement = document.activeElement;
        
        // Focus first focusable element
        const firstFocusable = element.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (firstFocusable) {
            firstFocusable.focus();
        }
    }

    hide(id) {
        const modal = this.modals.get(id);
        if (!modal) return;

        // Call onClose handler
        if (modal.options.onClose) {
            const result = modal.options.onClose(id);
            if (result === false) return; // Prevent closing
        }

        // Remove keyboard handler
        if (modal.keyHandler) {
            document.removeEventListener('keydown', modal.keyHandler);
        }

        // Hide with animation
        modal.overlay.classList.add('hiding');
        
        setTimeout(() => {
            if (modal.overlay.parentNode) {
                modal.overlay.parentNode.removeChild(modal.overlay);
            }
            this.modals.delete(id);
            
            // Restore focus
            if (this.previousActiveElement) {
                this.previousActiveElement.focus();
            }
        }, 300);
    }

    hideAll() {
        this.modals.forEach((_, id) => this.hide(id));
    }

    update(id, updates) {
        const modal = this.modals.get(id);
        if (!modal) return;

        if (updates.title) {
            const titleEl = modal.header.querySelector('.modal-title');
            if (titleEl) titleEl.textContent = updates.title;
        }

        if (updates.content) {
            if (typeof updates.content === 'string') {
                modal.body.innerHTML = updates.content;
            } else if (updates.content instanceof HTMLElement) {
                modal.body.innerHTML = '';
                modal.body.appendChild(updates.content);
            }
        }
    }

    // Convenience methods
    alert(title, message, options = {}) {
        return this.show({
            title,
            content: `<p>${message}</p>`,
            size: 'small',
            actions: [
                {
                    label: 'OK',
                    class: 'btn-primary',
                    handler: () => true
                }
            ],
            ...options
        });
    }

    confirm(title, message, options = {}) {
        return new Promise((resolve) => {
            this.show({
                title,
                content: `<p>${message}</p>`,
                size: 'small',
                actions: [
                    {
                        label: options.cancelLabel || 'Cancel',
                        class: 'btn-secondary',
                        handler: () => {
                            resolve(false);
                            return true;
                        }
                    },
                    {
                        label: options.confirmLabel || 'Confirm',
                        class: options.confirmClass || 'btn-primary',
                        handler: () => {
                            resolve(true);
                            return true;
                        }
                    }
                ],
                closable: false,
                ...options
            });
        });
    }

    prompt(title, message, defaultValue = '', options = {}) {
        return new Promise((resolve) => {
            const inputId = `prompt-input-${Date.now()}`;
            const content = `
                <p>${message}</p>
                <div class="form-group">
                    <input type="text" id="${inputId}" class="form-input" value="${defaultValue}" placeholder="${options.placeholder || ''}">
                </div>
            `;

            const modalId = this.show({
                title,
                content,
                size: 'small',
                actions: [
                    {
                        label: options.cancelLabel || 'Cancel',
                        class: 'btn-secondary',
                        handler: () => {
                            resolve(null);
                            return true;
                        }
                    },
                    {
                        label: options.confirmLabel || 'OK',
                        class: 'btn-primary',
                        handler: () => {
                            const input = document.getElementById(inputId);
                            resolve(input ? input.value : '');
                            return true;
                        }
                    }
                ],
                closable: false,
                ...options
            });

            // Focus input after modal is shown
            setTimeout(() => {
                const input = document.getElementById(inputId);
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 100);
        });
    }

    loading(title, message, options = {}) {
        const content = `
            <div class="loading-content">
                <div class="spinner-lg"></div>
                <p>${message}</p>
            </div>
        `;

        return this.show({
            title,
            content,
            size: 'small',
            closable: false,
            className: 'modal-loading',
            ...options
        });
    }

    // Cleanup
    destroy() {
        this.hideAll();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// CSS styles for modals
const modalStyles = `
.modal-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: var(--z-modal);
    pointer-events: none;
}

.modal-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    backdrop-filter: blur(5px);
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: auto;
}

.modal-overlay.show {
    opacity: 1;
}

.modal-overlay.hiding {
    opacity: 0;
}

.modal {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xl);
    max-width: 90vw;
    max-height: 90vh;
    overflow: hidden;
    transform: scale(0.9);
    transition: transform 0.3s ease;
    display: flex;
    flex-direction: column;
}

.modal-overlay.show .modal {
    transform: scale(1);
}

.modal-small { width: 400px; }
.modal-medium { width: 600px; }
.modal-large { width: 800px; }
.modal-xlarge { width: 1000px; }

.modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
}

.modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
}

.modal-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: var(--radius-md);
    transition: var(--transition-fast);
}

.modal-close:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
}

.modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
}

.modal-footer {
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    flex-shrink: 0;
}

.modal-loading .modal-body {
    text-align: center;
}

.loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

.loading-content p {
    color: var(--text-secondary);
    margin: 0;
}

@media (max-width: 768px) {
    .modal {
        width: 90vw !important;
        max-width: none;
    }
    
    .modal-overlay {
        padding: 1rem;
    }
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = modalStyles;
document.head.appendChild(styleSheet);

// Export singleton instance
window.modal = new Modal();