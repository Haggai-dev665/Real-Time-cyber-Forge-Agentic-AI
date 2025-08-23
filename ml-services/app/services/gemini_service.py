"""
Gemini AI Service for cybersecurity analysis with custom training data integration
"""
import asyncio
import logging
import json
import os
from typing import Dict, List, Any, Optional
from datetime import datetime

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from ..core.config import settings

logger = logging.getLogger(__name__)

class GeminiService:
    """Google Gemini AI Service with custom training data integration"""
    
    def __init__(self):
        self.model = None
        self.is_initialized = False
        self.custom_knowledge = {}
        self.training_examples = []
        
        # Safety settings for cybersecurity analysis
        self.safety_settings = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }
        
        # Cybersecurity-focused system prompt
        self.system_prompt = """You are CyberForge AI, an advanced cybersecurity expert specializing in:

CORE EXPERTISE:
- Real-time threat detection and analysis
- Malware and phishing identification
- Network security assessment
- Browser security monitoring
- Risk assessment and mitigation
- Security incident response

ANALYSIS METHODOLOGY:
1. Threat Assessment: Evaluate risk levels (Critical, High, Medium, Low)
2. Pattern Recognition: Identify attack vectors and TTPs
3. Context Analysis: Consider environmental factors and user behavior
4. Risk Scoring: Provide numerical risk scores (0-10 scale)
5. Actionable Recommendations: Specific, implementable security measures

CUSTOM KNOWLEDGE BASE:
{custom_knowledge}

TRAINING EXAMPLES:
{training_examples}

RESPONSE FORMAT:
Always provide structured responses with:
- Risk Level: (Critical/High/Medium/Low)
- Threat Types: Specific classifications
- Confidence Score: (0.0-1.0)
- Detailed Analysis: Technical explanation
- Recommendations: Specific action items
- Prevention Measures: Long-term security improvements

Focus on practical, actionable cybersecurity guidance based on current threat landscape and best practices."""

    async def initialize(self):
        """Initialize Gemini AI service"""
        try:
            if not settings.GEMINI_API_KEY:
                logger.error("GEMINI_API_KEY not found in configuration")
                raise ValueError("Gemini API key is required")
            
            # Configure Gemini
            genai.configure(api_key=settings.GEMINI_API_KEY)
            
            # Initialize model
            self.model = genai.GenerativeModel(
                model_name=settings.GEMINI_MODEL,
                safety_settings=self.safety_settings
            )
            
            # Load custom training data
            await self._load_custom_training_data()
            
            # Test connection
            await self._test_connection()
            
            self.is_initialized = True
            logger.info("✅ Gemini AI service initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Gemini service: {e}")
            self.is_initialized = False
            raise
    
    def is_ready(self) -> bool:
        """Check if Gemini service is ready"""
        return self.is_initialized and self.model is not None
    
    async def _load_custom_training_data(self):
        """Load custom cybersecurity training data and knowledge base"""
        try:
            # Load knowledge base
            knowledge_base_path = settings.CUSTOM_KNOWLEDGE_BASE
            if os.path.exists(knowledge_base_path):
                for filename in os.listdir(knowledge_base_path):
                    if filename.endswith('.json'):
                        file_path = os.path.join(knowledge_base_path, filename)
                        with open(file_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            self.custom_knowledge[filename[:-5]] = data
                logger.info(f"✅ Loaded {len(self.custom_knowledge)} knowledge base files")
            
            # Load training examples
            training_data_path = settings.TRAINING_DATA_PATH
            if os.path.exists(training_data_path):
                for filename in os.listdir(training_data_path):
                    if filename.endswith('.json'):
                        file_path = os.path.join(training_data_path, filename)
                        with open(file_path, 'r', encoding='utf-8') as f:
                            examples = json.load(f)
                            if isinstance(examples, list):
                                self.training_examples.extend(examples)
                            else:
                                self.training_examples.append(examples)
                logger.info(f"✅ Loaded {len(self.training_examples)} training examples")
            
            # Create default training data if none exists
            if not self.training_examples:
                self._create_default_training_data()
                
        except Exception as e:
            logger.warning(f"⚠️ Could not load custom training data: {e}")
            self._create_default_training_data()
    
    def _create_default_training_data(self):
        """Create default cybersecurity training examples"""
        self.training_examples = [
            {
                "input": "Suspicious email with attachment claiming to be from bank",
                "output": "RISK LEVEL: High\nTHREAT TYPE: Phishing/Social Engineering\nCONFIDENCE: 0.9\nANALYSIS: Classic phishing attempt using financial institution impersonation\nRECOMMENDATIONS: Delete email, verify with bank directly, do not click links or download attachments"
            },
            {
                "input": "Unknown executable file downloaded from web browser",
                "output": "RISK LEVEL: Critical\nTHREAT TYPE: Potential Malware\nCONFIDENCE: 0.85\nANALYSIS: Unverified executable poses significant malware risk\nRECOMMENDATIONS: Quarantine file, scan with antivirus, avoid execution until verified"
            },
            {
                "input": "Multiple failed login attempts from foreign IP addresses",
                "output": "RISK LEVEL: High\nTHREAT TYPE: Brute Force Attack\nCONFIDENCE: 0.95\nANALYSIS: Credential stuffing or brute force attack detected\nRECOMMENDATIONS: Enable MFA, implement rate limiting, monitor for credential compromise"
            }
        ]
        
        self.custom_knowledge = {
            "threat_indicators": {
                "phishing": ["suspicious_links", "impersonation", "urgency_tactics", "credential_requests"],
                "malware": ["unknown_executables", "suspicious_downloads", "system_modifications"],
                "network_attacks": ["port_scanning", "unusual_traffic", "failed_authentications"]
            },
            "risk_scoring": {
                "critical": {"score_range": [8, 10], "response_time": "immediate"},
                "high": {"score_range": [6, 7], "response_time": "within_1_hour"},
                "medium": {"score_range": [4, 5], "response_time": "within_24_hours"},
                "low": {"score_range": [1, 3], "response_time": "routine_review"}
            }
        }
    
    async def _test_connection(self):
        """Test Gemini API connection"""
        try:
            test_prompt = "Test connection. Respond with 'OK' if you can receive this message."
            response = await self.model.generate_content_async(test_prompt)
            if response.text:
                logger.info("✅ Gemini API connection test successful")
            else:
                raise Exception("No response from Gemini API")
        except Exception as e:
            logger.error(f"❌ Gemini API connection test failed: {e}")
            raise
    
    async def analyze_security_query(self, query: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Analyze security query using Gemini with custom training data"""
        if not self.is_ready():
            raise Exception("Gemini service not initialized")
        
        try:
            # Prepare enhanced prompt with custom knowledge
            enhanced_prompt = self._create_enhanced_prompt(query, context)
            
            # Generate response
            response = await self.model.generate_content_async(
                enhanced_prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=settings.GEMINI_TEMPERATURE,
                    max_output_tokens=settings.GEMINI_MAX_TOKENS,
                )
            )
            
            # Parse and structure response
            analysis_result = self._parse_security_response(response.text, query, context)
            
            return analysis_result
            
        except Exception as e:
            logger.error(f"Gemini analysis error: {e}")
            return self._create_fallback_response(query, context)
    
    def _create_enhanced_prompt(self, query: str, context: Dict[str, Any] = None) -> str:
        """Create enhanced prompt with custom knowledge and training data"""
        # Format custom knowledge
        knowledge_str = json.dumps(self.custom_knowledge, indent=2) if self.custom_knowledge else "No custom knowledge available"
        
        # Format training examples (last 5 for context)
        examples_str = "\n".join([
            f"Example {i+1}:\nInput: {ex.get('input', '')}\nOutput: {ex.get('output', '')}\n"
            for i, ex in enumerate(self.training_examples[-5:])
        ]) if self.training_examples else "No training examples available"
        
        # Create system prompt with custom data
        system_prompt = self.system_prompt.format(
            custom_knowledge=knowledge_str,
            training_examples=examples_str
        )
        
        # Add context if provided
        context_str = ""
        if context:
            context_str = f"\nCONTEXT:\n{json.dumps(context, indent=2)}\n"
        
        # Combine into final prompt
        final_prompt = f"""{system_prompt}

{context_str}
SECURITY ANALYSIS REQUEST:
{query}

Provide a comprehensive cybersecurity analysis following the response format above:"""
        
        return final_prompt
    
    def _parse_security_response(self, response_text: str, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Gemini response into structured security analysis"""
        try:
            # Extract key information using basic parsing
            response_lower = response_text.lower()
            
            # Determine risk level
            if "critical" in response_lower:
                risk_level = "Critical"
                risk_score = 9.0
            elif "high" in response_lower:
                risk_level = "High"
                risk_score = 7.0
            elif "medium" in response_lower:
                risk_level = "Medium"
                risk_score = 5.0
            else:
                risk_level = "Low"
                risk_score = 3.0
            
            # Extract confidence score
            confidence = 0.8  # Default confidence
            if "confidence" in response_lower:
                # Try to extract numerical confidence
                try:
                    import re
                    conf_match = re.search(r'confidence[:\s]*([0-9.]+)', response_lower)
                    if conf_match:
                        confidence = float(conf_match.group(1))
                        if confidence > 1.0:
                            confidence = confidence / 100.0  # Convert percentage to decimal
                except:
                    confidence = 0.8
            
            # Extract threat types
            threat_types = []
            threat_keywords = ["phishing", "malware", "ddos", "ransomware", "social engineering", "brute force"]
            for keyword in threat_keywords:
                if keyword in response_lower:
                    threat_types.append(keyword.title())
            
            if not threat_types:
                threat_types = ["Unknown"]
            
            # Extract recommendations (look for numbered lists or bullet points)
            recommendations = []
            lines = response_text.split('\n')
            for line in lines:
                line = line.strip()
                if any(indicator in line.lower() for indicator in ['recommend', 'should', 'must', 'action']):
                    if len(line) > 10 and len(line) < 200:  # Reasonable recommendation length
                        recommendations.append(line)
            
            if not recommendations:
                recommendations = ["Follow standard cybersecurity best practices"]
            
            return {
                "response": response_text,
                "risk_level": risk_level,
                "risk_score": risk_score,
                "confidence": confidence,
                "threat_types": threat_types,
                "recommendations": recommendations[:5],  # Limit to 5 recommendations
                "analysis_timestamp": datetime.utcnow().isoformat(),
                "model_used": "gemini-pro",
                "custom_data_used": len(self.custom_knowledge) > 0 or len(self.training_examples) > 0
            }
            
        except Exception as e:
            logger.error(f"Error parsing Gemini response: {e}")
            return self._create_fallback_response(query, context)
    
    def _create_fallback_response(self, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Create fallback response when Gemini is unavailable"""
        return {
            "response": "Gemini AI service is temporarily unavailable. Using fallback security analysis.",
            "risk_level": "Medium",
            "risk_score": 5.0,
            "confidence": 0.3,
            "threat_types": ["Unknown"],
            "recommendations": [
                "Verify the security concern manually",
                "Consult with security team",
                "Follow standard security protocols",
                "Monitor for additional indicators"
            ],
            "analysis_timestamp": datetime.utcnow().isoformat(),
            "model_used": "fallback",
            "custom_data_used": False
        }
    
    async def generate_text(self, prompt: str, max_length: int = 500) -> str:
        """Generate text using Gemini (for compatibility with existing interfaces)"""
        if not self.is_ready():
            return "Gemini service not available"
        
        try:
            response = await self.model.generate_content_async(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=settings.GEMINI_TEMPERATURE,
                    max_output_tokens=min(max_length, settings.GEMINI_MAX_TOKENS),
                )
            )
            return response.text if response.text else "No response generated"
        except Exception as e:
            logger.error(f"Text generation error: {e}")
            return f"Text generation failed: {str(e)}"
    
    async def detect_threats(self, text: str) -> Dict[str, Any]:
        """Detect threats in text using Gemini"""
        threat_prompt = f"""Analyze the following text for cybersecurity threats:

TEXT: {text}

Identify:
1. Threat type (if any)
2. Risk level (Critical/High/Medium/Low/None)
3. Specific indicators
4. Recommended actions

Provide a brief, focused analysis:"""

        analysis = await self.analyze_security_query(threat_prompt)
        return {
            "threat_detected": analysis["risk_level"] != "Low",
            "threat_type": analysis["threat_types"][0] if analysis["threat_types"] else "None",
            "risk_score": analysis["risk_score"],
            "confidence": analysis["confidence"],
            "details": analysis["response"]
        }