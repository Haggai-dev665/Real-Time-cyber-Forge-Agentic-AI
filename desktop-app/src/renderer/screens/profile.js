/**
 * Profile Screen
 * User profile management, security settings, and account configuration
 */

class ProfileScreen {
    constructor() {
        this.container = null;
        this.isActive = false;
        this.profile = {};
        this.activeSection = 'profile';
    }

    async show(container, options = {}) {
        this.container = container;
        this.isActive = true;
        container.innerHTML = this.createHTML();
        this.initializeComponents();
        await this.loadProfile();
        container.classList.add('screen-enter');
    }

    hide() {
        this.isActive = false;
    }

    createHTML() {
        return `
            <div class="profile-screen" style="padding:var(--space-lg); display:flex; flex-direction:column; gap:var(--space-lg); overflow-y:auto; height:100%;">
                <!-- Header -->
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--space-md);">
                    <div>
                        <h2 style="font-size:var(--text-2xl); font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:var(--space-sm);">
                            <i class="fas fa-user-circle" style="color:var(--primary);"></i>
                            User Profile
                        </h2>
                        <p style="color:var(--text-muted); margin-top:4px;">Manage your account, security settings, and preferences</p>
                    </div>
                </div>

                <!-- Profile Hero -->
                <div style="background:linear-gradient(135deg, var(--bg-card), #1a0a2e); border:1px solid var(--primary)33; border-radius:var(--radius-lg); padding:var(--space-xl); display:flex; align-items:center; gap:var(--space-xl); flex-wrap:wrap;">
                    <div style="position:relative; flex-shrink:0;">
                        <div style="width:80px; height:80px; border-radius:50%; background:linear-gradient(135deg, var(--primary), var(--accent)); display:flex; align-items:center; justify-content:center; font-size:2rem; color:white; font-weight:700;">
                            SA
                        </div>
                        <div style="position:absolute; bottom:2px; right:2px; width:16px; height:16px; border-radius:50%; background:var(--success); border:2px solid var(--bg-card);"></div>
                    </div>
                    <div style="flex:1;">
                        <h3 id="profile-name" style="font-size:var(--text-xl); font-weight:700; color:var(--text-primary);">Security Administrator</h3>
                        <p id="profile-email" style="color:var(--text-secondary); margin-top:2px;">admin@cyberforge.ai</p>
                        <div style="display:flex; gap:var(--space-sm); margin-top:var(--space-sm); flex-wrap:wrap;">
                            <span style="background:var(--primary)22; color:var(--primary); padding:2px 8px; border-radius:99px; font-size:var(--text-xs); font-weight:600;">ADMINISTRATOR</span>
                            <span style="background:var(--success)22; color:var(--success); padding:2px 8px; border-radius:99px; font-size:var(--text-xs);">● Active</span>
                            <span style="background:var(--bg-secondary); color:var(--text-muted); padding:2px 8px; border-radius:99px; font-size:var(--text-xs);">MFA Enabled</span>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:var(--space-md); min-width:300px;">
                        ${[
                            { label:'Threats Analyzed', val:'2,847' },
                            { label:'Incidents Handled', val:'34' },
                            { label:'Days Active', val:'182' },
                        ].map(s => `
                            <div style="text-align:center; background:var(--bg-secondary)88; border-radius:var(--radius-md); padding:var(--space-md);">
                                <div style="font-size:var(--text-xl); font-weight:700; color:var(--primary);">${s.val}</div>
                                <div style="font-size:var(--text-xs); color:var(--text-muted); margin-top:2px;">${s.label}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Content Tabs -->
                <div style="display:flex; border-bottom:2px solid var(--border-color);">
                    ${[
                        { id:'profile', label:'Profile Info', icon:'user' },
                        { id:'security', label:'Security', icon:'shield-alt' },
                        { id:'notifications', label:'Notifications', icon:'bell' },
                        { id:'api-keys', label:'API Keys', icon:'key' },
                        { id:'activity', label:'Activity Log', icon:'history' },
                    ].map(t => `
                        <button id="tab-${t.id}" onclick="window._profileScreen?.switchTab('${t.id}')" 
                                style="padding:var(--space-sm) var(--space-md); border:none; background:none; cursor:pointer; font-size:var(--text-sm); font-weight:500; color:var(--text-muted); border-bottom:2px solid transparent; margin-bottom:-2px; display:flex; align-items:center; gap:6px; transition:all var(--transition-fast);"
                                onmouseenter="this.style.color='var(--text-primary)'"
                                onmouseleave="if(this.dataset.active !== 'true') this.style.color='var(--text-muted)'"
                                ${t.id === 'profile' ? 'data-active="true"' : ''}>
                            <i class="fas fa-${t.icon}"></i> ${t.label}
                        </button>
                    `).join('')}
                </div>

                <!-- Tab Content -->
                <div id="profile-tab-content">
                    <!-- Populated by switchTab -->
                </div>
            </div>
        `;
    }

    initializeComponents() {
        window._profileScreen = this;
        this.switchTab('profile');
    }

    async loadProfile() {
        const api = window.cyberforgeAPI || window.apiClient;
        try {
            if (api) {
                const userId = window.CyberForgeApp?.resolveCurrentUserId?.();
                if (userId) {
                    const result = await api.getUserProfile?.(userId);
                    if (result?.success && result.data) {
                        const data = result.data;
                        const nameEl = document.getElementById('profile-name');
                        const emailEl = document.getElementById('profile-email');
                        if (nameEl && data.name) nameEl.textContent = data.name;
                        if (emailEl && data.email) emailEl.textContent = data.email;
                    }
                }
            }
        } catch (e) { /* fallback */ }
    }

    switchTab(tabId) {
        this.activeSection = tabId;
        document.querySelectorAll('[id^="tab-"]').forEach(btn => {
            const active = btn.id === `tab-${tabId}`;
            btn.dataset.active = active ? 'true' : 'false';
            btn.style.color = active ? 'var(--primary)' : 'var(--text-muted)';
            btn.style.borderBottomColor = active ? 'var(--primary)' : 'transparent';
        });

        const content = document.getElementById('profile-tab-content');
        if (!content) return;

        const tabContents = {
            profile: this.renderProfileTab(),
            security: this.renderSecurityTab(),
            notifications: this.renderNotificationsTab(),
            'api-keys': this.renderAPIKeysTab(),
            activity: this.renderActivityTab(),
        };
        content.innerHTML = tabContents[tabId] || '';
    }

    renderProfileTab() {
        return `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-lg);">
                <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                    <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">Personal Information</h3>
                    <div style="display:flex; flex-direction:column; gap:var(--space-md);">
                        ${[
                            { label:'Full Name', id:'p-name', value:'Security Administrator', type:'text' },
                            { label:'Email Address', id:'p-email', value:'admin@cyberforge.ai', type:'email' },
                            { label:'Job Title', id:'p-title', value:'Chief Security Officer', type:'text' },
                            { label:'Department', id:'p-dept', value:'Security Operations', type:'text' },
                            { label:'Phone', id:'p-phone', value:'+1 (555) 000-0000', type:'tel' },
                        ].map(f => `
                            <div>
                                <label style="display:block; font-size:var(--text-xs); font-weight:600; color:var(--text-muted); margin-bottom:4px; text-transform:uppercase;">${f.label}</label>
                                <input type="${f.type}" class="form-control" id="${f.id}" value="${f.value}" />
                            </div>
                        `).join('')}
                        <button class="btn btn-primary" onclick="window._profileScreen?.saveProfile()" style="margin-top:var(--space-sm);">
                            <i class="fas fa-save"></i> Save Changes
                        </button>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:var(--space-md);">
                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                        <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">Preferences</h3>
                        ${[
                            { label:'Theme', type:'select', options:['Dark','Light','System'] },
                            { label:'Language', type:'select', options:['English','Spanish','French','German'] },
                            { label:'Timezone', type:'select', options:['UTC','EST','PST','GMT'] },
                        ].map(p => `
                            <div style="margin-bottom:var(--space-md);">
                                <label style="display:block; font-size:var(--text-xs); font-weight:600; color:var(--text-muted); margin-bottom:4px; text-transform:uppercase;">${p.label}</label>
                                <select class="form-control">
                                    ${p.options.map(o => `<option>${o}</option>`).join('')}
                                </select>
                            </div>
                        `).join('')}
                    </div>
                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                        <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">Account Info</h3>
                        ${[
                            { label:'Account Created', val:'August 15, 2023' },
                            { label:'Last Login', val:'January 22, 2024 14:30' },
                            { label:'Login Location', val:'San Francisco, CA, USA' },
                            { label:'Account Type', val:'Enterprise Administrator' },
                        ].map(i => `
                            <div style="display:flex; justify-content:space-between; padding:var(--space-xs) 0; border-bottom:1px solid var(--border-color);">
                                <span style="font-size:var(--text-sm); color:var(--text-muted);">${i.label}</span>
                                <span style="font-size:var(--text-sm); color:var(--text-secondary); font-weight:500;">${i.val}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderSecurityTab() {
        return `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-lg);">
                <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                    <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">Password</h3>
                    <div style="display:flex; flex-direction:column; gap:var(--space-md);">
                        ${['Current Password','New Password','Confirm New Password'].map(l => `
                            <div>
                                <label style="display:block; font-size:var(--text-xs); font-weight:600; color:var(--text-muted); margin-bottom:4px; text-transform:uppercase;">${l}</label>
                                <input type="password" class="form-control" placeholder="••••••••" />
                            </div>
                        `).join('')}
                        <button class="btn btn-primary" onclick="alert('Password updated successfully!')">
                            <i class="fas fa-lock"></i> Update Password
                        </button>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:var(--space-md);">
                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                        <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">Two-Factor Authentication</h3>
                        <div style="display:flex; align-items:center; gap:var(--space-md); padding:var(--space-md); background:var(--success)11; border:1px solid var(--success)33; border-radius:var(--radius-md); margin-bottom:var(--space-md);">
                            <i class="fas fa-check-circle" style="color:var(--success); font-size:1.5rem;"></i>
                            <div>
                                <div style="font-weight:600; color:var(--text-primary);">MFA is enabled</div>
                                <div style="font-size:var(--text-xs); color:var(--text-muted);">Using Authenticator App</div>
                            </div>
                        </div>
                        <button class="btn btn-secondary" onclick="alert('Opening MFA settings...')">
                            <i class="fas fa-cog"></i> Manage MFA
                        </button>
                    </div>
                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                        <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">Active Sessions</h3>
                        ${[
                            { device:'Chrome on MacBook Pro', location:'San Francisco, CA', current:true },
                            { device:'CyberForge Desktop App', location:'San Francisco, CA', current:false },
                        ].map(s => `
                            <div style="display:flex; align-items:center; justify-content:space-between; padding:var(--space-sm) 0; border-bottom:1px solid var(--border-color);">
                                <div>
                                    <div style="font-size:var(--text-sm); color:var(--text-primary);">${s.device} ${s.current ? '<span style="background:var(--success)22; color:var(--success); padding:1px 6px; border-radius:99px; font-size:10px; margin-left:4px;">Current</span>' : ''}</div>
                                    <div style="font-size:var(--text-xs); color:var(--text-muted);">${s.location}</div>
                                </div>
                                ${!s.current ? '<button class="btn btn-sm btn-danger" onclick="alert(\'Session revoked\')"><i class="fas fa-times"></i></button>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderNotificationsTab() {
        const settings = [
            { group:'Security Alerts', items:[
                { label:'Critical Threat Alerts', desc:'Immediate notification for critical security events', val:true },
                { label:'Vulnerability Discoveries', desc:'New CVEs affecting your systems', val:true },
                { label:'Compliance Violations', desc:'Compliance control failures', val:true },
                { label:'Anomaly Detection', desc:'Behavioral anomalies detected by AI', val:false },
            ]},
            { group:'System Notifications', items:[
                { label:'ML Model Updates', desc:'When models are retrained or updated', val:true },
                { label:'Scheduled Report Delivery', desc:'When scheduled reports are generated', val:true },
                { label:'System Health Alerts', desc:'Infrastructure or performance issues', val:false },
            ]},
        ];

        return `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-lg);">
                ${settings.map(group => `
                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                        <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">${group.group}</h3>
                        <div style="display:flex; flex-direction:column; gap:var(--space-md);">
                            ${group.items.map(item => `
                                <div style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-md);">
                                    <div>
                                        <div style="font-size:var(--text-sm); font-weight:500; color:var(--text-primary);">${item.label}</div>
                                        <div style="font-size:var(--text-xs); color:var(--text-muted);">${item.desc}</div>
                                    </div>
                                    <div onclick="this.classList.toggle('on'); this.querySelector('div').style.left = this.classList.contains('on') ? '18px' : '2px'; this.style.background = this.classList.contains('on') ? 'var(--success)' : 'var(--bg-secondary)'"
                                         style="width:36px; height:20px; border-radius:99px; background:${item.val ? 'var(--success)' : 'var(--bg-secondary)'}; border:1px solid var(--border-color); position:relative; cursor:pointer; flex-shrink:0; ${item.val ? 'class:on' : ''}">
                                        <div style="width:14px; height:14px; border-radius:50%; background:white; position:absolute; top:2px; left:${item.val ? '18px' : '2px'}; transition:left 0.2s;"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderAPIKeysTab() {
        return `
            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-md);">
                    <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary);">API Keys</h3>
                    <button class="btn btn-primary btn-sm" onclick="alert('Creating new API key...')">
                        <i class="fas fa-plus"></i> New Key
                    </button>
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:var(--text-sm);">
                        <thead>
                            <tr style="border-bottom:2px solid var(--border-color);">
                                <th style="padding:var(--space-sm) var(--space-md); text-align:left; color:var(--text-muted); font-weight:600;">Name</th>
                                <th style="padding:var(--space-sm) var(--space-md); text-align:left; color:var(--text-muted); font-weight:600;">Key</th>
                                <th style="padding:var(--space-sm) var(--space-md); text-align:left; color:var(--text-muted); font-weight:600;">Permissions</th>
                                <th style="padding:var(--space-sm) var(--space-md); text-align:left; color:var(--text-muted); font-weight:600;">Last Used</th>
                                <th style="padding:var(--space-sm) var(--space-md); text-align:center; color:var(--text-muted); font-weight:600;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${[
                                { name:'Production API', key:'cf_prod_••••••••••••••••XXXX', perms:'Read/Write', lastUsed:'2024-01-22' },
                                { name:'Dashboard Integration', key:'cf_dash_••••••••••••••••XXXX', perms:'Read Only', lastUsed:'2024-01-21' },
                                { name:'SIEM Integration', key:'cf_siem_••••••••••••••••XXXX', perms:'Read/Write/Admin', lastUsed:'2024-01-20' },
                            ].map(k => `
                                <tr style="border-bottom:1px solid var(--border-color);"
                                    onmouseenter="this.style.background='var(--bg-hover)'"
                                    onmouseleave="this.style.background=''">
                                    <td style="padding:var(--space-sm) var(--space-md); font-weight:500; color:var(--text-primary);">${k.name}</td>
                                    <td style="padding:var(--space-sm) var(--space-md); font-family:var(--font-mono); font-size:var(--text-xs); color:var(--text-muted);">${k.key}</td>
                                    <td style="padding:var(--space-sm) var(--space-md); color:var(--text-secondary);">${k.perms}</td>
                                    <td style="padding:var(--space-sm) var(--space-md); color:var(--text-muted);">${k.lastUsed}</td>
                                    <td style="padding:var(--space-sm) var(--space-md); text-align:center;">
                                        <button class="btn btn-sm btn-secondary" onclick="alert('Copying key...')" title="Copy"><i class="fas fa-copy"></i></button>
                                        <button class="btn btn-sm btn-danger" onclick="alert('Revoking key...')" title="Revoke"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderActivityTab() {
        const activities = [
            { time:'2024-01-22 14:30', action:'Login', details:'Successful login from Chrome browser', icon:'sign-in-alt', color:'var(--success)' },
            { time:'2024-01-22 12:15', action:'Report Generated', details:'Weekly Threat Summary report generated', icon:'file-alt', color:'var(--primary)' },
            { time:'2024-01-22 10:00', action:'Setting Changed', details:'Email notification preferences updated', icon:'cog', color:'var(--info)' },
            { time:'2024-01-21 16:45', action:'Incident Closed', details:'Incident INC-2024-007 marked as resolved', icon:'check-circle', color:'var(--success)' },
            { time:'2024-01-21 14:30', action:'API Key Created', details:'New API key "SIEM Integration" created', icon:'key', color:'var(--warning)' },
            { time:'2024-01-21 09:00', action:'Login', details:'Successful login from Desktop App', icon:'sign-in-alt', color:'var(--success)' },
            { time:'2024-01-20 18:30', action:'Scan Initiated', details:'Full vulnerability scan initiated on network range 192.168.0.0/24', icon:'search', color:'var(--primary)' },
        ];
        return `
            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:var(--space-lg);">
                <h3 style="font-size:var(--text-base); font-weight:600; color:var(--text-primary); margin-bottom:var(--space-md);">Recent Activity</h3>
                <div style="position:relative; padding-left:var(--space-xl);">
                    <div style="position:absolute; left:12px; top:0; bottom:0; width:2px; background:var(--border-color);"></div>
                    ${activities.map(a => `
                        <div style="position:relative; margin-bottom:var(--space-md);">
                            <div style="position:absolute; left:-24px; top:4px; width:12px; height:12px; border-radius:50%; background:${a.color}; border:2px solid var(--bg-card);"></div>
                            <div style="background:var(--bg-secondary); border-radius:var(--radius-md); padding:var(--space-sm) var(--space-md);">
                                <div style="display:flex; align-items:center; gap:var(--space-sm); margin-bottom:2px;">
                                    <i class="fas fa-${a.icon}" style="color:${a.color}; font-size:var(--text-xs);"></i>
                                    <span style="font-size:var(--text-sm); font-weight:500; color:var(--text-primary);">${a.action}</span>
                                    <span style="margin-left:auto; font-size:var(--text-xs); color:var(--text-muted);">${a.time}</span>
                                </div>
                                <div style="font-size:var(--text-xs); color:var(--text-secondary);">${a.details}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    saveProfile() {
        const name = document.getElementById('p-name')?.value;
        const email = document.getElementById('p-email')?.value;
        const nameEl = document.getElementById('profile-name');
        const emailEl = document.getElementById('profile-email');
        if (nameEl && name) nameEl.textContent = name;
        if (emailEl && email) emailEl.textContent = email;
        alert('Profile saved successfully!');
    }
}

window.ProfileScreen = ProfileScreen;
