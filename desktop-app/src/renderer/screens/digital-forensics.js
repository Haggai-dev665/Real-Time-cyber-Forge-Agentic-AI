/**
 * Digital Forensics Screen
 */

class DigitalForensicsScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        
        this.container.innerHTML = this.createHTML();
        this.initializeComponents();
        
        this.container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
    }

    createHTML() {
        return `
            <div class="digital-forensics-screen">
                <div class="forensics-header">
                    <h2><i class="fas fa-search-plus"></i> Digital Forensics</h2>
                    <p>Advanced digital forensics and incident investigation</p>
                </div>
                
                <div class="forensics-content">
                    <div class="investigation-tools">
                        <button class="tool-btn"><i class="fas fa-hdd"></i> Disk Analysis</button>
                        <button class="tool-btn"><i class="fas fa-memory"></i> Memory Dump</button>
                        <button class="tool-btn"><i class="fas fa-network-wired"></i> Network Forensics</button>
                        <button class="tool-btn"><i class="fas fa-mobile-alt"></i> Mobile Forensics</button>
                    </div>
                    
                    <div class="evidence-timeline">
                        <h3>Evidence Timeline</h3>
                        <div class="timeline-item">
                            <span class="time">14:32:15</span>
                            <span class="event">Suspicious file accessed</span>
                            <span class="source">System Log</span>
                        </div>
                        <div class="timeline-item">
                            <span class="time">14:35:22</span>
                            <span class="event">Network connection established</span>
                            <span class="source">Firewall Log</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        // Setup event listeners
    }
}

window.DigitalForensicsScreen = DigitalForensicsScreen;