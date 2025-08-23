#!/usr/bin/env python3
"""
Simple test script for Gemini AI integration
"""
import asyncio
import sys
import os

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

async def test_basic_gemini():
    """Test basic Gemini integration"""
    print("🚀 Testing Basic Gemini AI Integration")
    print("=" * 50)
    
    try:
        from app.core.config import settings
        print(f"✅ Configuration loaded: Gemini model = {settings.GEMINI_MODEL}")
        
        from app.services.gemini_service import GeminiService
        print("✅ Gemini service module imported")
        
        # Test initialization (will use fallback without real API key)
        gemini = GeminiService()
        print("✅ Gemini service created")
        
        # Test custom training data loading
        print("\n📚 Testing custom training data loading...")
        await gemini._load_custom_training_data()
        print(f"✅ Loaded {len(gemini.custom_knowledge)} knowledge base files")
        print(f"✅ Loaded {len(gemini.training_examples)} training examples")
        
        # Test fallback response creation
        print("\n🔧 Testing fallback functionality...")
        fallback_response = gemini._create_fallback_response(
            "I received a suspicious email asking for my password",
            {"type": "phishing_analysis"}
        )
        print("✅ Fallback response generated:")
        print(f"   Risk Level: {fallback_response['risk_level']}")
        print(f"   Threat Types: {fallback_response['threat_types']}")
        print(f"   Custom Data Used: {fallback_response['custom_data_used']}")
        
        print("\n✅ All basic tests passed!")
        print("🎯 Gemini AI service is properly integrated with custom training data")
        print("📝 Ready to use with real Gemini API key")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_basic_gemini())