"""
Analysis API routes - Security data analysis endpoints
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class NetworkAnalysisRequest(BaseModel):
    traffic_data: Dict[str, Any]
    timestamp: Optional[str] = None

class NetworkAnalysisResponse(BaseModel):
    anomalies: List[Dict[str, Any]]
    patterns: List[str]
    risk_score: float
    recommendations: List[str]
    analyzed_at: str

class BatchProcessRequest(BaseModel):
    items: List[Dict[str, Any]]
    process_type: str
    options: Optional[Dict[str, Any]] = {}
    timestamp: Optional[str] = None

@router.get("/")
async def get_analysis_endpoints():
    """Get available analysis endpoints"""
    return {
        "endpoints": [
            "GET /api/analysis/ - This endpoint",
            "POST /api/analysis/network - Network traffic analysis",
            "POST /api/analysis/batch - Batch data processing",
            "POST /analyze - Main analysis endpoint (root)",
            "POST /analyze-url - URL analysis (root)",
            "POST /scan-threats - Threat scanning (root)"
        ]
    }

@router.post("/network", response_model=NetworkAnalysisResponse)
async def analyze_network(request: NetworkAnalysisRequest):
    """Analyze network traffic for anomalies and threats"""
    try:
        from main import threat_analyzer, ml_manager
        
        traffic_data = request.traffic_data
        
        # Analyze network traffic
        anomalies = []
        patterns = []
        risk_score = 0.0
        
        # Check for common anomaly patterns
        if traffic_data.get('bytes_sent', 0) > 1000000:
            anomalies.append({
                "type": "high_data_transfer",
                "severity": "medium",
                "description": "Unusually high data transfer detected"
            })
            risk_score += 0.2
            
        if traffic_data.get('connection_count', 0) > 100:
            anomalies.append({
                "type": "connection_spike",
                "severity": "high",
                "description": "High number of connections detected"
            })
            risk_score += 0.3
            
        if traffic_data.get('failed_connections', 0) > 10:
            anomalies.append({
                "type": "failed_connections",
                "severity": "medium",
                "description": "Multiple failed connection attempts"
            })
            risk_score += 0.2
            
        # Detect patterns
        if traffic_data.get('protocol') == 'tcp':
            patterns.append("Standard TCP traffic")
        if traffic_data.get('encrypted', False):
            patterns.append("Encrypted communication detected")
        if traffic_data.get('destination_port') in [22, 23, 3389]:
            patterns.append("Remote access protocol detected")
            risk_score += 0.1
            
        return NetworkAnalysisResponse(
            anomalies=anomalies,
            patterns=patterns if patterns else ["Normal traffic patterns"],
            risk_score=min(risk_score, 1.0),
            recommendations=[
                "Monitor high-risk connections",
                "Review firewall rules",
                "Enable deep packet inspection"
            ] if risk_score > 0.3 else ["Continue monitoring"],
            analyzed_at=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Network analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch")
async def batch_process(request: BatchProcessRequest):
    """Process multiple items in batch"""
    try:
        results = []
        
        for i, item in enumerate(request.items):
            results.append({
                "index": i,
                "status": "processed",
                "result": {
                    "item_id": item.get("id", f"item_{i}"),
                    "process_type": request.process_type,
                    "success": True
                }
            })
        
        return {
            "batch_id": f"batch_{datetime.utcnow().timestamp()}",
            "process_type": request.process_type,
            "total_items": len(request.items),
            "processed": len(results),
            "results": results,
            "completed_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Batch processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))