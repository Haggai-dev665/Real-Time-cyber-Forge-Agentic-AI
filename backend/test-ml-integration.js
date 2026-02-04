#!/usr/bin/env node
/**
 * Test CyberForge ML Backend Integration
 * Run: node test-ml-integration.js
 */

const { cyberforgeML, predict, analyzeUrl, healthCheck } = require('./src/services/cyberforgeMLService');

async function runTests() {
    console.log('\n🔧 CyberForge ML Integration Tests\n');
    console.log('='.repeat(50));

    // Test 1: Health Check
    console.log('\n📊 Test 1: Health Check');
    const health = await healthCheck();
    console.log('Status:', health.status);
    console.log('Models:', health.models_available.join(', '));
    console.log('HF Repo:', health.huggingface_repo);

    // Test 2: Model Info
    console.log('\n📋 Test 2: Model Information');
    const models = cyberforgeML.getModelInfo();
    for (const [name, info] of Object.entries(models)) {
        console.log(`  ${name}: ${(info.accuracy * 100).toFixed(1)}% accuracy`);
    }

    // Test 3: URL Analysis - Suspicious URL
    console.log('\n🔍 Test 3: Analyze Suspicious URL');
    const suspiciousResult = await analyzeUrl('http://login-secure-bank.phishing-site.tk/verify');
    console.log('URL:', suspiciousResult.url);
    console.log('Risk Level:', suspiciousResult.aggregate.overall_risk_level);
    console.log('Max Threat Score:', suspiciousResult.aggregate.max_threat_score);
    console.log('Action:', suspiciousResult.aggregate.recommended_action);

    // Test 4: URL Analysis - Safe URL
    console.log('\n✅ Test 4: Analyze Safe URL');
    const safeResult = await analyzeUrl('https://www.google.com/search?q=weather');
    console.log('URL:', safeResult.url);
    console.log('Risk Level:', safeResult.aggregate.overall_risk_level);
    console.log('Max Threat Score:', safeResult.aggregate.max_threat_score);
    console.log('Action:', safeResult.aggregate.recommended_action);

    // Test 5: Direct Model Prediction
    console.log('\n🎯 Test 5: Direct Model Prediction');
    const phishingTest = await predict('phishing_detection', {
        is_https: false,
        url_length: 120,
        has_suspicious_tld: true,
        has_ip_address: true
    });
    console.log('Model: phishing_detection');
    console.log('Is Threat:', phishingTest.is_threat);
    console.log('Score:', phishingTest.threat_score);
    console.log('Risk Level:', phishingTest.risk_level);

    // Test 6: Batch Prediction
    console.log('\n📦 Test 6: Batch Prediction');
    const urls = [
        'https://www.example.com',
        'http://suspicious.xyz/login',
        'https://github.com'
    ];
    
    for (const url of urls) {
        const result = await analyzeUrl(url);
        const risk = result.aggregate.overall_risk_level;
        const icon = risk === 'critical' || risk === 'high' ? '🔴' : 
                    risk === 'medium' ? '🟡' : '🟢';
        console.log(`  ${icon} ${url.substring(0, 40).padEnd(40)} -> ${risk.toUpperCase()}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests completed!\n');
}

runTests().catch(console.error);
