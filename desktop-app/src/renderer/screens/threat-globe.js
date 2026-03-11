/**
 * Threat Map Screen - 2D Real-time Threat Intelligence Visualization
 * Canvas-based flat world map with animated threat arcs
 * Data powered by AlienVault OTX - NO mock/fallback data
 */

class ThreatGlobeScreen {

    static WORLD_POLYGONS = [
        [[-130,55],[-125,60],[-120,65],[-110,70],[-100,72],[-90,70],[-85,65],[-80,60],[-78,55],[-75,45],[-80,32],[-82,25],[-85,18],[-90,15],[-97,17],[-105,22],[-117,32],[-122,37],[-125,45],[-130,55]],
        [[-90,15],[-87,14],[-84,11],[-82,8],[-78,8],[-80,10],[-84,12],[-87,15],[-90,15]],
        [[-80,10],[-75,12],[-65,10],[-55,4],[-50,0],[-45,-5],[-35,-8],[-35,-15],[-40,-20],[-43,-23],[-48,-28],[-53,-34],[-60,-42],[-65,-55],[-70,-52],[-72,-45],[-70,-30],[-70,-18],[-75,-10],[-78,-2],[-80,10]],
        [[-10,36],[0,43],[5,46],[3,48],[8,48],[6,52],[10,55],[18,56],[22,55],[30,60],[30,65],[25,68],[20,65],[15,60],[10,58],[5,52],[0,49],[-5,43],[-10,36]],
        [[5,58],[10,62],[15,65],[18,68],[22,70],[28,71],[30,70],[28,66],[22,60],[15,57],[10,56],[5,58]],
        [[-17,15],[-15,25],[-10,30],[-5,34],[0,36],[10,37],[20,35],[30,32],[33,30],[35,15],[40,12],[43,10],[50,12],[45,0],[42,-5],[40,-15],[35,-25],[30,-34],[25,-34],[18,-28],[12,-18],[8,-5],[5,0],[0,5],[-5,5],[-10,8],[-17,15]],
        [[28,42],[35,42],[40,45],[50,52],[60,55],[70,55],[80,55],[90,55],[100,55],[110,52],[120,55],[130,58],[140,55],[150,58],[160,60],[170,62],[180,65],[180,72],[170,72],[160,70],[145,68],[130,60],[110,55],[90,52],[70,52],[55,52],[45,48],[40,45],[35,42],[28,42]],
        [[68,28],[72,24],[75,22],[78,18],[80,12],[80,8],[78,10],[75,15],[72,20],[68,25],[68,28]],
        [[75,30],[85,28],[90,22],[95,18],[100,15],[105,20],[110,22],[115,28],[120,30],[125,38],[130,42],[128,46],[122,48],[118,45],[110,42],[100,35],[90,30],[80,30],[75,30]],
        [[130,31],[133,34],[136,36],[139,38],[141,42],[142,45],[140,44],[137,38],[134,34],[130,31]],
        [[95,6],[100,2],[105,-2],[106,-5],[108,-8],[112,-8],[114,-5],[106,0],[102,5],[95,6]],
        [[95,4],[100,0],[105,-3],[108,-7],[112,-8],[115,-8],[118,-8],[120,-5],[125,-3],[130,-4],[135,-5],[140,-6],[141,-3],[138,0],[132,-2],[125,-5],[120,-7],[115,-7],[106,-5],[104,-1],[100,2],[95,4]],
        [[115,-14],[125,-13],[130,-12],[135,-12],[142,-12],[148,-16],[153,-25],[152,-32],[148,-38],[142,-38],[135,-35],[128,-32],[122,-28],[117,-22],[115,-14]],
        [[166,-35],[170,-37],[174,-40],[175,-44],[174,-46],[172,-44],[168,-38],[166,-35]],
        [[-8,50],[-6,52],[-4,54],[-3,57],[0,58],[2,54],[1,51],[-2,50],[-5,50],[-8,50]],
        [[-55,60],[-48,62],[-40,65],[-30,70],[-22,73],[-18,77],[-20,80],[-30,82],[-42,84],[-50,83],[-55,78],[-58,72],[-55,60]],
        [[-24,64],[-22,65],[-18,66],[-14,66],[-14,64],[-18,63],[-24,64]],
        [[44,-12],[48,-15],[50,-18],[48,-22],[47,-25],[44,-23],[43,-18],[44,-12]],
        [[30,32],[35,37],[40,38],[48,36],[50,30],[55,25],[60,25],[55,22],[50,24],[45,28],[40,32],[35,35],[30,32]],
    ];

