/**
 * CyberForge Setup Wizard — Real System Integration
 * No mock data. Every value comes from Tauri IPC or live HTTP checks.
 */

(() => {
  'use strict';

  // ─── State ───
  const TOTAL_STEPS = 5;
  let currentStep = 0;
  let systemData  = {};
  let browsersData = [];
  let connectionResults = { api: false, ws: false, ml: false, db: false };

  const BACKEND_URL = 'https://cyberforge-ddd97655464f.herokuapp.com';
  const ML_URL      = 'https://che237-cyberforge.hf.space';

  // ─── Helpers ───
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ─── Check first-run ───
  document.addEventListener('DOMContentLoaded', () => {
    // If setup already complete, skip straight to auth
    if (localStorage.getItem('cyberforge_setup_complete') === 'true') {
      window.location.href = 'auth-page.html';
      return;
    }
    console.log('🧙 Setup Wizard starting — first launch detected');
    animateWelcome();
  });

  // ─── Navigation ───
  window.wizardNext = function () {
    if (currentStep >= TOTAL_STEPS - 1) return;
    const prev = currentStep;
    currentStep++;
    transitionStep(prev, currentStep);
    updateProgress();
    onStepEnter(currentStep);
  };

  window.wizardBack = function () {
    if (currentStep <= 0) return;
    const prev = currentStep;
    currentStep--;
    transitionStepBack(prev, currentStep);
    updateProgress();
  };

  function transitionStep(fromIdx, toIdx) {
    const steps = $$('.wizard-step');
    const from = steps[fromIdx];
    const to   = steps[toIdx];
    from.classList.remove('active');
    from.classList.add('exit-left');
    to.classList.add('active');
    to.classList.remove('exit-left');
  }

  function transitionStepBack(fromIdx, toIdx) {
    const steps = $$('.wizard-step');
    const from = steps[fromIdx];
    const to   = steps[toIdx];
    from.classList.remove('active');
    to.classList.remove('exit-left');
    to.classList.add('active');
  }

  function updateProgress() {
    const pct = (currentStep / (TOTAL_STEPS - 1)) * 100;
    $('#progress-fill').style.width = pct + '%';
    $$('.step-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === currentStep);
      dot.classList.toggle('done', i < currentStep);
    });
  }

  // ─── Step Enter Handlers ───
  function onStepEnter(step) {
    switch (step) {
      case 1: runSystemScan(); break;
      case 2: runBrowserDetection(); break;
      case 3: runConnectionTests(); break;
      case 4: showCompleteSummary(); break;
    }
  }

  // ═══════════════════════════════════════════════
  // STEP 0 — Welcome Animation
  // ═══════════════════════════════════════════════
  function animateWelcome() {
    if (typeof gsap !== 'undefined') {
      gsap.from('.shield-svg', { scale: 0, opacity: 0, duration: 0.8, ease: 'back.out(1.7)', delay: 0.2 });
      gsap.from('.step-title', { y: 30, opacity: 0, duration: 0.6, delay: 0.5 });
      gsap.from('.step-subtitle', { y: 20, opacity: 0, duration: 0.5, delay: 0.7 });
      gsap.from('.step-description', { y: 20, opacity: 0, duration: 0.5, delay: 0.9 });
      gsap.from('.meta-chip', { y: 15, opacity: 0, duration: 0.4, stagger: 0.1, delay: 1.1 });
      gsap.from('.wizard-btn.primary', { y: 20, opacity: 0, duration: 0.5, delay: 1.5 });
    }
  }

  // ═══════════════════════════════════════════════
  // STEP 1 — System Scan (Real Tauri data)
  // ═══════════════════════════════════════════════
  async function runSystemScan() {
    console.log('🔍 Running system scan via Tauri IPC...');
    const items = $$('#scan-results .scan-item');

    // Animate items in with stagger
    items.forEach((item, i) => {
      setTimeout(() => item.classList.add('visible'), i * 200);
    });

    try {
      // Call Tauri system stats command
      const stats = await window.electronAPI.getSystemStats();
      console.log('📊 System stats received:', stats);

      // Populate with real data — sequential reveal
      await sleep(400);
      setScanItem('scan-os', detectOSName(stats), 0);

      await sleep(500);
      setScanItem('scan-cpu', stats.cpu_model || `${stats.cpu_count || navigator.hardwareConcurrency} cores`, 1);

      await sleep(400);
      const memGB = stats.total_memory
        ? (stats.total_memory / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
        : 'Unknown';
      setScanItem('scan-memory', memGB, 2);

      await sleep(400);
      setScanItem('scan-arch', detectArch(), 3);

      await sleep(400);
      setScanItem('scan-hostname', stats.hostname || 'Unknown', 4);

      await sleep(400);
      const uptimeStr = stats.uptime
        ? formatUptime(stats.uptime)
        : 'Unknown';
      setScanItem('scan-uptime', uptimeStr, 5);

      // Store for summary
      systemData = {
        os: detectOSName(stats),
        cpu: stats.cpu_model || `${stats.cpu_count || '?'} cores`,
        memory: memGB,
        arch: detectArch(),
        hostname: stats.hostname || 'Unknown',
        uptime: uptimeStr
      };

    } catch (err) {
      console.error('System scan error:', err);

      // Fallback to navigator-based detection (still real, not mock)
      await sleep(400);
      setScanItem('scan-os', detectOSFromUA(), 0);
      await sleep(500);
      setScanItem('scan-cpu', `${navigator.hardwareConcurrency} cores`, 1);
      await sleep(400);
      const devMem = navigator.deviceMemory ? navigator.deviceMemory + ' GB (est.)' : 'Not available';
      setScanItem('scan-memory', devMem, 2);
      await sleep(400);
      setScanItem('scan-arch', detectArch(), 3);
      await sleep(400);
      setScanItem('scan-hostname', 'Local', 4);
      await sleep(400);
      setScanItem('scan-uptime', 'N/A', 5);

      systemData = {
        os: detectOSFromUA(),
        cpu: `${navigator.hardwareConcurrency} cores`,
        memory: devMem,
        arch: detectArch(),
        hostname: 'Local',
        uptime: 'N/A'
      };
    }

    // Enable continue button
    await sleep(300);
    const btn = $('#btn-after-scan');
    btn.classList.remove('disabled');
    btn.disabled = false;
  }

  function setScanItem(id, value, idx) {
    const item = $(`#${id}`);
    if (!item) return;
    const valueEl = item.querySelector('.scan-value');
    const statusEl = item.querySelector('.scan-status');
    if (valueEl) valueEl.textContent = value;
    if (statusEl) {
      statusEl.classList.remove('scanning');
      statusEl.classList.add('done');
      statusEl.innerHTML = '';
    }
    item.classList.add('done');
  }

  function detectOSName(stats) {
    const os = stats.os_name || stats.os || '';
    const ver = stats.os_version || '';
    if (os && ver) return `${os} ${ver}`;
    if (os) return os;
    return detectOSFromUA();
  }

  function detectOSFromUA() {
    const ua = navigator.userAgent;
    if (ua.includes('Mac OS X')) {
      const m = ua.match(/Mac OS X (\d+[_\.]\d+[_\.]?\d*)/);
      return 'macOS ' + (m ? m[1].replace(/_/g, '.') : '');
    }
    if (ua.includes('Windows NT 10')) return 'Windows 10/11';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Linux')) return 'Linux';
    return navigator.platform || 'Unknown';
  }

  function detectArch() {
    const ua = navigator.userAgent;
    if (ua.includes('arm64') || ua.includes('aarch64')) return 'ARM64 (Apple Silicon)';
    if (ua.includes('x86_64') || ua.includes('x64') || ua.includes('Win64') || ua.includes('Intel Mac')) return 'x86_64 (Intel)';
    return navigator.platform || 'Unknown';
  }

  function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(' ');
  }

  // ═══════════════════════════════════════════════
  // STEP 2 — Browser Detection (Real Tauri data)
  // ═══════════════════════════════════════════════
  async function runBrowserDetection() {
    console.log('🌐 Running browser detection via Tauri IPC...');
    const scanning = $('#browser-scanning');
    const list = $('#browser-list');
    const summary = $('#browser-summary');

    scanning.style.display = 'flex';
    list.style.display = 'none';
    summary.style.display = 'none';

    try {
      // Call real Tauri browser detection
      const result = await window.electronAPI.detectSystemBrowsers();
      console.log('🌐 Browser detection result:', result);

      let browsers = [];
      if (Array.isArray(result)) {
        browsers = result;
      } else if (result && Array.isArray(result.browsers)) {
        browsers = result.browsers;
      } else if (result && typeof result === 'object') {
        // Convert object format to array
        browsers = Object.entries(result).map(([k, v]) => ({
          name: v.name || k,
          version: v.version || 'Unknown',
          path: v.path || v.exec_path || '',
          is_running: v.is_running || v.running || false,
          is_default: v.is_default || false
        }));
      }

      if (browsers.length === 0) {
        throw new Error('No browsers detected');
      }

      browsersData = browsers;
      scanning.style.display = 'none';
      list.style.display = 'flex';

      // Render each browser card with staggered animation
      list.innerHTML = '';
      let runningCount = 0;

      browsers.forEach((browser, i) => {
        const name = browser.name || 'Unknown';
        const nameLower = name.toLowerCase();
        const version = browser.version || '';
        const path = browser.path || browser.exec_path || '';
        const isRunning = browser.is_running || browser.running || false;
        const isDefault = browser.is_default || false;
        if (isRunning) runningCount++;

        const iconClass = getBrowserIconClass(nameLower);
        const colorClass = getBrowserColorClass(nameLower);

        const card = document.createElement('div');
        card.className = `browser-card ${isRunning ? 'running' : ''}`;
        card.innerHTML = `
          <div class="browser-card-icon ${colorClass}">
            <i class="${iconClass}"></i>
          </div>
          <div class="browser-card-info">
            <div class="browser-card-name">${name}${isDefault ? ' <span style="font-size:10px;color:#4A7C59;">(Default)</span>' : ''}</div>
            <div class="browser-card-version">${version || 'Version unknown'}</div>
            ${path ? `<div class="browser-card-path" title="${path}">${path}</div>` : ''}
          </div>
          <div class="browser-card-state ${isRunning ? 'running' : 'installed'}">
            ${isRunning ? '● Running' : '● Installed'}
          </div>
          <div class="browser-card-monitor">
            <input type="checkbox" id="monitor-${i}" checked onchange="updateBrowserCount()">
            <label for="monitor-${i}">Monitor</label>
          </div>
        `;
        list.appendChild(card);

        // Stagger animation
        setTimeout(() => card.classList.add('visible'), (i + 1) * 250);
      });

      // Show summary
      await sleep(browsers.length * 250 + 300);
      summary.style.display = 'flex';
      $('#browsers-found').textContent = browsers.length;
      $('#browsers-running').textContent = runningCount;
      $('#browsers-selected').textContent = browsers.length;

      if (typeof gsap !== 'undefined') {
        gsap.from('.summary-stat', { y: 20, opacity: 0, duration: 0.5, stagger: 0.15 });
      }

      // Store browser selections
      storeBrowserSelections();

    } catch (err) {
      console.error('Browser detection error:', err);
      scanning.innerHTML = `
        <div style="text-align:center;padding:20px;">
          <i class="fas fa-exclamation-triangle" style="font-size:32px;color:#C7923E;margin-bottom:12px;"></i>
          <p style="color:#6B7A85;font-size:14px;">Browser detection unavailable</p>
          <p style="color:#94A3B8;font-size:12px;margin-top:4px;">${err.message}</p>
          <p style="color:#94A3B8;font-size:12px;margin-top:8px;">
            Ensure the Tauri desktop app is running.<br>
            Browser monitoring can be configured later in Settings.
          </p>
        </div>
      `;
    }

    // Enable continue button regardless
    const btn = $('#btn-after-browsers');
    btn.classList.remove('disabled');
    btn.disabled = false;
  }

  window.updateBrowserCount = function () {
    const checked = $$('.browser-card-monitor input:checked');
    $('#browsers-selected').textContent = checked.length;
    storeBrowserSelections();
  };

  function storeBrowserSelections() {
    const selected = [];
    $$('.browser-card-monitor input').forEach((cb, i) => {
      if (cb.checked && browsersData[i]) {
        selected.push(browsersData[i].name || 'Unknown');
      }
    });
    localStorage.setItem('cyberforge_monitored_browsers', JSON.stringify(selected));
  }

  function getBrowserIconClass(name) {
    if (name.includes('chrome') || name.includes('chromium')) return 'fab fa-chrome';
    if (name.includes('firefox')) return 'fab fa-firefox-browser';
    if (name.includes('safari')) return 'fab fa-safari';
    if (name.includes('edge')) return 'fab fa-edge';
    if (name.includes('brave')) return 'fab fa-brave';
    if (name.includes('opera')) return 'fab fa-opera';
    if (name.includes('arc')) return 'fas fa-circle-half-stroke';
    return 'fas fa-globe';
  }

  function getBrowserColorClass(name) {
    if (name.includes('chrome') || name.includes('chromium')) return 'chrome';
    if (name.includes('firefox')) return 'firefox';
    if (name.includes('safari')) return 'safari';
    if (name.includes('edge')) return 'edge';
    if (name.includes('brave')) return 'brave';
    if (name.includes('opera')) return 'opera';
    if (name.includes('arc')) return 'arc';
    return 'default';
  }

  // ═══════════════════════════════════════════════
  // STEP 3 — Backend Connection Tests (Real HTTP)
  // ═══════════════════════════════════════════════
  async function runConnectionTests() {
    console.log('🔌 Testing backend connections...');

    // 1) API Health Check
    await testConnection('conn-api', async () => {
      const resp = await fetch(`${BACKEND_URL}/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      connectionResults.api = true;
      return data;
    });

    await sleep(500);

    // 2) WebSocket Test
    setConnTesting('conn-ws');
    await testConnection('conn-ws', () => {
      return new Promise((resolve, reject) => {
        const wsProto = BACKEND_URL.startsWith('https') ? 'wss' : 'ws';
        const wsHost = BACKEND_URL.replace(/^https?:\/\//, '');
        const ws = new WebSocket(`${wsProto}://${wsHost}/ws`);
        const timeout = setTimeout(() => { ws.close(); reject(new Error('Timeout')); }, 8000);
        ws.onopen = () => {
          clearTimeout(timeout);
          connectionResults.ws = true;
          ws.close();
          resolve({ connected: true });
        };
        ws.onerror = (e) => { clearTimeout(timeout); reject(e); };
      });
    });

    await sleep(500);

    // 3) ML Service
    setConnTesting('conn-ml');
    await testConnection('conn-ml', async () => {
      const resp = await fetch(`${BACKEND_URL}/api/cyberforge-ml/health`, {
        signal: AbortSignal.timeout(10000)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      connectionResults.ml = true;
      return await resp.json();
    });

    await sleep(500);

    // 4) Database (test via backend health which includes DB check)
    setConnTesting('conn-db');
    await testConnection('conn-db', async () => {
      // The /health endpoint already checks MongoDB + Redis
      const resp = await fetch(`${BACKEND_URL}/health`, {
        signal: AbortSignal.timeout(8000)
      });
      const data = await resp.json();
      if (data.database === 'connected' || data.mongodb === 'connected' || data.status === 'ok') {
        connectionResults.db = true;
        return data;
      }
      throw new Error('Database not connected');
    });

    // Show overall result
    await sleep(400);
    const resultEl = $('#connection-result');
    resultEl.style.display = 'block';

    const successCount = Object.values(connectionResults).filter(Boolean).length;
    const badge = $('#conn-result-badge');
    const resultText = $('#conn-result-text');

    if (successCount === 4) {
      badge.className = 'result-badge success';
      badge.querySelector('i').className = 'fas fa-check-circle';
      resultText.textContent = 'All services connected';
    } else if (successCount >= 2) {
      badge.className = 'result-badge partial';
      badge.querySelector('i').className = 'fas fa-exclamation-circle';
      resultText.textContent = `${successCount}/4 services connected`;
    } else {
      badge.className = 'result-badge failed';
      badge.querySelector('i').className = 'fas fa-times-circle';
      resultText.textContent = 'Connection issues detected';
    }

    // Save backend URL to localStorage
    localStorage.setItem('cyberforge_backend_url', BACKEND_URL);

    // Enable continue
    const btn = $('#btn-after-connect');
    btn.classList.remove('disabled');
    btn.disabled = false;
  }

  function setConnTesting(id) {
    const item = $(`#${id}`);
    if (!item) return;
    const status = item.querySelector('.conn-status');
    status.className = 'conn-status testing';
    status.innerHTML = '<div class="mini-spinner"></div>';
  }

  async function testConnection(id, testFn) {
    const item = $(`#${id}`);
    if (!item) return;
    const status = item.querySelector('.conn-status');

    // Set testing state
    status.className = 'conn-status testing';
    status.innerHTML = '<div class="mini-spinner"></div>';

    try {
      await testFn();
      status.className = 'conn-status success';
      status.innerHTML = '';
      item.classList.add('success');
      console.log(`✅ ${id} connected`);
    } catch (err) {
      status.className = 'conn-status failed';
      status.innerHTML = '';
      item.classList.add('failed');
      console.warn(`❌ ${id} failed:`, err.message);
    }
  }

  // ═══════════════════════════════════════════════
  // STEP 4 — Completion Summary
  // ═══════════════════════════════════════════════
  function showCompleteSummary() {
    // Populate summary cards with real data
    $('#summary-os').textContent = systemData.os || detectOSFromUA();
    $('#summary-browsers').textContent = browsersData.length
      ? `${browsersData.length} detected`
      : 'None detected';

    const connCount = Object.values(connectionResults).filter(Boolean).length;
    $('#summary-backend').textContent = connCount === 4
      ? 'All Connected'
      : `${connCount}/4 Connected`;

    // Animate completion
    if (typeof gsap !== 'undefined') {
      gsap.from('.success-circle', { scale: 0, duration: 0.6, ease: 'back.out(1.7)' });
      gsap.from('.summary-card', { y: 30, opacity: 0, duration: 0.5, stagger: 0.1, delay: 0.6 });
      gsap.from('.launch-btn', { y: 20, opacity: 0, duration: 0.5, delay: 1.2 });
    }

    // Fire confetti
    setTimeout(launchConfetti, 800);
  }

  function launchConfetti() {
    const container = $('#confetti-container');
    if (!container) return;
    const colors = ['#4A7C59', '#5E9B6E', '#C7923E', '#3B82F6', '#E8E2D8', '#25343F'];
    for (let i = 0; i < 40; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.top = Math.random() * 30 + '%';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = Math.random() * 0.8 + 's';
      piece.style.animationDuration = (2 + Math.random() * 2) + 's';
      piece.style.width = (4 + Math.random() * 8) + 'px';
      piece.style.height = (4 + Math.random() * 8) + 'px';
      container.appendChild(piece);
    }
  }

  // ═══════════════════════════════════════════════
  // LAUNCH APP
  // ═══════════════════════════════════════════════
  window.launchApp = function () {
    // Mark setup as complete
    localStorage.setItem('cyberforge_setup_complete', 'true');
    localStorage.setItem('cyberforge_setup_date', new Date().toISOString());
    localStorage.setItem('cyberforge_backend_url', BACKEND_URL);

    // Store system info for Agent Center
    localStorage.setItem('cyberforge_system_data', JSON.stringify(systemData));
    localStorage.setItem('cyberforge_browsers_data', JSON.stringify(browsersData));

    // Register browsers with backend if API is connected
    if (connectionResults.api && browsersData.length > 0) {
      registerBrowsersWithBackend().catch(err => {
        console.warn('Browser registration deferred:', err.message);
      });
    }

    // Animate out and navigate
    if (typeof gsap !== 'undefined') {
      gsap.to('.wizard-container', {
        opacity: 0, scale: 0.95,
        duration: 0.5,
        onComplete: () => {
          window.location.href = 'auth-page.html';
        }
      });
    } else {
      window.location.href = 'auth-page.html';
    }
  };

  async function registerBrowsersWithBackend() {
    const token = localStorage.getItem('authToken');
    for (const browser of browsersData) {
      try {
        await fetch(`${BACKEND_URL}/api/browsers/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            'User-Agent': 'cyber-forge-desktop/2.0'
          },
          body: JSON.stringify({
            browser_name: browser.name,
            browser_version: browser.version || '',
            exec_path: browser.path || browser.exec_path || '',
            is_running: browser.is_running || false,
            is_default: browser.is_default || false,
            os: systemData.os || detectOSFromUA()
          })
        });
      } catch (e) {
        // Will be retried on next app launch or from Agent Center
      }
    }
  }

})();
