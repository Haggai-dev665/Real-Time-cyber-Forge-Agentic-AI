"""
ML Model Manager using Gemini API for threat detection and analysis
"""
import logging
import numpy as np
from typing import Dict, List, Any, Optional
from datetime import datetime

from ..core.config import settings
from .gemini_service import GeminiService

logger = logging.getLogger(__name__)

class MLModelManager:
    """Manages ML models for threat detection and analysis using Gemini API"""
    
    def __init__(self):
        self.gemini_service = GeminiService()
        self.is_initialized = False
        self.models = {}
        self.tokenizers = {}
        self.pipelines = {}
    
    async def load_models(self):
        """Load Gemini service and initialize"""
        try:
            logger.info("Initializing Gemini-powered ML model manager...")
            
            # Initialize Gemini service
            await self.gemini_service.initialize()
            
            # Mark as initialized
            self.is_initialized = True
            logger.info("✅ ML model manager initialized with Gemini API")
            
        except Exception as e:
            logger.error(f"❌ Failed to load ML models: {e}")
            # Still mark as initialized to allow fallback responses
            self.is_initialized = True
            logger.info("✅ ML model manager initialized in fallback mode")
    
    def is_ready(self) -> bool:
        """Check if ML manager is ready"""
        return self.is_initialized and self.gemini_service.is_ready()
    
    async def generate_text(self, prompt: str, max_length: int = 300) -> str:
        """Generate text using Gemini"""
        if not self.is_ready():
            return self._fallback_text_generation(prompt)
        
        try:
            return await self.gemini_service.generate_text(prompt, max_length)
        except Exception as e:
            logger.error(f"Text generation error: {e}")
            return self._fallback_text_generation(prompt)
    
    def _fallback_text_generation(self, prompt: str) -> str:
        """Fallback text generation when Gemini is unavailable"""
        prompt_lower = prompt.lower()
        
        if any(word in prompt_lower for word in ['threat', 'malware', 'attack']):
            return "Security threat detected. Recommend immediate investigation and containment measures. Apply security patches and monitor system activity."
        elif any(word in prompt_lower for word in ['safe', 'secure']):
            return "System appears secure. Continue monitoring and maintain security best practices including regular updates and user awareness training."
        else:
            return "Cybersecurity analysis requires careful evaluation of threat indicators, risk assessment, and implementation of appropriate security controls."
    
    async def detect_threats(self, text: str) -> Dict[str, Any]:
        """Detect threats using Gemini"""
        if not self.is_ready():
            return self._fallback_threat_detection(text)
        
        try:
            return await self.gemini_service.detect_threats(text)
        except Exception as e:
            logger.error(f"Threat detection error: {e}")
            return self._fallback_threat_detection(text)
    
    def _fallback_threat_detection(self, text: str) -> Dict[str, Any]:
        """Fallback threat detection using keyword analysis"""
        text_lower = text.lower()
        risk_score = 0.0
        threat_type = "Unknown"
        threat_detected = False
        
        # Basic keyword-based threat detection
        threat_keywords = {
            'malware': ['virus', 'trojan', 'ransomware', 'spyware', 'malware', 'worm'],
            'phishing': ['phishing', 'fake', 'suspicious email', 'credential', 'click here'],
            'network_attack': ['ddos', 'port scan', 'intrusion', 'unauthorized access'],
            'data_breach': ['data breach', 'leaked', 'compromised', 'stolen data']
        }
        
        for category, keywords in threat_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    threat_detected = True
                    threat_type = category.replace('_', ' ').title()
                    risk_score = 7.0 if category in ['malware', 'data_breach'] else 5.0
                    break
            if threat_detected:
                break
        
        return {
            "threat_detected": threat_detected,
            "threat_type": threat_type,
            "risk_score": risk_score,
            "confidence": 0.6 if threat_detected else 0.3,
            "details": f"Keyword-based analysis: {'Threat indicators found' if threat_detected else 'No obvious threats detected'}"
        }
    
    def _get_simple_embeddings(self, text: str) -> np.ndarray:
        """Simple fallback embeddings using text hashing"""
        import hashlib
        # Create a simple hash-based embedding
        hash_obj = hashlib.md5(text.encode())
        hash_bytes = hash_obj.digest()
        # Convert to float array and normalize
        embedding = np.frombuffer(hash_bytes, dtype=np.uint8).astype(np.float32)
        # Pad or truncate to standard size
        if len(embedding) < 384:
            embedding = np.pad(embedding, (0, 384 - len(embedding)), 'constant')
        else:
            embedding = embedding[:384]
        # Normalize
        return embedding / np.linalg.norm(embedding)
    
    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment using Gemini for cybersecurity context"""
        if not self.is_ready():
            return self._fallback_sentiment_analysis(text)
        
        try:
            sentiment_prompt = f"""Analyze the cybersecurity sentiment of this text. Consider threat indicators, user concern levels, and security implications:

