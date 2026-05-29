/**
 * CyberForge Hybrid 3D Globe with Leaflet Integration
 * Renders real OpenStreetMap data onto a 3D globe using Three.js
 * Supports zoom from global view to city-level detail
 */

class HybridEarthGlobe {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Globe container not found:', containerId);
            return;
        }

        // Configuration - Use Stadia Maps with API key for high-quality maps
        this.options = {
            isDarkTheme: options.isDarkTheme !== false,
            // Stadia Maps Stamen Toner-Lite for clean white continents
            tileServer: options.tileServer || 'https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png?api_key=08962091-7cb9-498c-8710-12a0bd41d82b',
            // Stadia Maps Stamen Toner for dark mode
            darkTileServer: options.darkTileServer || 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png?api_key=08962091-7cb9-498c-8710-12a0bd41d82b',
            initialZoom: options.initialZoom || 2,
            initialCenter: options.initialCenter || [20, 0],
            showTraffic: options.showTraffic !== false,
            useBlueOceans: true, // Blue water effect
            useProcedural: options.useProcedural || false, // Use procedural texture as fallback
            ...options
        };

        // State
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.globe = null;
        this.atmosphere = null;
        this.stars = null;
        this.arcs = [];
        this.cityMarkers = [];
        this.animationId = null;
        this.clock = new THREE.Clock();

        // Leaflet integration
        this.leafletContainer = null;
        this.leafletMap = null;
        this.mapCanvas = null;
        this.mapCtx = null;
        this.mapTexture = null;
        this.mapDirty = true;
        this.currentZoom = this.options.initialZoom;
        this.tileLoadQueue = new Set();
        this.renderTimeout = null;

        // Globe parameters
        this.globeRadius = 1;
        this.textureWidth = 2048;
        this.textureHeight = 1024;

        // Initialize
        this.init();
    }

    init() {
        this.createLeafletContainer();
        this.initLeaflet();
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createLights();
        this.createStars();
        this.createGlobe();
        this.createAtmosphere();
        this.createControls();
        this.setupEventListeners();
        this.animate();

        // Only add sample traffic if explicitly enabled (disabled by default for clean look)
        setTimeout(() => {
            if (this.options.showTraffic && this.options.showSampleTraffic) {
                this.addSampleTraffic();
            }
        }, 2000);
    }

    /* ========================================
       LEAFLET SETUP - REAL MAP DATA
       ======================================== */

    createLeafletContainer() {
        // Create hidden container for Leaflet
        this.leafletContainer = document.createElement('div');
        this.leafletContainer.id = 'leaflet-hidden-container';
        this.leafletContainer.style.cssText = `
            position: absolute;
            width: ${this.textureWidth}px;
            height: ${this.textureHeight}px;
            left: -9999px;
            top: -9999px;
            visibility: hidden;
            pointer-events: none;
        `;
        document.body.appendChild(this.leafletContainer);
    }

    initLeaflet() {
        // Initialize Leaflet map
        this.leafletMap = L.map(this.leafletContainer, {
            zoomControl: false,
            attributionControl: false,
            zoomSnap: 0.1,
            zoomDelta: 0.5,
            minZoom: 1,
            maxZoom: 18,
            worldCopyJump: false,
            maxBounds: [[-90, -180], [90, 180]],
            maxBoundsViscosity: 1.0
        });

        // Set initial view
        this.leafletMap.setView(this.options.initialCenter, this.options.initialZoom);

        // Add tile layer based on theme
        this.updateTileLayer();

        // Create map canvas for texture
        this.createMapCanvas();

        // Listen for tile loading events
        this.leafletMap.on('load moveend zoomend', () => {
            this.scheduleMapRender();
        });

        // Track tile loading
        this.leafletMap.eachLayer((layer) => {
            if (layer.on) {
                layer.on('tileload', () => this.scheduleMapRender());
                layer.on('load', () => this.scheduleMapRender());
            }
        });
    }

    updateTileLayer() {
        // Remove existing tile layers
        this.leafletMap.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                this.leafletMap.removeLayer(layer);
            }
        });

        // Add appropriate tile layer based on theme
        const tileUrl = this.options.isDarkTheme 
            ? this.options.darkTileServer 
            : this.options.tileServer;

        const tileLayer = L.tileLayer(tileUrl, {
            maxZoom: 18,
            minZoom: 1,
            crossOrigin: 'anonymous',
            noWrap: false,
            bounds: [[-90, -180], [90, 180]]
        });

        tileLayer.on('tileload', () => this.scheduleMapRender());
        tileLayer.on('load', () => this.scheduleMapRender());
        tileLayer.addTo(this.leafletMap);
    }

    createMapCanvas() {
        this.mapCanvas = document.createElement('canvas');
        this.mapCanvas.width = this.textureWidth;
        this.mapCanvas.height = this.textureHeight;
        this.mapCtx = this.mapCanvas.getContext('2d', { willReadFrequently: true });

        // Fill with beautiful ocean blue initially
        this.mapCtx.fillStyle = this.options.isDarkTheme ? '#1C2B33' : '#33485A';
        this.mapCtx.fillRect(0, 0, this.textureWidth, this.textureHeight);

        // Create Three.js texture from canvas
        this.mapTexture = new THREE.CanvasTexture(this.mapCanvas);
        this.mapTexture.wrapS = THREE.RepeatWrapping;
        this.mapTexture.wrapT = THREE.ClampToEdgeWrapping;
        this.mapTexture.colorSpace = THREE.SRGBColorSpace;
        this.mapTexture.minFilter = THREE.LinearFilter;
        this.mapTexture.magFilter = THREE.LinearFilter;
        this.mapTexture.needsUpdate = true;
    }

    scheduleMapRender() {
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }
        this.renderTimeout = setTimeout(() => {
            this.renderLeafletToCanvas();
        }, 100);
    }

    renderLeafletToCanvas() {
        if (!this.mapCtx || !this.leafletMap) return;

        const container = this.leafletMap.getContainer();
        const tilePane = container.querySelector('.leaflet-tile-pane');
        if (!tilePane) return;

        // Clear canvas with beautiful ocean blue
        this.mapCtx.fillStyle = this.options.isDarkTheme ? '#1C2B33' : '#33485A';
        this.mapCtx.fillRect(0, 0, this.textureWidth, this.textureHeight);

        // Get all loaded tiles
        const tiles = tilePane.querySelectorAll('img.leaflet-tile');
        const loadedTiles = Array.from(tiles).filter(tile => tile.complete && tile.naturalWidth > 0);

        if (loadedTiles.length === 0) {
            this.scheduleMapRender();
            return;
        }

        // Calculate scale factor
        const scaleX = this.textureWidth / container.offsetWidth;
        const scaleY = this.textureHeight / container.offsetHeight;

        // Draw each tile onto the canvas
        loadedTiles.forEach(tile => {
            try {
                const rect = tile.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();

                const x = (rect.left - containerRect.left) * scaleX;
                const y = (rect.top - containerRect.top) * scaleY;
                const w = rect.width * scaleX;
                const h = rect.height * scaleY;

                this.mapCtx.drawImage(tile, x, y, w, h);
            } catch (e) {
                // Skip tiles that can't be drawn (CORS issues)
            }
        });

        // Process the canvas to create blue water + white continents effect
        if (this.options.useBlueOceans) {
            this.applyBlueOceansEffect();
        }

        // Update Three.js texture
        if (this.mapTexture) {
            this.mapTexture.needsUpdate = true;
        }

        this.mapDirty = false;
    }

    applyBlueOceansEffect() {
        // Get image data
        const imageData = this.mapCtx.getImageData(0, 0, this.textureWidth, this.textureHeight);
        const data = imageData.data;

        // Ocean color (beautiful deep blue)
        const oceanR = this.options.isDarkTheme ? 8 : 20;
        const oceanG = this.options.isDarkTheme ? 25 : 80;
        const oceanB = this.options.isDarkTheme ? 50 : 160;

        // Continent color (white/cream)
        const landR = this.options.isDarkTheme ? 220 : 250;
        const landG = this.options.isDarkTheme ? 225 : 250;
        const landB = this.options.isDarkTheme ? 235 : 248;

        // Border/coastline color
        const borderR = this.options.isDarkTheme ? 150 : 200;
        const borderG = this.options.isDarkTheme ? 160 : 210;
        const borderB = this.options.isDarkTheme ? 180 : 220;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Calculate luminance
            const luminance = (r * 0.299 + g * 0.587 + b * 0.114);

            // Stamen Toner tiles: white/very light = land, darker = water
            // Stamen Toner-Lite has light gray background (water) and white land
            if (luminance > 250) {
                // Pure white = land (continents) - make white/cream
                data[i] = landR;
                data[i + 1] = landG;
                data[i + 2] = landB;
            } else if (luminance > 220) {
                // Light = coastlines/borders or light land areas
                data[i] = borderR;
                data[i + 1] = borderG;
                data[i + 2] = borderB;
            } else if (luminance > 180) {
                // Medium-light gray = water in Stamen Toner-Lite
                data[i] = oceanR;
                data[i + 1] = oceanG;
                data[i + 2] = oceanB;
            } else if (luminance > 100) {
                // Medium = blend zone or features
                const blend = (luminance - 100) / 80;
                data[i] = Math.round(oceanR * (1 - blend) + borderR * blend);
                data[i + 1] = Math.round(oceanG * (1 - blend) + borderG * blend);
                data[i + 2] = Math.round(oceanB * (1 - blend) + borderB * blend);
            } else {
                // Dark = water (oceans) or dark features - make beautiful blue
                data[i] = oceanR;
                data[i + 1] = oceanG;
                data[i + 2] = oceanB;
            }
        }

        this.mapCtx.putImageData(imageData, 0, 0);
    }

    /* ========================================
       THREE.JS SCENE SETUP
       ======================================== */

    createScene() {
        this.scene = new THREE.Scene();
        this.updateBackground();
    }

    updateBackground() {
        if (this.options.isDarkTheme) {
            this.scene.background = new THREE.Color(0x0a0a12);
        } else {
            this.scene.background = new THREE.Color(0xe8f4fc);
        }
    }

    createCamera() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
        this.camera.position.set(0, 0, 3);
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: true
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);
    }

    createLights() {
        // Ambient light for overall illumination
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        // Directional light (sun)
        const sun = new THREE.DirectionalLight(0xffffff, 1.2);
        sun.position.set(5, 3, 5);
        this.scene.add(sun);

        // Accent light
        this.accentLight = new THREE.PointLight(
            this.options.isDarkTheme ? 0x6366f1 : 0x3b82f6,
            0.4,
            10
        );
        this.accentLight.position.set(-3, 2, 2);
        this.scene.add(this.accentLight);
    }

    createStars() {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 3000;
        const positions = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);

        for (let i = 0; i < starCount; i++) {
            const radius = 30 + Math.random() * 70;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
            sizes[i] = Math.random() * 1.5 + 0.5;
        }

        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const starMaterial = new THREE.PointsMaterial({
            color: this.options.isDarkTheme ? 0xffffff : 0x8899aa,
            size: 0.4,
            sizeAttenuation: true,
            transparent: true,
            opacity: this.options.isDarkTheme ? 0.9 : 0.3
        });

        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.stars);
    }

    /* ========================================
       GLOBE WITH DYNAMIC MAP TEXTURE
       ======================================== */

    createGlobe() {
        // High-detail sphere geometry
        const geometry = new THREE.SphereGeometry(this.globeRadius, 128, 64);

        // Custom shader material for proper UV mapping
        const material = new THREE.ShaderMaterial({
            uniforms: {
                mapTexture: { value: this.mapTexture },
                nightIntensity: { value: this.options.isDarkTheme ? 0.3 : 0.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vPosition;

                void main() {
                    vUv = uv;
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D mapTexture;
                uniform float nightIntensity;
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vPosition;

                void main() {
                    // Sample map texture
                    vec4 mapColor = texture2D(mapTexture, vUv);
                    
                    // Simple lighting
                    vec3 lightDir = normalize(vec3(1.0, 0.5, 1.0));
                    float light = max(dot(vNormal, lightDir), 0.0);
                    
                    // Mix day and night
                    vec3 finalColor = mapColor.rgb * (0.6 + light * 0.4);
                    
                    // Add slight night glow in dark areas
                    if (nightIntensity > 0.0) {
                        float nightGlow = (1.0 - light) * nightIntensity * 0.2;
                        finalColor += vec3(0.9, 0.8, 0.5) * nightGlow;
                    }
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `
        });

        this.globe = new THREE.Mesh(geometry, material);
        this.scene.add(this.globe);

        // Add grid overlay
        this.createGridOverlay();
    }

    createGridOverlay() {
        const gridGeometry = new THREE.SphereGeometry(this.globeRadius * 1.002, 72, 36);
        const gridMaterial = new THREE.MeshBasicMaterial({
            color: this.options.isDarkTheme ? 0x4f46e5 : 0x2563eb,
            wireframe: true,
            transparent: true,
            opacity: 0.08
        });

        this.gridOverlay = new THREE.Mesh(gridGeometry, gridMaterial);
        this.scene.add(this.gridOverlay);
    }

    createAtmosphere() {
        const atmosphereGeometry = new THREE.SphereGeometry(this.globeRadius * 1.12, 64, 64);

        // Use a blue glow that complements the ocean color
        const atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                glowColor: { value: new THREE.Color(this.options.isDarkTheme ? 0x4f9eff : 0x00bfff) },
                intensity: { value: 0.85 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 glowColor;
                uniform float intensity;
                varying vec3 vNormal;
                varying vec3 vPosition;
                
                void main() {
                    vec3 viewDir = normalize(-vPosition);
                    float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.5);
                    gl_FragColor = vec4(glowColor, fresnel * intensity);
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });

        this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.scene.add(this.atmosphere);
    }

    createControls() {
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.minDistance = 1.3;
            this.controls.maxDistance = 8;
            this.controls.enablePan = false;
            this.controls.autoRotate = true;
            this.controls.autoRotateSpeed = 0.3;
            this.controls.rotateSpeed = 0.5;

            // Sync camera distance to Leaflet zoom
            this.controls.addEventListener('change', () => {
                this.syncZoomFromCamera();
            });
        }
    }

    /* ========================================
       ZOOM SYNCHRONIZATION
       ======================================== */

    syncZoomFromCamera() {
        if (!this.controls || !this.leafletMap) return;

        const distance = this.camera.position.length();
        
        // Map camera distance to Leaflet zoom level
        // Close (1.3) = zoom 8, Far (8) = zoom 1
        const minDist = 1.3, maxDist = 8;
        const minZoom = 1, maxZoom = 8;
        
        const t = (distance - minDist) / (maxDist - minDist);
        const leafletZoom = Math.round(maxZoom - t * (maxZoom - minZoom));
        
        if (leafletZoom !== this.currentZoom && leafletZoom >= minZoom && leafletZoom <= maxZoom) {
            this.currentZoom = leafletZoom;
            this.leafletMap.setZoom(leafletZoom, { animate: false });
            this.scheduleMapRender();
        }
    }

    setZoom(level) {
        if (this.leafletMap) {
            this.leafletMap.setZoom(level, { animate: false });
            this.currentZoom = level;
            this.scheduleMapRender();
        }
    }

    panTo(lat, lon) {
        if (this.leafletMap) {
            this.leafletMap.setView([lat, lon], this.currentZoom, { animate: false });
            this.scheduleMapRender();
        }
    }

    /* ========================================
       NETWORK TRAFFIC VISUALIZATION
       ======================================== */

    latLonToVector3(lat, lon, radius = this.globeRadius) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);

        return new THREE.Vector3(
            -radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
        );
    }

    addArc(startLat, startLon, endLat, endLon, color = 0x818cf8) {
        const startPoint = this.latLonToVector3(startLat, startLon, this.globeRadius * 1.01);
        const endPoint = this.latLonToVector3(endLat, endLon, this.globeRadius * 1.01);

        // Calculate arc height based on distance
        const midPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
        const distance = startPoint.distanceTo(endPoint);
        midPoint.normalize().multiplyScalar(this.globeRadius * (1.0 + distance * 0.25));

        // Create curved path
        const curve = new THREE.QuadraticBezierCurve3(startPoint, midPoint, endPoint);
        const points = curve.getPoints(64);

        // Create arc line with gradient effect
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.7,
            linewidth: 2
        });

        const arc = new THREE.Line(geometry, material);
        this.scene.add(arc);

        // Create traveling particle
        const particleGeometry = new THREE.SphereGeometry(0.012, 12, 12);
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1
        });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        this.scene.add(particle);

        // Add glow around particle
        const glowGeometry = new THREE.SphereGeometry(0.025, 8, 8);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.4
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.scene.add(glow);

        // Store arc data for animation
        const arcData = {
            arc,
            particle,
            glow,
            curve,
            progress: Math.random(),
            speed: 0.003 + Math.random() * 0.004,
            color
        };

        this.arcs.push(arcData);

        // Add endpoint markers
        this.addCityMarker(startLat, startLon, 0x22c55e, 'source');
        this.addCityMarker(endLat, endLon, 0xef4444, 'destination');

        return arcData;
    }

    addCityMarker(lat, lon, color, type = 'city') {
        const position = this.latLonToVector3(lat, lon, this.globeRadius * 1.01);

        // Marker dot
        const dotGeometry = new THREE.SphereGeometry(0.015, 12, 12);
        const dotMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.95
        });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        dot.position.copy(position);
        this.scene.add(dot);

        // Outer ring
        const ringGeometry = new THREE.RingGeometry(0.02, 0.028, 24);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(position);
        ring.lookAt(new THREE.Vector3(0, 0, 0));
        this.scene.add(ring);

        this.cityMarkers.push({ dot, ring, position, color, type });

        return { dot, ring };
    }

    addSampleTraffic() {
        const routes = [
            // US to Europe
            { from: [40.7128, -74.0060], to: [51.5074, -0.1278], color: 0x818cf8 },
            // US to Asia
            { from: [37.7749, -122.4194], to: [35.6762, 139.6503], color: 0x22d3ee },
            // Europe to Australia
            { from: [48.8566, 2.3522], to: [-33.8688, 151.2093], color: 0x34d399 },
            // South America to Africa
            { from: [-23.5505, -46.6333], to: [-33.9249, 18.4241], color: 0xfbbf24 },
            // Asia to Middle East
            { from: [31.2304, 121.4737], to: [25.2048, 55.2708], color: 0xf472b6 },
            // Europe to Asia
            { from: [52.5200, 13.4050], to: [22.3193, 114.1694], color: 0xa78bfa },
            // US internal
            { from: [40.7128, -74.0060], to: [34.0522, -118.2437], color: 0x60a5fa }
        ];

        routes.forEach((route, i) => {
            setTimeout(() => {
                this.addArc(
                    route.from[0], route.from[1],
                    route.to[0], route.to[1],
                    route.color
                );
            }, i * 400);
        });
    }

    clearTraffic() {
        // Remove arcs
        this.arcs.forEach(arcData => {
            this.scene.remove(arcData.arc);
            this.scene.remove(arcData.particle);
            this.scene.remove(arcData.glow);
            arcData.arc.geometry.dispose();
            arcData.arc.material.dispose();
            arcData.particle.geometry.dispose();
            arcData.particle.material.dispose();
            arcData.glow.geometry.dispose();
            arcData.glow.material.dispose();
        });
        this.arcs = [];

        // Remove city markers
        this.cityMarkers.forEach(marker => {
            this.scene.remove(marker.dot);
            this.scene.remove(marker.ring);
            marker.dot.geometry.dispose();
            marker.dot.material.dispose();
            marker.ring.geometry.dispose();
            marker.ring.material.dispose();
        });
        this.cityMarkers = [];
    }

    /* ========================================
       EVENT LISTENERS
       ======================================== */

    setupEventListeners() {
        window.addEventListener('resize', () => this.onResize());

        // Mouse wheel zoom
        this.renderer.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (this.leafletMap) {
                const delta = e.deltaY > 0 ? -0.5 : 0.5;
                const newZoom = Math.max(1, Math.min(10, this.currentZoom + delta));
                if (newZoom !== this.currentZoom) {
                    this.setZoom(newZoom);
                }
            }
        }, { passive: false });
    }

    onResize() {
        if (!this.container) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /* ========================================
       THEME SUPPORT
       ======================================== */

    setTheme(isDark) {
        this.options.isDarkTheme = isDark;

        // Update background
        this.updateBackground();

        // Update stars
        if (this.stars) {
            this.stars.material.opacity = isDark ? 0.9 : 0.3;
            this.stars.material.color.set(isDark ? 0xffffff : 0x8899aa);
        }

        // Update atmosphere
        if (this.atmosphere) {
            this.atmosphere.material.uniforms.glowColor.value.set(isDark ? 0x818cf8 : 0x60a5fa);
        }

        // Update grid
        if (this.gridOverlay) {
            this.gridOverlay.material.color.set(isDark ? 0x4f46e5 : 0x2563eb);
        }

        // Update accent light
        if (this.accentLight) {
            this.accentLight.color.set(isDark ? 0x6366f1 : 0x3b82f6);
        }

        // Update globe shader
        if (this.globe && this.globe.material.uniforms) {
            this.globe.material.uniforms.nightIntensity.value = isDark ? 0.3 : 0.0;
        }

        // Update Leaflet tile layer
        this.updateTileLayer();
    }

    /* ========================================
       ANIMATION LOOP
       ======================================== */

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        // Update controls
        if (this.controls) {
            this.controls.update();
        }

        // Rotate globe slightly if auto-rotate is on
        if (this.globe && this.controls && this.controls.autoRotate) {
            // Globe rotation handled by OrbitControls
        }

        // Sync grid rotation with globe
        if (this.gridOverlay && this.globe) {
            this.gridOverlay.rotation.copy(this.globe.rotation);
        }

        // Animate arc particles
        this.arcs.forEach(arcData => {
            arcData.progress += arcData.speed;
            if (arcData.progress > 1) {
                arcData.progress = 0;
            }

            const point = arcData.curve.getPoint(arcData.progress);
            arcData.particle.position.copy(point);
            arcData.glow.position.copy(point);

            // Pulse effect
            const pulse = 1 + Math.sin(time * 8 + arcData.progress * Math.PI) * 0.3;
            arcData.particle.scale.setScalar(pulse);
            arcData.glow.scale.setScalar(pulse * 1.5);
        });

        // Animate city markers
        this.cityMarkers.forEach((marker, i) => {
            const pulse = 1 + Math.sin(time * 3 + i * 0.5) * 0.15;
            marker.ring.scale.setScalar(pulse);
        });

        // Render
        this.renderer.render(this.scene, this.camera);
    }

    /* ========================================
       CLEANUP
       ======================================== */

    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }

        // Clear traffic
        this.clearTraffic();

        // Dispose globe
        if (this.globe) {
            this.globe.geometry.dispose();
            this.globe.material.dispose();
            this.scene.remove(this.globe);
        }

        // Dispose atmosphere
        if (this.atmosphere) {
            this.atmosphere.geometry.dispose();
            this.atmosphere.material.dispose();
            this.scene.remove(this.atmosphere);
        }

        // Dispose stars
        if (this.stars) {
            this.stars.geometry.dispose();
            this.stars.material.dispose();
            this.scene.remove(this.stars);
        }

        // Dispose grid
        if (this.gridOverlay) {
            this.gridOverlay.geometry.dispose();
            this.gridOverlay.material.dispose();
            this.scene.remove(this.gridOverlay);
        }

        // Dispose controls
        if (this.controls) {
            this.controls.dispose();
        }

        // Dispose renderer
        if (this.renderer) {
            this.renderer.dispose();
            this.container.removeChild(this.renderer.domElement);
        }

        // Dispose Leaflet
        if (this.leafletMap) {
            this.leafletMap.remove();
        }

        if (this.leafletContainer && this.leafletContainer.parentNode) {
            this.leafletContainer.parentNode.removeChild(this.leafletContainer);
        }

        // Dispose texture
        if (this.mapTexture) {
            this.mapTexture.dispose();
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HybridEarthGlobe;
}
