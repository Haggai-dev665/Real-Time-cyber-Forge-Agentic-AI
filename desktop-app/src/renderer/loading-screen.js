/**
 * CyberForge — Advanced Loading Screen v3
 * Uses --cf-* design tokens. No hardcoded colors.
 * Teal/cyan brand (#F69D39). No purple/neon.
 */
class LoadingScreen {
    constructor() {
        this.loadingElement = null;
        this.progressBar    = null;
        this.progressText   = null;
        this.statusText     = null;
        this.isVisible      = false;
        this.progress       = 0;
        this.loadingMessages = [
            'Initializing security engine…',
            'Connecting to backend…',
            'Loading ML models…',
            'Starting AI agents…',
            'Syncing threat intelligence…',
            'Calibrating anomaly detectors…',
            'Activating real-time monitor…',
            'Ready.'
        ];
        this.currentMessageIndex = 0;
    }

    create() {
        this.loadingElement = document.createElement('div');
        this.loadingElement.id = 'cyberforge-loading-v3';

        this.loadingElement.innerHTML = `
            <div class="cfls-backdrop"></div>
            <div class="cfls-scan-bar"></div>
            <div class="cfls-particles" aria-hidden="true">
                ${Array.from({length:12}, (_,i)=>`<div class="cfls-particle cfls-p${i}"></div>`).join('')}
            </div>
            <div class="cfls-center">
                <!-- Logo -->
                <div class="cfls-logo-wrap">
                    <div class="cfls-ring cfls-ring-outer"></div>
                    <div class="cfls-ring cfls-ring-inner"></div>
                    <div class="cfls-shield-icon">
                        <i class="fas fa-shield-halved"></i>
                    </div>
                </div>

                <!-- Brand -->
                <div class="cfls-brand">
                    <span class="cfls-brand-cyber">Cyber</span><span class="cfls-brand-forge">Forge</span>
                </div>
                <div class="cfls-tagline">Agentic AI Security Platform</div>

                <!-- Progress -->
                <div class="cfls-progress-wrap">
                    <div class="cfls-progress-track">
                        <div class="cfls-progress-fill"></div>
                        <div class="cfls-progress-glow"></div>
                    </div>
                    <div class="cfls-progress-pct">0%</div>
                </div>

                <!-- Status -->
                <div class="cfls-status">
                    <span class="cfls-status-dot"></span>
                    <span class="cfls-status-text">Initializing…</span>
                </div>

                <!-- Feature badges -->
                <div class="cfls-badges">
                    <span class="cfls-badge"><i class="fas fa-shield-halved"></i> Threat Detection</span>
                    <span class="cfls-badge"><i class="fas fa-brain"></i> AI Orchestrator</span>
                    <span class="cfls-badge"><i class="fas fa-network-wired"></i> Real-Time Feed</span>
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            /* ─────── CyberForge Loader v3 ─────── */
            #cyberforge-loading-v3 {
                position: fixed; inset: 0; z-index: 99998;
                display: flex; align-items: center; justify-content: center;
                font-family: 'Roboto', 'Inter', system-ui, sans-serif;
                -webkit-user-select: none; user-select: none;
                overflow: hidden;
            }
            #cyberforge-loading-v3 * { box-sizing: border-box; margin: 0; padding: 0; }

            /* Background */
            .cfls-backdrop {
                position: absolute; inset: 0;
                background: var(--cf-bg-app, #0B0908);
            }

            /* Grid overlay */
            .cfls-backdrop::after {
                content: '';
                position: absolute; inset: -100%;
                width: 300%; height: 300%;
                background:
                    repeating-linear-gradient(0deg,   transparent 0, transparent 59px, rgba(246,157,57,.025) 59px, rgba(246,157,57,.025) 60px),
                    repeating-linear-gradient(90deg,  transparent 0, transparent 59px, rgba(246,157,57,.025) 59px, rgba(246,157,57,.025) 60px);
                animation: cflsGridDrift 40s linear infinite;
            }
            @keyframes cflsGridDrift { to { transform: translate(60px,60px); } }

            /* Radial glow */
            .cfls-backdrop::before {
                content: '';
                position: absolute; inset: 0;
                background: radial-gradient(600px circle at 50% 45%, rgba(246,157,57,.07), transparent 65%);
            }

            /* Scanning bar */
            .cfls-scan-bar {
                position: absolute; left:0; right:0; height:1px;
                background: linear-gradient(90deg, transparent, rgba(246,157,57,.3), transparent);
                z-index: 2; pointer-events: none;
                animation: cflsScanDown 4s ease-in-out infinite;
                opacity: .7;
            }
            @keyframes cflsScanDown { 0% { top: -2px; } 100% { top: 100%; } }

            /* Particles */
            .cfls-particles { position:absolute; inset:0; z-index:1; pointer-events:none; }
            .cfls-particle {
                position: absolute; width:2px; height:2px;
                background: var(--cf-interactive-default, #F69D39);
                border-radius: 50%; opacity:0;
                animation: cflsParticle 5s ease-in-out infinite;
            }
            @keyframes cflsParticle {
                0%,100%{ opacity:0; transform:translateY(0) scale(.5); }
                50%    { opacity:.5; transform:translateY(-22px) scale(1); }
            }
            .cfls-p0 { top:18%;left:12%;animation-delay:0s; }
            .cfls-p1 { top:72%;left:82%;animation-delay:.5s; }
            .cfls-p2 { top:38%;left:92%;animation-delay:1.1s; }
            .cfls-p3 { top:82%;left:22%;animation-delay:1.7s; }
            .cfls-p4 { top:10%;left:62%;animation-delay:2.3s; }
            .cfls-p5 { top:55%;left:8%; animation-delay:.8s; }
            .cfls-p6 { top:30%;left:48%;animation-delay:1.5s; }
            .cfls-p7 { top:88%;left:58%;animation-delay:2.1s; }
            .cfls-p8 { top:62%;left:40%;animation-delay:0.3s; }
            .cfls-p9 { top:20%;left:75%;animation-delay:2.8s; }
            .cfls-p10{ top:45%;left:26%;animation-delay:1.9s; }
            .cfls-p11{ top:78%;left:70%;animation-delay:3.2s; }

            /* Center container */
            .cfls-center {
                position: relative; z-index:10;
                display:flex; flex-direction:column; align-items:center; gap:0;
                animation: cflsFadeIn .7s ease-out .1s both;
            }
            @keyframes cflsFadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }

            /* Logo */
            .cfls-logo-wrap {
                position:relative; width:110px; height:110px;
                display:flex; align-items:center; justify-content:center;
                margin-bottom:22px;
            }
            .cfls-ring {
                position:absolute; border-radius:50%;
                border:1.5px solid transparent;
            }
            .cfls-ring-outer {
                inset:-14px;
                border-top-color: var(--cf-interactive-default, #F69D39);
                border-right-color: rgba(246,157,57,.2);
                opacity:.5;
                animation: cflsSpin 3s linear infinite;
            }
            .cfls-ring-inner {
                inset:-5px;
                border-bottom-color: var(--cf-status-info, #5E7A88);
                border-left-color: rgba(94,122,136,.15);
                opacity:.5;
                animation: cflsSpin 2s linear infinite reverse;
            }
            @keyframes cflsSpin { to { transform:rotate(360deg); } }

            .cfls-shield-icon {
                width:110px; height:110px; border-radius:24px;
                background: var(--cf-surface-1, #1A1516);
                border: 1px solid rgba(246,157,57,.15);
                display:flex; align-items:center; justify-content:center;
                box-shadow: 0 0 40px rgba(246,157,57,.12);
                animation: cflsLogoPulse 3s ease-in-out infinite;
            }
            @keyframes cflsLogoPulse {
                0%,100%{ box-shadow:0 0 30px rgba(246,157,57,.1); }
                50%    { box-shadow:0 0 55px rgba(246,157,57,.22); }
            }
            .cfls-shield-icon i {
                font-size:2.5rem;
                color: var(--cf-interactive-default, #F69D39);
                filter: drop-shadow(0 0 8px rgba(246,157,57,.5));
            }

            /* Brand text */
            .cfls-brand {
                font-family:'Space Grotesk','Roboto',sans-serif;
                font-size:1.9rem; font-weight:700;
                letter-spacing:.06em; margin-bottom:4px;
            }
            .cfls-brand-cyber { color: var(--cf-text-primary, #E2DBCD); }
            .cfls-brand-forge { color: var(--cf-interactive-default, #F69D39); }

            .cfls-tagline {
                font-size:.72rem; letter-spacing:.12em; text-transform:uppercase; font-weight:400;
                color: var(--cf-text-muted, #756E66);
                margin-bottom:36px;
                font-family:'Roboto Mono',monospace;
            }

            /* Progress */
            .cfls-progress-wrap {
                display:flex; flex-direction:column; align-items:center; gap:6px;
                width:260px; margin-bottom:14px;
            }
            .cfls-progress-track {
                width:100%; height:3px;
                background: rgba(255,255,255,.07); border-radius:3px; overflow:hidden;
                position:relative;
            }
            .cfls-progress-fill {
                height:100%; width:0%;
                background: var(--cf-interactive-default, #F69D39);
                border-radius:3px; transition:width .35s ease-out;
                position:relative;
            }
            .cfls-progress-fill::after {
                content:''; position:absolute;
                right:0; top:50%; transform:translateY(-50%);
                width:8px; height:8px; border-radius:50%;
                background: var(--cf-interactive-default, #F69D39);
                box-shadow: 0 0 8px var(--cf-interactive-default, #F69D39);
            }
            .cfls-progress-pct {
                font-size:.7rem; font-family:'Roboto Mono',monospace; font-weight:500;
                color: var(--cf-interactive-default, #F69D39);
            }

            /* Status */
            .cfls-status {
                display:flex; align-items:center; gap:7px;
                margin-bottom:22px;
            }
            .cfls-status-dot {
                width:6px; height:6px; border-radius:50%;
                background: var(--cf-interactive-default, #F69D39);
                animation: cflsDotPulse 1.8s ease-in-out infinite;
            }
            @keyframes cflsDotPulse {
                0%,100%{ opacity:1; transform:scale(1); }
                50%    { opacity:.4; transform:scale(.8); }
            }
            .cfls-status-text {
                font-size:.72rem; font-family:'Roboto Mono',monospace;
                color: var(--cf-text-secondary, #9A9182); letter-spacing:.05em;
                min-width:240px; text-align:center;
            }

            /* Feature badges */
            .cfls-badges {
                display:flex; gap:8px; flex-wrap:wrap; justify-content:center;
            }
            .cfls-badge {
                display:flex; align-items:center; gap:5px;
                padding:4px 10px; border-radius:99px;
                border:1px solid rgba(246,157,57,.15);
                background: rgba(246,157,57,.04);
                font-size:.68rem; color: var(--cf-text-secondary, #9A9182);
                font-family:'Roboto',sans-serif;
                animation: cflsFadeIn .7s ease-out both;
            }
            .cfls-badge:nth-child(1){ animation-delay:.3s; }
            .cfls-badge:nth-child(2){ animation-delay:.5s; }
            .cfls-badge:nth-child(3){ animation-delay:.7s; }
            .cfls-badge i { color: var(--cf-interactive-default, #F69D39); font-size:.65rem; }
        `;

        document.head.appendChild(style);
        document.body.appendChild(this.loadingElement);

        this.progressBar  = this.loadingElement.querySelector('.cfls-progress-fill');
        this.progressText = this.loadingElement.querySelector('.cfls-progress-pct');
        this.statusText   = this.loadingElement.querySelector('.cfls-status-text');
        this.isVisible    = true;
    }

