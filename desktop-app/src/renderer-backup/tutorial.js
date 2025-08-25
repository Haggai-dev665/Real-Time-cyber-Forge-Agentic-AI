/**
 * Advanced Tutorial and Onboarding System
 */

class TutorialSystem {
    constructor() {
        this.currentStep = 0;
        this.steps = [];
        this.isActive = false;
        this.welcomeShown = localStorage.getItem('cyber-forge-welcome-shown') !== 'true';
        this.tutorialCompleted = localStorage.getItem('cyber-forge-tutorial-completed') === 'true';
        
        this.init();
    }

    init() {
        this.setupSteps();
        this.createWelcomeScreen();
        this.createTutorialContainer();
        
        if (this.welcomeShown) {
            setTimeout(() => this.showWelcome(), 1000);
        }
    }

    setupSteps() {
        this.steps = [
            {
                title: "Welcome to Cyber Forge AI",
                content: `
                    <p>Welcome to the most advanced cybersecurity AI platform! This tutorial will guide you through all the powerful features available to protect your digital environment.</p>
                    <div class="tutorial-feature-grid">
                        <div class="tutorial-feature">
                            <div class="tutorial-feature-icon"><i class="fas fa-shield-halved"></i></div>
                            <div class="tutorial-feature-title">Real-time Protection</div>
                            <div class="tutorial-feature-description">Advanced AI monitors your browsing in real-time</div>
                        </div>
                        <div class="tutorial-feature">
                            <div class="tutorial-feature-icon"><i class="fas fa-brain"></i></div>
                            <div class="tutorial-feature-title">AI Intelligence</div>
                            <div class="tutorial-feature-description">Machine learning algorithms detect emerging threats</div>
                        </div>
                        <div class="tutorial-feature">
                            <div class="tutorial-feature-icon"><i class="fas fa-chart-line"></i></div>
                            <div class="tutorial-feature-description">Comprehensive security analytics and insights</div>
                        </div>
                    </div>
                `,
                highlight: null
            },
            {
                title: "Dashboard Overview",
                content: `
                    <p>The <span class="tutorial-highlight">Dashboard</span> is your central command center. Here you can:</p>
                    <ul>
                        <li>Monitor real-time security metrics</li>
                        <li>View live activity feeds</li>
                        <li>Check your current risk assessment</li>
                        <li>Access recent AI tasks and insights</li>
                    </ul>
                    <p>The dashboard automatically updates as our AI analyzes your browsing patterns and detects potential threats.</p>
                `,
                highlight: '[data-tab="dashboard"]'
            },
            {
                title: "AI Task Management",
                content: `
                    <p>The <span class="tutorial-highlight">AI Tasks</span> section allows you to:</p>
                    <ul>
                        <li>Create custom security analysis tasks</li>
                        <li>Monitor ongoing AI operations</li>
                        <li>View completed analysis results</li>
                        <li>Schedule automated security scans</li>
                    </ul>
                    <p>Our AI agent can perform network scans, website analysis, threat detection, and generate comprehensive security reports.</p>
                `,
                highlight: '[data-tab="tasks"]'
            },
            {
                title: "Real-time Analysis",
                content: `
                    <p>The <span class="tutorial-highlight">Analysis</span> tab provides:</p>
                    <ul>
                        <li>Real-time browsing pattern analysis</li>
                        <li>Security risk assessments</li>
                        <li>Detailed threat breakdowns</li>
                        <li>Historical security data</li>
                    </ul>
                    <p>Submit custom queries to get AI-powered security insights about any website, network, or security concern.</p>
                `,
                highlight: '[data-tab="analysis"]'
            },
            {
                title: "Threat Detection",
                content: `
                    <p>Our advanced <span class="tutorial-highlight">Threat Detection</span> system:</p>
                    <ul>
                        <li>Monitors for malware, phishing, and suspicious activity</li>
                        <li>Provides real-time threat alerts</li>
                        <li>Categorizes threats by risk level</li>
                        <li>Offers mitigation recommendations</li>
                    </ul>
                    <p>The AI continuously learns from new threat patterns to improve detection accuracy.</p>
                `,
                highlight: '[data-tab="threats"]'
            },
            {
                title: "Network Security Scanner",
                content: `
                    <p>The <span class="tutorial-highlight">Network Scanner</span> helps you:</p>
                    <ul>
                        <li>Scan your network for vulnerabilities</li>
                        <li>Identify open ports and services</li>
                        <li>Detect unauthorized devices</li>
                        <li>Monitor network traffic patterns</li>
                    </ul>
                    <p>Configure custom scan parameters and schedule regular network assessments.</p>
                `,
                highlight: '[data-tab="network"]'
            },
            {
                title: "ML Dashboard",
                content: `
                    <p>The <span class="tutorial-highlight">ML Dashboard</span> showcases our AI capabilities:</p>
                    <ul>
                        <li>Real-time model performance metrics</li>
                        <li>Machine learning accuracy statistics</li>
                        <li>Training progress and results</li>
                        <li>AI model management tools</li>
                    </ul>
                    <p>This advanced feature is perfect for understanding how our AI protects you.</p>
                `,
                highlight: '[data-tab="ml-dashboard"]'
            },
            {
                title: "AI Chat Assistant",
                content: `
                    <p>Your personal <span class="tutorial-highlight">AI Assistant</span> can:</p>
                    <ul>
                        <li>Answer cybersecurity questions</li>
                        <li>Provide security recommendations</li>
                        <li>Execute security tasks via natural language</li>
                        <li>Generate detailed security reports</li>
                    </ul>
                    <p>Simply type your questions or requests, and the AI will provide expert assistance.</p>
                `,
                highlight: '[data-tab="chat"]'
            },
            {
                title: "Theme & Notifications",
                content: `
                    <p>Customize your experience with:</p>
                    <div class="tutorial-feature-grid">
                        <div class="tutorial-feature">
                            <div class="tutorial-feature-icon"><i class="fas fa-palette"></i></div>
                            <div class="tutorial-feature-title">Theme Switcher</div>
                            <div class="tutorial-feature-description">Toggle between light, dark, and auto themes</div>
                        </div>
                        <div class="tutorial-feature">
                            <div class="tutorial-feature-icon"><i class="fas fa-bell"></i></div>
                            <div class="tutorial-feature-title">Smart Notifications</div>
                            <div class="tutorial-feature-description">Real-time alerts and system messages</div>
                        </div>
                    </div>
                    <p>The theme system provides smooth transitions and the notification center keeps you informed of all security events.</p>
                `,
                highlight: '.theme-switcher, .header-messages'
            },
            {
                title: "Get Started!",
                content: `
                    <p>🎉 <strong>Congratulations!</strong> You're now ready to use Cyber Forge AI.</p>
                    <div class="tutorial-feature-grid">
                        <div class="tutorial-feature">
                            <div class="tutorial-feature-icon"><i class="fas fa-rocket"></i></div>
                            <div class="tutorial-feature-title">Start Exploring</div>
                            <div class="tutorial-feature-description">Begin with the Dashboard to see real-time protection</div>
                        </div>
                        <div class="tutorial-feature">
                            <div class="tutorial-feature-icon"><i class="fas fa-question-circle"></i></div>
                            <div class="tutorial-feature-title">Need Help?</div>
                            <div class="tutorial-feature-description">Ask the AI Assistant anytime for guidance</div>
                        </div>
                    </div>
                    <p>Your digital security is now enhanced with the power of advanced AI. Stay safe!</p>
                `,
                highlight: null
            }
        ];
    }

