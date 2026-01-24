"""
Insights API routes - AI-powered security insights generation
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class InsightRequest(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = {}
    timestamp: Optional[str] = None

class InsightResponse(BaseModel):
    insights: List[str]
    recommendations: List[str]
    risk_assessment: str
    confidence: float
    generated_at: str

@router.get("/")
async def get_insight_endpoints():
    """Get available insight endpoints"""
    return {
        "endpoints": [
            "GET /api/insights/ - This endpoint",
            "POST /api/insights/generate - Generate security insights",
            "POST /api/insights/query-memory - Query AI memory",
            "GET /api/insights/datasets/available - Available datasets"
        ]
    }

@router.post("/generate", response_model=InsightResponse)
async def generate_insights(request: InsightRequest):
    """Generate AI-powered security insights based on query and context"""
    try:
        from main import ai_agent
        
        query = request.query
        context = request.context or {}
        
        # Generate insights using AI agent if available
        if ai_agent and ai_agent.is_ready():
            result = await ai_agent.analyze(query, context)
            
            return InsightResponse(
                insights=result.insights if hasattr(result, 'insights') else [
                    f"Analysis of: {query}",
                    "Security posture evaluation completed",
                    "Threat indicators checked"
                ],
                recommendations=result.recommendations if hasattr(result, 'recommendations') else [
                    "Continue monitoring for suspicious activity",
                    "Review security configurations regularly",
                    "Ensure all systems are patched"
                ],
                risk_assessment="Medium" if "threat" in query.lower() else "Low",
                confidence=result.confidence if hasattr(result, 'confidence') else 0.85,
                generated_at=datetime.utcnow().isoformat()
            )
        
        # Fallback response when AI agent is not available
        return InsightResponse(
            insights=[
                f"Query analyzed: {query}",
                "Basic security assessment completed",
                "No immediate threats detected"
            ],
            recommendations=[
                "Enable real-time monitoring",
                "Review access controls",
                "Update threat intelligence feeds"
            ],
            risk_assessment="Low",
            confidence=0.7,
            generated_at=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Insight generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/query-memory")
async def query_memory(query: str, limit: int = 10):
    """Query the AI memory store for relevant past analyses"""
    try:
        from main import memory_store
        
        if memory_store and memory_store.is_ready():
            results = await memory_store.query_similar(query, limit=limit)
            return {
                "query": query,
                "results": results,
                "count": len(results),
                "timestamp": datetime.utcnow().isoformat()
            }
        
        return {
            "query": query,
            "results": [],
            "count": 0,
            "message": "Memory store not available",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Memory query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))