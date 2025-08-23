"""
Schemas for ML/AI Services
"""
from typing import Dict, List, Any, Optional
from datetime import datetime
from pydantic import BaseModel

class AnalysisRequest(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[Dict]] = None

class AnalysisResult(BaseModel):
    response: str
    confidence: float
    insights: List[str]
    recommendations: List[str]
    context: Optional[Dict[str, Any]] = None
    timestamp: datetime

class ThreatScanRequest(BaseModel):
    urls: List[str]
    context: str = "security_analysis"
    scan_id: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    services: Dict[str, bool]
    version: str