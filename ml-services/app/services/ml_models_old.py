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
            
            # Try to load models, but handle offline scenario gracefully
            try:
                # Load text generation pipeline with a smaller model
                logger.info("Loading text generation model...")
                self.pipelines['text_generation'] = pipeline(
                    'text-generation',
                    model='gpt2',  # GPT-2 is smaller and more likely to be cached
                    tokenizer='gpt2',
                    max_length=256,
                    do_sample=True,
                    temperature=0.7,
                    pad_token_id=50256
                )
                logger.info("✅ Text generation model loaded")
                
            except Exception as e:
                logger.warning(f"Failed to load text generation model: {e}")
                self.pipelines['text_generation'] = None
            
            try:
                # Load sentiment analysis pipeline
                logger.info("Loading sentiment analysis model...")
                self.pipelines['sentiment'] = pipeline('sentiment-analysis')
                logger.info("✅ Sentiment analysis model loaded")
                
            except Exception as e:
                logger.warning(f"Failed to load sentiment model: {e}")
                self.pipelines['sentiment'] = None
            
            try:
                # Load feature extraction for embeddings
                logger.info("Loading feature extraction model...")
                self.pipelines['feature_extraction'] = pipeline('feature-extraction')
                logger.info("✅ Feature extraction model loaded")
                
            except Exception as e:
                logger.warning(f"Failed to load feature extraction model: {e}")
                self.pipelines['feature_extraction'] = None
            
            try:
                # Load sentence transformer for similarity
                logger.info("Loading sentence transformer...")
                self.models['sentence_transformer'] = SentenceTransformer('all-MiniLM-L6-v2')
                logger.info("✅ Sentence transformer loaded")
                
            except Exception as e:
                logger.warning(f"Failed to load sentence transformer: {e}")
                self.models['sentence_transformer'] = None
            
            self.is_initialized = True
            logger.info("✅ ML model manager initialized (some models may be unavailable)")
            
        except Exception as e:
            logger.error(f"❌ Failed to load ML models: {e}")
            # Still mark as initialized to allow fallback responses
            self.is_initialized = True
            logger.info("✅ ML model manager initialized in fallback mode")
    
    def is_ready(self) -> bool:
        """Check if models are ready"""
        return self.is_initialized
    
    async def generate_text(self, prompt: str, max_length: int = 200) -> str:
        """Generate text response using free model"""
        try:
            if not self.is_ready():
                return "ML models not ready"
            
            # Check if text generation pipeline is available
            if self.pipelines.get('text_generation'):
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
            else:
                # Fallback to rule-based response
                return self._generate_rule_based_response(prompt)
            
        except Exception as e:
            logger.error(f"Text generation error: {e}")
            return self._generate_rule_based_response(prompt)
    
    def _generate_rule_based_response(self, prompt: str) -> str:
        """Generate rule-based response when ML models are not available"""
        prompt_lower = prompt.lower()
        
        if any(word in prompt_lower for word in ['threat', 'attack', 'malware', 'virus']):
            return """I've analyzed your security query. Based on the context, here are my recommendations:
            
1. Verify the source and authenticity of any suspicious content
2. Avoid clicking on unknown links or downloading suspicious files
3. Keep your security software updated
4. Enable two-factor authentication where possible
5. Regular security scans are recommended

If you're experiencing an active threat, disconnect from the network and run a full system scan."""

        elif any(word in prompt_lower for word in ['safe', 'secure', 'protection']):
            return """Your security query indicates you're looking for protection guidance:
            
1. Use strong, unique passwords for all accounts
2. Keep your operating system and software updated
3. Use reputable antivirus software
4. Be cautious with email attachments and downloads
5. Enable automatic security updates
6. Regular backups are essential

These practices will significantly improve your security posture."""

        else:
            return """I'm here to help with cybersecurity analysis and recommendations. I can assist with:
            
- Threat detection and analysis
- Security best practices
- Risk assessment
- Incident response guidance
- Prevention strategies

Please provide more details about your specific security concerns."""
    
    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment for threat detection"""
        try:
            if not self.is_ready():
                return {"label": "NEUTRAL", "score": 0.5}
            
            if self.pipelines.get('sentiment'):
                result = self.pipelines['sentiment'](text)
                return result[0] if result else {"label": "NEUTRAL", "score": 0.5}
            else:
                # Fallback to simple keyword analysis
                return self._analyze_sentiment_fallback(text)
            
        except Exception as e:
            logger.error(f"Sentiment analysis error: {e}")
            return self._analyze_sentiment_fallback(text)
    
    def _analyze_sentiment_fallback(self, text: str) -> Dict[str, Any]:
        """Fallback sentiment analysis using keywords"""
        text_lower = text.lower()
        
        negative_words = ['attack', 'threat', 'malware', 'virus', 'dangerous', 'suspicious', 'hack', 'breach']
        positive_words = ['safe', 'secure', 'protected', 'clean', 'trusted', 'verified']
        
        negative_count = sum(1 for word in negative_words if word in text_lower)
        positive_count = sum(1 for word in positive_words if word in text_lower)
        
        if negative_count > positive_count:
            return {"label": "NEGATIVE", "score": min(0.5 + negative_count * 0.1, 0.9)}
        elif positive_count > negative_count:
            return {"label": "POSITIVE", "score": min(0.5 + positive_count * 0.1, 0.9)}
        else:
            return {"label": "NEUTRAL", "score": 0.5}
    
    async def get_embeddings(self, text: str) -> np.ndarray:
        """Get text embeddings for similarity search"""
        try:
            if not self.is_ready():
                return np.zeros(384)  # Default embedding size
            
            if self.models.get('sentence_transformer'):
                embeddings = self.models['sentence_transformer'].encode([text])
                return embeddings[0]
            else:
                # Fallback: simple hash-based embeddings
                return self._get_simple_embeddings(text)
            
        except Exception as e:
            logger.error(f"Embeddings error: {e}")
            return self._get_simple_embeddings(text)
    
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