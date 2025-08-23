"""
Threat Analyzer using free ML models
"""
import logging
from typing import Dict, List, Any, Optional
import asyncio
import re
from urllib.parse import urlparse
from datetime import datetime

logger = logging.getLogger(__name__)

class ThreatResult:
    """Result of threat analysis"""
    def __init__(self, risk_score: float, threat_types: List[str], 
                 confidence: float, recommendations: List[str]):
        self.risk_score = risk_score
        self.threat_types = threat_types
        self.confidence = confidence
        self.recommendations = recommendations

class ThreatAnalyzer:
    """Analyzes threats using free ML models and heuristics"""
    
    def __init__(self, ml_manager):
        self.ml_manager = ml_manager
        self.is_initialized = False
        
    def is_ready(self) -> bool:
        """Check if threat analyzer is ready"""
        return self.is_initialized and self.ml_manager.is_ready()
    
    async def analyze_url(self, url: str, context: str = "security") -> ThreatResult:
        """Analyze URL for security threats"""
        try:
            risk_score = 0.0
            threat_types = []
            recommendations = []
            
            # Parse URL
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            path = parsed.path.lower()
            
            # Check for suspicious patterns
            suspicious_patterns = [
                r'bit\.ly|tinyurl|goo\.gl',  # URL shorteners
                r'[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}',  # IP addresses
                r'(phish|scam|fake|malware|virus)',  # Suspicious words
                r'[a-z]+(secure|bank|paypal|amazon)[a-z]*\.(tk|ml|ga|cf)',  # Suspicious domains
            ]
            
            for pattern in suspicious_patterns:
                if re.search(pattern, url, re.IGNORECASE):
                    risk_score += 0.3
                    if 'phish' in pattern or 'scam' in pattern:
                        threat_types.append('phishing')
                    elif 'malware' in pattern or 'virus' in pattern:
                        threat_types.append('malware')
                    else:
                        threat_types.append('suspicious_pattern')
            
            # Check protocol
            if parsed.scheme == 'http':
                risk_score += 0.2
                threat_types.append('insecure_connection')
                recommendations.append('Use HTTPS connections when possible')
            
            # Check for suspicious path patterns
            suspicious_paths = ['admin', 'login', 'secure', 'verify', 'update', 'confirm']
            if any(word in path for word in suspicious_paths):
                risk_score += 0.1
                recommendations.append('Be cautious with login/verification pages')
            
            # Use ML model for additional analysis
            if self.ml_manager.is_ready():
                threat_analysis = await self.ml_manager.detect_threats(url)
                risk_score += threat_analysis['threat_score'] * 0.5
                if threat_analysis['threat_keywords']:
                    threat_types.extend(['keyword_' + kw for kw in threat_analysis['threat_keywords'][:3]])
            
            # Normalize risk score
            risk_score = min(risk_score, 1.0)
            
            # Generate recommendations
            if risk_score > 0.7:
                recommendations.extend([
                    'HIGH RISK: Avoid this URL',
                    'Do not enter personal information',
                    'Report as suspicious if received via email'
                ])
            elif risk_score > 0.4:
                recommendations.extend([
                    'Exercise caution with this URL',
                    'Verify the source before proceeding',
                    'Check for HTTPS and valid certificates'
                ])
            else:
                recommendations.append('URL appears safe, but remain vigilant')
            
            confidence = 0.8 if self.ml_manager.is_ready() else 0.6
            
            return ThreatResult(
                risk_score=risk_score,
                threat_types=list(set(threat_types)),
                confidence=confidence,
                recommendations=recommendations
            )
            
        except Exception as e:
            logger.error(f"URL analysis error: {e}")
            return ThreatResult(
                risk_score=0.5,
                threat_types=['analysis_error'],
                confidence=0.3,
                recommendations=['Unable to complete analysis, exercise caution']
            )
    
    async def scan_multiple(self, urls: List[str], context: str = "security") -> List[Dict[str, Any]]:
        """Scan multiple URLs for threats"""
        results = []
        
        for url in urls:
            try:
                result = await self.analyze_url(url, context)
                results.append({
                    'url': url,
                    'risk_score': result.risk_score,
                    'threat_types': result.threat_types,
                    'confidence': result.confidence,
                    'recommendations': result.recommendations
                })
            except Exception as e:
                logger.error(f"Error scanning {url}: {e}")
                results.append({
                    'url': url,
                    'risk_score': 0.5,
                    'threat_types': ['scan_error'],
                    'confidence': 0.2,
                    'recommendations': ['Scan failed, manual review recommended']
                })
        
        return results