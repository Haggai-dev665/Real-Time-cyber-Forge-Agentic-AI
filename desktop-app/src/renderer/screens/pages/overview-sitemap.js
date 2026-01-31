/**
 * Sitemap Pages - Structure, Endpoints, Assets
 * Connected to backend API for real data
 */

// ========================================
// SITEMAP PAGES
// ========================================

class SitemapStructurePage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 30000;
        this.sitemapData = null;
        this.selectedDomain = null;
    }

    createHTML() {
        return `
            <div class="page-content sitemap-structure-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-project-diagram"></i>
                        <h2>Sitemap Structure</h2>
                    </div>
                    <div class="page-actions">
                        <input type="text" id="domain-input" class="caido-input" placeholder="Enter domain to map..." />
                        <button class="caido-btn primary" id="build-sitemap">
                            <i class="fas fa-sitemap"></i> Build Sitemap
                        </button>
                        <button class="caido-btn small" id="export-sitemap">
                            <i class="fas fa-download"></i> Export
                        </button>
                    </div>
                </div>

                <div class="sitemap-container">
                    <div class="sitemap-sidebar">
                        <h4>Discovered Domains</h4>
                        <div class="domain-list" id="domain-list">
                            <div class="loading-placeholder">Loading domains...</div>
                        </div>
                    </div>
                    <div class="sitemap-main">
                        <div class="sitemap-tree" id="sitemap-tree">
                            <div class="empty-state">
                                <i class="fas fa-sitemap"></i>
                                <p>Select a domain or enter one to build sitemap</p>
                            </div>
                        </div>
                    </div>
                    <div class="sitemap-details">
                        <h4>Node Details</h4>
                        <div class="node-details" id="node-details">
                            <div class="empty-state small">
                                <p>Select a node to view details</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('build-sitemap')?.addEventListener('click', () => this.buildSitemap());
        document.getElementById('export-sitemap')?.addEventListener('click', () => this.exportSitemap());
    }

    async loadData() {
        try {
            // Get all requests to extract domains
            const requestsRes = await this.api.getHttpRequests(1, 500);
            if (requestsRes.success) {
                const requests = requestsRes.data?.data?.requests || [];
                const domains = [...new Set(requests.map(r => r.host).filter(Boolean))];
                this.renderDomainList(domains);
            }
        } catch (error) {
            console.error('Failed to load sitemap data:', error);
        }
    }

    renderDomainList(domains) {
        const container = document.getElementById('domain-list');
        if (!container) return;

        if (!domains.length) {
            container.innerHTML = `<div class="empty-state small">No domains captured</div>`;
            return;
        }

        container.innerHTML = domains.map(domain => `
            <div class="domain-item" data-domain="${domain}">
                <i class="fas fa-globe"></i>
                <span>${domain}</span>
            </div>
        `).join('');

        container.querySelectorAll('.domain-item').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.domain-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                this.selectedDomain = item.dataset.domain;
                document.getElementById('domain-input').value = this.selectedDomain;
                this.loadSitemapForDomain(this.selectedDomain);
            });
        });
    }

    async loadSitemapForDomain(domain) {
        const treeContainer = document.getElementById('sitemap-tree');
        treeContainer.innerHTML = `<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Loading sitemap...</div>`;

        try {
            const result = await this.api.get(`/api/sitemap/${encodeURIComponent(domain)}`);
            if (result.success && result.data?.data) {
                this.sitemapData = result.data.data;
                this.renderSitemapTree(this.sitemapData);
            } else {
                // No existing sitemap, offer to build one
                treeContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-sitemap"></i>
                        <p>No sitemap exists for ${domain}</p>
                        <button class="caido-btn primary" onclick="document.getElementById('build-sitemap').click()">
                            Build Sitemap
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            treeContainer.innerHTML = `<div class="error-state">Failed to load sitemap: ${error.message}</div>`;
        }
    }

    async buildSitemap() {
        const domain = document.getElementById('domain-input').value.trim();
        if (!domain) {
            window.showToast?.('warning', 'Domain Required', 'Please enter a domain to map');
            return;
        }

        const treeContainer = document.getElementById('sitemap-tree');
        treeContainer.innerHTML = `<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Building sitemap for ${domain}...</div>`;

        try {
            const result = await this.api.post('/api/sitemap/build', { domain, depth: 3 });
            if (result.success && result.data?.data) {
                this.sitemapData = result.data.data;
                this.renderSitemapTree(this.sitemapData);
                window.showToast?.('success', 'Sitemap Built', `Found ${this.sitemapData.nodes?.length || 0} paths`);
            }
        } catch (error) {
            treeContainer.innerHTML = `<div class="error-state">Failed to build sitemap: ${error.message}</div>`;
            window.showToast?.('error', 'Build Failed', error.message);
        }
    }

    renderSitemapTree(sitemap) {
        const container = document.getElementById('sitemap-tree');
        if (!container) return;

        const nodes = sitemap.nodes || [];
        if (!nodes.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>No paths discovered for ${sitemap.domain}</p>
                </div>
            `;
            return;
        }

        // Build tree structure
        const tree = this.buildTreeStructure(nodes);
        container.innerHTML = `
            <div class="tree-header">
                <span class="domain-root"><i class="fas fa-globe"></i> ${sitemap.domain}</span>
                <span class="tree-stats">${nodes.length} paths</span>
            </div>
            <div class="tree-content">
                ${this.renderTreeNodes(tree, 0)}
            </div>
        `;

        // Add click handlers for tree nodes
        container.querySelectorAll('.tree-node').forEach(node => {
            node.addEventListener('click', (e) => {
                e.stopPropagation();
                container.querySelectorAll('.tree-node').forEach(n => n.classList.remove('selected'));
                node.classList.add('selected');
                this.showNodeDetails(node.dataset.path);
            });
        });
    }

    buildTreeStructure(nodes) {
        const tree = {};
        nodes.forEach(node => {
            const parts = node.path.split('/').filter(Boolean);
            let current = tree;
            parts.forEach((part, index) => {
                if (!current[part]) {
                    current[part] = { _children: {}, _data: null };
                }
                if (index === parts.length - 1) {
                    current[part]._data = node;
                }
                current = current[part]._children;
            });
        });
        return tree;
    }

    renderTreeNodes(tree, level) {
        return Object.entries(tree).map(([name, node]) => {
            const hasChildren = Object.keys(node._children).length > 0;
            const data = node._data || {};
            const path = data.path || `/${name}`;
            
            return `
                <div class="tree-node level-${level}" data-path="${path}">
                    <div class="tree-node-content">
                        <span class="tree-toggle ${hasChildren ? '' : 'hidden'}">
                            <i class="fas fa-chevron-right"></i>
                        </span>
                        <i class="fas ${hasChildren ? 'fa-folder' : 'fa-file'}"></i>
                        <span class="tree-node-name">${name}</span>
                        ${data.requests ? `<span class="tree-node-count">${data.requests}</span>` : ''}
                        ${data.methods?.length ? `
                            <span class="tree-node-methods">
                                ${data.methods.map(m => `<span class="method-mini ${m.toLowerCase()}">${m}</span>`).join('')}
                            </span>
                        ` : ''}
                    </div>
                    ${hasChildren ? `
                        <div class="tree-children">
                            ${this.renderTreeNodes(node._children, level + 1)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    showNodeDetails(path) {
        const node = this.sitemapData?.nodes?.find(n => n.path === path);
        const container = document.getElementById('node-details');
        if (!container) return;

        if (!node) {
            container.innerHTML = `<div class="empty-state small">No details available</div>`;
            return;
        }

        container.innerHTML = `
            <div class="detail-section">
                <label>Path</label>
                <code>${node.path}</code>
            </div>
            <div class="detail-section">
                <label>Request Count</label>
                <span>${node.requests || 0}</span>
            </div>
            <div class="detail-section">
                <label>Methods</label>
                <div class="methods-list">
                    ${(node.methods || []).map(m => `<span class="method-badge ${m.toLowerCase()}">${m}</span>`).join('')}
                </div>
            </div>
            <div class="detail-actions">
                <button class="caido-btn small" onclick="window.pageController.navigateTo('http-requests', {filter: '${node.path}'})">
                    <i class="fas fa-list"></i> View Requests
                </button>
                <button class="caido-btn small" onclick="window.pageController.navigateTo('replay-queue', {path: '${node.path}'})">
                    <i class="fas fa-redo"></i> Replay
                </button>
            </div>
        `;
    }

    async exportSitemap() {
        if (!this.sitemapData) {
            window.showToast?.('warning', 'No Sitemap', 'Build a sitemap first before exporting');
            return;
        }

        const blob = new Blob([JSON.stringify(this.sitemapData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sitemap-${this.sitemapData.domain}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        window.showToast?.('success', 'Exported', 'Sitemap exported successfully');
    }
}

class SitemapEndpointsPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 30000;
        this.endpoints = [];
    }

    createHTML() {
        return `
            <div class="page-content sitemap-endpoints-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-link"></i>
                        <h2>API Endpoints</h2>
                    </div>
                    <div class="page-actions">
                        <input type="text" id="endpoint-search" class="caido-input" placeholder="Search endpoints..." />
                        <select id="endpoint-filter" class="caido-select">
                            <option value="all">All Methods</option>
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                        <button class="caido-btn small" id="refresh-endpoints">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>

                <div class="endpoints-stats">
                    <div class="stat-card">
                        <span class="stat-value" id="total-endpoints">0</span>
                        <span class="stat-label">Total Endpoints</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value" id="unique-hosts">0</span>
                        <span class="stat-label">Unique Hosts</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value" id="api-endpoints">0</span>
                        <span class="stat-label">API Endpoints</span>
                    </div>
                </div>

                <div class="endpoints-table-container">
                    <table class="caido-table sortable" id="endpoints-table">
                        <thead>
                            <tr>
                                <th data-sort="method">Method</th>
                                <th data-sort="host">Host</th>
                                <th data-sort="path">Path</th>
                                <th data-sort="requests">Requests</th>
                                <th data-sort="status">Last Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="endpoints-body">
                            <tr><td colspan="6" class="loading">Loading endpoints...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="endpoints-pagination" id="endpoints-pagination"></div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('refresh-endpoints')?.addEventListener('click', () => this.refresh());
        document.getElementById('endpoint-search')?.addEventListener('input', (e) => this.filterEndpoints(e.target.value));
        document.getElementById('endpoint-filter')?.addEventListener('change', (e) => this.filterByMethod(e.target.value));
    }

    async loadData() {
        try {
            const result = await this.api.getHttpRequests(1, 500);
            if (result.success) {
                const requests = result.data?.data?.requests || [];
                this.endpoints = this.aggregateEndpoints(requests);
                this.updateStats(requests);
                this.renderEndpoints(this.endpoints);
            }
        } catch (error) {
            console.error('Failed to load endpoints:', error);
        }
    }

    aggregateEndpoints(requests) {
        const endpointMap = new Map();
        requests.forEach(req => {
            const key = `${req.method}:${req.host}${req.path}`;
            if (!endpointMap.has(key)) {
                endpointMap.set(key, {
                    method: req.method,
                    host: req.host,
                    path: req.path,
                    count: 0,
                    lastStatus: null,
                    lastTimestamp: null
                });
            }
            const ep = endpointMap.get(key);
            ep.count++;
            if (!ep.lastTimestamp || new Date(req.timestamp) > new Date(ep.lastTimestamp)) {
                ep.lastStatus = req.status;
                ep.lastTimestamp = req.timestamp;
            }
        });
        return Array.from(endpointMap.values()).sort((a, b) => b.count - a.count);
    }

    updateStats(requests) {
        document.getElementById('total-endpoints').textContent = this.endpoints.length;
        document.getElementById('unique-hosts').textContent = [...new Set(requests.map(r => r.host))].length;
        document.getElementById('api-endpoints').textContent = 
            this.endpoints.filter(e => e.path.includes('/api')).length;
    }

    renderEndpoints(endpoints) {
        const tbody = document.getElementById('endpoints-body');
        if (!tbody) return;

        if (!endpoints.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty">No endpoints discovered</td></tr>`;
            return;
        }

        tbody.innerHTML = endpoints.map(ep => `
            <tr>
                <td><span class="method-badge ${ep.method.toLowerCase()}">${ep.method}</span></td>
                <td><code>${ep.host}</code></td>
                <td><code class="path">${ep.path}</code></td>
                <td>${ep.count}</td>
                <td><span class="status-badge status-${Math.floor((ep.lastStatus || 0) / 100)}xx">${ep.lastStatus || '-'}</span></td>
                <td>
                    <button class="caido-btn tiny" onclick="window.pageController.navigateTo('http-requests', {filter: '${ep.path}'})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="caido-btn tiny" onclick="window.pageController.navigateTo('replay-queue', {endpoint: '${ep.method}:${ep.path}'})">
                        <i class="fas fa-redo"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    filterEndpoints(query) {
        const filtered = this.endpoints.filter(ep => 
            ep.path.toLowerCase().includes(query.toLowerCase()) ||
            ep.host.toLowerCase().includes(query.toLowerCase())
        );
        this.renderEndpoints(filtered);
    }

    filterByMethod(method) {
        if (method === 'all') {
            this.renderEndpoints(this.endpoints);
        } else {
            this.renderEndpoints(this.endpoints.filter(ep => ep.method === method));
        }
    }
}

class SitemapAssetsPage extends BasePage {
    constructor() {
        super();
        this.autoRefreshMs = 60000;
        this.assets = [];
    }

    createHTML() {
        return `
            <div class="page-content sitemap-assets-page">
                <div class="page-header">
                    <div class="page-title">
                        <i class="fas fa-cubes"></i>
                        <h2>Discovered Assets</h2>
                    </div>
                    <div class="page-actions">
                        <input type="text" id="asset-search" class="caido-input" placeholder="Search assets..." />
                        <select id="asset-type-filter" class="caido-select">
                            <option value="all">All Types</option>
                            <option value="script">Scripts</option>
                            <option value="style">Stylesheets</option>
                            <option value="image">Images</option>
                            <option value="font">Fonts</option>
                            <option value="document">Documents</option>
                        </select>
                        <button class="caido-btn small" id="refresh-assets">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>

                <div class="assets-overview">
                    <div class="asset-type-card" data-type="script">
                        <i class="fas fa-code"></i>
                        <span class="count" id="script-count">0</span>
                        <span class="label">Scripts</span>
                    </div>
                    <div class="asset-type-card" data-type="style">
                        <i class="fas fa-palette"></i>
                        <span class="count" id="style-count">0</span>
                        <span class="label">Stylesheets</span>
                    </div>
                    <div class="asset-type-card" data-type="image">
                        <i class="fas fa-image"></i>
                        <span class="count" id="image-count">0</span>
                        <span class="label">Images</span>
                    </div>
                    <div class="asset-type-card" data-type="font">
                        <i class="fas fa-font"></i>
                        <span class="count" id="font-count">0</span>
                        <span class="label">Fonts</span>
                    </div>
                    <div class="asset-type-card" data-type="document">
                        <i class="fas fa-file-alt"></i>
                        <span class="count" id="document-count">0</span>
                        <span class="label">Documents</span>
                    </div>
                </div>

                <div class="assets-grid" id="assets-grid">
                    <div class="loading-placeholder">Loading assets...</div>
                </div>
            </div>
        `;
    }

    async initialize() {
        document.getElementById('refresh-assets')?.addEventListener('click', () => this.refresh());
        document.getElementById('asset-search')?.addEventListener('input', (e) => this.filterAssets(e.target.value));
        document.getElementById('asset-type-filter')?.addEventListener('change', (e) => this.filterByType(e.target.value));

        document.querySelectorAll('.asset-type-card').forEach(card => {
            card.addEventListener('click', () => {
                document.getElementById('asset-type-filter').value = card.dataset.type;
                this.filterByType(card.dataset.type);
            });
        });
    }

    async loadData() {
        try {
            const result = await this.api.getHttpRequests(1, 500);
            if (result.success) {
                const requests = result.data?.data?.requests || [];
                this.assets = this.extractAssets(requests);
                this.updateCounts();
                this.renderAssets(this.assets);
            }
        } catch (error) {
            console.error('Failed to load assets:', error);
        }
    }

    extractAssets(requests) {
        const assets = [];
        const seen = new Set();

        requests.forEach(req => {
            const path = req.path || '';
            const type = this.detectAssetType(path);
            const key = `${req.host}${path}`;

            if (type && !seen.has(key)) {
                seen.add(key);
                assets.push({
                    type,
                    host: req.host,
                    path,
                    url: `${req.scheme || 'https'}://${req.host}${path}`,
                    status: req.status,
                    size: req.responseSize || 0,
                    timestamp: req.timestamp
                });
            }
        });

        return assets;
    }

    detectAssetType(path) {
        const lower = path.toLowerCase();
        if (/\.(js|mjs|jsx|ts|tsx)(\?|$)/.test(lower)) return 'script';
        if (/\.(css|scss|sass|less)(\?|$)/.test(lower)) return 'style';
        if (/\.(png|jpg|jpeg|gif|svg|webp|ico|bmp)(\?|$)/.test(lower)) return 'image';
        if (/\.(woff|woff2|ttf|eot|otf)(\?|$)/.test(lower)) return 'font';
        if (/\.(pdf|doc|docx|xls|xlsx|txt|xml|json)(\?|$)/.test(lower)) return 'document';
        return null;
    }

    updateCounts() {
        const counts = { script: 0, style: 0, image: 0, font: 0, document: 0 };
        this.assets.forEach(a => counts[a.type]++);
        
        Object.entries(counts).forEach(([type, count]) => {
            const el = document.getElementById(`${type}-count`);
            if (el) el.textContent = count;
        });
    }

    renderAssets(assets) {
        const container = document.getElementById('assets-grid');
        if (!container) return;

        if (!assets.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-cubes"></i>
                    <p>No assets discovered yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = assets.map(asset => `
            <div class="asset-card ${asset.type}">
                <div class="asset-icon">
                    <i class="fas ${this.getAssetIcon(asset.type)}"></i>
                </div>
                <div class="asset-info">
                    <div class="asset-name" title="${asset.path}">${this.getFileName(asset.path)}</div>
                    <div class="asset-host">${asset.host}</div>
                    <div class="asset-meta">
                        <span class="asset-size">${this.formatBytes(asset.size)}</span>
                        <span class="asset-status">${asset.status || '-'}</span>
                    </div>
                </div>
                <div class="asset-actions">
                    <button class="caido-btn tiny" onclick="window.open('${asset.url}', '_blank')">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    getAssetIcon(type) {
        const icons = {
            script: 'fa-code',
            style: 'fa-palette',
            image: 'fa-image',
            font: 'fa-font',
            document: 'fa-file-alt'
        };
        return icons[type] || 'fa-file';
    }

    getFileName(path) {
        const parts = path.split('/');
        return parts[parts.length - 1].split('?')[0] || path;
    }

    filterAssets(query) {
        const filtered = this.assets.filter(a => 
            a.path.toLowerCase().includes(query.toLowerCase()) ||
            a.host.toLowerCase().includes(query.toLowerCase())
        );
        this.renderAssets(filtered);
    }

    filterByType(type) {
        if (type === 'all') {
            this.renderAssets(this.assets);
        } else {
            this.renderAssets(this.assets.filter(a => a.type === type));
        }
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.SitemapStructurePage = SitemapStructurePage;
    window.SitemapEndpointsPage = SitemapEndpointsPage;
    window.SitemapAssetsPage = SitemapAssetsPage;
}
