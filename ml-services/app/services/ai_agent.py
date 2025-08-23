"""
AI Agent with memory capabilities for cybersecurity analysis using Gemini API
"""
import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from ..core.config import settings
from ..models.schemas import AnalysisResult
from .gemini_service import GeminiService

logger = logging.getLogger(__name__)

class AIAgent:
    """Advanced AI agent with memory and reasoning capabilities using Gemini API"""
    
    def __init__(self, memory_store, threat_analyzer, ml_manager=None):
        self.memory_store = memory_store
        self.threat_analyzer = threat_analyzer
        self.ml_manager = ml_manager
        self.gemini_service = GeminiService()
        self.conversation_history = []
        self.is_initialized = False
        
    async def initialize(self):
        """Initialize the AI agent with Gemini service"""
        try:
            # Initialize Gemini service
            await self.gemini_service.initialize()
            
            self.is_initialized = True
            logger.info("✅ AI Agent initialized successfully with Gemini API")
        except Exception as e:
            logger.error(f"❌ Failed to initialize AI Agent: {e}")
            self.is_initialized = False
            raise
    
    def is_ready(self) -> bool:
        """Check if the AI agent is ready"""
        return self.is_initialized and self.gemini_service.is_ready()
    
    async def analyze(self, query: str, context: Dict[str, Any] = None, 
                     conversation_history: List[Dict] = None) -> AnalysisResult:
        """Perform AI analysis with memory and context using Gemini"""
        try:
            # Prepare context for Gemini
            full_context = await self._prepare_context(query, context, conversation_history)
            
            # Use Gemini for analysis
            gemini_result = await self.gemini_service.analyze_security_query(query, full_context)
            
            # Store in memory
            await self._store_memory(query, gemini_result["response"], context)
            
            # Create structured result
            result = AnalysisResult(
                response=gemini_result["response"],
                confidence=gemini_result["confidence"],
                insights=[f"Risk Level: {gemini_result['risk_level']}", 
                         f"Threat Types: {', '.join(gemini_result['threat_types'])}"],
                recommendations=gemini_result["recommendations"],
                context=context,
                timestamp=datetime.utcnow()
            )
            
            return result
            
        except Exception as e:
            logger.error(f"AI analysis error: {e}")
            return AnalysisResult(
                response="I apologize, but I encountered an error during analysis. Please try again.",
                confidence=0.0,
                insights=[],
                recommendations=["Please retry the analysis"],
                context=context,
                timestamp=datetime.utcnow()
            )
    
    async def _prepare_context(self, query: str, context: Dict[str, Any] = None, 
                              conversation_history: List[Dict] = None) -> Dict[str, Any]:
        """Prepare context for Gemini analysis"""
        prepared_context = {}
        
        # Add conversation history
        if conversation_history:
            prepared_context["conversation_history"] = conversation_history[-5:]  # Last 5 messages
        
        # Add current context
        if context:
            prepared_context.update(context)
        
        # Add relevant memory
        if self.memory_store:
            try:
                similar_analyses = await self.memory_store.query_similar(query, limit=3)
                if similar_analyses:
                    prepared_context["similar_past_analyses"] = [
                        {"summary": analysis.get('summary', 'N/A'), 
                         "timestamp": analysis.get('timestamp', 'Unknown')}
                        for analysis in similar_analyses
                    ]
            except Exception as e:
                logger.warning(f"Could not retrieve similar analyses: {e}")
        
        return prepared_context
    
    async def _store_memory(self, query: str, response: str, context: Dict[str, Any]):
        """Store analysis in memory for future reference"""
        if self.memory_store:
            try:
                memory_entry = {
                    'query': query,
                    'response': response,
                    'context': context,
                    'timestamp': datetime.utcnow().isoformat(),
                    'summary': response[:200] + "..." if len(response) > 200 else response
                }
                await self.memory_store.store_analysis(memory_entry, None)
            except Exception as e:
                logger.warning(f"Could not store memory: {e}")
    
    async def generate_text(self, prompt: str, max_length: int = 300) -> str:
        """Generate text using Gemini (for compatibility)"""
        if not self.is_ready():
            return "AI service not available"
        
        try:
            return await self.gemini_service.generate_text(prompt, max_length)
        except Exception as e:
            logger.error(f"Text generation error: {e}")
            return f"Text generation failed: {str(e)}"
    
    async def detect_threats(self, text: str) -> Dict[str, Any]:
        """Detect threats in text using Gemini"""
        if not self.is_ready():
            return {
                "threat_detected": False,
                "threat_type": "Unknown",
                "risk_score": 0.0,
                "confidence": 0.0,
                "details": "AI service not available"
            }
        
        try:
            return await self.gemini_service.detect_threats(text)
        except Exception as e:
            logger.error(f"Threat detection error: {e}")
            return {
                "threat_detected": False,
                "threat_type": "Error",
                "risk_score": 0.0,
                "confidence": 0.0,
                "details": f"Threat detection failed: {str(e)}"
            }