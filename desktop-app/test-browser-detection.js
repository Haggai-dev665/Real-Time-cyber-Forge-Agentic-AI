#!/usr/bin/env node

/**
 * Browser Detection Test Script
 * Tests the browser selector functionality without running the full Electron app
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Import the BrowserSelector class
const BrowserSelector = require('./src/browser-monitor/browser-selector');

async function testBrowserDetection() {
    console.log('🔍 Testing Browser Detection Functionality\n');
    
    const browserSelector = new BrowserSelector();
    
    try {
        console.log('1. Detecting installed browsers...');
        const browsers = await browserSelector.detectInstalledBrowsers();
        
        if (browsers.length === 0) {
            console.log('❌ No supported browsers detected on this system');
            console.log('   Supported browsers: Chrome, Firefox, Edge, Safari');
        } else {
            console.log(`✅ Found ${browsers.length} browser(s):\n`);
            
            browsers.forEach((browser, index) => {
                console.log(`   ${index + 1}. ${browser.name}`);
                console.log(`      Path: ${browser.executablePath || browser.command || 'System default'}`);
                console.log(`      Debug Port: ${browser.debugPort}`);
                console.log(`      Icon: ${browser.icon}`);
                console.log('');
            });
        }
        
        console.log('2. Testing browser selection...');
        if (browsers.length > 0) {
            const selectedBrowsers = browserSelector.setSelectedBrowsers([browsers[0].name]);
            console.log(`✅ Selected browser: ${selectedBrowsers[0].name}`);
        } else {
            console.log('❌ Cannot test selection - no browsers available');
        }
        
        console.log('\n3. Testing platform detection...');
        console.log(`   Platform: ${process.platform}`);
        console.log(`   Architecture: ${process.arch}`);
        
        console.log('\n✅ Browser detection test completed successfully!');
        console.log('\n📋 Summary:');
        console.log(`   - Platform: ${process.platform}`);
        console.log(`   - Browsers detected: ${browsers.length}`);
        console.log(`   - Browser selector initialized: ${browserSelector ? 'Yes' : 'No'}`);
        
        if (browsers.length > 0) {
            console.log('\n🚀 Browser monitoring would be available for:');
            browsers.forEach(browser => {
                console.log(`   - ${browser.name} on port ${browser.debugPort}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error during browser detection test:', error.message);
        console.error('\nFull error:', error);
    }
}

// Check if we're in a proper desktop environment
function checkEnvironment() {
    console.log('🌐 Environment Check:');
    console.log(`   Node.js version: ${process.version}`);
    console.log(`   Platform: ${process.platform}`);
    console.log(`   Architecture: ${process.arch}`);
    
    if (process.platform === 'linux' && !process.env.DISPLAY) {
        console.log('⚠️  Warning: No DISPLAY environment variable detected');
        console.log('   This may affect browser detection in headless environments');
    }
    
    console.log('');
}

// Main execution
async function main() {
    console.log('🔬 Cyber Forge AI - Browser Detection Test\n');
    
    checkEnvironment();
    await testBrowserDetection();
    
    console.log('\n📖 Next Steps:');
    console.log('   1. Run the full desktop app to test UI integration');
    console.log('   2. Select browsers through the selection dialog');
    console.log('   3. Monitor real browser activity with enhanced features');
    console.log('\n   To run the full app: npm run dev');
}

// Run the test
main().catch(console.error);