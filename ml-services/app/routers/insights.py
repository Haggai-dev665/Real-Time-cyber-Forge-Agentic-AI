"""
Insights API routes
"""
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_insight_endpoints():
    """Get available insight endpoints"""
    return {
        "endpoints": [
            "GET /api/insights/ - This endpoint",
            "POST /query-memory - Query AI memory",
            "GET /datasets/available - Available datasets"
        ]
    }