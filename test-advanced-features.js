#!/usr/bin/env node

/**
 * Cyber Forge AI - Comprehensive Test Suite
 * Tests all components of the enhanced desktop application
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class CyberForgeTestSuite {
    constructor() {
        this.testResults = [];
        this.startTime = Date.now();
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const colors = {
            info: '\x1b[36m',    // Cyan
            success: '\x1b[32m', // Green  
            warning: '\x1b[33m', // Yellow
            error: '\x1b[31m',   // Red
            reset: '\x1b[0m'     // Reset
        };
        
        console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
    }

    async runTest(testName, testFunction) {
        this.log(`Running test: ${testName}`, 'info');
        try {
            const result = await testFunction();
            this.testResults.push({ name: testName, status: 'PASS', result });
            this.log(`✅ ${testName} - PASSED`, 'success');
            return result;
        } catch (error) {
            this.testResults.push({ name: testName, status: 'FAIL', error: error.message });
            this.log(`❌ ${testName} - FAILED: ${error.message}`, 'error');
            return null;
        }
    }

    async testBackendConnection() {
        return new Promise((resolve, reject) => {
            exec('curl -s http://localhost:8000/health', (error, stdout, stderr) => {
                if (error) {
                    reject(new Error('Backend not responding'));
                } else {
                    try {
                        const health = JSON.parse(stdout);
                        if (health.status === 'healthy') {
                            resolve(health);
                        } else {
                            reject(new Error('Backend unhealthy'));
                        }
                    } catch (e) {
                        reject(new Error('Invalid backend response'));
                    }
                }
            });
        });
    }

    async testMLServices() {
        return new Promise((resolve, reject) => {
            exec('curl -s http://localhost:8001/health', (error, stdout, stderr) => {
                if (error) {
                    reject(new Error('ML Services not responding'));
                } else {
                    try {
                        const health = JSON.parse(stdout);
                        if (health.status === 'healthy') {
                            resolve(health);
                        } else {
                            reject(new Error('ML Services unhealthy'));
                        }
                    } catch (e) {
                        reject(new Error('Invalid ML Services response'));
                    }
                }
            });
        });
    }

    async testFileStructure() {
        const requiredFiles = [
            'src/renderer/advanced-index.html',
            'src/renderer/advanced-styles.css',
            'src/renderer/dashboard-chat-styles.css',
            'src/renderer/advanced-app.js',
            'src/main.js',
            'src/preload.js'
        ];

        const missingFiles = [];
        const basePath = path.join(__dirname, '../../desktop-app');

        for (const file of requiredFiles) {
            const fullPath = path.join(basePath, file);
            if (!fs.existsSync(fullPath)) {
                missingFiles.push(file);
            }
        }

        if (missingFiles.length > 0) {
            throw new Error(`Missing files: ${missingFiles.join(', ')}`);
        }

        return { filesChecked: requiredFiles.length, allPresent: true };
    }

    async testDatabaseConnection() {
        return new Promise((resolve, reject) => {
            exec('mongod --version', (error, stdout, stderr) => {
                if (error) {
                    reject(new Error('MongoDB not installed or not in PATH'));
                } else {
                    // Test if MongoDB is running
                    exec('mongo --eval "db.runCommand({ping:1})" --quiet', (error2, stdout2, stderr2) => {
                        if (error2) {
                            reject(new Error('MongoDB not running'));
                        } else {
                            resolve({ mongoVersion: stdout.trim(), status: 'running' });
                        }
                    });
                }
            });
        });
    }

    async testRedisConnection() {
        // Since we're using Redis Cloud, test the connection string format
        const envPath = path.join(__dirname, '../../backend/.env');
        if (!fs.existsSync(envPath)) {
            throw new Error('Backend .env file not found');
        }

        const envContent = fs.readFileSync(envPath, 'utf8');
        const redisUrlMatch = envContent.match(/REDIS_URL=(.+)/);
        
        if (!redisUrlMatch) {
            throw new Error('REDIS_URL not found in .env');
        }

        const redisUrl = redisUrlMatch[1];
        if (!redisUrl.includes('redis://') || !redisUrl.includes('@')) {
            throw new Error('Invalid Redis URL format');
        }

        return { redisUrl: redisUrl.replace(/:[^:]*@/, ':***@'), status: 'configured' };
    }

    async testAdvancedFeatures() {
        const features = [
            'Dashboard with metrics',
            'AI Chat interface',
            'Real-time monitoring',
            'Threat detection',
            'ML model integration',
            'Security analysis',
            'System statistics',
            'Enhanced UI/UX'
        ];

        // Check if advanced files contain the required features
        const advancedAppPath = path.join(__dirname, '../desktop-app/src/renderer/advanced-app.js');
        if (!fs.existsSync(advancedAppPath)) {
            throw new Error('Advanced app file not found');
        }

        const appContent = fs.readFileSync(advancedAppPath, 'utf8');
        const implementedFeatures = features.filter(feature => {
            const searchTerms = feature.toLowerCase().split(' ');
            return searchTerms.some(term => appContent.toLowerCase().includes(term));
        });

        return {
            totalFeatures: features.length,
            implementedFeatures: implementedFeatures.length,
            features: implementedFeatures
        };
    }

    async testPackageIntegrity() {
        const packageFiles = [
            '../../desktop-app/package.json',
            '../../backend/package.json',
            '../../ml-services/requirements.txt'
        ];

        const packages = {};
        
        for (const file of packageFiles) {
            const fullPath = path.join(__dirname, file);
            if (fs.existsSync(fullPath)) {
                if (file.endsWith('.json')) {
                    const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                    packages[path.basename(path.dirname(fullPath))] = {
                        name: pkg.name,
                        version: pkg.version,
                        dependencies: Object.keys(pkg.dependencies || {}).length
                    };
                } else {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    packages[path.basename(path.dirname(fullPath))] = {
                        requirements: content.split('\n').filter(line => line.trim()).length
                    };
                }
            }
        }

        return packages;
    }

    generateReport() {
        const endTime = Date.now();
        const duration = endTime - this.startTime;
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
        const failedTests = totalTests - passedTests;

        this.log('\n' + '='.repeat(60), 'info');
        this.log('🚀 CYBER FORGE AI - TEST SUITE REPORT', 'info');
        this.log('='.repeat(60), 'info');
        
        this.log(`📊 Total Tests: ${totalTests}`, 'info');
        this.log(`✅ Passed: ${passedTests}`, 'success');
        this.log(`❌ Failed: ${failedTests}`, failedTests > 0 ? 'error' : 'info');
        this.log(`⏱️  Duration: ${duration}ms`, 'info');
        this.log(`📈 Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`, 'info');

        this.log('\n📋 DETAILED RESULTS:', 'info');
        this.testResults.forEach(test => {
            const status = test.status === 'PASS' ? '✅' : '❌';
            this.log(`${status} ${test.name}`, test.status === 'PASS' ? 'success' : 'error');
            if (test.error) {
                this.log(`   └─ ${test.error}`, 'warning');
            }
        });

        if (passedTests === totalTests) {
            this.log('\n🎉 ALL TESTS PASSED! Your Cyber Forge AI platform is ready!', 'success');
            this.log('\n🚀 Next Steps:', 'info');
            this.log('   1. Start ML Services: cd ml-services && python main.py', 'info');
            this.log('   2. Start Backend: cd backend && npm run dev', 'info');
            this.log('   3. Start Desktop App: cd desktop-app && npm run dev', 'info');
        } else {
            this.log('\n⚠️  Some tests failed. Please check the issues above.', 'warning');
        }

        this.log('\n' + '='.repeat(60), 'info');
    }

    async runAllTests() {
        this.log('🔍 Starting Cyber Forge AI Test Suite...', 'info');
        
        await this.runTest('File Structure', () => this.testFileStructure());
        await this.runTest('Package Integrity', () => this.testPackageIntegrity());
        await this.runTest('Backend Connection', () => this.testBackendConnection());
        await this.runTest('ML Services', () => this.testMLServices());
        await this.runTest('Database Connection', () => this.testDatabaseConnection());
        await this.runTest('Redis Configuration', () => this.testRedisConnection());
        await this.runTest('Advanced Features', () => this.testAdvancedFeatures());

        this.generateReport();
    }
}

// Run the test suite
const testSuite = new CyberForgeTestSuite();
testSuite.runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
});
