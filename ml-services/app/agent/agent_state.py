"""
Agent State Machine
Manages agent operational states with clear visibility into what the agent is doing.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from collections import deque
import json

logger = logging.getLogger(__name__)


class AgentStatus(Enum):
    """Agent operational status - always visible to user"""
    IDLE = "idle"                     # No active tasks, waiting for input
    MONITORING = "monitoring"          # Actively observing browser/system
    ANALYZING = "analyzing"            # Processing data, running analysis
    INVESTIGATING = "investigating"    # Deep diving into a specific threat
    WAITING = "waiting"                # Waiting for external resource/response
    BLOCKED = "blocked"                # Cannot proceed, needs user input
    STARTING = "starting"              # Initializing
    STOPPING = "stopping"              # Graceful shutdown in progress


class ScanMode(Enum):
    """Adaptive scan modes"""
    QUICK = "quick"           # Low overhead, continuous background
    DEEP = "deep"             # Full AI behavior + pattern analysis
    STEALTH = "stealth"       # Low footprint, slow probing
    FORENSIC = "forensic"     # Maximum logging & traceability


@dataclass
class CurrentGoal:
    """Human-readable representation of what the agent is doing"""
    id: str
    description: str
    started_at: datetime
    progress: float = 0.0  # 0.0 to 1.0
    sub_goals: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'description': self.description,
            'started_at': self.started_at.isoformat(),
            'progress': self.progress,
            'sub_goals': self.sub_goals,
        }


@dataclass
class CompletedAction:
    """Record of a completed agent action"""
    id: str
    action_type: str
    description: str
    result: str
    timestamp: datetime
    duration_ms: int
    success: bool
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'action_type': self.action_type,
            'description': self.description,
            'result': self.result,
            'timestamp': self.timestamp.isoformat(),
            'duration_ms': self.duration_ms,
            'success': self.success,
        }


@dataclass
class RaisedAlert:
    """Alert raised by the agent requiring attention"""
    id: str
    severity: str  # info, warning, critical
    title: str
    description: str
    timestamp: datetime
    source: str
    data: Dict[str, Any] = field(default_factory=dict)
    acknowledged: bool = False
    action_taken: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'severity': self.severity,
            'title': self.title,
            'description': self.description,
            'timestamp': self.timestamp.isoformat(),
            'source': self.source,
            'data': self.data,
            'acknowledged': self.acknowledged,
            'action_taken': self.action_taken,
        }


@dataclass
class ScheduledTask:
    """Upcoming scheduled task"""
    id: str
    task_type: str
    description: str
    next_run: datetime
    recurrence: Optional[str] = None
    enabled: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'task_type': self.task_type,
            'description': self.description,
            'next_run': self.next_run.isoformat(),
            'recurrence': self.recurrence,
            'enabled': self.enabled,
        }


class AgentStateManager:
    """
    Central state manager for the autonomous agent.
    Provides visibility into agent status, goals, tasks, and decisions.
    
    This is what powers the Agent Control Center UI.
    """
    
    def __init__(self):
        # Current state
        self.status = AgentStatus.IDLE
        self.scan_mode = ScanMode.QUICK
        self.current_goal: Optional[CurrentGoal] = None
        
        # Active work
        self.active_tasks: Dict[str, Dict[str, Any]] = {}
        self.scheduled_tasks: Dict[str, ScheduledTask] = {}
        
        # History (bounded queues)
        self.completed_actions: deque = deque(maxlen=100)
        self.raised_alerts: deque = deque(maxlen=50)
        self.decision_log: deque = deque(maxlen=200)
        
        # Statistics
        self.stats = {
            'total_observations': 0,
            'total_analyses': 0,
            'total_decisions': 0,
            'total_actions': 0,
            'threats_detected': 0,
            'threats_blocked': 0,
            'session_start': datetime.utcnow().isoformat(),
        }
        
        # Event listeners
        self._listeners: Dict[str, List[Callable]] = {}
        
        # State lock
        self._lock = asyncio.Lock()
        
        logger.info("🎛️ Agent State Manager initialized")
    
    # ==================== Status Management ====================
    
    async def set_status(self, status: AgentStatus, reason: Optional[str] = None):
        """Update agent status with reason"""
        async with self._lock:
            old_status = self.status
            self.status = status
            
            self._log_decision(
                decision_type='status_change',
                description=f"Status changed: {old_status.value} → {status.value}",
                reason=reason or "System state change",
            )
            
            await self._emit('status_changed', {
                'old': old_status.value,
                'new': status.value,
                'reason': reason,
            })
            
            logger.info(f"📊 Agent status: {status.value}" + (f" ({reason})" if reason else ""))
    
    async def set_scan_mode(self, mode: ScanMode, reason: Optional[str] = None):
        """Update scan mode"""
        async with self._lock:
            old_mode = self.scan_mode
            self.scan_mode = mode
            
            self._log_decision(
                decision_type='mode_change',
                description=f"Scan mode changed: {old_mode.value} → {mode.value}",
                reason=reason or "Mode adjustment",
            )
            
            await self._emit('mode_changed', {'old': old_mode.value, 'new': mode.value})
            logger.info(f"🔍 Scan mode: {mode.value}")
    
    # ==================== Goal Management ====================
    
    async def set_current_goal(self, goal_id: str, description: str, sub_goals: List[str] = None):
        """Set current high-level goal"""
        async with self._lock:
            self.current_goal = CurrentGoal(
                id=goal_id,
                description=description,
                started_at=datetime.utcnow(),
                sub_goals=sub_goals or [],
            )
            
            await self.set_status(AgentStatus.MONITORING, f"Working on: {description}")
            await self._emit('goal_started', self.current_goal.to_dict())
            logger.info(f"🎯 Goal set: {description}")
    
    async def update_goal_progress(self, progress: float, completed_sub_goal: Optional[str] = None):
        """Update goal progress"""
        async with self._lock:
            if self.current_goal:
                self.current_goal.progress = min(1.0, max(0.0, progress))
                
                if completed_sub_goal:
                    self.current_goal.sub_goals = [
                        sg for sg in self.current_goal.sub_goals 
                        if sg != completed_sub_goal
                    ]
                
                await self._emit('goal_progress', {
                    'goal_id': self.current_goal.id,
                    'progress': self.current_goal.progress,
                })
    
    async def complete_goal(self, result: str):
        """Mark current goal as complete"""
        async with self._lock:
            if self.current_goal:
                goal = self.current_goal
                self.current_goal = None
                
                self._log_decision(
                    decision_type='goal_completed',
                    description=f"Goal completed: {goal.description}",
                    reason=result,
                )
                
                await self.set_status(AgentStatus.IDLE, "Goal completed")
                await self._emit('goal_completed', {'goal_id': goal.id, 'result': result})
    
    # ==================== Task Management ====================
    
    async def add_active_task(self, task_id: str, task_type: str, description: str):
        """Register an active task"""
        async with self._lock:
            self.active_tasks[task_id] = {
                'id': task_id,
                'type': task_type,
                'description': description,
                'started_at': datetime.utcnow().isoformat(),
                'status': 'running',
            }
            
            await self._emit('task_started', self.active_tasks[task_id])
    
    async def update_task_status(self, task_id: str, status: str, progress: float = None):
        """Update task status"""
        async with self._lock:
            if task_id in self.active_tasks:
                self.active_tasks[task_id]['status'] = status
                if progress is not None:
                    self.active_tasks[task_id]['progress'] = progress
    
    async def complete_task(self, task_id: str, result: Any, success: bool = True):
        """Complete an active task"""
        async with self._lock:
            if task_id in self.active_tasks:
                task = self.active_tasks.pop(task_id)
                
                started = datetime.fromisoformat(task['started_at'])
                duration_ms = int((datetime.utcnow() - started).total_seconds() * 1000)
                
                action = CompletedAction(
                    id=task_id,
                    action_type=task['type'],
                    description=task['description'],
                    result=str(result)[:500],  # Truncate long results
                    timestamp=datetime.utcnow(),
                    duration_ms=duration_ms,
                    success=success,
                )
                
                self.completed_actions.append(action)
                self.stats['total_actions'] += 1
                
                await self._emit('task_completed', action.to_dict())
    
    async def add_scheduled_task(self, task: ScheduledTask):
        """Add a scheduled task"""
        async with self._lock:
            self.scheduled_tasks[task.id] = task
            await self._emit('schedule_added', task.to_dict())
    
    # ==================== Alert Management ====================
    
    async def raise_alert(
        self,
        severity: str,
        title: str,
        description: str,
        source: str,
        data: Dict[str, Any] = None,
    ) -> str:
        """Raise an alert for user attention"""
        import uuid
        
        async with self._lock:
            alert = RaisedAlert(
                id=str(uuid.uuid4())[:8],
                severity=severity,
                title=title,
                description=description,
                timestamp=datetime.utcnow(),
                source=source,
                data=data or {},
            )
            
            self.raised_alerts.append(alert)
            
            if severity == 'critical':
                self.stats['threats_detected'] += 1
            
            await self._emit('alert_raised', alert.to_dict())
            logger.warning(f"🚨 Alert [{severity}]: {title}")
            
            return alert.id
    
    async def acknowledge_alert(self, alert_id: str, action_taken: Optional[str] = None):
        """Acknowledge an alert"""
        async with self._lock:
            for alert in self.raised_alerts:
                if alert.id == alert_id:
                    alert.acknowledged = True
                    alert.action_taken = action_taken
                    await self._emit('alert_acknowledged', {'id': alert_id, 'action': action_taken})
                    break
    
    # ==================== Decision Logging ====================
    
    def _log_decision(self, decision_type: str, description: str, reason: str):
        """Log an agent decision for transparency"""
        self.decision_log.append({
            'type': decision_type,
            'description': description,
            'reason': reason,
            'timestamp': datetime.utcnow().isoformat(),
        })
        self.stats['total_decisions'] += 1
    
    async def log_observation(self, observation_type: str, data: Dict[str, Any]):
        """Log an observation"""
        async with self._lock:
            self.stats['total_observations'] += 1
            await self._emit('observation', {
                'type': observation_type,
                'data': data,
                'timestamp': datetime.utcnow().isoformat(),
            })
    
    async def log_analysis(self, analysis_type: str, result: Dict[str, Any]):
        """Log an analysis result"""
        async with self._lock:
            self.stats['total_analyses'] += 1
            await self._emit('analysis', {
                'type': analysis_type,
                'result': result,
                'timestamp': datetime.utcnow().isoformat(),
            })
    
    # ==================== Event System ====================
    
    def on(self, event: str, callback: Callable):
        """Register event listener"""
        if event not in self._listeners:
            self._listeners[event] = []
        self._listeners[event].append(callback)
    
    def off(self, event: str, callback: Callable):
        """Remove event listener"""
        if event in self._listeners:
            self._listeners[event] = [cb for cb in self._listeners[event] if cb != callback]
    
    async def _emit(self, event: str, data: Any):
        """Emit event to listeners"""
        if event in self._listeners:
            for callback in self._listeners[event]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(data)
                    else:
                        callback(data)
                except Exception as e:
                    logger.error(f"Event handler error for {event}: {e}")
    
    # ==================== State Snapshot ====================
    
    def get_control_center_state(self) -> Dict[str, Any]:
        """
        Get complete state for the Agent Control Center UI.
        This is the main method called by the frontend.
        """
        return {
            'status': self.status.value,
            'scan_mode': self.scan_mode.value,
            'current_goal': self.current_goal.to_dict() if self.current_goal else None,
            'active_tasks': list(self.active_tasks.values()),
            'scheduled_tasks': [t.to_dict() for t in self.scheduled_tasks.values()],
            'recent_actions': [a.to_dict() for a in list(self.completed_actions)[-10:]],
            'alerts': [a.to_dict() for a in self.raised_alerts if not a.acknowledged],
            'stats': self.stats,
            'timestamp': datetime.utcnow().isoformat(),
        }
    
    def get_decision_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent decision history for transparency"""
        return list(self.decision_log)[-limit:]
    
    def explain_current_state(self) -> str:
        """
        Generate human-readable explanation of current state.
        Answers: What is the agent doing? Why? What's next?
        """
        lines = []
        
        # Current status
        status_explanations = {
            AgentStatus.IDLE: "I'm currently idle, waiting for tasks or observations.",
            AgentStatus.MONITORING: "I'm actively monitoring browser activity for security threats.",
            AgentStatus.ANALYZING: "I'm analyzing data I've collected to identify potential risks.",
            AgentStatus.INVESTIGATING: "I'm investigating a specific threat or anomaly in detail.",
            AgentStatus.WAITING: "I'm waiting for an external resource or service to respond.",
            AgentStatus.BLOCKED: "I need your input to proceed with my current task.",
            AgentStatus.STARTING: "I'm initializing my systems.",
            AgentStatus.STOPPING: "I'm gracefully shutting down.",
        }
        lines.append(f"**Current Status**: {status_explanations.get(self.status, self.status.value)}")
        
        # Current goal
        if self.current_goal:
            lines.append(f"\n**Current Goal**: {self.current_goal.description}")
            lines.append(f"**Progress**: {int(self.current_goal.progress * 100)}%")
            if self.current_goal.sub_goals:
                lines.append(f"**Remaining sub-tasks**: {len(self.current_goal.sub_goals)}")
        
        # Active tasks
        if self.active_tasks:
            lines.append(f"\n**Active Tasks** ({len(self.active_tasks)}):")
            for task in list(self.active_tasks.values())[:5]:
                lines.append(f"  • {task['description']}")
        
        # Pending alerts
        unacked_alerts = [a for a in self.raised_alerts if not a.acknowledged]
        if unacked_alerts:
            lines.append(f"\n**⚠️ Pending Alerts** ({len(unacked_alerts)}):")
            for alert in unacked_alerts[:3]:
                lines.append(f"  • [{alert.severity}] {alert.title}")
        
        # Stats summary
        lines.append(f"\n**Session Stats**: {self.stats['total_observations']} observations, "
                    f"{self.stats['total_analyses']} analyses, "
                    f"{self.stats['threats_detected']} threats detected")
        
        return "\n".join(lines)


# Global state instance
agent_state = AgentStateManager()
