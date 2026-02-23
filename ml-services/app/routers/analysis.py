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
            "POST /api/analysis/explain - Threat explanation & recommendations",
            "POST /analyze - Main analysis endpoint (root)",
            "POST /analyze-url - URL analysis (root)",
            "POST /scan-threats - Threat scanning (root)"
        ]
    }


class ThreatExplainRequest(BaseModel):
    threat_data: Dict[str, Any]


class ThreatExplainResponse(BaseModel):
    summary: str
    recommendations: List[str]
    technical_details: str
    timestamp: str


@router.post("/explain", response_model=ThreatExplainResponse)
async def explain_threat(request: ThreatExplainRequest):
    """
    Generate a human-readable explanation of a classified threat.
    Called by the Node.js backend mlServiceClient.getExplanation().
    Tries the Gemini reasoning layer first, then falls back to template.
    """
    try:
        td = request.threat_data
        category = td.get("category", "unknown")
        threat_type = td.get("threatType", category)
        confidence = td.get("confidence", 0)
        risk_score = td.get("riskScore", 0)
        indicators = td.get("indicators", [])

        # Attempt Gemini-powered explanation
        gemini_summary = None
        try:
            from main import ai_agent
            if ai_agent and ai_agent.is_ready():
                prompt = (
                    f"Provide a concise cybersecurity threat explanation:\n"
                    f"Threat type: {threat_type}\n"
                    f"Risk score: {risk_score}/100\n"
                    f"Confidence: {round(confidence * 100)}%\n"
                    f"Indicators: {', '.join(indicators[:10])}\n"
                    f"Give: 1-sentence summary, 3 actionable recommendations, brief technical detail."
                )
                gemini_result = await ai_agent.analyze(query=prompt, context={})
                if gemini_result and gemini_result.get("analysis"):
                    gemini_summary = gemini_result["analysis"]
        except Exception as gem_err:
            logger.debug(f"Gemini explanation unavailable: {gem_err}")

        # Build recommendations based on threat type
        rec_map = {
            "phishing": [
                "Block the domain at firewall/DNS level",
                "Alert users who may have visited the URL",
                "Check credential stores for compromised logins",
                "Enable anti-phishing browser extensions"
            ],
            "malware": [
                "Quarantine affected endpoints immediately",
                "Scan all connected systems with updated AV signatures",
                "Review network logs for lateral movement",
                "Isolate the malicious URL at proxy level"
            ],
            "suspicious": [
                "Add the domain to watchlist for continued monitoring",
                "Enable enhanced logging for related traffic",
                "Review security header configuration"
            ],
            "crypto": [
                "Block mining scripts at content-security-policy level",
                "Scan for cryptominer processes on endpoints",
                "Review CPU usage anomalies across the network"
            ],
            "botnet": [
                "Immediately block C2 communication IPs/domains",
                "Scan for persistence mechanisms on affected hosts",
                "Review DNS query logs for beaconing patterns"
            ],
        }

        recommendations = rec_map.get(threat_type, rec_map.get(category, [
            "Monitor the source for further activity",
            "Review related network traffic patterns",
            "Update threat intelligence feeds"
        ]))

        if gemini_summary:
            summary = gemini_summary[:500]
            technical_details = (
                f"AI-Powered Analysis | Type: {threat_type} | "
                f"Risk: {risk_score}/100 | Confidence: {round(confidence * 100)}% | "
                f"Indicators: {', '.join(indicators[:5])}"
            )
        else:
            summary = (
                f"{threat_type.replace('_', ' ').title()} threat detected "
                f"with {round(confidence * 100)}% confidence (risk score {risk_score}/100). "
                f"{len(indicators)} indicator(s) triggered."
            )
            technical_details = (
                f"Heuristic Analysis | Type: {threat_type} | "
                f"Risk: {risk_score}/100 | Confidence: {round(confidence * 100)}% | "
                f"Indicators: {', '.join(indicators[:5])}"
            )

        return ThreatExplainResponse(
            summary=summary,
            recommendations=recommendations[:5],
            technical_details=technical_details,
            timestamp=datetime.utcnow().isoformat()
        )

    except Exception as e:
        logger.error(f"Threat explanation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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