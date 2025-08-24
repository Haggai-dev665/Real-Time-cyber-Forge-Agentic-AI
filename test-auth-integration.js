const axios = require('axios');

async function testWithAuth() {
    console.log('🔐 Testing ML Service Integration with Authentication...\n');
    
    try {
        // Step 1: Register/Login to get token
        console.log('1. Registering test user...');
        
        const registerData = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'TestPass123!',
            firstName: 'Test',
            lastName: 'User'
        };
        
        let token = null;
        
        try {
            const registerResponse = await axios.post('http://localhost:8000/api/auth/register', registerData);
            token = registerResponse.data.token;
            console.log('✅ User registered successfully');
        } catch (error) {
            if (error.response?.status === 400 && error.response.data.message.includes('already exists')) {
                console.log('📝 User already exists, trying login...');
                
                // Try login instead
                const loginResponse = await axios.post('http://localhost:8000/api/auth/login', {
                    email: registerData.email,
                    password: registerData.password
                });
                token = loginResponse.data.token;
                console.log('✅ User logged in successfully');
            } else {
                throw error;
            }
        }
        
        if (!token) {
            throw new Error('Failed to get authentication token');
        }
        
        console.log(`🎫 Token obtained: ${token.substring(0, 20)}...`);
        
        // Step 2: Test ML endpoints with authentication
        const headers = { Authorization: `Bearer ${token}` };
        
        console.log('\n2. Testing ML Service Health with Auth...');
        const healthResponse = await axios.get('http://localhost:8000/api/ai/ml-health', { headers });
        console.log('✅ ML Health Check:', healthResponse.data);
        
        console.log('\n3. Testing AI Chat with ML...');
        const chatResponse = await axios.post('http://localhost:8000/api/ai/chat-ml', {
            message: 'What are the top 3 cybersecurity threats to watch out for?'
        }, { headers });
        console.log('✅ AI Chat Response:', chatResponse.data);
        
        console.log('\n4. Testing Threat Scanning...');
        const threatResponse = await axios.post('http://localhost:8000/api/ai/scan-threats-ml', {
            target: 'https://example.com',
            scanType: 'comprehensive'
        }, { headers });
        console.log('✅ Threat Scan Response:', threatResponse.data);
        
        console.log('\n🎉 All ML Integration Tests Passed!');
        console.log('\n📋 Integration Summary:');
        console.log('   ✅ Authentication: Working');
        console.log('   ✅ ML Service: Connected');
        console.log('   ✅ Backend Proxy: Functional');
        console.log('   ✅ AI Chat: Operational');
        console.log('   ✅ Threat Scanning: Ready');
        console.log('\n🚀 Your Cyber Forge AI platform is fully operational!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        if (error.response?.status === 500) {
            console.log('\n💡 Tip: Make sure the ML services are running on port 8001');
            console.log('   Run: cd ml-services && python main.py');
        }
    }
}

testWithAuth();