TEXT: {text}

Provide:
1. Security sentiment (Concerned/Neutral/Confident)
2. Threat awareness level (High/Medium/Low)
3. User anxiety indicators
4. Confidence score (0.0-1.0)

Response format: SENTIMENT: [sentiment] | AWARENESS: [level] | CONFIDENCE: [score]"""

            response = await self.gemini_service.generate_text(sentiment_prompt, 200)
            return self._parse_sentiment_response(response, text)
            
        except Exception as e:
            logger.error(f"Sentiment analysis error: {e}")
            return self._fallback_sentiment_analysis(text)
    
    def _parse_sentiment_response(self, response: str, original_text: str) -> Dict[str, Any]:
        """Parse Gemini sentiment response"""
        response_lower = response.lower()
        
        # Extract sentiment
        if "concerned" in response_lower:
            sentiment = "NEGATIVE"
            sentiment_score = 0.2
        elif "confident" in response_lower:
            sentiment = "POSITIVE"
            sentiment_score = 0.8
        else:
            sentiment = "NEUTRAL"
            sentiment_score = 0.5
        
        # Extract confidence
        confidence = 0.7  # Default
        import re
        conf_match = re.search(r'confidence[:\s]*([0-9.]+)', response_lower)
        if conf_match:
            try:
                confidence = float(conf_match.group(1))
            except:
                confidence = 0.7
        
        return {
            "label": sentiment,
            "score": sentiment_score,
            "confidence": confidence,
            "details": response
        }
    
    def _fallback_sentiment_analysis(self, text: str) -> Dict[str, Any]:
        """Fallback sentiment analysis"""
        text_lower = text.lower()
        
        negative_words = ['threat', 'attack', 'malware', 'suspicious', 'danger', 'hack', 'breach']
        positive_words = ['safe', 'secure', 'protected', 'clean', 'verified', 'trusted']
        
        neg_count = sum(1 for word in negative_words if word in text_lower)
        pos_count = sum(1 for word in positive_words if word in text_lower)
        
        if neg_count > pos_count:
            return {"label": "NEGATIVE", "score": 0.3, "confidence": 0.6}
        elif pos_count > neg_count:
            return {"label": "POSITIVE", "score": 0.7, "confidence": 0.6}
        else:
            return {"label": "NEUTRAL", "score": 0.5, "confidence": 0.5}
    
    async def get_embeddings(self, text: str) -> np.ndarray:
        """Get embeddings for text (fallback to simple hash-based)"""
        try:
            # For now, use simple hash-based embeddings as Gemini doesn't directly provide embeddings
            return self._get_simple_embeddings(text)
        except Exception as e:
            logger.error(f"Embedding generation error: {e}")
            return self._get_simple_embeddings("fallback_text")
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about loaded models"""
        return {
            "ml_backend": "gemini_api",
            "model_name": settings.GEMINI_MODEL,
            "status": "ready" if self.is_ready() else "fallback_mode",
            "capabilities": [
                "threat_detection",
                "text_generation", 
                "security_analysis",
                "sentiment_analysis"
            ],
            "custom_training_data": self.gemini_service.custom_knowledge if hasattr(self.gemini_service, 'custom_knowledge') else {}
        }