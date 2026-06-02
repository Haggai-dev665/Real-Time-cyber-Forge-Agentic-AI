"""
Threats API routes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class ThreatDetectRequest(BaseModel):
    text: str
    metadata: Optional[Dict[str, Any]] = {}


class ThreatDetectResponse(BaseModel):
    risk_score: float
    confidence: float
    threat_type: str
    indicators: List[str]
    details: Dict[str, Any]


@router.get("/")
async def get_threat_endpoints():
    """Get available threat endpoints"""
    return {
        "endpoints": [
            "GET /api/threats/ - This endpoint",
            "POST /api/threats/detect - Classify a threat from evidence text",
            "POST /scan-threats - Threat scanning (root)",
            "POST /analyze-url - URL threat analysis (root)"
        ]
    }


@router.post("/detect", response_model=ThreatDetectResponse)
async def detect_threat(request: ThreatDetectRequest):
    """
    Classify a threat from structured evidence text.
    Called by the Node.js backend mlServiceClient.classifyThreat().
    """
    try:
        text = request.text.lower()
        metadata = request.metadata or {}
        original_risk = metadata.get("riskScore", 0)

        # --- Keyword-based heuristic scoring ---
        indicators: List[str] = []
        risk_score = float(original_risk) if original_risk else 0.0
        threat_type = "benign"

        keyword_signals = {
            "phishing":    (["phishing", "credential", "login", "fake", "spoof", "deceptive"], 25),
            "malware":     (["malware", "trojan", "ransomware", "payload", "exploit", "dropper"], 30),
            "suspicious":  (["suspicious", "obfuscated", "redirect", "tracking", "mixed content"], 15),
            "crypto":      (["cryptominer", "mining", "coinhive", "crypto"], 20),
            "botnet":      (["botnet", "c2", "command and control", "beacon"], 25),
            "dns_tunnel":  (["dns tunnel", "dns exfiltration", "subdomain"], 20),
        }

        for category, (keywords, weight) in keyword_signals.items():
            hits = [kw for kw in keywords if kw in text]
            if hits:
                indicators.extend([f"{category}: {kw}" for kw in hits])
                risk_score = min(risk_score + weight, 100)
                if threat_type == "benign" or weight > keyword_signals.get(threat_type, ([], 0))[1]:
                    threat_type = category

        # Header / SSL checks embedded in evidence text
        if "missing security headers" in text:
            indicators.append("missing_security_headers")
            risk_score = min(risk_score + 10, 100)
        if "https: no" in text:
            indicators.append("no_https")
            risk_score = min(risk_score + 15, 100)

        confidence = 0.55 + min(len(indicators) * 0.05, 0.35)

        # Try to use the ML manager if available
        try:
            from main import ml_manager
            if ml_manager and ml_manager.is_ready():
                ml_prediction = await ml_manager.predict(request.text)
                if ml_prediction:
                    risk_score = ml_prediction.get("risk_score", risk_score)
                    confidence = ml_prediction.get("confidence", confidence)
                    threat_type = ml_prediction.get("threat_type", threat_type)
        except Exception as ml_err:
            logger.debug(f"ML manager unavailable, using heuristics: {ml_err}")

        return ThreatDetectResponse(
            risk_score=round(min(risk_score, 100), 1),
            confidence=round(confidence, 2),
            threat_type=threat_type,
            indicators=indicators if indicators else ["no_signals"],
            details={
                "original_risk_score": original_risk,
                "url": metadata.get("url", ""),
                "analysis_method": "heuristic+keyword",
                "analyzed_at": datetime.utcnow().isoformat()
            }
        )

    except Exception as e:
        logger.error(f"Threat detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))