    createWelcomeScreen() {
        const welcomeScreen = document.createElement('div');
        welcomeScreen.className = 'welcome-screen';
        welcomeScreen.innerHTML = `
            <div class="welcome-content">
                <div class="welcome-logo">
                    <i class="fas fa-shield-halved"></i>
                </div>
                <h1 class="welcome-title">Cyber Forge AI</h1>
                <p class="welcome-description">
                    Advanced AI-powered cybersecurity protection for the modern digital world. 
                    Real-time threat detection, intelligent analysis, and proactive security measures.
                </p>
                <div class="welcome-actions">
                    <button class="welcome-btn" onclick="tutorialSystem.startTutorial()">
                        <i class="fas fa-play"></i>
                        Start Tutorial
                    </button>
                    <button class="welcome-btn secondary" onclick="tutorialSystem.skipWelcome()">
                        <i class="fas fa-forward"></i>
                        Skip & Explore
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(welcomeScreen);
        this.welcomeScreen = welcomeScreen;
    }

    createTutorialContainer() {
        const tutorialOverlay = document.createElement('div');
        tutorialOverlay.className = 'tutorial-overlay';
        tutorialOverlay.innerHTML = `
            <div class="tutorial-container">
                <button class="tutorial-close" onclick="tutorialSystem.closeTutorial()">
                    <i class="fas fa-times"></i>
                </button>
                
                <div class="tutorial-header">
                    <h1 class="tutorial-title">Interactive Tutorial</h1>
                    <p class="tutorial-subtitle">Learn how to use Cyber Forge AI effectively</p>
                    <div class="tutorial-progress">
                        <div class="tutorial-progress-bar"></div>
                    </div>
                </div>
                
                <div class="tutorial-steps"></div>
                
                <div class="tutorial-navigation">
                    <button class="tutorial-nav-btn secondary" id="tutorial-prev" onclick="tutorialSystem.previousStep()">
                        <i class="fas fa-chevron-left"></i>
                        Previous
                    </button>
                    
                    <div class="tutorial-steps-indicator"></div>
                    
                    <button class="tutorial-nav-btn" id="tutorial-next" onclick="tutorialSystem.nextStep()">
                        Next
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(tutorialOverlay);
        this.tutorialOverlay = tutorialOverlay;
        this.tutorialContainer = tutorialOverlay.querySelector('.tutorial-container');
        this.stepsContainer = tutorialOverlay.querySelector('.tutorial-steps');
        this.progressBar = tutorialOverlay.querySelector('.tutorial-progress-bar');
        this.stepsIndicator = tutorialOverlay.querySelector('.tutorial-steps-indicator');
        
        this.createStepElements();
        this.createStepIndicators();
    }