    constructor() {
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.mapCanvas = null;
        this.mapCtx = null;
        this.isActive = false;
        this.isPaused = false;
        this.threatData = [];
        this.animatedThreats = [];
        this.updateInterval = null;
        this.animationFrame = null;
        this.resizeObserver = null;
        this.UPDATE_INTERVAL_MS = 30000;
        this.mapPadding = { top: 24, right: 24, bottom: 24, left: 24 };
        this.isDark = true;
        this.displayWidth = 0;
        this.displayHeight = 0;
        this.activeFilters = { severity: ["high", "medium", "low"] };
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
        if (this.animationFrame) { cancelAnimationFrame(this.animationFrame); this.animationFrame = null; }
        if (this.resizeObserver) { this.resizeObserver.disconnect(); this.resizeObserver = null; }
    }

    createHTML() {
        var q = '"';
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
            '<canvas id="threat-map-canvas" class="threat-map-canvas"></canvas>' +
            '<div class="map-overlay-tl"><div class="threat-counter-chip">' +
            '<span class="counter-value" id="threat-count">0</span>' +
            '<span class="counter-label">active threats</span></div></div>' +
            '<div class="map-overlay-bl"><div class="map-legend">' +
            '<div class="legend-title">Severity</div>' +
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
        this.canvas = this.container.querySelector("#threat-map-canvas");
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext("2d");
        this.handleResize();
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this.canvas.parentElement);
        this.animationFrame = requestAnimationFrame(t => this.draw(t));
    }

    handleResize() {
        var wrapper = this.canvas.parentElement;
        var dpr = window.devicePixelRatio || 1;
        var w = wrapper.clientWidth;
        var h = wrapper.clientHeight;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + "px";
        this.canvas.style.height = h + "px";
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.displayWidth = w;
        this.displayHeight = h;
        this.buildMapCache();
    }

    buildMapCache() {
        var w = this.displayWidth, h = this.displayHeight;
        if (!w || !h) return;
        this.mapCanvas = document.createElement("canvas");
        this.mapCanvas.width = w;
        this.mapCanvas.height = h;
        this.mapCtx = this.mapCanvas.getContext("2d");
        var ctx = this.mapCtx;
        var dark = this.isDark;
        var bg = dark ? "#0c1318" : "#f0f4f8";
        var landFill = dark ? "#1a2a36" : "#d0dbe5";
        var landStroke = dark ? "#243545" : "#b0c0d0";
        var gridColor = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)";

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.5;
        for (var lon = -180; lon <= 180; lon += 30) {
            var p = this._project(0, lon, w, h);
            ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); ctx.stroke();
        }
        for (var lat = -90; lat <= 90; lat += 30) {
            var p = this._project(lat, 0, w, h);
            ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(w, p.y); ctx.stroke();
        }

        ThreatGlobeScreen.WORLD_POLYGONS.forEach(function(poly) {
            ctx.beginPath();
            var self2 = this;
            poly.forEach(function(coords, i) {
                var p = this._project(coords[1], coords[0], w, h);
                i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
            }.bind(this));
            ctx.closePath();
            ctx.fillStyle = landFill;
            ctx.fill();
            ctx.strokeStyle = landStroke;
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }.bind(this));

        var vg = ctx.createRadialGradient(w/2, h/2, h*0.3, w/2, h/2, w*0.7);
        vg.addColorStop(0, "transparent");
        vg.addColorStop(1, dark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.08)");
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
    }

    _project(lat, lon, w, h) {
        var p = this.mapPadding;
        var mw = (w || this.displayWidth) - p.left - p.right;
        var mh = (h || this.displayHeight) - p.top - p.bottom;
        return { x: p.left + ((lon + 180) / 360) * mw, y: p.top + ((90 - lat) / 180) * mh };
    }

    project(lat, lon) {
        return this._project(lat, lon, this.displayWidth, this.displayHeight);
    }

    draw(timestamp) {
        if (!this.isActive) return;
        var ctx = this.ctx;
        if (this.mapCanvas) ctx.drawImage(this.mapCanvas, 0, 0);
        if (!this.isPaused) this.drawThreats(timestamp);
        this.animationFrame = requestAnimationFrame(function(t) { this.draw(t); }.bind(this));
    }

    drawThreats(time) {
        var ctx = this.ctx;
        var self = this;
        this.animatedThreats.forEach(function(at) {
            var elapsed = time - at.startTime;
            var cycle = 4000;
            var progress = (elapsed % cycle) / cycle;
            var color = at.color;
            var from = self.project(at.origin.lat, at.origin.lon);
            var to = self.project(at.destination.lat, at.destination.lon);

            var dx = to.x - from.x, dy = to.y - from.y;
            var dist = Math.sqrt(dx*dx + dy*dy);
            var cpX = (from.x + to.x) / 2;
            var cpY = Math.min(from.y, to.y) - dist * 0.28;

            ctx.save();
            // Base arc
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.quadraticCurveTo(cpX, cpY, to.x, to.y);
            ctx.strokeStyle = color + "15";
            ctx.lineWidth = 1;
            ctx.stroke();

            // Animated trail
            var trailLen = 0.35;
            var tStart = Math.max(0, progress - trailLen);
            var steps = 40;
            ctx.beginPath();
            var first = true;
            for (var i = 0; i <= steps; i++) {
                var t = tStart + (progress - tStart) * (i / steps);
                if (t < 0 || t > 1) continue;
                var px = (1-t)*(1-t)*from.x + 2*(1-t)*t*cpX + t*t*to.x;
                var py = (1-t)*(1-t)*from.y + 2*(1-t)*t*cpY + t*t*to.y;
                if (first) { ctx.moveTo(px, py); first = false; } else { ctx.lineTo(px, py); }
            }
            var grad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
            grad.addColorStop(0, color + "20");
            grad.addColorStop(0.5, color + "BB");
            grad.addColorStop(1, color + "20");
            ctx.strokeStyle = grad;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Moving particle
            var pt = progress;
            var ppx = (1-pt)*(1-pt)*from.x + 2*(1-pt)*pt*cpX + pt*pt*to.x;
            var ppy = (1-pt)*(1-pt)*from.y + 2*(1-pt)*pt*cpY + pt*pt*to.y;
            ctx.beginPath();
            ctx.arc(ppx, ppy, 3.5, 0, Math.PI*2);
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 14;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();

            // Endpoint dots
            var pulse = Math.sin(time/400 + at.phaseOffset) * 0.5 + 0.5;
            self._drawDot(ctx, from.x, from.y, color, pulse);
            self._drawDot(ctx, to.x, to.y, color, pulse);
        });
    }

    _drawDot(ctx, x, y, color, pulse) {
        ctx.save();
        var r = 4 + pulse * 4;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color + "18";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
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
            self.canvas.style.opacity = "0.45";
            self.canvas.style.filter = "grayscale(40%)";
        });
        if (resumeBtn) resumeBtn.addEventListener("click", function() {
            self.isPaused = false;
            resumeBtn.style.display = "none";
            pauseBtn.style.display = "inline-flex";
            self.canvas.style.opacity = "1";
            self.canvas.style.filter = "none";
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

        if (this.canvas) this.canvas.addEventListener("click", function(e) {
            var rect = self.canvas.getBoundingClientRect();
            var mx = e.clientX - rect.left;
            var my = e.clientY - rect.top;
            var closest = null, closestDist = 30;
            self.animatedThreats.forEach(function(at) {
                var from = self.project(at.origin.lat, at.origin.lon);
                var to = self.project(at.destination.lat, at.destination.lon);
                var d1 = Math.hypot(from.x - mx, from.y - my);
                var d2 = Math.hypot(to.x - mx, to.y - my);
                var d = Math.min(d1, d2);
                if (d < closestDist) { closestDist = d; closest = at.threat; }
            });
            if (closest) self.showThreatDetails(closest);
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

    visualizeThreats() {
        var self = this;
        var filtered = this.threatData.filter(function(t) {
            return self.activeFilters.severity.indexOf(t.severity || "low") !== -1;
        });
        this.animatedThreats = filtered.map(function(threat, i) {
            return {
                threat: threat,
                origin: threat.origin || { lat: 0, lon: 0 },
                destination: threat.destination || { lat: 0, lon: 0 },
                color: self.getSeverityColor(threat.severity),
                startTime: performance.now() - i * 600,
                phaseOffset: i * 1.3
            };
        });
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
            item.addEventListener("click", function() { self.showThreatDetails(threat); });
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
            '<div class="detail-row"><span class="detail-label">Origin</span><span class="detail-value">' + this._esc((threat.origin && threat.origin.country) || "??") + ' (' + ((threat.origin && threat.origin.lat) || 0).toFixed(2) + ', ' + ((threat.origin && threat.origin.lon) || 0).toFixed(2) + ')</span></div>' +
            '<div class="detail-row"><span class="detail-label">Target</span><span class="detail-value">' + this._esc((threat.destination && threat.destination.country) || "??") + ' (' + ((threat.destination && threat.destination.lat) || 0).toFixed(2) + ', ' + ((threat.destination && threat.destination.lon) || 0).toFixed(2) + ')</span></div></div>' +
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

    getCurrentTime() {
        var n = new Date();
        return String(n.getHours()).padStart(2, "0") + ":" + String(n.getMinutes()).padStart(2, "0");
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
