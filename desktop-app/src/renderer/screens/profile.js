/**
 * Profile Screen
 */

class ProfileScreen {
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
            <div class="profile-screen">
                <div class="profile-header">
                    <h2><i class="fas fa-user"></i> User Profile</h2>
                    <p>Manage your account and preferences</p>
                </div>
                
                <div class="profile-content">
                    <div class="profile-info">
                        <div class="avatar">
                            <i class="fas fa-user-circle"></i>
                        </div>
                        <div class="user-details">
                            <h3>Security Administrator</h3>
                            <p>admin@cyberforge.ai</p>
                            <p>Last login: 2024-01-22 14:30</p>
                        </div>
                    </div>
                    
                    <div class="profile-settings">
                        <h3>Settings</h3>
                        <div class="setting-item">
                            <label>Email Notifications</label>
                            <input type="checkbox" checked>
                        </div>
                        <div class="setting-item">
                            <label>Real-time Alerts</label>
                            <input type="checkbox" checked>
                        </div>
                        <div class="setting-item">
                            <label>Auto-save Reports</label>
                            <input type="checkbox">
                        </div>
                    </div>
                    
                    <div class="security-settings">
                        <h3>Security</h3>
                        <button class="btn btn-secondary">Change Password</button>
                        <button class="btn btn-secondary">Two-Factor Auth</button>
                        <button class="btn btn-secondary">API Keys</button>
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        // Setup event listeners
    }
}

window.ProfileScreen = ProfileScreen;