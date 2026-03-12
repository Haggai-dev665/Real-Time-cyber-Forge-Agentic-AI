/**
 * Threat Map Screen - Real-time Threat Intelligence Visualization
 * Powered by Leaflet.js + CartoDB/OpenStreetMap tiles
 * Data powered by AlienVault OTX - NO mock/fallback data
 */

class ThreatGlobeScreen {

    constructor() {
        this.container = null;
        this.map = null;
        this.isActive = false;
        this.isPaused = false;
        this.threatData = [];
        this.threatLayers = [];
        this.arcLayers = [];
        this.updateInterval = null;
        this.UPDATE_INTERVAL_MS = 30000;
        this.activeFilters = { severity: ["high", "medium", "low"] };
        this.isDark = false;
        this.tileLayer = null;
    }

    async show(container) {
        this.container = container;
        this.isActive = true;
        this.isDark = document.body.dataset.theme === "dark" ||
            document.documentElement.getAttribute("data-theme") === "dark" ||
            localStorage.getItem("cyberforge-theme") === "dark";
        this.container.innerHTML = this.createHTML();
        this.initializeMap();
        this.setupEventListeners();
        await this.loadThreatData();
        this.startRealTimeUpdates();
        this.container.classList.add("screen-enter");
    }

    hide() {
        this.isActive = false;
        this.stopRealTimeUpdates();
        if (this.map) { this.map.remove(); this.map = null; }
    }

    createHTML() {
        return '<div class="threat-globe-screen">' +
            '<div class="globe-header"><div class="header-content">' +
            '<div class="globe-title-section">' +
            '<h1 class="globe-title"><i class="fas fa-map-marked-alt"></i> Global Threat Intelligence</h1>' +
            '<p class="globe-subtitle">Real-time cyber threats powered by AlienVault OTX</p></div>' +
            '<div class="globe-header-right">' +
            '<div class="header-severity-badges">' +
            '<div class="severity-stat critical"><span class="severity-stat-count" id="stat-critical">0</span><span class="severity-stat-label">Critical</span></div>' +
            '<div class="severity-stat medium"><span class="severity-stat-count" id="stat-medium">0</span><span class="severity-stat-label">Medium</span></div>' +
            '<div class="severity-stat low"><span class="severity-stat-count" id="stat-low">0</span><span class="severity-stat-label">Low</span></div></div>' +
            '<div class="globe-controls">' +
            '<button class="tm-btn tm-btn-ghost" id="pause-globe-btn" title="Pause"><i class="fas fa-pause"></i></button>' +
            '<button class="tm-btn tm-btn-ghost" id="resume-globe-btn" style="display:none" title="Resume"><i class="fas fa-play"></i></button>' +
            '<button class="tm-btn tm-btn-ghost" id="filter-threats-btn" title="Filter"><i class="fas fa-filter"></i></button>' +
            '<button class="tm-btn tm-btn-accent" id="refresh-threats-btn" title="Refresh"><i class="fas fa-sync-alt"></i></button>' +
            '</div></div></div></div>' +

            '<div class="globe-main-container">' +
            '<div class="globe-visualization-wrapper">' +
            '<div id="threat-leaflet-map" style="width:100%;height:100%;border-radius:12px;z-index:1;"></div>' +
            '<div class="map-overlay-tl"><div class="threat-counter-chip">' +
            '<span class="counter-value" id="threat-count">0</span>' +
            '<span class="counter-label">ACTIVE THREATS</span></div></div>' +
            '<div class="map-overlay-bl"><div class="map-legend">' +
            '<div class="legend-title">SEVERITY</div>' +
            '<div class="legend-row"><span class="legend-dot" style="background:#D92D20;box-shadow:0 0 6px #D92D20"></span>Critical</div>' +
            '<div class="legend-row"><span class="legend-dot" style="background:#DC6803;box-shadow:0 0 6px #DC6803"></span>Medium</div>' +
            '<div class="legend-row"><span class="legend-dot" style="background:#1570EF;box-shadow:0 0 6px #1570EF"></span>Low</div>' +
            '</div></div>' +
            '<div class="map-overlay-tr"><div class="data-source-badge"><i class="fas fa-satellite-dish"></i> AlienVault OTX</div></div>' +
            '<div class="map-state-overlay" id="map-loading"><i class="fas fa-satellite-dish fa-pulse"></i><span>Connecting to threat intelligence\u2026</span></div>' +
            '<div class="map-state-overlay map-state-hidden" id="map-empty"><i class="fas fa-shield-alt"></i><span>No active threats detected</span><span class="map-state-sub">Monitoring global intelligence feeds</span></div>' +
            '</div>' +

            '<div class="threat-feed-sidebar">' +
            '<div class="sidebar-header"><h3><i class="fas fa-stream"></i> Live Feed</h3><span class="live-indicator"><span class="live-dot"></span>LIVE</span></div>' +
            '<div class="threat-feed-list" id="threat-feed-list"></div></div></div>' +

            '<div class="threat-details-panel" id="threat-details-panel" style="display:none">' +
            '<div class="panel-header"><h3><i class="fas fa-crosshairs"></i> Threat Intel</h3><button class="tm-btn-icon" id="close-details-btn"><i class="fas fa-times"></i></button></div>' +
            '<div class="panel-body" id="threat-details-body"></div></div>' +

            '<div class="filter-modal" id="filter-modal" style="display:none"><div class="modal-content">' +
            '<div class="modal-header"><h3>Filter Threats</h3><button class="tm-btn-icon" id="close-filter-btn"><i class="fas fa-times"></i></button></div>' +
            '<div class="modal-body"><div class="filter-group"><label class="filter-label">Severity Level</label>' +
            '<div class="checkbox-group">' +
            '<label class="cb-label"><input type="checkbox" checked data-filter="severity" value="high"><span class="cb-dot" style="background:#D92D20"></span>Critical</label>' +
            '<label class="cb-label"><input type="checkbox" checked data-filter="severity" value="medium"><span class="cb-dot" style="background:#DC6803"></span>Medium</label>' +
            '<label class="cb-label"><input type="checkbox" checked data-filter="severity" value="low"><span class="cb-dot" style="background:#1570EF"></span>Low</label>' +
            '</div></div></div>' +
            '<div class="modal-footer"><button class="tm-btn tm-btn-ghost" id="reset-filter-btn">Reset</button><button class="tm-btn tm-btn-accent" id="apply-filter-btn">Apply</button></div>' +
            '</div></div></div>';
    }

