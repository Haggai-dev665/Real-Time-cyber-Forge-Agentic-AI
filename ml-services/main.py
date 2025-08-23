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
enhanced_ai_agent = None
threat_analyzer = None
ml_manager = None
memory_store = None

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    global ai_agent, enhanced_ai_agent, threat_analyzer, ml_manager, memory_store
    
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
        threat_analyzer.is_initialized = True
        
        # Initialize original AI agent
        ai_agent = AIAgent(memory_store, threat_analyzer, ml_manager)
        await ai_agent.initialize()
        
        # Initialize enhanced AI agent
        try:
            from app.services.enhanced_ai_agent import enhanced_ai_agent as enhanced_agent
            enhanced_ai_agent = enhanced_agent
            await enhanced_ai_agent.initialize()
        except ImportError:
            logger.warning("Enhanced AI agent not available")
            enhanced_ai_agent = None
        
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

# Enhanced AI Agent Endpoints

@app.post("/ai/create-task")
async def create_ai_task(
    task_type: str,
    title: str,
    description: str,
    parameters: dict = {},
    priority: str = "medium"
):
    """Create a new AI task"""
    try:
        if not enhanced_ai_agent:
            raise HTTPException(status_code=503, detail="Enhanced AI agent not available")
        
        from app.services.enhanced_ai_agent import TaskType, TaskPriority
        
        if not enhanced_ai_agent.is_ready():
            raise HTTPException(status_code=503, detail="Enhanced AI agent not ready")
        
        # Convert string to enums
        task_type_enum = TaskType(task_type.lower().replace(' ', '_'))
        priority_enum = TaskPriority(priority.lower())
        
        task_id = await enhanced_ai_agent.create_task(
            task_type=task_type_enum,
            title=title,
            description=description,
            parameters=parameters,
            priority=priority_enum
        )
        
        return {
            "task_id": task_id,
            "status": "created",
            "message": f"Task '{title}' created successfully"
        }
        
    except Exception as e:
        logger.error(f"Task creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ai/tasks")
async def list_ai_tasks(status: str = None):
    """List AI tasks with optional status filter"""
    try:
        if not enhanced_ai_agent:
            raise HTTPException(status_code=503, detail="Enhanced AI agent not available")
        
        from app.services.enhanced_ai_agent import TaskStatus
        
        if not enhanced_ai_agent.is_ready():
            raise HTTPException(status_code=503, detail="Enhanced AI agent not ready")
        
        status_filter = TaskStatus(status) if status else None
        tasks = await enhanced_ai_agent.list_tasks(status_filter)
        
        return {
            "tasks": tasks,
            "total": len(tasks),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Task listing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ai/tasks/{task_id}")
async def get_ai_task_status(task_id: str):
    """Get status of a specific AI task"""
    try:
        if not enhanced_ai_agent:
            raise HTTPException(status_code=503, detail="Enhanced AI agent not available")
        
        if not enhanced_ai_agent.is_ready():
            raise HTTPException(status_code=503, detail="Enhanced AI agent not ready")
        
        task_status = await enhanced_ai_agent.get_task_status(task_id)
        
        if not task_status:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return task_status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Task status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/tasks/{task_id}/start")
async def start_ai_task(task_id: str):
    """Start a pending AI task"""
    try:
        if not enhanced_ai_agent:
            raise HTTPException(status_code=503, detail="Enhanced AI agent not available")
        
        if not enhanced_ai_agent.is_ready():
            raise HTTPException(status_code=503, detail="Enhanced AI agent not ready")
        
        success = await enhanced_ai_agent.start_task(task_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to start task")
        
        return {
            "task_id": task_id,
            "status": "started",
            "message": "Task started successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Task start error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/ai/tasks/{task_id}")
async def cancel_ai_task(task_id: str):
    """Cancel a pending or in-progress AI task"""
    try:
        if not enhanced_ai_agent:
            raise HTTPException(status_code=503, detail="Enhanced AI agent not available")
        
        if not enhanced_ai_agent.is_ready():
            raise HTTPException(status_code=503, detail="Enhanced AI agent not ready")
        
        success = await enhanced_ai_agent.cancel_task(task_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to cancel task")
        
        return {
            "task_id": task_id,
            "status": "cancelled",
            "message": "Task cancelled successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Task cancellation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Dataset Management Endpoints

@app.get("/datasets/available")
async def list_available_datasets():
    """List all available datasets for download"""
    try:
        # Return a simple list of common cybersecurity datasets
        return {
            "datasets": [
                {"name": "cybersecurity-threats", "description": "Common cybersecurity threats dataset"},
                {"name": "phishing-emails", "description": "Phishing email detection dataset"},
                {"name": "malware-samples", "description": "Malware analysis samples"}
            ],
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Dataset listing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/datasets/downloaded")
async def list_downloaded_datasets():
    """List all downloaded datasets"""
    try:
        # Return empty list for now - could be enhanced to track actual downloads
        return {
            "datasets": [],
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Downloaded datasets listing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/datasets/{dataset_name}/download")
async def download_dataset(dataset_name: str, force_refresh: bool = False):
    """Download a dataset (placeholder)"""
    try:
        # Placeholder - in a real implementation this would download from Kaggle or other sources
        return {
            "dataset_name": dataset_name,
            "status": "downloaded",
            "details": {"message": "Dataset download simulation"},
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Dataset download error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/datasets/{dataset_name}/summary")
async def get_dataset_summary(dataset_name: str):
    """Get summary statistics for a dataset"""
    try:
        # Placeholder summary
        return {
            "name": dataset_name,
            "rows": 1000,
            "columns": 10,
            "size": "1.2MB",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Dataset summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Enhanced Analysis Endpoint
@app.post("/analyze-enhanced")
async def analyze_data_enhanced(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """Enhanced analysis using the AI agent with ML models"""
    try:
        if not ai_agent or not ai_agent.is_ready():
            raise HTTPException(status_code=503, detail="AI agent not ready")
        
        # Use standard AI agent for analysis (enhanced features integrated)
        result = await ai_agent.analyze(
            query=request.query,
            context=request.context,
            conversation_history=request.conversation_history
        )
        
        # Store analysis result in background
        if memory_store:
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
        logger.error(f"Enhanced analysis error: {e}")
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