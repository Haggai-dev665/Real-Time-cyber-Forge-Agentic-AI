"""
Threats API routes
"""
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_threat_endpoints():
    """Get available threat endpoints"""
    return {
        "endpoints": [
            "GET /api/threats/ - This endpoint",
            "POST /scan-threats - Threat scanning",
            "POST /analyze-url - URL threat analysis"
        ]
    }