    initializeMap() {
        var mapEl = this.container.querySelector("#threat-leaflet-map");
        if (!mapEl || typeof L === "undefined") return;

        this.map = L.map(mapEl, {
            center: [20, 0],
            zoom: 2,
            minZoom: 1,
            maxZoom: 8,
            zoomControl: false,
            attributionControl: false,
            worldCopyJump: true,
            maxBounds: [[-85, -180], [85, 180]],
            maxBoundsViscosity: 1.0,
            zoomSnap: 0.5,
            zoomDelta: 0.5
        });

        L.control.zoom({ position: "topright" }).addTo(this.map);
        L.control.attribution({ position: "bottomright", prefix: false })
            .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a> | <a href="https://carto.com/" target="_blank">CARTO</a>')
            .addTo(this.map);

        this.setTileLayer();

        var self = this;
        setTimeout(function() {
            if (self.map) {
                self.map.invalidateSize();
                self.map.fitWorld({ padding: [20, 20], maxZoom: 3 });
            }
        }, 250);
    }

    setTileLayer() {
        if (this.tileLayer && this.map) {
            this.map.removeLayer(this.tileLayer);
        }
        if (this.isDark) {
            this.tileLayer = L.tileLayer(
                "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
                { subdomains: "abcd", maxZoom: 19 }
            );
        } else {
            this.tileLayer = L.tileLayer(
                "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
                { subdomains: "abcd", maxZoom: 19 }
            );
        }
        this.tileLayer.addTo(this.map);
    }

    clearThreatLayers() {
        var self = this;
        this.threatLayers.forEach(function(layer) { if (self.map) self.map.removeLayer(layer); });
        this.threatLayers = [];
        this.arcLayers.forEach(function(layer) { if (self.map) self.map.removeLayer(layer); });
        this.arcLayers = [];
    }

