/**
 * Enhanced Web Search and Location Mapping Component
 * Provides real web search capabilities with geolocation mapping
 */

class WebSearchManager {
    constructor() {
        this.map = null;
        this.searchResults = [];
        this.locationMarkers = [];
        this.searchHistory = [];
        this.init();
    }

    init() {
        this.initializeLeafletMap();
        this.setupSearchEventListeners();
        this.loadSearchHistory();
    }

    initializeLeafletMap() {
        // Initialize Leaflet map in the designated container
        const mapContainer = document.getElementById('location-map');
        if (mapContainer) {
            this.map = L.map('location-map').setView([51.505, -0.09], 2);
            
            // Add OpenStreetMap tiles (free alternative to Google Maps)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);

            // Add dark theme for cybersecurity aesthetic
            this.addDarkMapTheme();
        }
    }

    addDarkMapTheme() {
        // Add CartoDB Dark Matter tiles for better aesthetic
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors © CARTO',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);
    }

    setupSearchEventListeners() {
        const webSearchInput = document.getElementById('web-search-input');
        const webSearchBtn = document.getElementById('web-search-btn');
        const searchResultsContainer = document.getElementById('search-results');

        if (webSearchInput) {
            webSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performWebSearch(e.target.value);
                }
            });
        }

        if (webSearchBtn) {
            webSearchBtn.addEventListener('click', () => {
                this.performWebSearch(webSearchInput.value);
            });
        }
    }

    async performWebSearch(query) {
        if (!query.trim()) return;

        this.showSearchLoading(true);
        
        try {
            // Use DuckDuckGo Instant Answer API for free web search
            const searchResults = await this.searchWithDuckDuckGo(query);
            
            // Also search for domain-specific results
            const domainResults = await this.searchDomains(query);
            
            // Combine and display results
            const combinedResults = [...searchResults, ...domainResults];
            this.displaySearchResults(combinedResults);
            
            // Get geolocation data for domains found
            await this.geolocateSearchResults(combinedResults);
            
            // Add to search history
            this.addToSearchHistory(query, combinedResults.length);
            
        } catch (error) {
            console.error('Search error:', error);
            this.showSearchError('Search failed. Please try again.');
        } finally {
            this.showSearchLoading(false);
        }
    }

    async searchWithDuckDuckGo(query) {
        try {
            // DuckDuckGo Instant Answer API
            const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
            const data = await response.json();
            
            const results = [];
            
            // Process instant answer
            if (data.Answer) {
                results.push({
                    type: 'instant',
                    title: 'Instant Answer',
                    content: data.Answer,
                    url: data.AnswerURL || '#',
                    source: 'DuckDuckGo'
                });
            }

            // Process related topics
            if (data.RelatedTopics && data.RelatedTopics.length > 0) {
                data.RelatedTopics.slice(0, 5).forEach(topic => {
                    if (topic.Text && topic.FirstURL) {
                        results.push({
                            type: 'related',
                            title: topic.Text.split(' - ')[0],
                            content: topic.Text,
                            url: topic.FirstURL,
                            source: 'DuckDuckGo'
                        });
                    }
                });
            }

            return results;
        } catch (error) {
            console.error('DuckDuckGo search error:', error);
            return [];
        }
    }

    async searchDomains(query) {
        // Search for domain-related information
        const domainPattern = /([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/g;
        const domains = query.match(domainPattern) || [];
        
        const results = [];
        
        for (const domain of domains) {
            try {
                const domainInfo = await this.getDomainInfo(domain);
                if (domainInfo) {
                    results.push({
                        type: 'domain',
                        title: `Domain: ${domain}`,
                        content: `IP: ${domainInfo.ip}, Location: ${domainInfo.location}`,
                        url: `https://${domain}`,
                        source: 'Domain Lookup',
                        geoData: domainInfo.geoData
                    });
                }
            } catch (error) {
                console.error(`Domain lookup error for ${domain}:`, error);
            }
        }
        
        return results;
    }

    async getDomainInfo(domain) {
        try {
            // Use a free IP geolocation API
            const response = await fetch(`https://ipapi.co/${domain}/json/`);
            const data = await response.json();
            
            if (data.ip) {
                return {
                    ip: data.ip,
                    location: `${data.city}, ${data.country_name}`,
                    geoData: {
                        lat: data.latitude,
                        lng: data.longitude,
                        city: data.city,
                        country: data.country_name,
                        org: data.org
                    }
                };
            }
        } catch (error) {
            console.error('IP lookup error:', error);
        }
        return null;
    }

    displaySearchResults(results) {
        const container = document.getElementById('search-results');
        if (!container) return;

        container.innerHTML = '';
        
        if (results.length === 0) {
            container.innerHTML = '<p class="no-results">No results found.</p>';
            return;
        }

        results.forEach(result => {
            const resultElement = this.createResultElement(result);
            container.appendChild(resultElement);
        });

        this.searchResults = results;
    }

    createResultElement(result) {
        const element = document.createElement('div');
        element.className = `search-result ${result.type}`;
        
        const typeIcon = this.getResultTypeIcon(result.type);
        const sourceColor = this.getSourceColor(result.source);
        
        element.innerHTML = `
            <div class="result-header">
                <i class="${typeIcon}" style="color: ${sourceColor}"></i>
                <span class="result-source" style="color: ${sourceColor}">${result.source}</span>
            </div>
            <h3 class="result-title">${result.title}</h3>
            <p class="result-content">${result.content}</p>
            <div class="result-actions">
                <a href="${result.url}" target="_blank" class="result-link">
                    <i class="fas fa-external-link-alt"></i> Visit
                </a>
                ${result.geoData ? `<button class="show-location-btn" onclick="webSearchManager.showLocationOnMap(${JSON.stringify(result.geoData).replace(/"/g, '&quot;')})">
                    <i class="fas fa-map-marker-alt"></i> Show Location
                </button>` : ''}
            </div>
        `;
        
        return element;
    }

    getResultTypeIcon(type) {
        const icons = {
            instant: 'fas fa-bolt',
            related: 'fas fa-link',
            domain: 'fas fa-globe',
            security: 'fas fa-shield-alt'
        };
        return icons[type] || 'fas fa-search';
    }

    getSourceColor(source) {
        const colors = {
            'DuckDuckGo': '#de5833',
            'Domain Lookup': '#667eea',
            'Security Check': '#f5576c'
        };
        return colors[source] || '#ffffff';
    }

    async geolocateSearchResults(results) {
        for (const result of results) {
            if (result.url && !result.geoData) {
                try {
                    const domain = new URL(result.url).hostname;
                    const geoData = await this.getDomainInfo(domain);
                    if (geoData) {
                        result.geoData = geoData.geoData;
                        this.addLocationMarker(geoData.geoData, result);
                    }
                } catch (error) {
                    console.error('Geolocation error:', error);
                }
            } else if (result.geoData) {
                this.addLocationMarker(result.geoData, result);
            }
        }
    }

    addLocationMarker(geoData, result) {
        if (!this.map || !geoData.lat || !geoData.lng) return;

        const marker = L.marker([geoData.lat, geoData.lng])
            .addTo(this.map)
            .bindPopup(`
                <div class="map-popup">
                    <h4>${result.title}</h4>
                    <p><strong>Location:</strong> ${geoData.city}, ${geoData.country}</p>
                    ${geoData.org ? `<p><strong>Organization:</strong> ${geoData.org}</p>` : ''}
                    <a href="${result.url}" target="_blank">Visit Site</a>
                </div>
            `);

        this.locationMarkers.push(marker);
        
        // Add custom icon based on result type
        const icon = this.createCustomIcon(result.type);
        marker.setIcon(icon);
    }

    createCustomIcon(type) {
        const iconColors = {
            instant: '#de5833',
            related: '#667eea',
            domain: '#f5576c',
            security: '#43e97b'
        };
        
        const color = iconColors[type] || '#ffffff';
        
        return L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    }

    showLocationOnMap(geoData) {
        if (!this.map || !geoData.lat || !geoData.lng) return;
        
        this.map.setView([geoData.lat, geoData.lng], 8);
        
        // Find and open the corresponding marker popup
        this.locationMarkers.forEach(marker => {
            const pos = marker.getLatLng();
            if (Math.abs(pos.lat - geoData.lat) < 0.01 && Math.abs(pos.lng - geoData.lng) < 0.01) {
                marker.openPopup();
            }
        });
    }

    clearSearchResults() {
        const container = document.getElementById('search-results');
        if (container) {
            container.innerHTML = '';
        }
        
        // Clear map markers
        this.locationMarkers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.locationMarkers = [];
        
        this.searchResults = [];
    }

    addToSearchHistory(query, resultCount) {
        const historyItem = {
            query,
            resultCount,
            timestamp: new Date().toISOString()
        };
        
        this.searchHistory.unshift(historyItem);
        
        // Keep only last 50 searches
        if (this.searchHistory.length > 50) {
            this.searchHistory = this.searchHistory.slice(0, 50);
        }
        
        this.saveSearchHistory();
        this.updateSearchHistoryUI();
    }

    saveSearchHistory() {
        try {
            localStorage.setItem('cyberforge_search_history', JSON.stringify(this.searchHistory));
        } catch (error) {
            console.error('Error saving search history:', error);
        }
    }

    loadSearchHistory() {
        try {
            const saved = localStorage.getItem('cyberforge_search_history');
            if (saved) {
                this.searchHistory = JSON.parse(saved);
                this.updateSearchHistoryUI();
            }
        } catch (error) {
            console.error('Error loading search history:', error);
        }
    }

    updateSearchHistoryUI() {
        const historyContainer = document.getElementById('search-history');
        if (!historyContainer || this.searchHistory.length === 0) return;

        historyContainer.innerHTML = this.searchHistory
            .slice(0, 10)
            .map(item => `
                <div class="history-item" onclick="webSearchManager.performWebSearch('${item.query}')">
                    <span class="history-query">${item.query}</span>
                    <span class="history-meta">${item.resultCount} results</span>
                </div>
            `).join('');
    }

    showSearchLoading(show) {
        const loadingElement = document.getElementById('search-loading');
        const resultsContainer = document.getElementById('search-results');
        
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
        
        if (resultsContainer && show) {
            resultsContainer.innerHTML = '';
        }
    }

    showSearchError(message) {
        const container = document.getElementById('search-results');
        if (container) {
            container.innerHTML = `<div class="search-error">${message}</div>`;
        }
    }
}

// Initialize the web search manager
let webSearchManager;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    webSearchManager = new WebSearchManager();
});