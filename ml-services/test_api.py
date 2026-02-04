#!/usr/bin/env python3
"""Test CyberForge API"""

from huggingface_hub import hf_hub_download
import sys

# Download the inference module
print("Downloading CyberForge inference module...")
path = hf_hub_download("Che237/cyberforge-models", "cyberforge_inference.py", local_dir="./test_api")
print(f"Downloaded to: {path}")

# Import and test
sys.path.insert(0, "./test_api")
from cyberforge_inference import CyberForgePredictor

print("\n" + "="*60)
print("CYBERFORGE API TEST")
print("="*60)

predictor = CyberForgePredictor()

# Test cases
test_cases = [
    {
        "name": "Suspicious Phishing Site",
        "features": {
            "is_https": False,
            "has_mixed_content": True,
            "missing_headers_count": 5,
            "has_insecure_cookies": True,
            "url_length": 200,
            "has_suspicious_tld": True
        }
    },
    {
        "name": "Safe Website (Google)",
        "features": {
            "is_https": True,
            "has_mixed_content": False,
            "missing_headers_count": 0,
            "has_insecure_cookies": False,
            "url_length": 25,
            "has_suspicious_tld": False
        }
    },
    {
        "name": "Potential Malware Site",
        "features": {
            "is_https": False,
            "has_mixed_content": True,
            "suspicious_apis": 3,
            "console_errors": 5,
            "external_requests": 20,
            "failed_requests": 8
        }
    }
]

for test in test_cases:
    print(f"\nTest: {test['name']}")
    print("-" * 40)
    
    for model in ["phishing_detection", "malware_detection", "anomaly_detection", "web_attack_detection"]:
        result = predictor.predict(model, test["features"])
        if result["risk_level"] in ["critical", "high"]:
            status = "[HIGH RISK]"
        elif result["risk_level"] == "medium":
            status = "[MEDIUM]"
        else:
            status = "[LOW]"
        print(f"  {model}: {status} {result['prediction']} ({result['confidence']}% confidence)")

print("\n" + "="*60)
print("All tests completed!")
print("="*60)
