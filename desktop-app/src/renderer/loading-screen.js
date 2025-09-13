// Advanced Loading Screen with Cyber Theme
class LoadingScreen {
    constructor() {
        this.loadingElement = null;
        this.progressBar = null;
        this.isVisible = false;
        this.progress = 0;
        this.loadingMessages = [
            "Initializing security protocols...",
            "Establishing secure connections...",
            "Loading threat intelligence...",
            "Activating AI monitoring...",
            "Preparing cyber defense systems...",
            "Synchronizing with threat feeds...",
            "Calibrating detection algorithms...",
            "Starting real-time monitoring..."
        ];
        this.currentMessageIndex = 0;
    }

    create() {
        this.loadingElement = document.createElement('div');
        this.loadingElement.id = 'cyber-loading-screen';
        this.loadingElement.innerHTML = `
            <div class="loading-container">
                <div class="cyber-logo">
                    <div class="logo-glow"></div>
                    <div class="logo-text">CYBER FORGE</div>
                    <div class="logo-subtitle">AI Security Platform</div>
                </div>
                
                <div class="loading-progress">
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                        <div class="progress-glow"></div>
                    </div>
                    <div class="progress-text">0%</div>
                </div>
                
                <div class="loading-status">
                    <span class="status-text">Initializing...</span>
                    <div class="loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
                
                <div class="cyber-grid">
                    <div class="grid-line"></div>
                    <div class="grid-line"></div>
                    <div class="grid-line"></div>
                    <div class="grid-line"></div>
                    <div class="grid-line"></div>
                </div>
                
                <div class="cyber-particles">
                    ${Array.from({length: 20}, (_, i) => `<div class="particle particle-${i}"></div>`).join('')}
                </div>
            </div>
        `;

        // Add CSS styles
        const style = document.createElement('style');
        style.textContent = `
            #cyber-loading-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 1;
                transition: opacity 0.5s ease;
                overflow: hidden;
            }

            .loading-container {
                text-align: center;
                position: relative;
                z-index: 2;
            }

            .cyber-logo {
                margin-bottom: 3rem;
                position: relative;
            }

            .logo-glow {
                width: 100px;
                height: 100px;
                margin: 0 auto 1rem;
                border: 3px solid #00ffff;
                border-radius: 50%;
                position: relative;
                animation: logoSpin 3s linear infinite;
            }

            .logo-glow::before {
                content: '';
                position: absolute;
                top: -3px;
                left: -3px;
                right: -3px;
                bottom: -3px;
                border-radius: 50%;
                background: conic-gradient(from 0deg, transparent, #00ffff, transparent, #ff00ff, transparent);
                animation: logoSpin 2s linear infinite reverse;
                z-index: -1;
            }

            .logo-glow::after {
                content: '';
                position: absolute;
                top: 10px;
                left: 10px;
                right: 10px;
                bottom: 10px;
                border-radius: 50%;
                background: radial-gradient(circle, #00ffff33 0%, transparent 70%);
                animation: pulse 2s ease-in-out infinite;
            }

            @keyframes logoSpin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            .logo-text {
                font-size: 2.5rem;
                font-weight: bold;
                background: linear-gradient(45deg, #00ffff, #ff00ff, #00ffff);
                background-size: 200% 200%;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                animation: gradientShift 3s ease-in-out infinite;
                text-shadow: 0 0 30px rgba(0, 255, 255, 0.5);
            }

            .logo-subtitle {
                color: #888;
                font-size: 1rem;
                letter-spacing: 3px;
                margin-top: 0.5rem;
                opacity: 0.8;
            }

            @keyframes gradientShift {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }

            .loading-progress {
                margin: 2rem 0;
                width: 300px;
                margin-left: auto;
                margin-right: auto;
            }

            .progress-bar {
                width: 100%;
                height: 6px;
                background: rgba(0, 255, 255, 0.1);
                border-radius: 3px;
                position: relative;
                overflow: hidden;
                border: 1px solid rgba(0, 255, 255, 0.3);
            }

            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #00ffff, #ff00ff, #00ffff);
                border-radius: 3px;
                width: 0%;
                transition: width 0.3s ease;
                position: relative;
            }

            .progress-glow {
                position: absolute;
                top: -2px;
                left: 0;
                height: 10px;
                width: 20px;
                background: radial-gradient(ellipse, rgba(0, 255, 255, 0.8) 0%, transparent 70%);
                border-radius: 50%;
                animation: progressGlow 2s ease-in-out infinite;
            }

            @keyframes progressGlow {
                0%, 100% { transform: translateX(-10px); opacity: 0; }
                50% { opacity: 1; }
            }

            .progress-text {
                color: #00ffff;
                font-size: 1.2rem;
                font-weight: bold;
                margin-top: 1rem;
                text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
            }

            .loading-status {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 1rem;
                margin-top: 2rem;
            }

            .status-text {
                color: #ccc;
                font-size: 1rem;
                min-width: 200px;
                text-align: left;
            }

            .loading-dots {
                display: flex;
                gap: 0.3rem;
            }

            .loading-dots span {
                width: 8px;
                height: 8px;
                background: #00ffff;
                border-radius: 50%;
                animation: dotPulse 1.5s ease-in-out infinite;
            }

            .loading-dots span:nth-child(2) {
                animation-delay: 0.2s;
            }

            .loading-dots span:nth-child(3) {
                animation-delay: 0.4s;
            }

            @keyframes dotPulse {
                0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
                40% { transform: scale(1.2); opacity: 1; }
            }

            .cyber-grid {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1;
                opacity: 0.1;
            }

            .grid-line {
                position: absolute;
                background: linear-gradient(90deg, transparent, #00ffff, transparent);
                height: 1px;
                width: 100%;
                animation: gridMove 4s linear infinite;
            }

            .grid-line:nth-child(1) { top: 20%; animation-delay: 0s; }
            .grid-line:nth-child(2) { top: 40%; animation-delay: 0.8s; }
            .grid-line:nth-child(3) { top: 60%; animation-delay: 1.6s; }
            .grid-line:nth-child(4) { top: 80%; animation-delay: 2.4s; }
            .grid-line:nth-child(5) { top: 100%; animation-delay: 3.2s; }

            @keyframes gridMove {
                0% { transform: translateX(-100%); opacity: 0; }
                50% { opacity: 0.3; }
                100% { transform: translateX(100%); opacity: 0; }
            }

            .cyber-particles {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1;
            }

            .particle {
                position: absolute;
                width: 2px;
                height: 2px;
                background: #00ffff;
                border-radius: 50%;
                animation: particleFloat 6s linear infinite;
            }

            .particle:nth-child(odd) {
                background: #ff00ff;
            }

            @keyframes particleFloat {
                0% {
                    transform: translateY(100vh) translateX(0);
                    opacity: 0;
                }
                10% {
                    opacity: 1;
                }
                90% {
                    opacity: 1;
                }
                100% {
                    transform: translateY(-10px) translateX(200px);
                    opacity: 0;
                }
            }

            /* Individual particle positioning and delays */
            ${Array.from({length: 20}, (_, i) => `
                .particle-${i} {
                    left: ${Math.random() * 100}%;
                    animation-delay: ${Math.random() * 6}s;
                    animation-duration: ${4 + Math.random() * 4}s;
                }
            `).join('')}

            @keyframes pulse {
                0%, 100% { opacity: 0.3; transform: scale(1); }
                50% { opacity: 0.8; transform: scale(1.1); }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(this.loadingElement);

        this.progressBar = this.loadingElement.querySelector('.progress-fill');
        this.progressText = this.loadingElement.querySelector('.progress-text');
        this.statusText = this.loadingElement.querySelector('.status-text');
        this.isVisible = true;
    }

    show() {
        if (!this.loadingElement) {
            this.create();
        }
        this.loadingElement.style.display = 'flex';
        this.isVisible = true;
        this.startLoadingSequence();
    }

    hide() {
        if (this.loadingElement) {
            this.loadingElement.style.opacity = '0';
            setTimeout(() => {
                if (this.loadingElement) {
                    this.loadingElement.style.display = 'none';
                    this.isVisible = false;
                }
            }, 500);
        }
    }

    updateProgress(percent) {
        this.progress = Math.min(100, Math.max(0, percent));
        if (this.progressBar) {
            this.progressBar.style.width = this.progress + '%';
        }
        if (this.progressText) {
            this.progressText.textContent = Math.round(this.progress) + '%';
        }
    }

    updateStatus(message) {
        if (this.statusText) {
            this.statusText.textContent = message;
        }
    }

    startLoadingSequence() {
        let progress = 0;
        let messageIndex = 0;

        const updateSequence = () => {
            if (!this.isVisible) return;

            progress += Math.random() * 15 + 5;
            progress = Math.min(100, progress);

            this.updateProgress(progress);

            if (messageIndex < this.loadingMessages.length && progress > (messageIndex + 1) * 12) {
                this.updateStatus(this.loadingMessages[messageIndex]);
                messageIndex++;
            }

            if (progress < 100) {
                setTimeout(updateSequence, 300 + Math.random() * 700);
            } else {
                setTimeout(() => {
                    this.updateStatus("Launch complete!");
                    setTimeout(() => this.hide(), 1000);
                }, 500);
            }
        };

        updateSequence();
    }
}

// Initialize loading screen
window.loadingScreen = new LoadingScreen();

// Auto-show loading screen when page starts loading
document.addEventListener('DOMContentLoaded', () => {
    window.loadingScreen.show();
});
