"""
ML Model Manager for threat detection and analysis using free models
"""
import logging
from typing import Dict, Any, Optional
import torch
from transformers import pipeline, AutoTokenizer, AutoModel
from sentence_transformers import SentenceTransformer
import numpy as np

from ..core.config import settings

logger = logging.getLogger(__name__)

class MLModelManager:
    """Manages ML models for threat detection and analysis"""
    
    def __init__(self):
        self.models = {}
        self.tokenizers = {}
        self.pipelines = {}
        self.is_initialized = False
        
    async def load_models(self):
        """Load all required ML models"""
        try:
            logger.info("Loading ML models...")
            
            # Load text generation pipeline
            self.pipelines['text_generation'] = pipeline(
                'text-generation',
                model=settings.DEFAULT_TEXT_MODEL,
                tokenizer=settings.DEFAULT_TEXT_MODEL,
                max_length=512,
                do_sample=True,
                temperature=0.7,
                pad_token_id=50256
            )
            
            # Load sentiment analysis pipeline for threat detection
            self.pipelines['sentiment'] = pipeline(
                'sentiment-analysis',
                model=settings.SENTIMENT_MODEL
            )
            
            # Load feature extraction for embeddings
            self.pipelines['feature_extraction'] = pipeline(
                'feature-extraction',
                model=settings.THREAT_DETECTION_MODEL
            )
            
            # Load sentence transformer for similarity
            self.models['sentence_transformer'] = SentenceTransformer('all-MiniLM-L6-v2')
            
            self.is_initialized = True
            logger.info("✅ All ML models loaded successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to load ML models: {e}")
            self.is_initialized = False
            raise
    
    def is_ready(self) -> bool:
        """Check if models are ready"""
        return self.is_initialized
    
    async def generate_text(self, prompt: str, max_length: int = 200) -> str:
        """Generate text response using free model"""
        try:
            if not self.is_ready():
                return "ML models not ready"
            
            # Use text generation pipeline
            result = self.pipelines['text_generation'](
                prompt,
                max_length=max_length,
                num_return_sequences=1,
                pad_token_id=50256
            )
            
            generated_text = result[0]['generated_text']
            # Remove the original prompt from the response
            response = generated_text[len(prompt):].strip()
            
            return response if response else "I understand your query and will help with cybersecurity analysis."
            
        except Exception as e:
            logger.error(f"Text generation error: {e}")
            return "I apologize, but I encountered an error generating a response."
    
    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment for threat detection"""
        try:
            if not self.is_ready():
                return {"label": "NEUTRAL", "score": 0.5}
            
            result = self.pipelines['sentiment'](text)
            return result[0] if result else {"label": "NEUTRAL", "score": 0.5}
            
        except Exception as e:
            logger.error(f"Sentiment analysis error: {e}")
            return {"label": "NEUTRAL", "score": 0.5}
    
    async def get_embeddings(self, text: str) -> np.ndarray:
        """Get text embeddings for similarity search"""
        try:
            if not self.is_ready():
                return np.zeros(384)  # Default embedding size
            
            embeddings = self.models['sentence_transformer'].encode([text])
            return embeddings[0]
            
        except Exception as e:
            logger.error(f"Embeddings error: {e}")
            return np.zeros(384)
    
    async def detect_threats(self, text: str) -> Dict[str, Any]:
        """Basic threat detection using sentiment and keywords"""
        try:
            # Analyze sentiment
            sentiment = await self.analyze_sentiment(text)
            
            # Check for threat keywords
            threat_keywords = [
                'malware', 'virus', 'phishing', 'scam', 'hack', 'breach',
                'suspicious', 'danger', 'threat', 'attack', 'exploit',
                'trojan', 'ransomware', 'botnet', 'vulnerability'
            ]
            
            text_lower = text.lower()
            found_keywords = [kw for kw in threat_keywords if kw in text_lower]
            
            # Calculate threat score
            threat_score = 0.0
            if sentiment['label'] == 'NEGATIVE':
                threat_score += sentiment['score'] * 0.5
            
            if found_keywords:
                threat_score += min(len(found_keywords) * 0.2, 0.5)
            
            threat_score = min(threat_score, 1.0)
            
            return {
                'threat_score': threat_score,
                'sentiment': sentiment,
                'threat_keywords': found_keywords,
                'risk_level': 'high' if threat_score > 0.7 else 'medium' if threat_score > 0.4 else 'low'
            }
            
        except Exception as e:
            logger.error(f"Threat detection error: {e}")
            return {
                'threat_score': 0.5,
                'sentiment': {"label": "NEUTRAL", "score": 0.5},
                'threat_keywords': [],
                'risk_level': 'medium'
            }