    visualizeThreats() {
        this.clearThreatLayers();
        if (!this.map) return;

        var self = this;
        var filtered = this.threatData.filter(function(t) {
            return self.activeFilters.severity.indexOf(t.severity || "low") !== -1;
        });

        filtered.forEach(function(threat) {
            var color = self.getSeverityColor(threat.severity);
            var origin = threat.origin || { lat: 0, lon: 0 };
            var dest = threat.destination || { lat: 0, lon: 0 };

            // Glow ring
            var glow = L.circleMarker([origin.lat, origin.lon], {
                radius: 16, fillColor: color, color: "transparent", fillOpacity: 0.10
            }).addTo(self.map);

            // Origin marker
            var originM = L.circleMarker([origin.lat, origin.lon], {
                radius: 7, fillColor: color, color: "#fff", weight: 2, opacity: 1, fillOpacity: 0.9
            }).addTo(self.map);

            // Destination marker
            var destM = L.circleMarker([dest.lat, dest.lon], {
                radius: 5, fillColor: color, color: "#fff", weight: 1.5, opacity: 0.8, fillOpacity: 0.7
            }).addTo(self.map);

            // Popup
            originM.bindPopup(
                '<div class="leaflet-threat-popup">' +
                '<div class="popup-severity ' + (threat.severity || "low") + '">' + (threat.severity || "low").toUpperCase() + '</div>' +
                '<div class="popup-title">' + self._esc(threat.threat || "Unknown Threat") + '</div>' +
                '<div class="popup-route"><i class="fas fa-location-arrow"></i> ' +
                self._esc((origin.country) || "??") + " \u2192 " +
                self._esc((dest.country) || "??") + '</div>' +
                (threat.adversary ? '<div class="popup-adversary"><i class="fas fa-user-secret"></i> ' + self._esc(threat.adversary) + '</div>' : '') +
                '</div>',
                { className: "threat-popup-container", maxWidth: 280 }
            );

            // Arc
            var arcPts = self.computeArcPoints([origin.lat, origin.lon], [dest.lat, dest.lon], 50);
            var bgArc = L.polyline(arcPts, { color: color, weight: 1.5, opacity: 0.12, smoothFactor: 1 }).addTo(self.map);
            var fgArc = L.polyline(arcPts, {
                color: color, weight: 2.5, opacity: 0.65, smoothFactor: 1,
                dashArray: "8 12", className: "threat-arc-animated"
            }).addTo(self.map);
            fgArc.on("click", function() { self.showThreatDetails(threat); });

            self.threatLayers.push(glow, originM, destM);
            self.arcLayers.push(bgArc, fgArc);
        });
    }

    computeArcPoints(from, to, n) {
        var pts = [];
        for (var i = 0; i <= n; i++) {
            var t = i / n;
            var lat = from[0] + (to[0] - from[0]) * t;
            var lon = from[1] + (to[1] - from[1]) * t;
            var h = Math.sin(t * Math.PI) * this.getArcHeight(from, to);
            pts.push([lat + h, lon]);
        }
        return pts;
    }

    getArcHeight(from, to) {
        var dLat = to[0] - from[0], dLon = to[1] - from[1];
        var dist = Math.sqrt(dLat * dLat + dLon * dLon);
        return Math.min(dist * 0.15, 15);
    }

