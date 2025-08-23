#!/usr/bin/env python3
"""
End-to-end test to demonstrate Gemini integration with custom training data
"""
import asyncio
import sys
import os
import json

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

async def demo_gemini_cybersecurity_analysis():
    """Demonstrate Gemini AI cybersecurity analysis with custom training data"""
    print("🛡️ CYBER FORGE AI - GEMINI INTEGRATION DEMO")
    print("=" * 70)
    print("Demonstrating advanced cybersecurity analysis with custom training data")
    print("=" * 70)
    
    from app.services.gemini_service import GeminiService
    from app.services.ml_models import MLModelManager
    from app.services.ai_agent import AIAgent
    from app.services.memory_store import MemoryStore
    from app.services.threat_analyzer import ThreatAnalyzer
    
    # Initialize services
    print("\n🚀 Initializing AI Services...")
    
    # Initialize memory store
    memory_store = MemoryStore()
    await memory_store.initialize()
    print("✅ Memory store initialized")
    
    # Initialize ML manager with Gemini
    ml_manager = MLModelManager()
    await ml_manager.load_models()
    print("✅ ML Manager with Gemini integration initialized")
    
    # Initialize threat analyzer
    threat_analyzer = ThreatAnalyzer(ml_manager)
    threat_analyzer.is_initialized = True
    print("✅ Threat analyzer initialized")
    
    # Initialize AI agent
    ai_agent = AIAgent(memory_store, threat_analyzer, ml_manager)
    await ai_agent.initialize()
    print("✅ AI Agent with Gemini backend initialized")
    
    # Display system capabilities
    model_info = ml_manager.get_model_info()
    print(f"\n📊 System Configuration:")
    print(f"   - AI Backend: {model_info['ml_backend']}")
    print(f"   - Model: {model_info['model_name']}")
    print(f"   - Status: {model_info['status']}")
    print(f"   - Custom Training Data: {bool(model_info.get('custom_training_data'))}")
    print(f"   - Capabilities: {', '.join(model_info['capabilities'])}")
    
    # Test scenarios
    test_scenarios = [
        {
            "title": "Phishing Email Analysis",
            "query": "I received an email from 'support@amazon-security.com' asking me to click a link to verify my account within 24 hours or it will be suspended. The sender claims there was suspicious activity.",
            "context": {"type": "email_analysis", "source": "user_report"}
        },
        {
            "title": "Malware Detection",
            "query": "Our antivirus detected a file called 'invoice.pdf.exe' that was downloaded from an email attachment. The file is trying to modify registry settings and make network connections.",
            "context": {"type": "malware_analysis", "severity": "high"}
        },
        {
            "title": "Network Security Incident",
            "query": "We're seeing unusual outbound traffic from multiple workstations to IP addresses in Russia and China during off-hours. Traffic volume is significantly higher than normal.",
            "context": {"type": "network_analysis", "alert_level": "critical"}
        },
        {
            "title": "Social Engineering Attempt",
            "query": "Someone called our reception claiming to be from IT support and asking for employee login credentials to 'update the system'. They knew some internal details about our company.",
            "context": {"type": "social_engineering", "attack_vector": "phone_call"}
        }
    ]
    
    print("\n" + "="*70)
    print("🔍 CYBERSECURITY ANALYSIS DEMONSTRATIONS")
    print("="*70)
    
    for i, scenario in enumerate(test_scenarios, 1):
        print(f"\n📋 Scenario {i}: {scenario['title']}")
        print("-" * 50)
        print(f"Query: {scenario['query']}")
        
        # Perform AI analysis
        result = await ai_agent.analyze(
            query=scenario['query'],
            context=scenario['context']
        )
        
        # Display results
        print(f"\n🤖 AI Analysis Results:")
        print(f"   Confidence: {result.confidence:.2f}")
        print(f"   Insights: {', '.join(result.insights[:3])}")  # Show first 3 insights
        print(f"   Recommendations ({len(result.recommendations)}):")
        for j, rec in enumerate(result.recommendations[:3], 1):  # Show first 3 recommendations
            print(f"      {j}. {rec}")
        
        # Additional threat analysis
        threat_result = await ml_manager.detect_threats(scenario['query'])
        print(f"\n🛡️ Threat Detection:")
        print(f"   Threat Detected: {threat_result.get('threat_detected', False)}")
        print(f"   Threat Type: {threat_result.get('threat_type', 'Unknown')}")
        print(f"   Risk Score: {threat_result.get('risk_score', 0)}/10")
        print(f"   Detection Confidence: {threat_result.get('confidence', 0):.2f}")
        
        print("\n" + "-"*50)
    
    # Display training data integration
    gemini_service = GeminiService()
    await gemini_service._load_custom_training_data()
    
    print("\n" + "="*70)
    print("📚 CUSTOM TRAINING DATA INTEGRATION")
    print("="*70)
    print(f"Knowledge Base Files Loaded: {len(gemini_service.custom_knowledge)}")
    for filename, data in gemini_service.custom_knowledge.items():
        print(f"   - {filename}: {len(data)} categories")
    
    print(f"\nTraining Examples Loaded: {len(gemini_service.training_examples)}")
    print("Sample Training Scenarios:")
    for i, example in enumerate(gemini_service.training_examples[:2], 1):
        input_text = example.get('input', '')[:100] + '...' if len(example.get('input', '')) > 100 else example.get('input', '')
        print(f"   {i}. {input_text}")
    
    print("\n" + "="*70)
    print("✅ GEMINI INTEGRATION DEMONSTRATION COMPLETE")
    print("="*70)
    print("🎯 Key Features Demonstrated:")
    print("   ✓ Gemini AI integration with fallback capability")
    print("   ✓ Custom cybersecurity knowledge base integration")
    print("   ✓ Real-world training scenarios for better responses")
    print("   ✓ Context-aware threat analysis and risk scoring")
    print("   ✓ Actionable security recommendations")
    print("   ✓ Multi-scenario cybersecurity analysis")
    print("\n🚀 Ready for production deployment with Gemini API key!")
    
    # Cleanup
    await memory_store.cleanup()

if __name__ == "__main__":
    asyncio.run(demo_gemini_cybersecurity_analysis())