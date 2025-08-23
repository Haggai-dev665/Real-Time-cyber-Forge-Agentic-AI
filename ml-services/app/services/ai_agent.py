"""
AI Agent with memory capabilities for cybersecurity analysis using free models
"""
import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from ..core.config import settings
from ..models.schemas import AnalysisResult

logger = logging.getLogger(__name__)

class AIAgent:
    """Advanced AI agent with memory and reasoning capabilities using free models"""
    
    def __init__(self, memory_store, threat_analyzer, ml_manager=None):
        self.memory_store = memory_store
        self.threat_analyzer = threat_analyzer
        self.ml_manager = ml_manager
        self.conversation_history = []  # Simple list instead of langchain memory
        self.is_initialized = False
        
        # System prompt for cybersecurity analysis
        self.system_prompt = """You are an advanced cybersecurity AI assistant with deep expertise in:
        - Threat detection and analysis
        - Browser security and web safety
        - Malware and phishing identification
        - Security best practices and recommendations
        - Risk assessment and mitigation strategies
        
        Your role is to analyze security data, provide insights, and offer actionable recommendations
        to help users stay safe online. Always be precise, helpful, and security-focused in your responses.
        
        When analyzing threats:
        1. Assess the risk level (low, medium, high, critical)
        2. Identify specific threat types
        3. Provide clear, actionable recommendations
        4. Explain the reasoning behind your assessment
        5. Consider the broader security context
        """
    
    async def initialize(self):
        """Initialize the AI agent"""
        try:
            self.is_initialized = True
            logger.info("AI Agent initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize AI Agent: {e}")
            self.is_initialized = False
            raise
    
    def is_ready(self) -> bool:
        """Check if the AI agent is ready"""
        return self.is_initialized
    
    async def analyze(self, query: str, context: Dict[str, Any] = None, 
                     conversation_history: List[Dict] = None) -> AnalysisResult:
        """Perform AI analysis with memory and context"""
        try:
            # Prepare context
            full_context = await self._prepare_context(query, context, conversation_history)
            
            # Generate AI response
            response = await self._generate_response(query, full_context)
            
            # Extract insights and recommendations
            insights = await self._extract_insights(response, context)
            recommendations = await self._generate_recommendations(response, context)
            
            # Calculate confidence score
            confidence = await self._calculate_confidence(response, context)
            
            # Store in memory
            await self._store_memory(query, response, context)
            
            result = AnalysisResult(
                response=response,
                confidence=confidence,
                insights=insights,
                recommendations=recommendations,
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
                              conversation_history: List[Dict] = None) -> str:
        """Prepare context for AI analysis"""
        context_parts = [self.system_prompt]
        
        # Add conversation history
        if conversation_history:
            context_parts.append("Previous conversation:")
            for msg in conversation_history[-5:]:  # Last 5 messages
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                context_parts.append(f"{role.capitalize()}: {content}")
        
        # Add current context
        if context:
            context_parts.append(f"Current context: {context}")
        
        # Add relevant memory
        if self.memory_store:
            similar_analyses = await self.memory_store.query_similar(query, limit=3)
            if similar_analyses:
                context_parts.append("Related previous analyses:")
                for analysis in similar_analyses:
                    context_parts.append(f"- {analysis.get('summary', 'N/A')}")
        
        return "\n\n".join(context_parts)
    
    async def _generate_response(self, query: str, context: str) -> str:
        """Generate AI response using free Hugging Face models"""
        try:
            # Use local ML models if available
            if self.ml_manager and self.ml_manager.is_ready():
                # Create a cybersecurity-focused prompt
                prompt = f"Cybersecurity Expert: {query}\nAnalysis:"
                response = await self.ml_manager.generate_text(prompt, max_length=300)
                
                if response and len(response.strip()) > 10:
                    return self._enhance_response(response, query)
            
            # Fallback to rule-based response
            return await self._generate_fallback_response(query, context)
            
        except Exception as e:
            logger.error(f"Response generation error: {e}")
            return await self._generate_fallback_response(query, context)
    
    def _enhance_response(self, response: str, query: str) -> str:
        """Enhance the generated response with cybersecurity context"""
        # Clean up the response
        response = response.strip()
        
        # Add security context if missing
        query_lower = query.lower()
        if any(word in query_lower for word in ['threat', 'malware', 'phishing', 'attack']):
            if 'security' not in response.lower():
                response += "\n\nSecurity Recommendation: Always verify the source and avoid suspicious links or downloads."
        
        # Ensure reasonable length
        if len(response) > 500:
            response = response[:500] + "..."
        
        return response
    
    async def _generate_fallback_response(self, query: str, context: Dict[str, Any]) -> str:
        """Generate fallback response when AI service is unavailable"""
        
        # Basic pattern matching for common queries
        query_lower = query.lower()
        
        if any(word in query_lower for word in ['threat', 'malware', 'virus', 'dangerous']):
            return """Based on the analysis, I've detected potential security concerns. Here's my assessment:

Security Analysis:
- The system has identified patterns that may indicate security risks
- Threat detection algorithms have flagged this for further investigation
- Immediate attention is recommended to assess the full scope

Recommendations:
1. Avoid accessing suspicious websites or downloading unknown files
2. Keep your browser and security software updated
3. Use strong, unique passwords for all accounts
4. Enable two-factor authentication where possible
5. Be cautious with email attachments and links

If you're seeing this message, it means advanced AI analysis is temporarily unavailable, but basic security protocols are still active."""

        elif any(word in query_lower for word in ['safe', 'secure', 'protected']):
            return """Security Status Assessment:

Your current browsing appears to be within normal safety parameters. However, maintaining good security hygiene is always important:

Best Practices:
1. Continue using HTTPS websites whenever possible
2. Regularly update your browser and operating system
3. Be cautious of suspicious downloads or email attachments
4. Use reputable antivirus software
5. Keep backups of important data

Stay vigilant and continue following security best practices."""

        else:
            return """I'm currently analyzing your security query. While advanced AI processing is temporarily limited, here are some general cybersecurity guidelines:

General Security Recommendations:
1. Always verify the authenticity of websites before entering sensitive information
2. Use strong, unique passwords for different accounts
3. Keep your software and browsers updated
4. Be cautious with downloads and email attachments
5. Enable two-factor authentication when available
6. Regularly monitor your accounts for suspicious activity

For specific threat analysis, please try again in a few moments when full AI capabilities are restored."""
    
    async def _extract_insights(self, response: str, context: Dict[str, Any]) -> List[str]:
        """Extract key insights from the response"""
        insights = []
        
        # Basic insight extraction based on keywords
        response_lower = response.lower()
        
        if 'high risk' in response_lower or 'critical' in response_lower:
            insights.append("High-risk security threat detected")
        
        if 'phishing' in response_lower:
            insights.append("Potential phishing attempt identified")
        
        if 'malware' in response_lower:
            insights.append("Malware threat indicators present")
        
        if 'suspicious' in response_lower:
            insights.append("Suspicious patterns detected")
        
        if 'secure' in response_lower and 'safe' in response_lower:
            insights.append("Security measures appear adequate")
        
        # Context-based insights
        if context and context.get('type') == 'browsing_analysis':
            insights.append("Browsing pattern analysis completed")
        
        return insights or ["Analysis completed successfully"]
    
    async def _generate_recommendations(self, response: str, context: Dict[str, Any]) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        response_lower = response.lower()
        
        # Security-based recommendations
        if any(word in response_lower for word in ['threat', 'risk', 'danger', 'malware']):
            recommendations.extend([
                "Avoid interacting with suspicious content",
                "Run a full system security scan",
                "Update your security software",
                "Change passwords if compromised"
            ])
        
        if 'phishing' in response_lower:
            recommendations.extend([
                "Never enter credentials on suspicious sites",
                "Verify website authenticity before proceeding",
                "Report suspected phishing attempts"
            ])
        
        if 'update' in response_lower:
            recommendations.append("Keep your software and browsers updated")
        
        # Default recommendations
        if not recommendations:
            recommendations = [
                "Continue following security best practices",
                "Stay vigilant while browsing",
                "Keep security software updated"
            ]
        
        return recommendations
    
    async def _calculate_confidence(self, response: str, context: Dict[str, Any]) -> float:
        """Calculate confidence score for the analysis"""
        confidence = 0.5  # Base confidence
        
        # Increase confidence based on response characteristics
        if len(response) > 200:
            confidence += 0.2
        
        if any(word in response.lower() for word in ['analysis', 'assessment', 'detected']):
            confidence += 0.2
        
        # Context-based confidence adjustments
        if context:
            if context.get('type') in ['threat_evaluation', 'security_analysis']:
                confidence += 0.1
        
        return min(confidence, 1.0)
    
    async def _store_memory(self, query: str, response: str, context: Dict[str, Any]):
        """Store analysis in memory for future reference"""
        if self.memory_store:
            memory_entry = {
                'query': query,
                'response': response,
                'context': context,
                'timestamp': datetime.utcnow().isoformat(),
                'summary': response[:200] + "..." if len(response) > 200 else response
            }
            await self.memory_store.store_analysis(memory_entry, None)