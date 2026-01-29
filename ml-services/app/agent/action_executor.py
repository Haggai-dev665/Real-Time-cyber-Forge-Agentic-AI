"""
Action Executor - Executes decisions made by the agent
The agent's "hands" that carry out actions on behalf of the user.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import json

logger = logging.getLogger(__name__)


class ActionType(Enum):
    """Types of actions the agent can execute"""
    BLOCK_URL = "block_url"
    BLOCK_DOMAIN = "block_domain"
    ALLOW_URL = "allow_url"
    SHOW_WARNING = "show_warning"
    QUARANTINE_FILE = "quarantine_file"
    DELETE_COOKIES = "delete_cookies"
    CLEAR_STORAGE = "clear_storage"
    GENERATE_REPORT = "generate_report"
    SEND_NOTIFICATION = "send_notification"
    START_SCAN = "start_scan"
    STOP_SCAN = "stop_scan"
    ESCALATE = "escalate"
    LOG_INCIDENT = "log_incident"


class ActionSeverity(Enum):
    """Severity levels for actions"""
    LOW = "low"           # Informational, no user impact
    MEDIUM = "medium"     # Some user impact, reversible
    HIGH = "high"         # Significant impact, may block access
    CRITICAL = "critical" # Destructive or requires confirmation


@dataclass
class ActionRequest:
    """Request for the agent to execute an action"""
    id: str
    action_type: ActionType
    target: str
    reason: str
    severity: ActionSeverity
    parameters: Dict[str, Any] = field(default_factory=dict)
    requires_confirmation: bool = False
    auto_approved: bool = False
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'action_type': self.action_type.value,
            'target': self.target,
            'reason': self.reason,
            'severity': self.severity.value,
            'parameters': self.parameters,
            'requires_confirmation': self.requires_confirmation,
            'auto_approved': self.auto_approved,
            'timestamp': self.timestamp.isoformat(),
        }


@dataclass
class ActionResult:
    """Result of an executed action"""
    action_id: str
    success: bool
    message: str
    executed_at: datetime = field(default_factory=datetime.utcnow)
    details: Dict[str, Any] = field(default_factory=dict)
    rollback_available: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'action_id': self.action_id,
            'success': self.success,
            'message': self.message,
            'executed_at': self.executed_at.isoformat(),
            'details': self.details,
            'rollback_available': self.rollback_available,
        }


class ActionExecutor:
    """
    Executes actions on behalf of the agent.
    Respects user preferences for what can be auto-executed vs. requires confirmation.
    """
    
    def __init__(self, state_manager=None):
        from .agent_state import agent_state
        
        self.state = state_manager or agent_state
        
        # Action handlers
        self._handlers: Dict[ActionType, Callable] = {}
        
        # Pending confirmations
        self.pending_confirmations: Dict[str, ActionRequest] = {}
        
        # Execution history
        self.history: List[ActionResult] = []
        
        # Blocked items (in-memory, would persist in production)
        self.blocked_urls: set = set()
        self.blocked_domains: set = set()
        
        # Auto-execute settings (what can run without confirmation)
        self.auto_execute_allowed = {
            ActionType.SHOW_WARNING: True,
            ActionType.SEND_NOTIFICATION: True,
            ActionType.LOG_INCIDENT: True,
            ActionType.GENERATE_REPORT: True,
            ActionType.BLOCK_URL: False,      # Requires opt-in
            ActionType.BLOCK_DOMAIN: False,   # Requires opt-in
            ActionType.QUARANTINE_FILE: False,
            ActionType.DELETE_COOKIES: False,
            ActionType.CLEAR_STORAGE: False,
        }
        
        # Register default handlers
        self._register_default_handlers()
        
        logger.info("⚡ Action Executor initialized")
    
    def _register_default_handlers(self):
        """Register default action handlers"""
        self._handlers[ActionType.BLOCK_URL] = self._handle_block_url
        self._handlers[ActionType.BLOCK_DOMAIN] = self._handle_block_domain
        self._handlers[ActionType.ALLOW_URL] = self._handle_allow_url
        self._handlers[ActionType.SHOW_WARNING] = self._handle_show_warning
        self._handlers[ActionType.SEND_NOTIFICATION] = self._handle_send_notification
        self._handlers[ActionType.LOG_INCIDENT] = self._handle_log_incident
        self._handlers[ActionType.GENERATE_REPORT] = self._handle_generate_report
    
    def register_handler(self, action_type: ActionType, handler: Callable):
        """Register a custom action handler"""
        self._handlers[action_type] = handler
    
    def enable_auto_execute(self, action_type: ActionType):
        """Enable auto-execution for an action type"""
        self.auto_execute_allowed[action_type] = True
        logger.info(f"✅ Auto-execute enabled for: {action_type.value}")
    
    def disable_auto_execute(self, action_type: ActionType):
        """Disable auto-execution for an action type"""
        self.auto_execute_allowed[action_type] = False
        logger.info(f"❌ Auto-execute disabled for: {action_type.value}")
    
    async def request_action(self, action: ActionRequest) -> ActionResult:
        """
        Request an action to be executed.
        May require confirmation based on action type and settings.
        """
        # Check if requires confirmation
        if self._requires_confirmation(action):
            # Queue for user confirmation
            self.pending_confirmations[action.id] = action
            
            # Raise alert for confirmation
            await self.state.raise_alert(
                severity='warning',
                title=f"Action Requires Confirmation: {action.action_type.value}",
                description=f"{action.reason}\n\nTarget: {action.target}",
                source='action_executor',
                data={'action_id': action.id, 'action': action.to_dict()}
            )
            
            return ActionResult(
                action_id=action.id,
                success=False,
                message="Action queued for confirmation",
                details={'status': 'pending_confirmation'}
            )
        
        # Execute immediately
        return await self._execute(action)
    
    async def confirm_action(self, action_id: str) -> ActionResult:
        """Confirm and execute a pending action"""
        if action_id not in self.pending_confirmations:
            return ActionResult(
                action_id=action_id,
                success=False,
                message="Action not found in pending confirmations"
            )
        
        action = self.pending_confirmations.pop(action_id)
        action.auto_approved = False
        
        return await self._execute(action)
    
    async def reject_action(self, action_id: str, reason: str = "") -> ActionResult:
        """Reject a pending action"""
        if action_id in self.pending_confirmations:
            action = self.pending_confirmations.pop(action_id)
            
            logger.info(f"Action rejected: {action.action_type.value} - {reason}")
            
            return ActionResult(
                action_id=action_id,
                success=True,
                message=f"Action rejected: {reason}",
                details={'rejected': True, 'reason': reason}
            )
        
        return ActionResult(
            action_id=action_id,
            success=False,
            message="Action not found"
        )
    
    def _requires_confirmation(self, action: ActionRequest) -> bool:
        """Check if action requires user confirmation"""
        if action.requires_confirmation:
            return True
        
        if action.severity in [ActionSeverity.HIGH, ActionSeverity.CRITICAL]:
            return True
        
        if not self.auto_execute_allowed.get(action.action_type, False):
            return True
        
        return False
    
    async def _execute(self, action: ActionRequest) -> ActionResult:
        """Execute an action"""
        handler = self._handlers.get(action.action_type)
        
        if not handler:
            return ActionResult(
                action_id=action.id,
                success=False,
                message=f"No handler for action type: {action.action_type.value}"
            )
        
        try:
            result = await handler(action)
            
            # Log to state
            await self.state.complete_task(
                action.id,
                result.message,
                result.success
            )
            
            # Store in history
            self.history.append(result)
            if len(self.history) > 1000:
                self.history = self.history[-500:]
            
            return result
            
        except Exception as e:
            logger.error(f"Action execution error: {e}")
            return ActionResult(
                action_id=action.id,
                success=False,
                message=f"Execution error: {str(e)}"
            )
    
    # ==================== Default Handlers ====================
    
    async def _handle_block_url(self, action: ActionRequest) -> ActionResult:
        """Block a specific URL"""
        url = action.target
        self.blocked_urls.add(url)
        
        logger.info(f"🛑 Blocked URL: {url}")
        
        return ActionResult(
            action_id=action.id,
            success=True,
            message=f"URL blocked: {url}",
            details={'blocked_url': url},
            rollback_available=True
        )
    
    async def _handle_block_domain(self, action: ActionRequest) -> ActionResult:
        """Block an entire domain"""
        domain = action.target
        self.blocked_domains.add(domain)
        
        logger.info(f"🛑 Blocked domain: {domain}")
        
        return ActionResult(
            action_id=action.id,
            success=True,
            message=f"Domain blocked: {domain}",
            details={'blocked_domain': domain},
            rollback_available=True
        )
    
    async def _handle_allow_url(self, action: ActionRequest) -> ActionResult:
        """Allow a previously blocked URL or domain"""
        target = action.target
        
        if target in self.blocked_urls:
            self.blocked_urls.remove(target)
        if target in self.blocked_domains:
            self.blocked_domains.remove(target)
        
        logger.info(f"✅ Allowed: {target}")
        
        return ActionResult(
            action_id=action.id,
            success=True,
            message=f"Allowed: {target}",
            details={'allowed': target}
        )
    
    async def _handle_show_warning(self, action: ActionRequest) -> ActionResult:
        """Show warning to user"""
        # This would integrate with the desktop app to show a warning dialog
        logger.warning(f"⚠️ Warning: {action.reason}")
        
        return ActionResult(
            action_id=action.id,
            success=True,
            message="Warning displayed",
            details={'warning': action.reason}
        )
    
    async def _handle_send_notification(self, action: ActionRequest) -> ActionResult:
        """Send notification to user"""
        logger.info(f"📢 Notification: {action.parameters.get('message', action.reason)}")
        
        return ActionResult(
            action_id=action.id,
            success=True,
            message="Notification sent",
            details={'notification': action.parameters.get('message', action.reason)}
        )
    
    async def _handle_log_incident(self, action: ActionRequest) -> ActionResult:
        """Log a security incident"""
        incident = {
            'target': action.target,
            'reason': action.reason,
            'severity': action.severity.value,
            'timestamp': action.timestamp.isoformat(),
            'parameters': action.parameters,
        }
        
        logger.info(f"📝 Incident logged: {json.dumps(incident)}")
        
        return ActionResult(
            action_id=action.id,
            success=True,
            message="Incident logged",
            details={'incident': incident}
        )
    
    async def _handle_generate_report(self, action: ActionRequest) -> ActionResult:
        """Generate a security report"""
        report_type = action.parameters.get('type', 'summary')
        
        # In production, this would generate an actual report
        logger.info(f"📊 Generating {report_type} report")
        
        return ActionResult(
            action_id=action.id,
            success=True,
            message=f"{report_type.title()} report generated",
            details={'report_type': report_type}
        )
    
    # ==================== Convenience Methods ====================
    
    async def block(self, observation, reason: str):
        """Block based on an observation"""
        import uuid
        
        url = observation.data.get('url', '')
        domain = observation.data.get('domain', '')
        
        if url:
            action = ActionRequest(
                id=str(uuid.uuid4())[:8],
                action_type=ActionType.BLOCK_URL,
                target=url,
                reason=reason,
                severity=ActionSeverity.HIGH,
            )
            return await self.request_action(action)
        
        elif domain:
            action = ActionRequest(
                id=str(uuid.uuid4())[:8],
                action_type=ActionType.BLOCK_DOMAIN,
                target=domain,
                reason=reason,
                severity=ActionSeverity.HIGH,
            )
            return await self.request_action(action)
    
    def is_blocked(self, url: str) -> bool:
        """Check if a URL is blocked"""
        if url in self.blocked_urls:
            return True
        
        # Check domain
        try:
            from urllib.parse import urlparse
            domain = urlparse(url).netloc
            if domain in self.blocked_domains:
                return True
        except:
            pass
        
        return False
    
    def get_blocked_items(self) -> Dict[str, List[str]]:
        """Get all blocked items"""
        return {
            'urls': list(self.blocked_urls),
            'domains': list(self.blocked_domains),
        }
    
    def get_pending_confirmations(self) -> List[Dict[str, Any]]:
        """Get pending actions awaiting confirmation"""
        return [action.to_dict() for action in self.pending_confirmations.values()]
    
    def get_execution_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent execution history"""
        return [r.to_dict() for r in self.history[-limit:]]


# Global instance
action_executor = ActionExecutor()
