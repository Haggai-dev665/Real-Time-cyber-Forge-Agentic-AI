"""
Agent Control Center API
REST API for the real-time agentic AI system.
Provides endpoints for agent control, observation, and intelligence.
"""

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from datetime import datetime
import asyncio
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/control", tags=["Agent Control Center"])

# Component references (set during initialization)
_components = {
    'state': None,
    'observation': None,
    'action': None,
    'feed': None,
    'scan_mode': None,
    'assistant': None,
}


def init_control_center(
    state_manager=None,
    observation_loop=None,
    action_executor=None,
    intelligence_feed=None,
    scan_mode_manager=None,
    assistant=None,
):
    """Initialize control center with component references"""
    _components['state'] = state_manager
    _components['observation'] = observation_loop
    _components['action'] = action_executor
    _components['feed'] = intelligence_feed
    _components['scan_mode'] = scan_mode_manager
    _components['assistant'] = assistant
    
    # Wire up assistant with components
    if assistant:
        assistant.set_components(
            state_manager=state_manager,
            observation_loop=observation_loop,
            intelligence_feed=intelligence_feed,
            scan_mode_manager=scan_mode_manager,
            action_executor=action_executor,
        )
    
    logger.info("✅ Control Center API initialized")


# ============================================================================
# Request/Response Models
# ============================================================================

class ControlCenterState(BaseModel):
    """Complete control center state"""
    status: str
    scan_mode: str
    current_goal: Optional[Dict[str, Any]]
    active_tasks: List[Dict[str, Any]]
    scheduled_tasks: List[Dict[str, Any]]
    recent_actions: List[Dict[str, Any]]
    alerts: List[Dict[str, Any]]
    stats: Dict[str, Any]
    timestamp: str


class ObservationRequest(BaseModel):
    """Request to record an observation"""
    type: str = Field(..., description="Observation type: page_visit, http_request, download, etc.")
    source: str = Field(default="desktop-app", description="Source of observation")
    data: Dict[str, Any] = Field(..., description="Observation data")


class ActionConfirmRequest(BaseModel):
    """Request to confirm an action"""
    action_id: str


class ScanModeRequest(BaseModel):
    """Request to change scan mode"""
    mode: str = Field(..., description="Scan mode: quick, deep, stealth, forensic")
    reason: Optional[str] = None


class AssistantRequest(BaseModel):
    """Request to the assistant"""
    message: str
    auto_execute: bool = Field(default=False, description="Auto-execute suggested actions")


class ExecuteActionRequest(BaseModel):
    """Request to execute an action"""
    intent: str
    parameters: Dict[str, Any] = Field(default_factory=dict)


# ============================================================================
# Control Center State Endpoints
# ============================================================================

@router.get("/state", response_model=ControlCenterState)
async def get_control_center_state():
    """
    Get complete Agent Control Center state.
    This is the main endpoint for the Control Center UI.
    """
    state = _components['state']
    if not state:
        raise HTTPException(status_code=503, detail="Agent state not initialized")
    
    return ControlCenterState(**state.get_control_center_state())


