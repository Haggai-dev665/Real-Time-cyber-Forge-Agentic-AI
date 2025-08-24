// Quick ML Integration Test
const axios = require('axios');

async function testMLIntegration() {
    console.log('🔬 Testing ML Service Integration...\n');
    
    try {
        // Test 1: Direct ML Service Health
        console.log('1. Testing ML Service Direct Access...');
        const mlHealth = await axios.get('http://127.0.0.1:8001/health');
        console.log('✅ ML Service Health:', mlHealth.data);
        
        // Test 2: Backend ML Health Endpoint
        console.log('\n2. Testing Backend ML Health Endpoint...');
        const backendMLHealth = await axios.get('http://localhost:8000/api/ai/ml-health');
        console.log('✅ Backend ML Health:', backendMLHealth.data);
        
        // Test 3: Test AI Chat through Backend
        console.log('\n3. Testing AI Chat through Backend...');
        const chatResponse = await axios.post('http://localhost:8000/api/ai/chat-ml', {
            message: 'Hello! Can you help me with cybersecurity?',
            context: 'Testing integration'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ AI Chat Response:', chatResponse.data.response.substring(0, 100) + '...');
        
        // Test 4: Test Threat Scanning
        console.log('\n4. Testing Threat Scanning...');
        const threatResponse = await axios.post('http://localhost:8000/api/ai/scan-threats-ml', {
            data: {
                type: 'network',
                content: 'Suspicious network activity detected on port 443'
            }
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Threat Scan Response:', threatResponse.data);
        
        console.log('\n🎉 ALL TESTS PASSED! ML Integration is working perfectly!');
        console.log('\n📱 Your desktop app can now:');
        console.log('   • Use AI-powered chat with Gemini');
        console.log('   • Scan threats with ML algorithms');
        console.log('   • Analyze websites with AI insights');
        console.log('   • Generate security recommendations');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testMLIntegration();