    setupEventListeners() {
        var self = this;
        var $ = function(sel) { return self.container.querySelector(sel); };

        var pauseBtn = $("#pause-globe-btn");
        var resumeBtn = $("#resume-globe-btn");
        if (pauseBtn) pauseBtn.addEventListener("click", function() {
            self.isPaused = true;
            pauseBtn.style.display = "none";
            resumeBtn.style.display = "inline-flex";
            var el = self.container.querySelector("#threat-leaflet-map");
            if (el) { el.style.opacity = "0.45"; el.style.filter = "grayscale(40%)"; }
        });
        if (resumeBtn) resumeBtn.addEventListener("click", function() {
            self.isPaused = false;
            resumeBtn.style.display = "none";
            pauseBtn.style.display = "inline-flex";
            var el = self.container.querySelector("#threat-leaflet-map");
            if (el) { el.style.opacity = "1"; el.style.filter = "none"; }
        });

        var refreshBtn = $("#refresh-threats-btn");
        if (refreshBtn) refreshBtn.addEventListener("click", async function() {
            var icon = refreshBtn.querySelector("i");
            if (icon) icon.classList.add("fa-spin");
            await self.loadThreatData();
            setTimeout(function() { if (icon) icon.classList.remove("fa-spin"); }, 800);
        });

        var filterBtn = $("#filter-threats-btn");
        var filterModal = $("#filter-modal");
        var closeFilter = $("#close-filter-btn");
        var applyFilter = $("#apply-filter-btn");
        var resetFilter = $("#reset-filter-btn");

        if (filterBtn) filterBtn.addEventListener("click", function() { filterModal.style.display = "flex"; });
        if (closeFilter) closeFilter.addEventListener("click", function() { filterModal.style.display = "none"; });
        if (filterModal) filterModal.addEventListener("click", function(e) { if (e.target === filterModal) filterModal.style.display = "none"; });

        if (applyFilter) applyFilter.addEventListener("click", function() {
            self.activeFilters.severity = [];
            self.container.querySelectorAll('[data-filter="severity"]:checked').forEach(function(cb) {
                self.activeFilters.severity.push(cb.value);
            });
            self.visualizeThreats();
            self.updateThreatFeed();
            self.updateCounts();
            filterModal.style.display = "none";
        });

        if (resetFilter) resetFilter.addEventListener("click", function() {
            self.container.querySelectorAll('[data-filter="severity"]').forEach(function(cb) { cb.checked = true; });
            self.activeFilters.severity = ["high", "medium", "low"];
            self.visualizeThreats();
            self.updateThreatFeed();
            self.updateCounts();
            filterModal.style.display = "none";
        });

        var closeDetails = $("#close-details-btn");
        if (closeDetails) closeDetails.addEventListener("click", function() {
            $("#threat-details-panel").style.display = "none";
        });
    }

    async loadThreatData() {
        var loading = this.container.querySelector("#map-loading");
        var empty = this.container.querySelector("#map-empty");
        try {
            var backendUrl = (window.API_ENDPOINTS && window.API_ENDPOINTS.BACKEND_URL) ||
                localStorage.getItem("cyberforge_backend_url") ||
                "https://cyberforge-ddd97655464f.herokuapp.com";
            if (!backendUrl.startsWith("http://") && !backendUrl.startsWith("https://")) {
                throw new Error("Invalid backend URL");
            }
            var response = await fetch(backendUrl + "/api/otx/threats/recent?limit=20");
            if (!response.ok) throw new Error("HTTP " + response.status);
            var data = await response.json();
            this.threatData = data.data || [];
            if (loading) loading.classList.add("map-state-hidden");
            if (this.threatData.length === 0) {
                if (empty) empty.classList.remove("map-state-hidden");
            } else {
                if (empty) empty.classList.add("map-state-hidden");
            }
            this.visualizeThreats();
            this.updateThreatFeed();
            this.updateCounts();
        } catch (error) {
            console.error("Error loading threat data:", error);
            this.threatData = [];
            if (loading) loading.classList.add("map-state-hidden");
            if (empty) empty.classList.remove("map-state-hidden");
            this.visualizeThreats();
            this.updateThreatFeed();
            this.updateCounts();
        }
    }

    updateThreatFeed() {
        var feedList = this.container.querySelector("#threat-feed-list");
        if (!feedList) return;
        var self = this;
        var filtered = this.threatData.filter(function(t) {
            return self.activeFilters.severity.indexOf(t.severity || "low") !== -1;
        });
        if (filtered.length === 0) {
            feedList.innerHTML = '<div class="feed-empty"><i class="fas fa-satellite-dish"></i><p>Listening for threats\u2026</p></div>';
            return;
        }
        feedList.innerHTML = "";
        filtered.slice(0, 15).forEach(function(threat) {
            var item = document.createElement("div");
            item.className = "threat-feed-item severity-" + (threat.severity || "low");
            var sev = (threat.severity || "low").toUpperCase();
            item.innerHTML =
                '<div class="threat-indicator">' +
                '<span class="severity-badge ' + (threat.severity || "low") + '">' + sev + '</span>' +
                '<span class="threat-time">' + self.formatTime(threat.timestamp) + '</span></div>' +
                '<div class="threat-info">' +
                '<div class="threat-name">' + self._esc(threat.threat || "Unknown Threat") + '</div>' +
                '<div class="threat-location"><i class="fas fa-location-arrow"></i> ' +
                self._esc((threat.origin && threat.origin.country) || "??") + ' \u2192 ' +
                self._esc((threat.destination && threat.destination.country) || "??") + '</div>' +
                (threat.adversary ? '<div class="threat-adversary"><i class="fas fa-user-secret"></i> ' + self._esc(threat.adversary) + '</div>' : '') +
                '</div>';
            item.addEventListener("click", function() {
                self.showThreatDetails(threat);
                if (self.map && threat.origin) {
                    self.map.flyTo([threat.origin.lat, threat.origin.lon], 4, { duration: 1.2 });
                }
            });
            feedList.appendChild(item);
        });
    }

