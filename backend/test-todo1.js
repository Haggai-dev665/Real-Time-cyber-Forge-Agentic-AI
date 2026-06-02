/**
 * Test script for TODO 1 implementation
 * Tests agent system, Appwrite integration, and data flow
 */

require('dotenv').config();
const { CyberforgeAgent } = require('./src/agent/CyberforgeAgent');
const { appwriteService } = require('./src/services/appwriteService');
const { datadogMetrics } = require('./src/services/datadogMetrics');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testAppwriteConnection() {
  log('\n📋 Testing Appwrite Connection...', colors.blue);
  
  try {
    // Check if Appwrite is configured
    if (!process.env.APPWRITE_PROJECT_ID || !process.env.APPWRITE_API_KEY) {
      log('⚠️  Appwrite not configured. Set APPWRITE_PROJECT_ID and APPWRITE_API_KEY in .env', colors.yellow);
      log('   See docs/APPWRITE_SETUP.md for setup instructions', colors.yellow);
      return false;
    }

    await appwriteService.initialize();
    log('✅ Appwrite connection successful', colors.green);
    return true;
  } catch (error) {
    log(`❌ Appwrite connection failed: ${error.message}`, colors.red);
    log('   Check your credentials in .env', colors.yellow);
    return false;
  }
}

async function testDatadogMetrics() {
  log('\n📊 Testing Datadog Metrics...', colors.blue);
  
  try {
    datadogMetrics.initialize();
    
    if (!datadogMetrics.isEnabled) {
      log('⚠️  Datadog is disabled (DATADOG_ENABLED=false)', colors.yellow);
      log('   This is OK for development', colors.yellow);
    } else {
      log('✅ Datadog metrics initialized', colors.green);
      
      // Send a test metric
      datadogMetrics.incrementCounter('test.counter', 1, { source: 'test_script' });
      log('✅ Test metric sent', colors.green);
    }
    
    return true;
  } catch (error) {
    log(`❌ Datadog initialization failed: ${error.message}`, colors.red);
    return false;
  }
}

async function testAgentCreation() {
  log('\n🤖 Testing Agent Creation...', colors.blue);
  
  try {
    // Create a test agent (don't start it)
    const testUserId = 'test-user-' + Date.now();
    const agent = new CyberforgeAgent({
      userId: testUserId,
      version: '1.0.0-test',
      capabilities: ['web_scanning', 'threat_analysis']
    });
    
    log(`✅ Agent created for user: ${testUserId}`, colors.green);
    log(`   State: ${agent.state}`, colors.green);
    log(`   Hostname: ${agent.metadata.hostname}`, colors.green);
    log(`   Platform: ${agent.metadata.platform}`, colors.green);
    
    return true;
  } catch (error) {
    log(`❌ Agent creation failed: ${error.message}`, colors.red);
    return false;
  }
}

async function testWebScraper() {
  log('\n🌐 Testing Web Scraper Integration...', colors.blue);
  
  try {
    const { webScraperAPIService } = require('./src/services/WebScraperAPIService');
    
    log('✅ Web Scraper service loaded', colors.green);
    log(`   API URL: ${webScraperAPIService.apiUrl}`, colors.green);
    log(`   API Key: ${webScraperAPIService.apiKey.substring(0, 10)}...`, colors.green);
    
    return true;
  } catch (error) {
    log(`❌ Web Scraper test failed: ${error.message}`, colors.red);
    return false;
  }
}

async function runTests() {
  log('\n' + '='.repeat(60), colors.blue);
  log('🧪 TODO 1 Implementation Tests', colors.blue);
  log('='.repeat(60), colors.blue);
  
  const results = {
    appwrite: false,
    datadog: false,
    agent: false,
    scraper: false
  };

  // Run tests
  results.appwrite = await testAppwriteConnection();
  results.datadog = await testDatadogMetrics();
  results.agent = await testAgentCreation();
  results.scraper = await testWebScraper();

  // Summary
  log('\n' + '='.repeat(60), colors.blue);
  log('📊 Test Summary', colors.blue);
  log('='.repeat(60), colors.blue);
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅' : '❌';
    const color = passed ? colors.green : colors.red;
    log(`${status} ${test}: ${passed ? 'PASSED' : 'FAILED'}`, color);
  });
  
  log('\n' + '-'.repeat(60), colors.blue);
  log(`Total: ${passed}/${total} tests passed`, passed === total ? colors.green : colors.yellow);
  log('='.repeat(60) + '\n', colors.blue);

  if (!results.appwrite) {
    log('\n⚠️  To enable full functionality:', colors.yellow);
    log('   1. Set up Appwrite following docs/APPWRITE_SETUP.md', colors.yellow);
    log('   2. Add credentials to backend/.env', colors.yellow);
    log('   3. Run this test again\n', colors.yellow);
  }

  if (passed === total) {
    log('🎉 All tests passed! TODO 1 implementation is ready.\n', colors.green);
    return 0;
  } else {
    log('⚠️  Some tests failed. Check the output above.\n', colors.yellow);
    return 1;
  }
}

// Run tests
runTests()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  });
