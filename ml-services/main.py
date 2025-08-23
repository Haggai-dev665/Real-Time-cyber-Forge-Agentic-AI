"""
Cyber Forge AI - ML/AI Services
Advanced machine learning and AI services for cybersecurity analysis
"""
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
import os

from app.core.config import settings
from app.services.ai_agent import AIAgent
from app.services.threat_analyzer import ThreatAnalyzer
from app.services.ml_models import MLModelManager
from app.services.memory_store import MemoryStore
from app.routers import analysis, threats, insights
from app.models.schemas import AnalysisRequest, ThreatScanRequest, HealthResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Cyber Forge AI - ML/AI Services",
    description="Advanced machine learning and AI services for cybersecurity analysis",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global services
ai_agent = None
threat_analyzer = None
ml_manager = None
memory_store = None

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    global ai_agent, threat_analyzer, ml_manager, memory_store
    
    logger.info("🚀 Starting Cyber Forge AI ML/AI Services...")
    
    try:
        # Initialize memory store
        memory_store = MemoryStore()
        await memory_store.initialize()
        
        # Initialize ML models
        ml_manager = MLModelManager()
        await ml_manager.load_models()
        
        # Initialize threat analyzer
        threat_analyzer = ThreatAnalyzer(ml_manager)
        
        # Initialize AI agent
        ai_agent = AIAgent(memory_store, threat_analyzer)
        await ai_agent.initialize()
        
        logger.info("✅ All services initialized successfully")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize services: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🔄 Shutting down services...")
    
    if memory_store:
        await memory_store.cleanup()
    
    logger.info("✅ Shutdown complete")

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow(),
        services={
            "ai_agent": ai_agent.is_ready() if ai_agent else False,
            "threat_analyzer": threat_analyzer.is_ready() if threat_analyzer else False,
            "ml_models": ml_manager.is_ready() if ml_manager else False,
            "memory_store": memory_store.is_ready() if memory_store else False
        },
        version="1.0.0"
    )

# Analysis endpoint
@app.post("/analyze")
async def analyze_data(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """Analyze cybersecurity data using AI and ML models"""
    try:
        if not ai_agent or not ai_agent.is_ready():
            raise HTTPException(status_code=503, detail="AI agent not ready")
        
        # Perform analysis
        result = await ai_agent.analyze(
            query=request.query,
            context=request.context,
            conversation_history=request.conversation_history
        )
        
        # Store analysis result in background
        background_tasks.add_task(
            memory_store.store_analysis,
            request.dict(),
            result
        )
        
        return {
            "response": result.response,
            "confidence": result.confidence,
            "insights": result.insights,
            "recommendations": result.recommendations,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# URL analysis endpoint
@app.post("/analyze-url")
async def analyze_url(url: str, context: str = "security_analysis"):
    """Analyze URL for security threats"""
    try:
        if not threat_analyzer or not threat_analyzer.is_ready():
            raise HTTPException(status_code=503, detail="Threat analyzer not ready")
        
        result = await threat_analyzer.analyze_url(url, context)
        
        return {
            "url": url,
            "risk_score": result.risk_score,
            "threat_types": result.threat_types,
            "confidence": result.confidence,
            "recommendations": result.recommendations,
            "analysis_timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"URL analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Threat scanning endpoint
@app.post("/scan-threats")
async def scan_threats(request: ThreatScanRequest):
    """Perform comprehensive threat scanning"""
    try:
        if not threat_analyzer or not threat_analyzer.is_ready():
            raise HTTPException(status_code=503, detail="Threat analyzer not ready")
        
        results = await threat_analyzer.scan_multiple(request.urls, request.context)
        
        return {
            "scan_id": request.scan_id,
            "results": results,
            "summary": {
                "total_urls": len(request.urls),
                "threats_found": sum(1 for r in results if r.risk_score > 0.5),
                "high_risk": sum(1 for r in results if r.risk_score > 0.8)
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Threat scanning error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Memory query endpoint
@app.post("/query-memory")
async def query_memory(query: str, limit: int = 10):
    """Query the AI agent's memory"""
    try:
        if not memory_store or not memory_store.is_ready():
            raise HTTPException(status_code=503, detail="Memory store not ready")
        
        results = await memory_store.query_similar(query, limit)
        
        return {
            "query": query,
            "results": results,
            "count": len(results),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Memory query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include routers
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(threats.router, prefix="/api/threats", tags=["threats"])
app.include_router(insights.router, prefix="/api/insights", tags=["insights"])

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "Cyber Forge AI - ML/AI Services",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "analyze": "/analyze",
            "analyze_url": "/analyze-url",
            "scan_threats": "/scan-threats",
            "documentation": "/docs"
        },
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8001)),
        reload=os.getenv("ENV") == "development",
        log_level="info"
    )