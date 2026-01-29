"""
Autonomous AI Agent Core Module
Production-ready autonomous agent with task planning, scheduling, and self-directed execution.

This module implements the vision of:
"A continuously running, autonomous AI agent that observes, reasons, decides, and acts on web security risks in real time."
"""

# Core components
from .autonomous_agent import AutonomousAgent
from .task_scheduler import TaskScheduler, ScheduledTask, TriggerType
from .tool_registry import ToolRegistry, Tool, ToolCategory
from .planner import AgentPlanner, Goal, Plan, PlanStep
from .executor import TaskExecutor, ExecutionResult
from .memory import AgentMemory, MemoryType, MemoryEntry
from .observability import AgentObserver, MetricType, AgentMetrics

# Real-time agentic components
from .agent_state import AgentStateManager, AgentStatus, agent_state
from .observation_loop import ObservationLoop, Observation, ObservationType, observation_loop
from .action_executor import ActionExecutor, ActionType, ActionRequest, ActionResult, action_executor
from .intelligence_feed import IntelligenceFeed, IntelligenceEvent, EventSeverity, intelligence_feed
from .scan_modes import ScanModeManager, ScanMode, SCAN_MODES, scan_mode_manager
from .operational_assistant import OperationalAssistant, AssistantResponse, ActionIntent, operational_assistant

__all__ = [
    # Core Agent
    'AutonomousAgent',
    'TaskScheduler',
    'ScheduledTask',
    'TriggerType',
    'ToolRegistry',
    'Tool',
    'ToolCategory',
    'AgentPlanner',
    'Goal',
    'Plan',
    'PlanStep',
    'TaskExecutor',
    'ExecutionResult',
    'AgentMemory',
    'MemoryType',
    'MemoryEntry',
    'AgentObserver',
    'MetricType',
    'AgentMetrics',
    
    # Agent State & Control
    'AgentStateManager',
    'AgentStatus',
    'agent_state',
    
    # Observation System
    'ObservationLoop',
    'Observation',
    'ObservationType',
    'observation_loop',
    
    # Action Execution
    'ActionExecutor',
    'ActionType',
    'ActionRequest',
    'ActionResult',
    'action_executor',
    
    # Intelligence Feed
    'IntelligenceFeed',
    'IntelligenceEvent',
    'EventSeverity',
    'intelligence_feed',
    
    # Scan Modes
    'ScanModeManager',
    'ScanMode',
    'SCAN_MODES',
    'scan_mode_manager',
    
    # Operational Assistant
    'OperationalAssistant',
    'AssistantResponse',
    'ActionIntent',
    'operational_assistant',
]
