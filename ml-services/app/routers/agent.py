"""
Agent API Router - REST API Endpoints for Autonomous Agent
Provides secure, scalable API for agent task management and control.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from datetime import datetime
from enum import Enum
import asyncio
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["Agent"])

# Global agent instance (initialized in main.py)
_agent_instance = None
_scheduler_instance = None
_planner_instance = None
_memory_instance = None
_observer_instance = None
_executor_instance = None


def get_agent():
    """Get the agent instance"""
    if _agent_instance is None:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    return _agent_instance


def get_scheduler():
    """Get the scheduler instance"""
    if _scheduler_instance is None:
        raise HTTPException(status_code=503, detail="Scheduler not initialized")
    return _scheduler_instance


def get_planner():
    """Get the planner instance"""
    if _planner_instance is None:
        raise HTTPException(status_code=503, detail="Planner not initialized")
    return _planner_instance


def get_memory():
    """Get the memory instance"""
    if _memory_instance is None:
        raise HTTPException(status_code=503, detail="Memory not initialized")
    return _memory_instance


def get_observer():
    """Get the observer instance"""
    if _observer_instance is None:
        raise HTTPException(status_code=503, detail="Observer not initialized")
    return _observer_instance


def init_agent_components(agent, scheduler, planner, memory, observer, executor):
    """Initialize agent components (called from main.py)"""
    global _agent_instance, _scheduler_instance, _planner_instance
    global _memory_instance, _observer_instance, _executor_instance
    
    _agent_instance = agent
    _scheduler_instance = scheduler
    _planner_instance = planner
    _memory_instance = memory
    _observer_instance = observer
    _executor_instance = executor
    
    logger.info("✅ Agent API components initialized")


# ============================================================================
# Request/Response Models
# ============================================================================

class TaskPriorityEnum(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class TaskCreateRequest(BaseModel):
    """Request to create a new task"""
    type: str = Field(..., description="Task type (e.g., 'network_scan', 'analysis')")
    description: str = Field(..., description="Human-readable task description")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Task parameters")
    priority: TaskPriorityEnum = Field(default=TaskPriorityEnum.NORMAL, description="Task priority")
    metadata: Optional[Dict[str, Any]] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "network_scan",
                "description": "Scan target network for vulnerabilities",
                "parameters": {"target": "192.168.1.0/24", "ports": "1-1000"},
                "priority": "high"
            }
        }


class TaskResponse(BaseModel):
    """Task response"""
    id: str
    type: str
    description: str
    status: str
    priority: str
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    result: Optional[Any] = None
    error: Optional[str] = None


class ScheduleCreateRequest(BaseModel):
    """Request to create a scheduled task"""
    task_type: str = Field(..., description="Task type to schedule")
    description: str = Field(..., description="Schedule description")
    trigger_type: str = Field(..., description="Trigger type: cron, interval, event, once, continuous")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Task parameters")
    
    # Trigger-specific config
    cron_expression: Optional[str] = Field(None, description="Cron expression (for cron triggers)")
    interval_seconds: Optional[int] = Field(None, description="Interval in seconds (for interval triggers)")
    event_type: Optional[str] = Field(None, description="Event type to listen for (for event triggers)")
    run_at: Optional[str] = Field(None, description="ISO datetime to run (for once triggers)")
    max_runs: Optional[int] = Field(None, description="Maximum number of runs")
    
    class Config:
        json_schema_extra = {
            "example": {
                "task_type": "network_scan",
                "description": "Daily network scan",
                "trigger_type": "cron",
                "cron_expression": "0 0 * * *",
                "parameters": {"target": "192.168.1.0/24"}
            }
        }


class GoalCreateRequest(BaseModel):
    """Request to create a goal for planning"""
    description: str = Field(..., description="Goal description in natural language")
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")
    priority: TaskPriorityEnum = Field(default=TaskPriorityEnum.NORMAL)
    
    class Config:
        json_schema_extra = {
            "example": {
                "description": "Perform a comprehensive security audit of the website example.com",
                "priority": "high"
            }
        }


class MemoryStoreRequest(BaseModel):
    """Request to store a memory"""
    content: str = Field(..., description="Memory content")
    memory_type: str = Field(default="semantic", description="Memory type: short_term, long_term, episodic, semantic, working")
    metadata: Optional[Dict[str, Any]] = None
    ttl_seconds: Optional[int] = Field(None, description="Time to live in seconds")


class MemorySearchRequest(BaseModel):
    """Request to search memory"""
    query: str = Field(..., description="Search query")
    memory_types: Optional[List[str]] = None
    limit: int = Field(default=10, ge=1, le=100)


class AlertRuleRequest(BaseModel):
    """Request to create an alert rule"""
    name: str
    metric_name: str
    condition: str = Field(..., description="Condition: gt, lt, eq, gte, lte")
    threshold: float
    severity: str = Field(default="warning", description="Severity: info, warning, error, critical")
    message_template: Optional[str] = None


# ============================================================================
# Task Endpoints
# ============================================================================

@router.post("/tasks", response_model=TaskResponse)
async def create_task(request: TaskCreateRequest):
    """Create a new task for the agent to execute"""
    agent = get_agent()
    
    try:
        # Map priority
        priority_map = {
            TaskPriorityEnum.LOW: 1,
            TaskPriorityEnum.NORMAL: 5,
            TaskPriorityEnum.HIGH: 8,
            TaskPriorityEnum.CRITICAL: 10,
        }
        
        task_id = await agent.add_task(
            task_type=request.type,
            description=request.description,
            parameters=request.parameters,
            priority=priority_map.get(request.priority, 5),
            metadata=request.metadata or {},
        )
        
        task = await agent.get_task(task_id)
        
        return TaskResponse(
            id=task.id,
            type=task.type,
            description=task.description,
            status=task.status.value,
            priority=request.priority.value,
            created_at=task.created_at.isoformat(),
            started_at=task.started_at.isoformat() if task.started_at else None,
            completed_at=task.completed_at.isoformat() if task.completed_at else None,
        )
        
    except Exception as e:
        logger.error(f"Failed to create task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks")
async def list_tasks(
    status: Optional[str] = Query(None, description="Filter by status"),
    task_type: Optional[str] = Query(None, description="Filter by task type"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List all tasks"""
    agent = get_agent()
    
    try:
        tasks = await agent.get_tasks(
            status=status,
            task_type=task_type,
            limit=limit,
            offset=offset,
        )
        
        return {
            "tasks": [
                {
                    "id": t.id,
                    "type": t.type,
                    "description": t.description,
                    "status": t.status.value,
                    "priority": t.priority,
                    "created_at": t.created_at.isoformat(),
                }
                for t in tasks
            ],
            "total": len(tasks),
            "limit": limit,
            "offset": offset,
        }
        
    except Exception as e:
        logger.error(f"Failed to list tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    """Get a specific task by ID"""
    agent = get_agent()
    
    try:
        task = await agent.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return {
            "id": task.id,
            "type": task.type,
            "description": task.description,
            "status": task.status.value,
            "priority": task.priority,
            "parameters": task.parameters,
            "result": task.result,
            "error": task.error,
            "created_at": task.created_at.isoformat(),
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "metadata": task.metadata,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    """Cancel a pending or running task"""
    agent = get_agent()
    
    try:
        success = await agent.cancel_task(task_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="Could not cancel task")
        
        return {"message": "Task cancelled", "task_id": task_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/{task_id}/retry")
async def retry_task(task_id: str):
    """Retry a failed task"""
    agent = get_agent()
    
    try:
        new_task_id = await agent.retry_task(task_id)
        
        return {"message": "Task queued for retry", "new_task_id": new_task_id}
        
    except Exception as e:
        logger.error(f"Failed to retry task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Schedule Endpoints
# ============================================================================

@router.post("/schedules")
async def create_schedule(request: ScheduleCreateRequest):
    """Create a scheduled task"""
    scheduler = get_scheduler()
    
    try:
        schedule_config = {
            "task_type": request.task_type,
            "description": request.description,
            "parameters": request.parameters,
        }
        
        if request.trigger_type == "cron":
            if not request.cron_expression:
                raise HTTPException(status_code=400, detail="Cron expression required for cron triggers")
            schedule_config["cron"] = request.cron_expression
            
        elif request.trigger_type == "interval":
            if not request.interval_seconds:
                raise HTTPException(status_code=400, detail="Interval seconds required for interval triggers")
            schedule_config["interval_seconds"] = request.interval_seconds
            
        elif request.trigger_type == "event":
            if not request.event_type:
                raise HTTPException(status_code=400, detail="Event type required for event triggers")
            schedule_config["event_type"] = request.event_type
            
        elif request.trigger_type == "once":
            if not request.run_at:
                raise HTTPException(status_code=400, detail="Run time required for once triggers")
            schedule_config["run_at"] = request.run_at
            
        elif request.trigger_type == "continuous":
            schedule_config["continuous"] = True
        
        if request.max_runs:
            schedule_config["max_runs"] = request.max_runs
        
        schedule_id = await scheduler.create_schedule(
            trigger_type=request.trigger_type,
            **schedule_config
        )
        
        return {"schedule_id": schedule_id, "message": "Schedule created"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schedules")
async def list_schedules():
    """List all schedules"""
    scheduler = get_scheduler()
    
    try:
        schedules = await scheduler.get_schedules()
        
        return {
            "schedules": [
                {
                    "id": s.id,
                    "task_type": s.task_type,
                    "trigger_type": s.trigger_type.value,
                    "status": s.status.value,
                    "run_count": s.run_count,
                    "next_run": s.next_run.isoformat() if s.next_run else None,
                    "last_run": s.last_run.isoformat() if s.last_run else None,
                }
                for s in schedules
            ]
        }
        
    except Exception as e:
        logger.error(f"Failed to list schedules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/schedules/{schedule_id}/pause")
async def pause_schedule(schedule_id: str):
    """Pause a schedule"""
    scheduler = get_scheduler()
    
    try:
        await scheduler.pause_schedule(schedule_id)
        return {"message": "Schedule paused", "schedule_id": schedule_id}
        
    except Exception as e:
        logger.error(f"Failed to pause schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/schedules/{schedule_id}/resume")
async def resume_schedule(schedule_id: str):
    """Resume a paused schedule"""
    scheduler = get_scheduler()
    
    try:
        await scheduler.resume_schedule(schedule_id)
        return {"message": "Schedule resumed", "schedule_id": schedule_id}
        
    except Exception as e:
        logger.error(f"Failed to resume schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str):
    """Delete a schedule"""
    scheduler = get_scheduler()
    
    try:
        await scheduler.delete_schedule(schedule_id)
        return {"message": "Schedule deleted", "schedule_id": schedule_id}
        
    except Exception as e:
        logger.error(f"Failed to delete schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Goal/Planning Endpoints
# ============================================================================

@router.post("/goals")
async def create_goal(request: GoalCreateRequest, background_tasks: BackgroundTasks):
    """Create a goal and generate execution plan"""
    planner = get_planner()
    agent = get_agent()
    
    try:
        # Create goal and plan
        goal_id = await planner.create_goal(
            description=request.description,
            context=request.context or {},
            priority=request.priority.value,
        )
        
        # Generate plan
        plan = await planner.generate_plan(goal_id)
        
        # Execute plan in background
        async def execute_plan_async():
            await planner.execute_plan(plan.id, agent)
        
        background_tasks.add_task(execute_plan_async)
        
        return {
            "goal_id": goal_id,
            "plan_id": plan.id,
            "steps": [
                {
                    "id": step.id,
                    "description": step.description,
                    "tool": step.tool_name,
                    "order": step.order,
                }
                for step in plan.steps
            ],
            "message": "Goal created and plan execution started",
        }
        
    except Exception as e:
        logger.error(f"Failed to create goal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/goals/{goal_id}")
async def get_goal(goal_id: str):
    """Get goal status and plan"""
    planner = get_planner()
    
    try:
        goal = await planner.get_goal(goal_id)
        
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")
        
        plan = await planner.get_plan_for_goal(goal_id)
        
        return {
            "goal": {
                "id": goal.id,
                "description": goal.description,
                "status": goal.status.value,
                "created_at": goal.created_at.isoformat(),
                "completed_at": goal.completed_at.isoformat() if goal.completed_at else None,
            },
            "plan": {
                "id": plan.id,
                "status": plan.status,
                "steps": [
                    {
                        "id": s.id,
                        "description": s.description,
                        "status": s.status,
                        "result": s.result,
                    }
                    for s in plan.steps
                ],
            } if plan else None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get goal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Memory Endpoints
# ============================================================================

@router.post("/memory")
async def store_memory(request: MemoryStoreRequest):
    """Store a memory"""
    memory = get_memory()
    
    try:
        memory_id = await memory.store(
            content=request.content,
            memory_type=request.memory_type,
            metadata=request.metadata or {},
            ttl_seconds=request.ttl_seconds,
        )
        
        return {"memory_id": memory_id, "message": "Memory stored"}
        
    except Exception as e:
        logger.error(f"Failed to store memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/memory/search")
async def search_memory(request: MemorySearchRequest):
    """Search memory semantically"""
    memory = get_memory()
    
    try:
        results = await memory.search(
            query=request.query,
            memory_types=request.memory_types,
            limit=request.limit,
        )
        
        return {
            "results": [
                {
                    "id": r.id,
                    "content": r.content,
                    "type": r.memory_type,
                    "relevance": r.relevance_score,
                    "created_at": r.created_at.isoformat(),
                }
                for r in results
            ],
            "query": request.query,
            "count": len(results),
        }
        
    except Exception as e:
        logger.error(f"Failed to search memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/memory/context")
async def get_context(query: str = Query(...), limit: int = Query(5)):
    """Get relevant context for a query"""
    memory = get_memory()
    
    try:
        context = await memory.get_context(query, limit=limit)
        return {"context": context, "query": query}
        
    except Exception as e:
        logger.error(f"Failed to get context: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Observability Endpoints
# ============================================================================

@router.get("/metrics")
async def get_metrics():
    """Get agent metrics"""
    observer = get_observer()
    
    try:
        metrics = await observer.get_all_metrics()
        return {"metrics": metrics}
        
    except Exception as e:
        logger.error(f"Failed to get metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/{metric_name}")
async def get_metric(metric_name: str):
    """Get a specific metric"""
    observer = get_observer()
    
    try:
        metric = await observer.get_metric(metric_name)
        
        if not metric:
            raise HTTPException(status_code=404, detail="Metric not found")
        
        return metric
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get metric: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts")
async def get_alerts(
    severity: Optional[str] = Query(None),
    acknowledged: Optional[bool] = Query(None),
):
    """Get active alerts"""
    observer = get_observer()
    
    try:
        alerts = await observer.get_alerts(
            severity=severity,
            acknowledged=acknowledged,
        )
        
        return {
            "alerts": [
                {
                    "id": a.id,
                    "name": a.name,
                    "message": a.message,
                    "severity": a.severity,
                    "triggered_at": a.triggered_at.isoformat(),
                    "acknowledged": a.acknowledged,
                }
                for a in alerts
            ]
        }
        
    except Exception as e:
        logger.error(f"Failed to get alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/rules")
async def create_alert_rule(request: AlertRuleRequest):
    """Create an alert rule"""
    observer = get_observer()
    
    try:
        rule_id = await observer.add_alert_rule(
            name=request.name,
            metric_name=request.metric_name,
            condition=request.condition,
            threshold=request.threshold,
            severity=request.severity,
            message_template=request.message_template,
        )
        
        return {"rule_id": rule_id, "message": "Alert rule created"}
        
    except Exception as e:
        logger.error(f"Failed to create alert rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    """Acknowledge an alert"""
    observer = get_observer()
    
    try:
        await observer.acknowledge_alert(alert_id)
        return {"message": "Alert acknowledged", "alert_id": alert_id}
        
    except Exception as e:
        logger.error(f"Failed to acknowledge alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def get_health():
    """Get agent health status"""
    observer = get_observer()
    
    try:
        health = await observer.run_health_checks()
        
        overall_status = "healthy"
        for check in health.values():
            if check.get("status") == "unhealthy":
                overall_status = "unhealthy"
                break
            elif check.get("status") == "degraded":
                overall_status = "degraded"
        
        return {
            "status": overall_status,
            "checks": health,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"Failed to get health: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Agent Control Endpoints
# ============================================================================

@router.get("/status")
async def get_agent_status():
    """Get overall agent status"""
    agent = get_agent()
    scheduler = get_scheduler()
    observer = get_observer()
    
    try:
        agent_status = await agent.get_status()
        scheduler_status = await scheduler.get_status()
        
        return {
            "agent": agent_status,
            "scheduler": scheduler_status,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"Failed to get status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/start")
async def start_agent(background_tasks: BackgroundTasks):
    """Start the agent"""
    agent = get_agent()
    
    try:
        background_tasks.add_task(agent.start)
        return {"message": "Agent starting", "status": "starting"}
        
    except Exception as e:
        logger.error(f"Failed to start agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
async def stop_agent():
    """Stop the agent gracefully"""
    agent = get_agent()
    
    try:
        await agent.stop()
        return {"message": "Agent stopped", "status": "stopped"}
        
    except Exception as e:
        logger.error(f"Failed to stop agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pause")
async def pause_agent():
    """Pause task processing"""
    agent = get_agent()
    
    try:
        await agent.pause()
        return {"message": "Agent paused", "status": "paused"}
        
    except Exception as e:
        logger.error(f"Failed to pause agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resume")
async def resume_agent():
    """Resume task processing"""
    agent = get_agent()
    
    try:
        await agent.resume()
        return {"message": "Agent resumed", "status": "running"}
        
    except Exception as e:
        logger.error(f"Failed to resume agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Streaming Endpoints
# ============================================================================

@router.get("/stream/tasks")
async def stream_task_updates():
    """Stream task status updates via Server-Sent Events"""
    agent = get_agent()
    
    async def event_generator():
        queue = asyncio.Queue()
        
        # Subscribe to task events
        def on_task_update(event_type, task):
            try:
                asyncio.get_event_loop().call_soon_threadsafe(
                    queue.put_nowait,
                    {"event": event_type, "task_id": task.id, "status": task.status.value}
                )
            except:
                pass
        
        agent.on_task_update(on_task_update)
        
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield f": keepalive\n\n"
        except asyncio.CancelledError:
            pass
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.get("/stream/logs")
async def stream_logs():
    """Stream agent logs via Server-Sent Events"""
    observer = get_observer()
    
    async def log_generator():
        last_index = 0
        
        while True:
            try:
                logs = await observer.get_recent_logs(since_index=last_index, limit=100)
                
                for log in logs:
                    last_index = max(last_index, log.get("index", 0) + 1)
                    yield f"data: {json.dumps(log)}\n\n"
                
                await asyncio.sleep(1.0)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                await asyncio.sleep(5.0)
    
    return StreamingResponse(
        log_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
