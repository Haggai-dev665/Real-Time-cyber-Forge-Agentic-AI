"""
Task Scheduler - Cron-based, Event-Driven, and Continuous Background Tasks
Production-ready scheduler for autonomous agent operations.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable, Union
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from croniter import croniter
import uuid

logger = logging.getLogger(__name__)


class TriggerType(Enum):
    """Types of task triggers"""
    CRON = "cron"           # Cron-based scheduling
    INTERVAL = "interval"   # Fixed interval
    EVENT = "event"         # Event-driven
    ONCE = "once"           # One-time scheduled
    CONTINUOUS = "continuous"  # Continuous loop


class ScheduleStatus(Enum):
    """Scheduled task status"""
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


@dataclass
class ScheduledTask:
    """Represents a scheduled task"""
    id: str
    name: str
    trigger_type: TriggerType
    task_type: str
    parameters: Dict[str, Any]
    status: ScheduleStatus = ScheduleStatus.ACTIVE
    
    # Cron-specific
    cron_expression: Optional[str] = None
    
    # Interval-specific
    interval_seconds: Optional[int] = None
    
    # One-time specific
    scheduled_time: Optional[datetime] = None
    
    # Event-specific
    event_name: Optional[str] = None
    event_filter: Optional[Dict[str, Any]] = None
    
    # Continuous-specific
    loop_delay_seconds: float = 1.0
    
    # Execution tracking
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    run_count: int = 0
    max_runs: Optional[int] = None
    
    # Metadata
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'trigger_type': self.trigger_type.value,
            'task_type': self.task_type,
            'parameters': self.parameters,
            'status': self.status.value,
            'cron_expression': self.cron_expression,
            'interval_seconds': self.interval_seconds,
            'scheduled_time': self.scheduled_time.isoformat() if self.scheduled_time else None,
            'event_name': self.event_name,
            'last_run': self.last_run.isoformat() if self.last_run else None,
            'next_run': self.next_run.isoformat() if self.next_run else None,
            'run_count': self.run_count,
            'max_runs': self.max_runs,
            'created_at': self.created_at.isoformat(),
        }


class TaskScheduler:
    """
    Production-Ready Task Scheduler
    
    Supports:
    - Cron-based scheduling (e.g., "0 * * * *" for hourly)
    - Interval-based scheduling (e.g., every 30 seconds)
    - Event-driven triggers
    - One-time scheduled tasks
    - Continuous background loops
    """
    
    def __init__(self, agent=None):
        self.agent = agent
        self.scheduled_tasks: Dict[str, ScheduledTask] = {}
        self.event_subscribers: Dict[str, List[str]] = {}  # event_name -> [task_ids]
        self._scheduler_task: Optional[asyncio.Task] = None
        self._continuous_tasks: Dict[str, asyncio.Task] = {}
        self._shutdown_event = asyncio.Event()
        self._is_running = False
        
        logger.info("📅 Task Scheduler initialized")
    
    async def start(self):
        """Start the scheduler"""
        if self._is_running:
            return
        
        self._is_running = True
        self._shutdown_event.clear()
        
        # Start main scheduler loop
        self._scheduler_task = asyncio.create_task(self._scheduler_loop())
        
        # Start any existing continuous tasks
        for task_id, task in self.scheduled_tasks.items():
            if task.trigger_type == TriggerType.CONTINUOUS and task.status == ScheduleStatus.ACTIVE:
                self._start_continuous_task(task)
        
        logger.info("✅ Task Scheduler started")
    
    async def stop(self):
        """Stop the scheduler"""
        self._is_running = False
        self._shutdown_event.set()
        
        # Cancel main scheduler
        if self._scheduler_task:
            self._scheduler_task.cancel()
            try:
                await self._scheduler_task
            except asyncio.CancelledError:
                pass
        
        # Cancel continuous tasks
        for task_id, task in list(self._continuous_tasks.items()):
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        
        self._continuous_tasks.clear()
        
        logger.info("🛑 Task Scheduler stopped")
    
    async def _scheduler_loop(self):
        """Main scheduler loop - checks and triggers scheduled tasks"""
        logger.info("🔄 Scheduler loop started")
        
        while not self._shutdown_event.is_set():
            try:
                now = datetime.utcnow()
                
                for task_id, task in list(self.scheduled_tasks.items()):
                    if task.status != ScheduleStatus.ACTIVE:
                        continue
                    
                    # Skip continuous tasks (handled separately)
                    if task.trigger_type == TriggerType.CONTINUOUS:
                        continue
                    
                    # Check if task should run
                    should_run = self._should_task_run(task, now)
                    
                    if should_run:
                        await self._trigger_task(task)
                
                # Sleep for a short interval
                await asyncio.sleep(1)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Scheduler loop error: {e}")
                await asyncio.sleep(5)
        
        logger.info("🛑 Scheduler loop stopped")
    
    def _should_task_run(self, task: ScheduledTask, now: datetime) -> bool:
        """Check if a task should run now"""
        
        # Check max runs
        if task.max_runs and task.run_count >= task.max_runs:
            task.status = ScheduleStatus.COMPLETED
            return False
        
        if task.trigger_type == TriggerType.CRON:
            if not task.cron_expression:
                return False
            
            if task.next_run is None:
                # Calculate initial next run
                cron = croniter(task.cron_expression, now)
                task.next_run = cron.get_next(datetime)
                return False
            
            if now >= task.next_run:
                return True
        
        elif task.trigger_type == TriggerType.INTERVAL:
            if not task.interval_seconds:
                return False
            
            if task.last_run is None:
                return True
            
            elapsed = (now - task.last_run).total_seconds()
            if elapsed >= task.interval_seconds:
                return True
        
        elif task.trigger_type == TriggerType.ONCE:
            if task.scheduled_time and now >= task.scheduled_time:
                if task.run_count == 0:
                    return True
        
        return False
    
    async def _trigger_task(self, scheduled_task: ScheduledTask):
        """Trigger a scheduled task"""
        logger.info(f"⏰ Triggering scheduled task: {scheduled_task.name}")
        
        try:
            # Create task in agent
            if self.agent:
                await self.agent.create_task(
                    name=f"[Scheduled] {scheduled_task.name}",
                    task_type=scheduled_task.task_type,
                    parameters=scheduled_task.parameters,
                    metadata={
                        'scheduled_task_id': scheduled_task.id,
                        'trigger_type': scheduled_task.trigger_type.value,
                    }
                )
            
            # Update tracking
            scheduled_task.last_run = datetime.utcnow()
            scheduled_task.run_count += 1
            
            # Calculate next run for cron tasks
            if scheduled_task.trigger_type == TriggerType.CRON:
                cron = croniter(scheduled_task.cron_expression, scheduled_task.last_run)
                scheduled_task.next_run = cron.get_next(datetime)
            
            # Mark one-time tasks as completed
            if scheduled_task.trigger_type == TriggerType.ONCE:
                scheduled_task.status = ScheduleStatus.COMPLETED
            
            logger.info(f"✅ Triggered task: {scheduled_task.name} (run #{scheduled_task.run_count})")
            
        except Exception as e:
            logger.error(f"❌ Failed to trigger task {scheduled_task.name}: {e}")
    
    def _start_continuous_task(self, scheduled_task: ScheduledTask):
        """Start a continuous background task"""
        if scheduled_task.id in self._continuous_tasks:
            return
        
        async def continuous_loop():
            while not self._shutdown_event.is_set():
                try:
                    if scheduled_task.status != ScheduleStatus.ACTIVE:
                        break
                    
                    await self._trigger_task(scheduled_task)
                    await asyncio.sleep(scheduled_task.loop_delay_seconds)
                    
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Continuous task error: {e}")
                    await asyncio.sleep(5)
        
        self._continuous_tasks[scheduled_task.id] = asyncio.create_task(continuous_loop())
        logger.info(f"🔄 Started continuous task: {scheduled_task.name}")
    
    # =========================================
    # SCHEDULE MANAGEMENT
    # =========================================
    
    async def schedule_cron(
        self,
        name: str,
        cron_expression: str,
        task_type: str,
        parameters: Dict[str, Any],
        max_runs: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ScheduledTask:
        """Schedule a cron-based task"""
        
        # Validate cron expression
        try:
            croniter(cron_expression)
        except Exception as e:
            raise ValueError(f"Invalid cron expression: {e}")
        
        task = ScheduledTask(
            id=str(uuid.uuid4()),
            name=name,
            trigger_type=TriggerType.CRON,
            task_type=task_type,
            parameters=parameters,
            cron_expression=cron_expression,
            max_runs=max_runs,
            metadata=metadata or {},
        )
        
        # Calculate first run
        cron = croniter(cron_expression, datetime.utcnow())
        task.next_run = cron.get_next(datetime)
        
        self.scheduled_tasks[task.id] = task
        logger.info(f"📅 Scheduled cron task: {name} ({cron_expression}), next run: {task.next_run}")
        
        return task
    
    async def schedule_interval(
        self,
        name: str,
        interval_seconds: int,
        task_type: str,
        parameters: Dict[str, Any],
        start_immediately: bool = False,
        max_runs: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ScheduledTask:
        """Schedule an interval-based task"""
        
        task = ScheduledTask(
            id=str(uuid.uuid4()),
            name=name,
            trigger_type=TriggerType.INTERVAL,
            task_type=task_type,
            parameters=parameters,
            interval_seconds=interval_seconds,
            max_runs=max_runs,
            metadata=metadata or {},
        )
        
        if not start_immediately:
            task.last_run = datetime.utcnow()
        
        self.scheduled_tasks[task.id] = task
        logger.info(f"📅 Scheduled interval task: {name} (every {interval_seconds}s)")
        
        return task
    
    async def schedule_once(
        self,
        name: str,
        scheduled_time: datetime,
        task_type: str,
        parameters: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ScheduledTask:
        """Schedule a one-time task"""
        
        if scheduled_time < datetime.utcnow():
            raise ValueError("Scheduled time must be in the future")
        
        task = ScheduledTask(
            id=str(uuid.uuid4()),
            name=name,
            trigger_type=TriggerType.ONCE,
            task_type=task_type,
            parameters=parameters,
            scheduled_time=scheduled_time,
            next_run=scheduled_time,
            max_runs=1,
            metadata=metadata or {},
        )
        
        self.scheduled_tasks[task.id] = task
        logger.info(f"📅 Scheduled one-time task: {name} at {scheduled_time}")
        
        return task
    
    async def schedule_event(
        self,
        name: str,
        event_name: str,
        task_type: str,
        parameters: Dict[str, Any],
        event_filter: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ScheduledTask:
        """Schedule an event-triggered task"""
        
        task = ScheduledTask(
            id=str(uuid.uuid4()),
            name=name,
            trigger_type=TriggerType.EVENT,
            task_type=task_type,
            parameters=parameters,
            event_name=event_name,
            event_filter=event_filter,
            metadata=metadata or {},
        )
        
        # Register event subscription
        if event_name not in self.event_subscribers:
            self.event_subscribers[event_name] = []
        self.event_subscribers[event_name].append(task.id)
        
        self.scheduled_tasks[task.id] = task
        logger.info(f"📅 Scheduled event task: {name} (on event: {event_name})")
        
        return task
    
    async def schedule_continuous(
        self,
        name: str,
        task_type: str,
        parameters: Dict[str, Any],
        loop_delay_seconds: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ScheduledTask:
        """Schedule a continuous background task"""
        
        task = ScheduledTask(
            id=str(uuid.uuid4()),
            name=name,
            trigger_type=TriggerType.CONTINUOUS,
            task_type=task_type,
            parameters=parameters,
            loop_delay_seconds=loop_delay_seconds,
            metadata=metadata or {},
        )
        
        self.scheduled_tasks[task.id] = task
        
        # Start immediately if scheduler is running
        if self._is_running:
            self._start_continuous_task(task)
        
        logger.info(f"📅 Scheduled continuous task: {name} (delay: {loop_delay_seconds}s)")
        
        return task
    
    async def emit_event(self, event_name: str, event_data: Dict[str, Any] = None):
        """Emit an event to trigger event-based tasks"""
        logger.info(f"📢 Event emitted: {event_name}")
        
        task_ids = self.event_subscribers.get(event_name, [])
        
        for task_id in task_ids:
            task = self.scheduled_tasks.get(task_id)
            if task and task.status == ScheduleStatus.ACTIVE:
                # Check event filter
                if task.event_filter:
                    if not self._matches_filter(event_data, task.event_filter):
                        continue
                
                # Merge event data into parameters
                merged_params = {**task.parameters, 'event_data': event_data}
                task.parameters = merged_params
                
                await self._trigger_task(task)
    
    def _matches_filter(self, data: Dict[str, Any], filter_spec: Dict[str, Any]) -> bool:
        """Check if event data matches filter specification"""
        if not data or not filter_spec:
            return True
        
        for key, expected_value in filter_spec.items():
            if key not in data:
                return False
            if data[key] != expected_value:
                return False
        
        return True
    
    # =========================================
    # SCHEDULE CONTROL
    # =========================================
    
    async def pause_schedule(self, task_id: str) -> bool:
        """Pause a scheduled task"""
        if task_id not in self.scheduled_tasks:
            return False
        
        task = self.scheduled_tasks[task_id]
        task.status = ScheduleStatus.PAUSED
        
        # Stop continuous task if running
        if task_id in self._continuous_tasks:
            self._continuous_tasks[task_id].cancel()
            del self._continuous_tasks[task_id]
        
        logger.info(f"⏸️ Paused schedule: {task.name}")
        return True
    
    async def resume_schedule(self, task_id: str) -> bool:
        """Resume a paused scheduled task"""
        if task_id not in self.scheduled_tasks:
            return False
        
        task = self.scheduled_tasks[task_id]
        if task.status != ScheduleStatus.PAUSED:
            return False
        
        task.status = ScheduleStatus.ACTIVE
        
        # Restart continuous task if applicable
        if task.trigger_type == TriggerType.CONTINUOUS and self._is_running:
            self._start_continuous_task(task)
        
        logger.info(f"▶️ Resumed schedule: {task.name}")
        return True
    
    async def cancel_schedule(self, task_id: str) -> bool:
        """Cancel a scheduled task"""
        if task_id not in self.scheduled_tasks:
            return False
        
        task = self.scheduled_tasks[task_id]
        task.status = ScheduleStatus.CANCELLED
        
        # Stop continuous task if running
        if task_id in self._continuous_tasks:
            self._continuous_tasks[task_id].cancel()
            del self._continuous_tasks[task_id]
        
        # Remove from event subscribers
        if task.event_name and task.event_name in self.event_subscribers:
            self.event_subscribers[task.event_name] = [
                tid for tid in self.event_subscribers[task.event_name]
                if tid != task_id
            ]
        
        logger.info(f"🚫 Cancelled schedule: {task.name}")
        return True
    
    def get_schedule(self, task_id: str) -> Optional[ScheduledTask]:
        """Get a scheduled task by ID"""
        return self.scheduled_tasks.get(task_id)
    
    def get_all_schedules(self) -> List[ScheduledTask]:
        """Get all scheduled tasks"""
        return list(self.scheduled_tasks.values())
    
    def get_active_schedules(self) -> List[ScheduledTask]:
        """Get all active scheduled tasks"""
        return [t for t in self.scheduled_tasks.values() if t.status == ScheduleStatus.ACTIVE]
    
    def get_status(self) -> Dict[str, Any]:
        """Get scheduler status"""
        return {
            'is_running': self._is_running,
            'total_schedules': len(self.scheduled_tasks),
            'active_schedules': len(self.get_active_schedules()),
            'continuous_tasks_running': len(self._continuous_tasks),
            'event_subscriptions': {k: len(v) for k, v in self.event_subscribers.items()},
        }
