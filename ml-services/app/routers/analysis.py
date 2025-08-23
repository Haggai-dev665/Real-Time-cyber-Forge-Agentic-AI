"""
Analysis API routes
"""
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_analysis_endpoints():
    """Get available analysis endpoints"""
    return {
        "endpoints": [
            "GET /api/analysis/ - This endpoint",
            "POST /analyze - Main analysis endpoint",
            "POST /analyze-url - URL analysis",
            "POST /scan-threats - Threat scanning"
        ]
    }