    updateCounts() {
        var self = this;
        var filtered = this.threatData.filter(function(t) {
            return self.activeFilters.severity.indexOf(t.severity || "low") !== -1;
        });
        var countEl = this.container.querySelector("#threat-count");
        if (countEl) countEl.textContent = filtered.length;
        var crit = filtered.filter(function(t) { return t.severity === "high" || t.severity === "critical"; }).length;
        var med = filtered.filter(function(t) { return t.severity === "medium"; }).length;
        var low = filtered.filter(function(t) { return !t.severity || t.severity === "low"; }).length;
        var sc = this.container.querySelector("#stat-critical");
        var sm = this.container.querySelector("#stat-medium");
        var sl = this.container.querySelector("#stat-low");
        if (sc) sc.textContent = crit;
        if (sm) sm.textContent = med;
        if (sl) sl.textContent = low;
    }

    showThreatDetails(threat) {
        var panel = this.container.querySelector("#threat-details-panel");
        var body = this.container.querySelector("#threat-details-body");
        if (!panel || !body) return;
        var sev = threat.severity || "low";
        body.innerHTML =
            '<div class="detail-section"><h4>Threat</h4>' +
            '<div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">' + this._esc(threat.threat || "Unknown") + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Severity</span><span class="detail-value"><span class="severity-badge ' + sev + '">' + sev.toUpperCase() + '</span></span></div>' +
            '<div class="detail-row"><span class="detail-label">Adversary</span><span class="detail-value">' + this._esc(threat.adversary || "Unknown") + '</span></div>' +
            '<div class="detail-row"><span class="detail-label">Detected</span><span class="detail-value">' + (threat.timestamp ? new Date(threat.timestamp).toLocaleString() : "\u2014") + '</span></div></div>' +
            '<div class="detail-section"><h4>Location</h4>' +
            '<div class="detail-row"><span class="detail-label">Origin</span><span class="detail-value">' + this._esc((threat.origin && threat.origin.country) || "??") + ' (' + ((threat.origin && threat.origin.lat) || 0).toFixed(2) + '\u00b0, ' + ((threat.origin && threat.origin.lon) || 0).toFixed(2) + '\u00b0)</span></div>' +
            '<div class="detail-row"><span class="detail-label">Target</span><span class="detail-value">' + this._esc((threat.destination && threat.destination.country) || "??") + ' (' + ((threat.destination && threat.destination.lat) || 0).toFixed(2) + '\u00b0, ' + ((threat.destination && threat.destination.lon) || 0).toFixed(2) + '\u00b0)</span></div></div>' +
            '<div class="detail-section"><h4>Description</h4>' +
            '<p class="detail-desc">' + this._esc(threat.description || "No description available.") + '</p></div>';
        panel.style.display = "flex";
    }

    startRealTimeUpdates() {
        var self = this;
        this.updateInterval = setInterval(function() {
            if (self.isActive && !self.isPaused) self.loadThreatData();
        }, this.UPDATE_INTERVAL_MS);
    }

    stopRealTimeUpdates() {
        if (this.updateInterval) { clearInterval(this.updateInterval); this.updateInterval = null; }
    }

    getSeverityColor(severity) {
        var c = { high: "#D92D20", critical: "#D92D20", medium: "#DC6803", low: "#1570EF" };
        return c[severity] || "#1570EF";
    }

    formatTime(timestamp) {
        if (!timestamp) return "\u2014";
        var diff = Date.now() - timestamp;
        var m = Math.floor(diff / 60000);
        if (m < 1) return "Just now";
        if (m < 60) return m + "m ago";
        var h = Math.floor(m / 60);
        if (h < 24) return h + "h ago";
        return Math.floor(h / 24) + "d ago";
    }

    _esc(str) {
        var d = document.createElement("div");
        d.textContent = str;
        return d.innerHTML;
    }
}

if (typeof window !== "undefined") {
    window.ThreatGlobeScreen = ThreatGlobeScreen;
}
