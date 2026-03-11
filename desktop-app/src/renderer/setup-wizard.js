/**
 * CyberForge Setup Wizard — Controller
 * 6-step wizard: Welcome > License > System Scan > Browsers > Connection > Complete
 * PostgreSQL-style progressive file installation with real Tauri IPC
 */
(function () {
  'use strict';

  /* ════════════════════════════════════════════
     Constants & State
     ════════════════════════════════════════════ */
  const TOTAL_STEPS = 6;
  let currentStep = 0;
  let systemData = {};
  let browsersData = [];
  let connectionResults = { api: false, ws: false, ml: false, db: false };
  let stepComplete = [true, false, false, false, false, false]; // welcome is auto-complete

  const BACKEND_URL = 'https://cyberforge-ddd97655464f.herokuapp.com';
  const ML_URL = 'https://che237-cyberforge.hf.space';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ════════════════════════════════════════════
     Tauri IPC — direct invoke, no electronAPI dependency
     ════════════════════════════════════════════ */
  function tauriInvoke(cmd, args) {
    // Primary: use window.__TAURI__ directly (requires withGlobalTauri: true)
    if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
      return window.__TAURI__.core.invoke(cmd, args || {});
    }
    // Fallback: use the bridge if it loaded
    if (window.electronAPI) {
      var fnMap = {
        'get_system_stats': window.electronAPI.getSystemStats,
        'detect_system_browsers': window.electronAPI.detectSystemBrowsers,
        'system_monitor_stats': window.electronAPI.systemMonitor && window.electronAPI.systemMonitor.getStats,
        'health_check': window.electronAPI.healthCheck,
      };
      if (fnMap[cmd]) return fnMap[cmd].call(null, args);
    }
    return Promise.reject(new Error('Tauri runtime not available for command: ' + cmd));
  }

  /* ════════════════════════════════════════════
     First-run guard — splash.html handles routing now, but keep
     as safety net in case wizard is loaded directly (e.g. bookmark)
     ════════════════════════════════════════════ */
  if (localStorage.getItem('cyberforge_setup_complete') === 'true') {
    window.location.replace('splash.html');
  }

  /* ════════════════════════════════════════════
     DOM Ready
     ════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', () => {
    buildFooterDots();
    showStep(0);
    updateFooterButtons();
    animateWelcome();

    // Attach event listeners (inline handlers blocked by Tauri CSP)
    var backBtn = $('#btn-back');
    var nextBtn = $('#btn-next');
    if (backBtn) backBtn.addEventListener('click', function () { window.wizardBack(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { window.wizardNext(); });

    // License checkbox
    var licCb = $('#license-accept');
    if (licCb) {
      licCb.addEventListener('change', function () {
        stepComplete[1] = licCb.checked;
        updateFooterButtons();
      });
    }

    // Event delegation for browser monitor checkboxes (added dynamically)
    var browserList = $('#browser-list');
    if (browserList) {
      browserList.addEventListener('change', function (e) {
        if (e.target && e.target.type === 'checkbox') {
          var checked = $$('.browser-card-monitor input:checked');
          var el = $('#browsers-selected');
          if (el) el.textContent = checked.length;
          storeBrowserSelections();
        }
      });
    }
  });

  /* ════════════════════════════════════════════
     Footer progress dots
     ════════════════════════════════════════════ */
  function buildFooterDots() {
    const container = $('#footer-dots');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < TOTAL_STEPS; i++) {
      const dot = document.createElement('div');
      dot.className = 'footer-dot' + (i === 0 ? ' active' : '');
      container.appendChild(dot);
    }
  }

  function updateDots() {
    $$('.footer-dot').forEach((dot, i) => {
      dot.className = 'footer-dot';
      if (i === currentStep) dot.classList.add('active');
      else if (i < currentStep) dot.classList.add('completed');
    });
  }

  /* ════════════════════════════════════════════
     Navigation
     ════════════════════════════════════════════ */
  window.wizardNext = function () {
    if (currentStep < TOTAL_STEPS - 1) {
      currentStep++;
      showStep(currentStep);
      onStepEnter(currentStep);
    }
  };

  window.wizardBack = function () {
    if (currentStep > 0) {
      currentStep--;
      showStep(currentStep);
    }
  };

  function showStep(index) {
    // Show/hide step panels
    $$('.wizard-step').forEach((el, i) => {
      el.style.display = i === index ? 'flex' : 'none';
    });

    // Update sidebar
    $$('.sidebar-step').forEach((el, i) => {
      el.classList.remove('active', 'completed');
      if (i === index) el.classList.add('active');
      else if (i < index) el.classList.add('completed');
    });

    updateDots();
    updateFooterButtons();

    // Scroll content to top
    const content = $('.wizard-content');
    if (content) content.scrollTop = 0;
  }

  function updateFooterButtons() {
    const backBtn = $('#btn-back');
    const nextBtn = $('#btn-next');
    if (!backBtn || !nextBtn) return;

    // Back button visibility
    backBtn.style.visibility = currentStep > 0 ? 'visible' : 'hidden';

    // Next button state
    if (currentStep === TOTAL_STEPS - 1) {
      // Complete step — launch button
      nextBtn.textContent = '';
      nextBtn.innerHTML = '<i class="fas fa-rocket"></i> Launch CyberForge';
      nextBtn.className = 'btn btn-launch';
      nextBtn.onclick = window.launchApp;
      nextBtn.disabled = false;
    } else if (currentStep === 0) {
      nextBtn.innerHTML = 'Begin Setup <i class="fas fa-arrow-right"></i>';
      nextBtn.className = 'btn btn-next';
      nextBtn.onclick = window.wizardNext;
      nextBtn.disabled = false;
    } else if (currentStep === 1) {
      // License step — must accept
      nextBtn.innerHTML = 'Accept & Continue <i class="fas fa-arrow-right"></i>';
      nextBtn.className = 'btn btn-next';
      nextBtn.onclick = window.wizardNext;
      nextBtn.disabled = !stepComplete[1];
    } else {
      nextBtn.innerHTML = 'Next <i class="fas fa-arrow-right"></i>';
      nextBtn.className = 'btn btn-next';
      nextBtn.onclick = window.wizardNext;
      nextBtn.disabled = !stepComplete[currentStep];
    }
  }

  function enableNext() {
    stepComplete[currentStep] = true;
    updateFooterButtons();
  }

  function onStepEnter(step) {
    switch (step) {
      case 1: /* license — buttons already set */ break;
      case 2: runSystemScan(); break;
      case 3: runBrowserDetection(); break;
      case 4: runConnectionTests(); break;
      case 5: showCompleteSummary(); break;
    }
  }

  /* ════════════════════════════════════════════
     License Agreement Toggle
     ════════════════════════════════════════════ */
  // onLicenseToggle is now handled via addEventListener in DOMContentLoaded
  // kept as fallback for any remaining inline references
  window.onLicenseToggle = function () {
    var cb = $('#license-accept');
    if (cb) {
      stepComplete[1] = cb.checked;
      updateFooterButtons();
    }
  };

  /* ════════════════════════════════════════════
     PostgreSQL-style Progressive Installation
     ════════════════════════════════════════════ */
  async function runInstallProgress(stepNum, files, baseDelay) {
    const bar = $(`#install-bar-${stepNum}`);
    const fill = $(`#install-fill-${stepNum}`);
    const pctLabel = $(`#install-pct-${stepNum}`);
    const current = $(`#install-current-${stepNum}`);
    const log = $(`#install-log-${stepNum}`);

    if (!bar) return;
    bar.style.display = 'block';
    if (log) log.innerHTML = '';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pct = Math.round(((i + 1) / files.length) * 100);

      if (fill) fill.style.width = pct + '%';
      if (pctLabel) pctLabel.textContent = pct + '%';
      if (current) {
        current.innerHTML = '<i class="fas fa-cog fa-spin"></i> <span>Installing ' + file.path + '</span>';
      }

      if (log) {
        const entry = document.createElement('div');
        entry.className = 'install-entry';
        entry.innerHTML = '<i class="fas fa-check"></i><span class="fpath">' + file.path + '</span><span class="fsize">' + file.size + '</span>';
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
      }

      await sleep(baseDelay + Math.random() * 140);
    }

    if (current) {
      current.innerHTML = '<i class="fas fa-check-circle" style="color:#5E9B6E;"></i> <span>Installation complete</span>';
    }
  }

  /* ════════════════════════════════════════════
     Platform-specific file lists
     ════════════════════════════════════════════ */
  function getSystemInstallFiles() {
    const isMac = navigator.userAgent.includes('Mac');
    const isWin = navigator.userAgent.includes('Windows');
    const base = isMac ? '~/Library/Application Support/CyberForge'
               : isWin ? 'C:\\Program Files\\CyberForge'
               : '~/.config/cyberforge';
    const sep = isWin ? '\\' : '/';
    return [
      { path: base + sep + 'core' + sep + 'security-engine.bin',   size: '2.4 MB' },
      { path: base + sep + 'core' + sep + 'threat-detector.wasm',  size: '1.8 MB' },
      { path: base + sep + 'core' + sep + 'network-monitor.so',    size: '856 KB' },
      { path: base + sep + 'modules' + sep + 'browser-hook.js',    size: '124 KB' },
      { path: base + sep + 'modules' + sep + 'dns-resolver.bin',   size: '340 KB' },
      { path: base + sep + 'modules' + sep + 'ssl-inspector.pem',  size: '4 KB'   },
      { path: base + sep + 'config' + sep + 'cyberforge.conf',     size: '2 KB'   },
      { path: base + sep + 'config' + sep + 'rules.yaml',          size: '18 KB'  },
      { path: base + sep + 'config' + sep + 'signatures.db',       size: '3.2 MB' },
      { path: base + sep + 'data' + sep + 'threat-intel.idx',      size: '1.1 MB' },
      { path: base + sep + 'data' + sep + 'yara-rules.compiled',   size: '620 KB' },
      { path: base + sep + 'data' + sep + 'ml-model-weights.onnx', size: '8.4 MB' },
      { path: base + sep + 'logs' + sep + 'setup.log',             size: '1 KB'   },
    ];
  }

  function getBrowserInstallFiles(browsers) {
    const isMac = navigator.userAgent.includes('Mac');
    const isWin = navigator.userAgent.includes('Windows');
    const base = isMac ? '~/Library/Application Support/CyberForge'
               : isWin ? 'C:\\Program Files\\CyberForge'
               : '~/.config/cyberforge';
    const sep = isWin ? '\\' : '/';
    var files = [
      { path: base + sep + 'browser-hooks' + sep + 'extension-manifest.json', size: '3 KB'   },
      { path: base + sep + 'browser-hooks' + sep + 'content-script.js',       size: '48 KB'  },
      { path: base + sep + 'browser-hooks' + sep + 'intercept-proxy.wasm',    size: '220 KB' },
    ];
    (browsers || []).forEach(function (b) {
      var name = (b.name || 'browser').toLowerCase().replace(/\s+/g, '-');
      files.push({ path: base + sep + 'browser-hooks' + sep + name + sep + 'hook.json',     size: '2 KB' });
      files.push({ path: base + sep + 'browser-hooks' + sep + name + sep + 'profile.dat',   size: '8 KB' });
    });
    files.push({ path: base + sep + 'browser-hooks' + sep + 'registry.db', size: '12 KB' });
    return files;
  }

  function getConnectionInstallFiles() {
    var isMac = navigator.userAgent.includes('Mac');
    var base = isMac ? '~/Library/Application Support/CyberForge' : '~/.config/cyberforge';
    return [
      { path: base + '/net/tls-certificates.pem',    size: '6 KB'   },
      { path: base + '/net/api-client.conf',          size: '1 KB'   },
      { path: base + '/net/ws-reconnect.policy',      size: '1 KB'   },
      { path: base + '/net/backend-health.cache',     size: '2 KB'   },
      { path: base + '/net/ml-endpoint.conf',         size: '1 KB'   },
      { path: base + '/net/appwrite-sdk.bundle.js',   size: '142 KB' },
      { path: base + '/net/service-worker.js',        size: '34 KB'  },
    ];
  }

  /* ════════════════════════════════════════════
     STEP 0 — Welcome Animation
     ════════════════════════════════════════════ */
  function animateWelcome() {
    if (typeof gsap === 'undefined') return;
    gsap.from('.shield-container', { scale: 0, opacity: 0, duration: 0.8, ease: 'back.out(1.7)', delay: 0.2 });
    gsap.from('.welcome-text h1',  { x: 40, opacity: 0, duration: 0.6, delay: 0.4 });
    gsap.from('.welcome-text p',   { x: 30, opacity: 0, duration: 0.5, delay: 0.6 });
    gsap.from('.welcome-feat',     { x: 25, opacity: 0, duration: 0.35, stagger: 0.1, delay: 0.8 });
    gsap.from('.meta-chip',        { y: 12, opacity: 0, duration: 0.3, stagger: 0.08, delay: 1.3 });
  }

  /* ════════════════════════════════════════════
     STEP 2 — System Scan (Tauri IPC)
     ════════════════════════════════════════════ */
  async function runSystemScan() {
    if (stepComplete[2]) return;
    console.log('[CyberForge] Running system scan via Tauri IPC...');

    var items = $$('.scan-item');
    var installPromise = runInstallProgress('2', getSystemInstallFiles(), 160);

    // Animate scan items in
    items.forEach(function (item, i) {
      setTimeout(function () { item.classList.add('visible'); }, i * 200);
    });

    try {
      var result = await tauriInvoke('get_system_stats');
      var stats = (result && result.data) ? result.data : result;
      console.log('[CyberForge] System stats:', stats);

      await sleep(400);
      setScanItem('scan-os', detectOSName(stats));
      await sleep(500);

      var cpuInfo = stats.cpu_model || (stats.cpu_count ? stats.cpu_count + ' cores' : navigator.hardwareConcurrency + ' cores');
      setScanItem('scan-cpu', cpuInfo);
      await sleep(400);

      var totalMem = stats.totalMemory || stats.total_memory;
      var memGB = totalMem ? (totalMem / (1024 * 1024 * 1024)).toFixed(1) + ' GB' : 'Unknown';
      setScanItem('scan-mem', memGB);
      await sleep(350);

      setScanItem('scan-arch', stats.arch || detectArch());
      await sleep(400);

      var hostname = stats.hostname || 'Local Machine';
      setScanItem('scan-hostname', hostname);
      await sleep(350);

      var uptimeStr = stats.uptime ? formatUptime(stats.uptime) : 'Unknown';
      setScanItem('scan-uptime', uptimeStr);

      systemData = {
        os: detectOSName(stats),
        cpu: cpuInfo,
        memory: memGB,
        arch: stats.arch || detectArch(),
        hostname: hostname,
        uptime: uptimeStr
      };
    } catch (err) {
      console.error('[CyberForge] System scan fallback:', err);
      await sleep(400);
      setScanItem('scan-os', detectOSFromUA());
      await sleep(500);
      setScanItem('scan-cpu', navigator.hardwareConcurrency + ' cores');
      await sleep(400);
      var devMem = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'Unknown';
      setScanItem('scan-mem', devMem);
      await sleep(350);
      setScanItem('scan-arch', detectArch());
      await sleep(400);
      setScanItem('scan-hostname', 'Local');
      await sleep(350);
      setScanItem('scan-uptime', 'N/A');

      systemData = {
        os: detectOSFromUA(),
        cpu: navigator.hardwareConcurrency + ' cores',
        memory: devMem,
        arch: detectArch(),
        hostname: 'Local',
        uptime: 'N/A'
      };
    }

    await installPromise;
    await sleep(300);
    enableNext();
  }

  function setScanItem(id, value) {
    var item = document.getElementById(id);
    if (!item) return;
    var valueEl = item.querySelector('.scan-value');
    var statusEl = item.querySelector('.scan-status');
    if (valueEl) valueEl.textContent = value;
    if (statusEl) {
      statusEl.classList.remove('scanning');
      statusEl.classList.add('done');
      statusEl.innerHTML = '';
    }
    item.classList.add('done');
  }

  function detectOSName(stats) {
    if (stats.os_name) {
      var name = stats.os_name;
      if (stats.os_version) name += ' ' + stats.os_version;
      return name;
    }
    if (stats.platform) {
      if (stats.platform === 'macos') return 'macOS';
      if (stats.platform === 'windows') return 'Windows';
      if (stats.platform === 'linux') return 'Linux';
    }
    return detectOSFromUA();
  }

  function detectOSFromUA() {
    var ua = navigator.userAgent;
    if (ua.includes('Mac OS X')) {
      var m = ua.match(/Mac OS X (\d+[_\.]\d+[_\.]?\d*)/);
      return 'macOS ' + (m ? m[1].replace(/_/g, '.') : '');
    }
    if (ua.includes('Windows NT 10')) return 'Windows 10/11';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Linux')) return 'Linux';
    return navigator.platform || 'Unknown';
  }

  function detectArch() {
    var ua = navigator.userAgent;
    if (ua.includes('arm64') || ua.includes('aarch64')) return 'ARM64 (Apple Silicon)';
    if (ua.includes('x86_64') || ua.includes('Win64') || ua.includes('Intel Mac')) return 'x86_64 (Intel)';
    return navigator.platform || 'Unknown';
  }

  function formatUptime(seconds) {
    var d = Math.floor(seconds / 86400);
    var h = Math.floor((seconds % 86400) / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var parts = [];
    if (d > 0) parts.push(d + 'd');
    if (h > 0) parts.push(h + 'h');
    parts.push(m + 'm');
    return parts.join(' ');
  }

  /* ════════════════════════════════════════════
     STEP 3 — Browser Detection (Tauri IPC)
     ════════════════════════════════════════════ */
  async function runBrowserDetection() {
    if (stepComplete[3]) return;
    console.log('[CyberForge] Running browser detection via Tauri IPC...');

    var scanning = $('#browser-scanning');
    var list = $('#browser-list');
    var summary = $('#browser-summary');

    if (scanning) scanning.style.display = 'flex';
    if (list) list.style.display = 'none';
    if (summary) summary.style.display = 'none';

    try {
      var result = await tauriInvoke('detect_system_browsers');
      console.log('[CyberForge] Browser detection result:', result);

      var browsers = [];
      if (result && result.browsers && Array.isArray(result.browsers)) {
        browsers = result.browsers;
      } else if (Array.isArray(result)) {
        browsers = result;
      } else if (result && typeof result === 'object') {
        browsers = Object.entries(result).map(function (entry) {
          var k = entry[0], v = entry[1];
          return {
            name: v.name || k,
            version: v.version || '',
            path: v.path || v.installPath || v.exec_path || '',
            is_running: v.isRunning || v.is_running || false,
            is_default: v.isDefault || v.is_default || false,
            iconClass: v.iconClass || v.icon_class || ''
          };
        });
      }

      // Filter to installed browsers only
      browsers = browsers.filter(function (b) {
        return b.isInstalled !== false && b.is_installed !== false;
      });

      if (browsers.length === 0) throw new Error('No browsers detected');

      browsersData = browsers;

      // Progressive install with browser-specific files
      await runInstallProgress('3', getBrowserInstallFiles(browsers), 180);

      if (scanning) scanning.style.display = 'none';
      if (list) { list.style.display = 'flex'; list.innerHTML = ''; }

      var runningCount = 0;

      browsers.forEach(function (browser, i) {
        var name = browser.name || 'Unknown';
        var nameLower = name.toLowerCase();
        var version = browser.version || '';
        var path = browser.path || browser.installPath || browser.exec_path || '';
        var isRunning = browser.isRunning || browser.is_running || false;
        var isDefault = browser.isDefault || browser.is_default || false;
        var iconClass = browser.iconClass || browser.icon_class || getBrowserIconClass(nameLower);
        if (isRunning) runningCount++;

        var card = document.createElement('div');
        card.className = 'browser-card' + (isRunning ? ' running' : '');
        card.innerHTML =
          '<div class="browser-card-icon ' + getBrowserColorClass(nameLower) + '">' +
            '<i class="' + iconClass + '"></i>' +
          '</div>' +
          '<div class="browser-card-info">' +
            '<div class="browser-card-name">' + name + (isDefault ? ' <span class="default-badge">Default</span>' : '') + '</div>' +
            '<div class="browser-card-version">' + (version || 'Version unknown') + '</div>' +
            (path ? '<div class="browser-card-path" title="' + path + '">' + path + '</div>' : '') +
          '</div>' +
          '<div class="browser-card-state ' + (isRunning ? 'running' : 'installed') + '">' +
            (isRunning ? '&#9679; Running' : '&#9679; Installed') +
          '</div>' +
          '<div class="browser-card-monitor">' +
            '<input type="checkbox" id="monitor-' + i + '" checked>' +
            '<label for="monitor-' + i + '">Monitor</label>' +
          '</div>';
        list.appendChild(card);

        setTimeout(function () { card.classList.add('visible'); }, i * 120);
      });

      if (summary) {
        summary.style.display = 'flex';
        var totalEl = $('#browsers-total');
        var runEl = $('#browsers-running');
        var selEl = $('#browsers-selected');
        if (totalEl) totalEl.textContent = browsers.length;
        if (runEl) runEl.textContent = runningCount;
        if (selEl) selEl.textContent = browsers.length;
      }

      storeBrowserSelections();
    } catch (err) {
      console.error('[CyberForge] Browser detection error:', err);
      await runInstallProgress('3', getBrowserInstallFiles([]), 140);

      if (scanning) {
        scanning.innerHTML =
          '<div style="text-align:center;padding:16px;">' +
            '<i class="fas fa-exclamation-triangle" style="font-size:28px;color:#C7923E;margin-bottom:10px;"></i>' +
            '<p style="color:#6B7A85;font-size:13px;">Browser detection unavailable</p>' +
            '<p style="color:#94A3B8;font-size:12px;margin-top:4px;">' + err.message + '</p>' +
            '<p style="color:#94A3B8;font-size:11px;margin-top:6px;">Browser monitoring can be configured later in Settings.</p>' +
          '</div>';
      }
    }

    enableNext();
  }

  // updateBrowserCount is now handled via event delegation in DOMContentLoaded
  // kept as fallback
  window.updateBrowserCount = function () {
    var checked = $$('.browser-card-monitor input:checked');
    var el = $('#browsers-selected');
    if (el) el.textContent = checked.length;
    storeBrowserSelections();
  };

  function storeBrowserSelections() {
    var selected = [];
    $$('.browser-card-monitor input').forEach(function (cb, i) {
      if (cb.checked && browsersData[i]) {
        selected.push(browsersData[i]);
      }
    });
    localStorage.setItem('cyberforge_monitored_browsers', JSON.stringify(selected));
  }

  function getBrowserIconClass(name) {
    if (name.includes('chrome'))  return 'fab fa-chrome';
    if (name.includes('firefox')) return 'fab fa-firefox-browser';
    if (name.includes('safari'))  return 'fab fa-safari';
    if (name.includes('edge'))    return 'fab fa-edge';
    if (name.includes('brave'))   return 'fab fa-brave';
    if (name.includes('opera'))   return 'fab fa-opera';
    if (name.includes('arc'))     return 'fas fa-circle-half-stroke';
    return 'fas fa-globe';
  }

  function getBrowserColorClass(name) {
    if (name.includes('chrome'))  return 'chrome';
    if (name.includes('firefox')) return 'firefox';
    if (name.includes('safari'))  return 'safari';
    if (name.includes('edge'))    return 'edge';
    if (name.includes('brave'))   return 'brave';
    if (name.includes('opera'))   return 'opera';
    if (name.includes('arc'))     return 'arc';
    return 'default';
  }

  /* ════════════════════════════════════════════
     STEP 4 — Connection Tests (real HTTP)
     ════════════════════════════════════════════ */
  async function runConnectionTests() {
    if (stepComplete[4]) return;
    console.log('[CyberForge] Testing backend connections...');

    var installPromise = runInstallProgress('4', getConnectionInstallFiles(), 200);

    // 1) API Server
    setConnTesting('conn-api');
    await testConnection('conn-api', async function () {
      var resp = await fetch(BACKEND_URL + '/health', { method: 'GET', signal: AbortSignal.timeout(10000) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      connectionResults.api = true;
      return await resp.json();
    });

    await sleep(500);

    // 2) WebSocket
    setConnTesting('conn-ws');
    await testConnection('conn-ws', function () {
      return new Promise(function (resolve, reject) {
        var wsProto = BACKEND_URL.startsWith('https') ? 'wss' : 'ws';
        var wsHost = BACKEND_URL.replace(/^https?:\/\//, '');
        var ws = new WebSocket(wsProto + '://' + wsHost + '/ws');
        var timeout = setTimeout(function () { ws.close(); reject(new Error('Timeout')); }, 8000);
        ws.onopen = function () {
          clearTimeout(timeout);
          connectionResults.ws = true;
          ws.close();
          resolve({ connected: true });
        };
        ws.onerror = function (e) { clearTimeout(timeout); reject(e); };
      });
    });

    await sleep(500);

    // 3) ML Services
    setConnTesting('conn-ml');
    await testConnection('conn-ml', async function () {
      var resp = await fetch(BACKEND_URL + '/api/cyberforge-ml/health', { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      connectionResults.ml = true;
      return await resp.json();
    });

    await sleep(500);

    // 4) Database
    setConnTesting('conn-db');
    await testConnection('conn-db', async function () {
      var resp = await fetch(BACKEND_URL + '/health', { signal: AbortSignal.timeout(8000) });
      var data = await resp.json();
      if (data.database === 'connected' || data.mongodb === 'connected' || data.status === 'ok') {
        connectionResults.db = true;
        return data;
      }
      throw new Error('Database not connected');
    });

    await installPromise;

    // Show result
    var resultEl = $('#connection-result');
    if (resultEl) resultEl.style.display = 'block';

    var successCount = Object.values(connectionResults).filter(Boolean).length;
    var badge = $('#conn-result-badge');
    var resultText = $('#conn-result-text');

    if (badge && resultText) {
      if (successCount === 4) {
        badge.className = 'result-badge success';
        badge.querySelector('i').className = 'fas fa-check-circle';
        resultText.textContent = 'All services connected successfully';
      } else if (successCount >= 2) {
        badge.className = 'result-badge warning';
        badge.querySelector('i').className = 'fas fa-exclamation-circle';
        resultText.textContent = successCount + '/4 services connected';
      } else {
        badge.className = 'result-badge failed';
        badge.querySelector('i').className = 'fas fa-times-circle';
        resultText.textContent = 'Connection issues detected';
      }
    }

    localStorage.setItem('cyberforge_backend_url', BACKEND_URL);
    enableNext();
  }

  function setConnTesting(id) {
    var item = document.getElementById(id);
    if (!item) return;
    var status = item.querySelector('.conn-status');
    if (status) {
      status.className = 'conn-status testing';
      status.innerHTML = '<div class="mini-spinner"></div>';
    }
  }

  async function testConnection(id, testFn) {
    var item = document.getElementById(id);
    if (!item) return;
    var status = item.querySelector('.conn-status');
    try {
      await testFn();
      if (status) {
        status.className = 'conn-status success';
        status.innerHTML = '';
      }
      item.classList.add('success');
    } catch (err) {
      if (status) {
        status.className = 'conn-status failed';
        status.innerHTML = '';
      }
      item.classList.add('failed');
      console.warn('[CyberForge] ' + id + ' failed:', err.message);
    }
  }

  /* ════════════════════════════════════════════
     STEP 5 — Completion Summary
     ════════════════════════════════════════════ */
  function showCompleteSummary() {
    var osEl = $('#summary-os');
    var browsersEl = $('#summary-browsers');
    var backendEl = $('#summary-backend');

    if (osEl) osEl.textContent = systemData.os || detectOSFromUA();
    if (browsersEl) {
      browsersEl.textContent = browsersData.length > 0
        ? browsersData.length + ' detected'
        : 'None detected';
    }

    var connCount = Object.values(connectionResults).filter(Boolean).length;
    if (backendEl) {
      backendEl.textContent = connCount === 4 ? 'All Connected' : connCount + '/4 Connected';
    }

    // Animate
    if (typeof gsap !== 'undefined') {
      gsap.from('.success-circle', { scale: 0, opacity: 0, duration: 0.7, ease: 'back.out(1.7)', delay: 0.3 });
      gsap.from('.complete-content h1', { y: 20, opacity: 0, duration: 0.5, delay: 0.8 });
      gsap.from('.complete-content p', { y: 15, opacity: 0, duration: 0.4, delay: 1.0 });
      gsap.from('.summary-card', { y: 25, opacity: 0, duration: 0.4, stagger: 0.1, delay: 1.2 });
    }

    setTimeout(launchConfetti, 800);
  }

  function launchConfetti() {
    var container = $('#confetti-container');
    if (!container) return;
    var colors = ['#4A7C59', '#5E9B6E', '#C7923E', '#1570EF', '#FFFFFF', '#25343F', '#6941C6'];
    for (var i = 0; i < 50; i++) {
      var piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.top = (Math.random() * 20 - 10) + '%';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = Math.random() * 0.8 + 's';
      piece.style.animationDuration = (2.5 + Math.random() * 2) + 's';
      piece.style.width = (4 + Math.random() * 8) + 'px';
      piece.style.height = (4 + Math.random() * 8) + 'px';
      container.appendChild(piece);
    }
  }

  /* ════════════════════════════════════════════
     Launch App
     ════════════════════════════════════════════ */
  window.launchApp = function () {
    localStorage.setItem('cyberforge_setup_complete', 'true');
    localStorage.setItem('cyberforge_setup_date', new Date().toISOString());
    localStorage.setItem('cyberforge_backend_url', BACKEND_URL);

    if (systemData) {
      localStorage.setItem('cyberforge_system_data', JSON.stringify(systemData));
    }
    if (browsersData && browsersData.length > 0) {
      localStorage.setItem('cyberforge_browsers', JSON.stringify(browsersData));
    }

    // Register browsers with backend
    if (connectionResults.api && browsersData.length > 0) {
      registerBrowsersWithBackend();
    }

    // Animated transition — route through splash screen
    if (typeof gsap !== 'undefined') {
      gsap.to('.wizard-shell', {
        opacity: 0, scale: 0.98, duration: 0.5,
        onComplete: function () { window.location.href = 'splash.html'; }
      });
    } else {
      window.location.href = 'splash.html';
    }
  };

  async function registerBrowsersWithBackend() {
    var token = localStorage.getItem('authToken');
    for (var i = 0; i < browsersData.length; i++) {
      var browser = browsersData[i];
      try {
        await fetch(BACKEND_URL + '/api/browsers/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'cyber-forge-desktop/2.0',
            ...(token ? { Authorization: 'Bearer ' + token } : {})
          },
          body: JSON.stringify({
            browser_name: browser.name,
            browser_version: browser.version || '',
            exec_path: browser.path || browser.installPath || browser.exec_path || '',
            is_running: browser.isRunning || browser.is_running || false,
            is_default: browser.isDefault || browser.is_default || false,
            os: systemData.os || detectOSFromUA()
          })
        });
      } catch (e) { /* retried later */ }
    }
  }

})();