    createStepElements() {
        this.steps.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.className = `tutorial-step ${index === 0 ? 'active' : ''}`;
            stepElement.innerHTML = `
                <div class="tutorial-step-header">
                    <div class="tutorial-step-number">${index + 1}</div>
                    <h2 class="tutorial-step-title">${step.title}</h2>
                </div>
                <div class="tutorial-step-content">
                    ${step.content}
                </div>
            `;
            this.stepsContainer.appendChild(stepElement);
        });
    }

    createStepIndicators() {
        this.steps.forEach((step, index) => {
            const dot = document.createElement('div');
            dot.className = `tutorial-step-dot ${index === 0 ? 'active' : ''}`;
            dot.onclick = () => this.goToStep(index);
            this.stepsIndicator.appendChild(dot);
        });
    }

    showWelcome() {
        this.welcomeScreen.classList.add('active');
    }

    hideWelcome() {
        this.welcomeScreen.classList.remove('active');
        localStorage.setItem('cyber-forge-welcome-shown', 'true');
    }

    skipWelcome() {
        this.hideWelcome();
        // Show a quick notification about available help
        if (window.advancedThemeSystem && window.advancedThemeSystem.notificationSystem) {
            window.advancedThemeSystem.notificationSystem.show(
                'Welcome to Cyber Forge AI!',
                'You can start the tutorial anytime from the settings or ask the AI Assistant for help.',
                'info',
                8000
            );
        }
    }

    startTutorial() {
        this.hideWelcome();
        this.showTutorial();
    }

    showTutorial() {
        this.isActive = true;
        this.currentStep = 0;
        this.tutorialOverlay.classList.add('active');
        this.updateStep();
        
        // Add tutorial launcher to settings if not exists
        this.addTutorialLauncher();
    }

    closeTutorial() {
        this.isActive = false;
        this.tutorialOverlay.classList.remove('active');
        this.clearHighlights();
        
        if (this.currentStep >= this.steps.length - 1) {
            localStorage.setItem('cyber-forge-tutorial-completed', 'true');
            this.tutorialCompleted = true;
        }
    }

    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.updateStep();
        } else {
            this.closeTutorial();
            
            // Show completion notification
            if (window.advancedThemeSystem && window.advancedThemeSystem.notificationSystem) {
                window.advancedThemeSystem.notificationSystem.show(
                    'Tutorial Completed! 🎉',
                    'You\'re now ready to use all the powerful features of Cyber Forge AI.',
                    'success',
                    6000
                );
            }
        }
    }

    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.updateStep();
        }
    }

    goToStep(stepIndex) {
        if (stepIndex >= 0 && stepIndex < this.steps.length) {
            this.currentStep = stepIndex;
            this.updateStep();
        }
    }

    updateStep() {
        // Update progress bar
        const progress = ((this.currentStep + 1) / this.steps.length) * 100;
        this.progressBar.style.width = `${progress}%`;
        
        // Update step visibility
        const stepElements = this.stepsContainer.querySelectorAll('.tutorial-step');
        stepElements.forEach((step, index) => {
            step.classList.toggle('active', index === this.currentStep);
        });
        
        // Update step indicators
        const dots = this.stepsIndicator.querySelectorAll('.tutorial-step-dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === this.currentStep);
            dot.classList.toggle('completed', index < this.currentStep);
        });
        
        // Update navigation buttons
        const prevBtn = document.getElementById('tutorial-prev');
        const nextBtn = document.getElementById('tutorial-next');
        
        prevBtn.disabled = this.currentStep === 0;
        
        if (this.currentStep === this.steps.length - 1) {
            nextBtn.innerHTML = '<i class="fas fa-check"></i> Complete Tutorial';
        } else {
            nextBtn.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
        }
        
        // Handle highlighting
        this.clearHighlights();
        const currentStepData = this.steps[this.currentStep];
        if (currentStepData.highlight) {
            this.highlightElement(currentStepData.highlight);
        }
    }

    highlightElement(selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.classList.add('tutorial-highlight-element');
            
            // Scroll element into view if needed
            setTimeout(() => {
                element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }, 300);
        }
    }

    clearHighlights() {
        document.querySelectorAll('.tutorial-highlight-element').forEach(element => {
            element.classList.remove('tutorial-highlight-element');
        });
    }

    addTutorialLauncher() {
        // Add tutorial option to settings
        const settingsContainer = document.querySelector('#settings-tab .settings-container');
        if (settingsContainer && !document.querySelector('.tutorial-launcher-section')) {
            const tutorialSection = document.createElement('div');
            tutorialSection.className = 'settings-section tutorial-launcher-section';
            tutorialSection.innerHTML = `
                <h3>Help & Tutorial</h3>
                <div class="setting-group">
                    <button class="btn-primary" onclick="tutorialSystem.showTutorial()">
                        <i class="fas fa-graduation-cap"></i>
                        Restart Tutorial
                    </button>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem;">
                        Learn how to use all the advanced features of Cyber Forge AI
                    </p>
                </div>
                <div class="setting-group">
                    <button class="btn-secondary" onclick="tutorialSystem.showQuickTips()">
                        <i class="fas fa-lightbulb"></i>
                        Quick Tips
                    </button>
                </div>
            `;
            settingsContainer.appendChild(tutorialSection);
        }
    }

    showQuickTips() {
        const tips = [
            "Use Ctrl+/ to quickly access the AI chat",
            "Right-click on any threat for quick actions",
            "The AI learns from your preferences over time",
            "Set up custom scan schedules for automated protection",
            "Use the theme switcher for comfortable viewing"
        ];
        
        const randomTip = tips[Math.floor(Math.random() * tips.length)];
        
        if (window.advancedThemeSystem && window.advancedThemeSystem.notificationSystem) {
            window.advancedThemeSystem.notificationSystem.show(
                'Quick Tip 💡',
                randomTip,
                'info',
                6000
            );
        }
    }

    // Interactive tutorial for specific features
    showFeatureTutorial(feature) {
        const featureTutorials = {
            'network-scan': {
                title: "Network Scanning Tutorial",
                steps: [
                    "Enter your target IP or hostname",
                    "Select ports to scan",
                    "Choose scan type (TCP/SYN/UDP)",
                    "Click 'Start Scan' to begin",
                    "Review results in the table below"
                ]
            },
            'ai-chat': {
                title: "AI Chat Tutorial",
                steps: [
                    "Type your security question",
                    "Use natural language for best results",
                    "Ask for specific analysis tasks",
                    "Request security reports",
                    "The AI remembers context within the session"
                ]
            }
        };
        
        const tutorial = featureTutorials[feature];
        if (tutorial && window.advancedThemeSystem && window.advancedThemeSystem.notificationSystem) {
            const stepsText = tutorial.steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
            
            window.advancedThemeSystem.notificationSystem.show(
                tutorial.title,
                stepsText,
                'info',
                10000
            );
        }
    }
}

// Initialize tutorial system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.tutorialSystem = new TutorialSystem();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        // Focus on AI chat input
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.focus();
            // Switch to chat tab if not already there
            const chatTab = document.querySelector('[data-tab="chat"]');
            if (chatTab && !chatTab.classList.contains('active')) {
                chatTab.click();
            }
        }
    }
    
    if (e.key === 'Escape' && window.tutorialSystem && window.tutorialSystem.isActive) {
        window.tutorialSystem.closeTutorial();
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TutorialSystem };
}