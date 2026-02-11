/**
 * CyberForge Browser Integration Manager
 * Handles deep browser integration for real-time monitoring
 * Creates browser extensions, configures native messaging, and sets up debug protocols
 */

const { app, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync, exec, spawn } = require('child_process');

class BrowserIntegrationManager {
  constructor() {
    this.platform = process.platform;
    this.appDataPath = this.getAppDataPath();
    this.extensionId = 'cyberforge-monitor';
    this.nativeHostName = 'com.cyberforge.monitor';
    
    // Browser-specific paths
    this.browserPaths = this.getBrowserPaths();
  }

  /**
   * Get application data path
   */
  getAppDataPath() {
    const appName = 'CyberForge';
    if (this.platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', appName);
    } else if (this.platform === 'win32') {
      return path.join(process.env.APPDATA || os.homedir(), appName);
    } else {
      return path.join(os.homedir(), '.config', appName.toLowerCase());
    }
  }

  /**
   * Get browser-specific configuration paths
   */
  getBrowserPaths() {
    const home = os.homedir();
    
    if (this.platform === 'darwin') {
      return {
        chrome: {
          nativeMessaging: path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'),
          policies: '/Library/Google/Chrome/policies/managed',
          userPolicies: path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'policies', 'managed'),
          extensions: path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'External Extensions'),
          debugFlags: '--remote-debugging-port=9222'
        },
        brave: {
          nativeMessaging: path.join(home, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
          policies: '/Library/BraveSoftware/Brave-Browser/policies/managed',
          userPolicies: path.join(home, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser', 'policies', 'managed'),
          debugFlags: '--remote-debugging-port=9223'
        },
        edge: {
          nativeMessaging: path.join(home, 'Library', 'Application Support', 'Microsoft Edge', 'NativeMessagingHosts'),
          policies: '/Library/Microsoft/Edge/policies/managed',
          userPolicies: path.join(home, 'Library', 'Application Support', 'Microsoft Edge', 'policies', 'managed'),
          debugFlags: '--remote-debugging-port=9224'
        },
        firefox: {
          nativeMessaging: path.join(home, 'Library', 'Application Support', 'Mozilla', 'NativeMessagingHosts'),
          profiles: path.join(home, 'Library', 'Application Support', 'Firefox', 'Profiles')
        },
        arc: {
          nativeMessaging: path.join(home, 'Library', 'Application Support', 'Arc', 'NativeMessagingHosts'),
          debugFlags: '--remote-debugging-port=9226'
        }
      };
    } else if (this.platform === 'win32') {
      return {
        chrome: {
          nativeMessaging: path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data', 'NativeMessagingHosts'),
          registryKey: 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts',
          policies: 'HKLM\\Software\\Policies\\Google\\Chrome',
          debugFlags: '--remote-debugging-port=9222'
        },
        brave: {
          nativeMessaging: path.join(process.env.LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'User Data', 'NativeMessagingHosts'),
          registryKey: 'HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts',
          debugFlags: '--remote-debugging-port=9223'
        },
        edge: {
          nativeMessaging: path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data', 'NativeMessagingHosts'),
          registryKey: 'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts',
          debugFlags: '--remote-debugging-port=9224'
        },
        firefox: {
          nativeMessaging: path.join(process.env.APPDATA, 'Mozilla', 'NativeMessagingHosts'),
          registryKey: 'HKCU\\Software\\Mozilla\\NativeMessagingHosts'
        }
      };
    } else {
      // Linux
      return {
        chrome: {
          nativeMessaging: path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts'),
          policies: '/etc/opt/chrome/policies/managed',
          debugFlags: '--remote-debugging-port=9222'
        },
        brave: {
          nativeMessaging: path.join(home, '.config', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
          debugFlags: '--remote-debugging-port=9223'
        },
        chromium: {
          nativeMessaging: path.join(home, '.config', 'chromium', 'NativeMessagingHosts'),
          debugFlags: '--remote-debugging-port=9225'
        },
        firefox: {
          nativeMessaging: path.join(home, '.mozilla', 'native-messaging-hosts')
        }
      };
    }
  }

  /**
   * Full browser integration setup
   */
  async setupBrowserIntegration(browsers) {
    const results = {
      nativeMessaging: [],
      browserShortcuts: [],
      extensions: [],
      permissions: []
    };

    console.log('[BrowserIntegration] Starting full browser integration setup...');

    for (const browser of browsers) {
      try {
        // 1. Setup Native Messaging Host
        const nmResult = await this.setupNativeMessagingHost(browser.id);
        results.nativeMessaging.push({ browser: browser.id, ...nmResult });

        // 2. Create browser launch shortcuts with debug flags
        const shortcutResult = await this.createDebugLaunchShortcut(browser);
        results.browserShortcuts.push({ browser: browser.id, ...shortcutResult });

        // 3. Setup browser policy for debugging (if possible)
        await this.setupBrowserDebugPolicy(browser.id);

        console.log(`[BrowserIntegration] ✅ ${browser.name} integration complete`);
      } catch (error) {
        console.error(`[BrowserIntegration] ❌ ${browser.name} integration failed:`, error.message);
      }
    }

    // 4. Request system permissions
    results.permissions = await this.requestSystemPermissions();

    // 5. Save integration state
    this.saveIntegrationState(results);

    return results;
  }

  /**
   * Setup Native Messaging Host for browser communication
   */
  async setupNativeMessagingHost(browserId) {
    const browserConfig = this.browserPaths[browserId];
    if (!browserConfig || !browserConfig.nativeMessaging) {
      return { success: false, error: 'Browser not supported for native messaging' };
    }

    try {
      // Create native messaging directory
      fs.mkdirSync(browserConfig.nativeMessaging, { recursive: true });

      // Create native messaging manifest
      const manifest = this.createNativeMessagingManifest(browserId);
      const manifestPath = path.join(browserConfig.nativeMessaging, `${this.nativeHostName}.json`);
      
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`[BrowserIntegration] Native messaging manifest created: ${manifestPath}`);

      // Create native messaging host executable
      const hostPath = this.createNativeMessagingHost();

      // On Windows, also register in the registry
      if (this.platform === 'win32' && browserConfig.registryKey) {
        await this.registerWindowsNativeHost(browserConfig.registryKey, manifestPath);
      }

      return { success: true, manifestPath, hostPath };
    } catch (error) {
      console.error(`[BrowserIntegration] Native messaging setup error:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create native messaging manifest
   */
  createNativeMessagingManifest(browserId) {
    const hostPath = path.join(this.appDataPath, 'bin', this.platform === 'win32' ? 'cyberforge-host.bat' : 'cyberforge-host');
    
    const manifest = {
      name: this.nativeHostName,
      description: 'CyberForge AI Security Monitor - Native messaging host for browser monitoring',
      path: hostPath,
      type: 'stdio'
    };

    // Chrome/Chromium-based browsers use allowed_origins
    if (['chrome', 'brave', 'edge', 'chromium', 'arc'].includes(browserId)) {
      manifest.allowed_origins = [
        `chrome-extension://${this.extensionId}/`
      ];
    }

    // Firefox uses allowed_extensions
    if (browserId === 'firefox') {
      manifest.allowed_extensions = [
        `${this.extensionId}@cyberforge.dev`
      ];
    }

    return manifest;
  }