@router.get("/explain")
async def explain_current_state():
    """Get human-readable explanation of what the agent is doing"""
    state = _components['state']
    if not state:
        raise HTTPException(status_code=503, detail="Agent state not initialized")
    
    return {
        "explanation": state.explain_current_state(),
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/decisions")
async def get_decision_history(limit: int = Query(default=50, ge=1, le=200)):
    """Get agent decision history for transparency"""
    state = _components['state']
    if not state:
        raise HTTPException(status_code=503, detail="Agent state not initialized")
    
    return {
        "decisions": state.get_decision_history(limit=limit),
        "total": len(state.decision_log),
    }


# ============================================================================
# Observation Endpoints
# ============================================================================

@router.post("/observe")
async def record_observation(request: ObservationRequest):
    """
    Record a browser observation.
    Called by browser monitor, extensions, etc.
    """
    observation = _components['observation']
    if not observation:
        raise HTTPException(status_code=503, detail="Observation loop not initialized")
    
    from ..agent.observation_loop import ObservationType
    
    try:
        obs_type = ObservationType(request.type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid observation type: {request.type}")
    
    obs_id = await observation.observe(obs_type, request.source, request.data)
    
    return {
        "observation_id": obs_id,
        "message": "Observation recorded",
    }


@router.get("/observations/stats")
async def get_observation_stats():
    """Get observation loop statistics"""
    observation = _components['observation']
    if not observation:
        raise HTTPException(status_code=503, detail="Observation loop not initialized")
    
    return observation.get_stats()


# ============================================================================
# Intelligence Feed Endpoints
# ============================================================================

@router.get("/feed")
async def get_intelligence_feed(
    limit: int = Query(default=50, ge=1, le=200),
    severity: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
):
    """Get intelligence feed events"""
    feed = _components['feed']
    if not feed:
        raise HTTPException(status_code=503, detail="Intelligence feed not initialized")
    
    from ..agent.intelligence_feed import EventSeverity
    
    severity_enum = None
    if severity:
        try:
            severity_enum = EventSeverity(severity)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid severity: {severity}")
    
    events = feed.get_events(
        limit=limit,
        severity=severity_enum,
        category=category,
    )
    
    return {
        "events": events,
        "summary": feed.get_summary(),
    }


@router.post("/feed/{event_id}/dismiss")
async def dismiss_feed_event(event_id: str):
    """Dismiss a feed event"""
    feed = _components['feed']
    if not feed:
        raise HTTPException(status_code=503, detail="Intelligence feed not initialized")
    
    feed.dismiss(event_id)
    return {"message": "Event dismissed", "event_id": event_id}


@router.get("/feed/stream")
async def stream_intelligence_feed():
    """Stream intelligence feed events via Server-Sent Events"""
    feed = _components['feed']
    if not feed:
        raise HTTPException(status_code=503, detail="Intelligence feed not initialized")
    
    async def event_generator():
        async for event in feed.stream():
            yield f"data: {json.dumps(event)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


# ============================================================================
# Scan Mode Endpoints
# ============================================================================

@router.get("/scan-mode")
async def get_scan_mode():
    """Get current scan mode and available modes"""
    scan_mode = _components['scan_mode']
    if not scan_mode:
        raise HTTPException(status_code=503, detail="Scan mode manager not initialized")
    
    return {
        "status": scan_mode.get_status(),
        "available_modes": scan_mode.get_all_modes(),
    }


@router.post("/scan-mode")
async def set_scan_mode(request: ScanModeRequest):
    """Set scan mode"""
    scan_mode = _components['scan_mode']
    if not scan_mode:
        raise HTTPException(status_code=503, detail="Scan mode manager not initialized")
    
    from ..agent.scan_modes import ScanMode
    
    try:
        mode = ScanMode(request.mode)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid scan mode: {request.mode}")
    
    await scan_mode.set_mode(mode, request.reason or "Manual selection via API")
    
    return {
        "message": f"Scan mode set to {mode.value}",
        "mode": mode.value,
    }


@router.post("/scan-mode/auto")
async def toggle_auto_mode(enabled: bool = Query(default=True)):
    """Enable or disable automatic scan mode selection"""
    scan_mode = _components['scan_mode']
    if not scan_mode:
        raise HTTPException(status_code=503, detail="Scan mode manager not initialized")
    
    if enabled:
        scan_mode.enable_auto_mode()
    else:
        scan_mode.disable_auto_mode()
    
    return {
        "auto_mode_enabled": scan_mode.auto_mode_enabled,
    }


# ============================================================================
# Action Endpoints
# ============================================================================

@router.get("/actions/pending")
async def get_pending_actions():
    """Get actions awaiting confirmation"""
    action = _components['action']
    if not action:
        raise HTTPException(status_code=503, detail="Action executor not initialized")
    
    return {
        "pending": action.get_pending_confirmations(),
    }


@router.post("/actions/confirm")
async def confirm_action(request: ActionConfirmRequest):
    """Confirm a pending action"""
    action = _components['action']
    if not action:
        raise HTTPException(status_code=503, detail="Action executor not initialized")
    
    result = await action.confirm_action(request.action_id)
    
    return result.to_dict()


@router.post("/actions/reject")
async def reject_action(request: ActionConfirmRequest, reason: str = Query(default="")):
    """Reject a pending action"""
    action = _components['action']
    if not action:
        raise HTTPException(status_code=503, detail="Action executor not initialized")
    
    result = await action.reject_action(request.action_id, reason)
    
    return result.to_dict()


@router.get("/actions/blocked")
async def get_blocked_items():
    """Get blocked URLs and domains"""
    action = _components['action']
    if not action:
        raise HTTPException(status_code=503, detail="Action executor not initialized")
    
    return action.get_blocked_items()


@router.get("/actions/history")
async def get_action_history(limit: int = Query(default=50, ge=1, le=200)):
    """Get action execution history"""
    action = _components['action']
    if not action:
        raise HTTPException(status_code=503, detail="Action executor not initialized")
    
    return {
        "history": action.get_execution_history(limit=limit),
    }


@router.post("/actions/block-settings")
async def update_block_settings(
    auto_block_urls: Optional[bool] = None,
    auto_block_domains: Optional[bool] = None,
):
    """Update auto-block settings"""
    action = _components['action']
    if not action:
        raise HTTPException(status_code=503, detail="Action executor not initialized")
    
    from ..agent.action_executor import ActionType
    
    if auto_block_urls is not None:
        if auto_block_urls:
            action.enable_auto_execute(ActionType.BLOCK_URL)
        else:
            action.disable_auto_execute(ActionType.BLOCK_URL)
    
    if auto_block_domains is not None:
        if auto_block_domains:
            action.enable_auto_execute(ActionType.BLOCK_DOMAIN)
        else:
            action.disable_auto_execute(ActionType.BLOCK_DOMAIN)
    
    return {
        "auto_block_urls": action.auto_execute_allowed.get(ActionType.BLOCK_URL, False),
        "auto_block_domains": action.auto_execute_allowed.get(ActionType.BLOCK_DOMAIN, False),
    }


# ============================================================================
# Assistant Endpoints
# ============================================================================

@router.post("/assistant")
async def assistant_process(request: AssistantRequest):
    """
    Process a message through the operational assistant.
    Can suggest AND execute actions.
    """
    assistant = _components['assistant']
    if not assistant:
        raise HTTPException(status_code=503, detail="Assistant not initialized")
    
    response = await assistant.process(
        user_input=request.message,
        auto_execute=request.auto_execute,
    )
    
    return response.to_dict()


@router.post("/assistant/execute")
async def assistant_execute_action(request: ExecuteActionRequest):
    """Execute an action suggested by the assistant"""
    assistant = _components['assistant']
    if not assistant:
        raise HTTPException(status_code=503, detail="Assistant not initialized")
    
    from ..agent.operational_assistant import AssistantAction, ActionIntent
    
    try:
        intent = ActionIntent(request.intent)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid intent: {request.intent}")
    
    action = AssistantAction(
        intent=intent,
        parameters=request.parameters,
        description=f"Execute {intent.value}",
    )
    
    result = await assistant.execute_action(action)
    
    return result


@router.get("/assistant/suggestions")
async def get_proactive_suggestions():
    """Get proactive suggestions from the assistant"""
    assistant = _components['assistant']
    if not assistant:
        raise HTTPException(status_code=503, detail="Assistant not initialized")
    
    suggestions = await assistant.get_proactive_suggestions()
    
    return {
        "suggestions": [s.to_dict() for s in suggestions],
    }


@router.get("/assistant/history")
async def get_assistant_history(limit: int = Query(default=10, ge=1, le=50)):
    """Get assistant conversation history"""
    assistant = _components['assistant']
    if not assistant:
        raise HTTPException(status_code=503, detail="Assistant not initialized")
    
    return {
        "history": assistant.get_conversation_history(limit=limit),
    }


# ============================================================================
# WebSocket for Real-Time Updates
# ============================================================================

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket for real-time Control Center updates.
    Streams state changes, observations, alerts, and feed events.
    """
    await websocket.accept()
    
    state = _components['state']
    feed = _components['feed']
    
    if not state or not feed:
        await websocket.close(code=1011, reason="Components not initialized")
        return
    
    # Event queue for this connection
    queue = asyncio.Queue()
    
    # Subscribe to events
    async def on_state_event(data):
        await queue.put({'type': 'state', 'data': data})
    
    def on_feed_event(data):
        try:
            asyncio.get_event_loop().call_soon_threadsafe(
                queue.put_nowait,
                {'type': 'feed', 'data': data}
            )
        except:
            pass
    
    state.on('status_changed', on_state_event)
    state.on('alert_raised', on_state_event)
    state.on('task_started', on_state_event)
    state.on('task_completed', on_state_event)
    feed.subscribe(on_feed_event)
    
    try:
        # Send initial state
        initial_state = state.get_control_center_state()
        await websocket.send_json({
            'type': 'initial_state',
            'data': initial_state,
        })
        
        while True:
            try:
                # Wait for event with timeout (for keepalive)
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_json(event)
            except asyncio.TimeoutError:
                # Send keepalive
                await websocket.send_json({'type': 'keepalive'})
    
    except WebSocketDisconnect:
        pass
    finally:
        # Unsubscribe
        state.off('status_changed', on_state_event)
        state.off('alert_raised', on_state_event)
        state.off('task_started', on_state_event)
        state.off('task_completed', on_state_event)
        feed.unsubscribe(on_feed_event)
