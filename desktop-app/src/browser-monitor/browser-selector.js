const { shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class BrowserSelector {
  constructor() {
    this.availableBrowsers = [];
    this.selectedBrowsers = [];
    this.isInitialized = false;
  }

  async detectInstalledBrowsers() {
    const browsers = [];
    const platform = process.platform;

    try {
      if (platform === 'win32') {
        // Windows browser detection
        const windowsBrowsers = [
          {
            name: 'Google Chrome',
            executablePaths: [
              'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
              'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
            ],
            icon: 'chrome',
            debugPort: 9222
          },
          {
            name: 'Microsoft Edge',
            executablePaths: [
              'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
              'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
            ],
            icon: 'edge',
            debugPort: 9223
          },
          {
            name: 'Mozilla Firefox',
            executablePaths: [
              'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
              'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'
            ],
            icon: 'firefox',
            debugPort: 9224
          }
        ];

        for (const browser of windowsBrowsers) {
          for (const execPath of browser.executablePaths) {
            if (fs.existsSync(execPath)) {
              browsers.push({
                ...browser,
                executablePath: execPath,
                installed: true
              });
              break;
            }
          }
        }
      } else if (platform === 'darwin') {
        // macOS browser detection
        const macBrowsers = [
          {
            name: 'Google Chrome',
            executablePaths: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
            icon: 'chrome',
            debugPort: 9222
          },
          {
            name: 'Safari',
            executablePaths: ['/Applications/Safari.app/Contents/MacOS/Safari'],
            icon: 'safari',
            debugPort: 9225
          },
          {
            name: 'Mozilla Firefox',
            executablePaths: ['/Applications/Firefox.app/Contents/MacOS/firefox'],
            icon: 'firefox',
            debugPort: 9224
          }
        ];

        for (const browser of macBrowsers) {
          for (const execPath of browser.executablePaths) {
            if (fs.existsSync(execPath)) {
              browsers.push({
                ...browser,
                executablePath: execPath,
                installed: true
              });
              break;
            }
          }
        }
      } else {
        // Linux browser detection
        const linuxBrowsers = [
          {
            name: 'Google Chrome',
            command: 'google-chrome',
            icon: 'chrome',
            debugPort: 9222
          },
          {
            name: 'Chromium',
            command: 'chromium-browser',
            icon: 'chromium',
            debugPort: 9222
          },
          {
            name: 'Mozilla Firefox',
            command: 'firefox',
            icon: 'firefox',
            debugPort: 9224
          }
        ];

        for (const browser of linuxBrowsers) {
          try {
            await this.checkCommandExists(browser.command);
            browsers.push({
              ...browser,
              installed: true
            });
          } catch (error) {
            // Browser not found
          }
        }
      }
    } catch (error) {
      console.error('Error detecting browsers:', error);
    }

    this.availableBrowsers = browsers;
    return browsers;
  }

  checkCommandExists(command) {
    return new Promise((resolve, reject) => {
      exec(`which ${command}`, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  }

  getAvailableBrowsers() {
    return this.availableBrowsers;
  }

  setSelectedBrowsers(browserIds) {
    this.selectedBrowsers = this.availableBrowsers.filter(browser => 
      browserIds.includes(browser.name)
    );
    return this.selectedBrowsers;
  }

  getSelectedBrowsers() {
    return this.selectedBrowsers;
  }

  async startBrowserMonitoring(browser) {
    try {
      const debugUrl = `http://localhost:${browser.debugPort}`;
      
      // Start browser with debugging enabled
      let command;
      if (process.platform === 'win32') {
        command = `"${browser.executablePath}" --remote-debugging-port=${browser.debugPort} --user-data-dir=%TEMP%/cyber-forge-${browser.debugPort}`;
      } else if (process.platform === 'darwin') {
        command = `"${browser.executablePath}" --remote-debugging-port=${browser.debugPort} --user-data-dir=/tmp/cyber-forge-${browser.debugPort}`;
      } else {
        command = `${browser.command} --remote-debugging-port=${browser.debugPort} --user-data-dir=/tmp/cyber-forge-${browser.debugPort}`;
      }

      return new Promise((resolve, reject) => {
        exec(command, (error) => {
          if (error) {
            console.error(`Error starting ${browser.name}:`, error);
            reject(error);
          } else {
            console.log(`${browser.name} started with debugging on port ${browser.debugPort}`);
            resolve(debugUrl);
          }
        });
      });
    } catch (error) {
      console.error(`Failed to start browser monitoring for ${browser.name}:`, error);
      throw error;
    }
  }

  async stopBrowserMonitoring() {
    // Clean up any monitoring connections
    this.selectedBrowsers = [];
  }
}

module.exports = BrowserSelector;