  /**
   * Create native messaging host executable
   */
  createNativeMessagingHost() {
    const binDir = path.join(this.appDataPath, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const electronPath = process.execPath;
    const appPath = app.getAppPath();

    if (this.platform === 'win32') {
      // Windows batch file
      const hostPath = path.join(binDir, 'cyberforge-host.bat');
      const content = `@echo off\n"${electronPath}" "${appPath}" --native-messaging %*`;
      fs.writeFileSync(hostPath, content);
      return hostPath;
    } else {
      // Unix shell script
      const hostPath = path.join(binDir, 'cyberforge-host');
      const content = `#!/bin/bash\n"${electronPath}" "${appPath}" --native-messaging "$@"`;
      fs.writeFileSync(hostPath, content);
      fs.chmodSync(hostPath, '755');
      return hostPath;
    }
  }

  /**
   * Register native messaging host in Windows registry
   */
  async registerWindowsNativeHost(registryKey, manifestPath) {
    if (this.platform !== 'win32') return;

    try {
      const regCommand = `reg add "${registryKey}\\${this.nativeHostName}" /ve /t REG_SZ /d "${manifestPath}" /f`;
      execSync(regCommand, { stdio: 'ignore' });
      console.log('[BrowserIntegration] Windows registry updated for native messaging');
    } catch (error) {
      console.error('[BrowserIntegration] Failed to update Windows registry:', error.message);
    }
  }

  /**
   * Create browser launch shortcut with debug flags enabled
   */
  async createDebugLaunchShortcut(browser) {
    const browserConfig = this.browserPaths[browser.id];
    if (!browserConfig || !browserConfig.debugFlags) {
      return { success: false, error: 'Debug flags not available for this browser' };
    }

    const shortcutsDir = path.join(this.appDataPath, 'shortcuts');
    fs.mkdirSync(shortcutsDir, { recursive: true });

    try {
      if (this.platform === 'darwin') {
        return await this.createMacOSLauncher(browser, browserConfig, shortcutsDir);
      } else if (this.platform === 'win32') {
        return await this.createWindowsShortcut(browser, browserConfig, shortcutsDir);
      } else {
        return await this.createLinuxDesktopEntry(browser, browserConfig, shortcutsDir);
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create macOS app launcher with debug flags
   */
  async createMacOSLauncher(browser, config, shortcutsDir) {
    const scriptPath = path.join(shortcutsDir, `Launch ${browser.name} (CyberForge).command`);
    
    const script = `#!/bin/bash
# CyberForge Browser Launcher - ${browser.name}
# This launches ${browser.name} with remote debugging enabled for security monitoring

echo "🛡️ CyberForge: Launching ${browser.name} with security monitoring..."

# Check if browser is already running
if pgrep -f "${browser.name}" > /dev/null; then
    echo "⚠️  ${browser.name} is already running."
    echo "Please close all ${browser.name} windows and try again for full monitoring."
    echo "Or continue to use existing session (monitoring may be limited)."
    read -p "Press Enter to continue anyway, or Ctrl+C to cancel..."
fi

# Launch browser with debug port
"${browser.path}" ${config.debugFlags} --user-data-dir="$HOME/Library/Application Support/CyberForge/BrowserProfiles/${browser.id}" &

echo "✅ ${browser.name} launched with CyberForge monitoring enabled!"
echo "🔒 Debug port: ${config.debugFlags.split('=')[1]}"
`;

    fs.writeFileSync(scriptPath, script);
    fs.chmodSync(scriptPath, '755');

    // Also create an AppleScript app for dock
    const appPath = path.join(shortcutsDir, `${browser.name} (CyberForge).app`);
    const appScript = `
      tell application "Terminal"
        do script "bash '${scriptPath}'"
        activate
      end tell
    `;

    try {
      const osaPath = path.join(appPath, 'Contents', 'MacOS');
      const resourcesPath = path.join(appPath, 'Contents', 'Resources');
      fs.mkdirSync(osaPath, { recursive: true });
      fs.mkdirSync(resourcesPath, { recursive: true });

      // Create simple launcher
      const launcherScript = path.join(osaPath, `${browser.name}`);
      fs.writeFileSync(launcherScript, `#!/bin/bash\nbash "${scriptPath}"`);
      fs.chmodSync(launcherScript, '755');
    } catch (e) {
      // Ignore app creation errors
    }

    return { success: true, path: scriptPath };
  }

  /**
   * Create Windows shortcut with debug flags
   */
  async createWindowsShortcut(browser, config, shortcutsDir) {
    const shortcutPath = path.join(shortcutsDir, `${browser.name} (CyberForge).bat`);
    
    const batchContent = `@echo off
echo 🛡️ CyberForge: Launching ${browser.name} with security monitoring...
echo.

REM Launch browser with debug port
start "" "${browser.path}" ${config.debugFlags}

echo ✅ ${browser.name} launched with CyberForge monitoring enabled!
echo 🔒 Debug port: ${config.debugFlags.split('=')[1]}
echo.
timeout /t 3 /nobreak >nul
`;

    fs.writeFileSync(shortcutPath, batchContent);
    return { success: true, path: shortcutPath };
  }

  /**
   * Create Linux .desktop entry with debug flags
   */
  async createLinuxDesktopEntry(browser, config, shortcutsDir) {
    const desktopPath = path.join(shortcutsDir, `cyberforge-${browser.id}.desktop`);
    
    const desktopEntry = `[Desktop Entry]
Version=1.0
Type=Application
Name=${browser.name} (CyberForge)
Comment=Launch ${browser.name} with CyberForge security monitoring
Exec=${browser.path} ${config.debugFlags}
Icon=${browser.id}
Terminal=false
Categories=Network;Security;
`;

    fs.writeFileSync(desktopPath, desktopEntry);
    fs.chmodSync(desktopPath, '755');

    // Copy to user's applications folder
    const userAppsDir = path.join(os.homedir(), '.local', 'share', 'applications');
    try {
      fs.mkdirSync(userAppsDir, { recursive: true });
      fs.copyFileSync(desktopPath, path.join(userAppsDir, `cyberforge-${browser.id}.desktop`));
    } catch (e) {
      // Ignore copy errors
    }

    return { success: true, path: desktopPath };
  }

  /**
   * Setup browser debug policy (enterprise feature)
   */
  async setupBrowserDebugPolicy(browserId) {
    const browserConfig = this.browserPaths[browserId];
    if (!browserConfig) return;

    // Only attempt policy setup on macOS/Linux where we have user-level access
    if (this.platform === 'darwin' && browserConfig.userPolicies) {
      try {
        fs.mkdirSync(browserConfig.userPolicies, { recursive: true });
        
        const policyFile = path.join(browserConfig.userPolicies, 'cyberforge-monitoring.json');
        const policy = {
          // Enable remote debugging
          RemoteDebuggingPort: this.getDebugPort(browserId),
          // Allow CyberForge to work
          ExtensionInstallAllowlist: [this.extensionId],
          // Security settings
          SafeBrowsingEnabled: true
        };

        fs.writeFileSync(policyFile, JSON.stringify(policy, null, 2));
        console.log(`[BrowserIntegration] Policy file created: ${policyFile}`);
      } catch (error) {
        // Policy setup requires elevated permissions, which is optional
        console.log(`[BrowserIntegration] Policy setup skipped (optional): ${error.message}`);
      }
    }
  }

  /**
   * Get debug port for browser
   */
  getDebugPort(browserId) {
    const ports = {
      chrome: 9222,
      brave: 9223,
      edge: 9224,
      chromium: 9225,
      arc: 9226,
      opera: 9227
    };
    return ports[browserId] || 9222;
  }

  /**
   * Request system-level permissions
   */
  async requestSystemPermissions() {
    const permissions = [];

    if (this.platform === 'darwin') {
      // macOS permissions
      permissions.push({
        name: 'Accessibility',
        description: 'Required for monitoring keyboard/mouse events',
        status: await this.checkMacAccessibility() ? 'granted' : 'required',
        action: 'openAccessibilityPrefs'
      });

      permissions.push({
        name: 'Full Disk Access',
        description: 'Required to read browser history and data',
        status: 'optional',
        action: 'openSecurityPrefs'
      });

      permissions.push({
        name: 'Network',
        description: 'Required for threat detection',
        status: 'granted',
        action: null
      });
    } else if (this.platform === 'win32') {
      permissions.push({
        name: 'Network Access',
        description: 'Required for browser monitoring',
        status: 'granted',
        action: null
      });

      permissions.push({
        name: 'Windows Defender Exception',
        description: 'Prevents false positives',
        status: 'optional',
        action: 'addDefenderException'
      });
    } else {
      // Linux
      permissions.push({
        name: 'Network Access',
        description: 'Required for browser monitoring',
        status: 'granted',
        action: null
      });
    }

    return permissions;
  }

  /**
   * Check macOS accessibility permission
   */
  async checkMacAccessibility() {
    if (this.platform !== 'darwin') return true;

    try {
      // Try to check if we have accessibility permissions
      const result = execSync('osascript -e \'tell application "System Events" to keystroke ""\'', {
        timeout: 1000,
        stdio: 'pipe'
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Open macOS System Preferences
   */
  openMacSystemPrefs(panel) {
    if (this.platform !== 'darwin') return;

    const panels = {
      accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
      security: 'x-apple.systempreferences:com.apple.preference.security?Privacy',
      fullDiskAccess: 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'
    };

    shell.openExternal(panels[panel] || panels.security);
  }

  /**
   * Save integration state to disk
   */
  saveIntegrationState(results) {
    const statePath = path.join(this.appDataPath, 'config', 'browser-integration.json');
    const state = {
      timestamp: new Date().toISOString(),
      platform: this.platform,
      results,
      version: require('../../package.json').version || '1.0.0'
    };

    try {
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
      console.log('[BrowserIntegration] Integration state saved');
    } catch (error) {
      console.error('[BrowserIntegration] Failed to save state:', error.message);
    }
  }

  /**
   * Load integration state from disk
   */
  loadIntegrationState() {
    const statePath = path.join(this.appDataPath, 'config', 'browser-integration.json');
    
    try {
      if (fs.existsSync(statePath)) {
        return JSON.parse(fs.readFileSync(statePath, 'utf8'));
      }
    } catch (error) {
      console.error('[BrowserIntegration] Failed to load state:', error.message);
    }

    return null;
  }

  /**
   * Launch browser with debug enabled
   */
  async launchBrowserWithDebug(browserId) {
    const browserConfig = this.browserPaths[browserId];
    if (!browserConfig) {
      throw new Error(`Unknown browser: ${browserId}`);
    }

    // Get browser executable path
    const browserExePath = this.getBrowserExecutable(browserId);
    if (!browserExePath || !fs.existsSync(browserExePath)) {
      throw new Error(`Browser not found: ${browserId}`);
    }

    const debugPort = this.getDebugPort(browserId);
    const userDataDir = path.join(this.appDataPath, 'BrowserProfiles', browserId);
    fs.mkdirSync(userDataDir, { recursive: true });

    const args = [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`
    ];

    console.log(`[BrowserIntegration] Launching ${browserId} with debug port ${debugPort}`);

    return new Promise((resolve, reject) => {
      const browserProcess = spawn(browserExePath, args, {
        detached: true,
        stdio: 'ignore'
      });

      browserProcess.unref();

      // Give browser time to start
      setTimeout(() => {
        resolve({
          success: true,
          browserId,
          debugPort,
          pid: browserProcess.pid
        });
      }, 2000);

      browserProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Get browser executable path
   */
  getBrowserExecutable(browserId) {
    const executables = {
      darwin: {
        chrome: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        brave: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        edge: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        arc: '/Applications/Arc.app/Contents/MacOS/Arc',
        firefox: '/Applications/Firefox.app/Contents/MacOS/firefox'
      },
      win32: {
        chrome: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        brave: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        edge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        firefox: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe'
      },
      linux: {
        chrome: '/usr/bin/google-chrome',
        brave: '/usr/bin/brave-browser',
        chromium: '/usr/bin/chromium-browser',
        firefox: '/usr/bin/firefox'
      }
    };

    return executables[this.platform]?.[browserId];
  }
}

module.exports = BrowserIntegrationManager;