    show() {
        if (!this.loadingElement) this.create();
        this.loadingElement.style.display = 'flex';
        this.isVisible = true;
        this.startLoadingSequence();
    }

    hide() {
        if (!this.loadingElement) return;
        var el = this.loadingElement;
        el.style.transition = 'opacity .5s ease';
        el.style.opacity = '0';
        setTimeout(function () {
            el.style.display = 'none';
        }, 520);
        this.isVisible = false;
    }

    updateProgress(percent) {
        this.progress = Math.min(100, Math.max(0, percent));
        if (this.progressBar)  this.progressBar.style.width  = this.progress + '%';
        if (this.progressText) this.progressText.textContent = Math.round(this.progress) + '%';
    }

    updateStatus(message) {
        if (this.statusText) this.statusText.textContent = message;
    }

    startLoadingSequence() {
        var self = this;
        var progress = 0;
        var messageIndex = 0;

        (function tick() {
            if (!self.isVisible) return;
            progress = Math.min(100, progress + Math.random() * 14 + 5);
            self.updateProgress(progress);

            if (messageIndex < self.loadingMessages.length &&
                progress > (messageIndex + 1) * 12) {
                self.updateStatus(self.loadingMessages[messageIndex]);
                messageIndex++;
            }

            if (progress < 100) {
                setTimeout(tick, 280 + Math.random() * 550);
            } else {
                self.updateStatus('Ready.');
                setTimeout(function () { self.hide(); }, 800);
            }
        })();
    }
}

window.loadingScreen = new LoadingScreen();

document.addEventListener('DOMContentLoaded', function () {
    window.loadingScreen.show();
});
