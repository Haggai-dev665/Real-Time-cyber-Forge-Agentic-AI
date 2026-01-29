"""
Operational AI Assistant
Context-aware assistant that can suggest AND execute actions.
This is not a chatbot - it's an operational co-pilot.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import json
import re

logger = logging.getLogger(__name__)


class ActionIntent(Enum):
    """Types of actions the assistant can execute"""
    BLOCK_DOMAIN = "block_domain"
    BLOCK_URL = "block_url"
    ALLOW = "allow"
    SCAN_URL = "scan_url"
    SCAN_NETWORK = "scan_network"
    DEEP_SCAN = "deep_scan"
    GENERATE_REPORT = "generate_report"
    INVESTIGATE = "investigate"
    CHANGE_MODE = "change_mode"
    SCHEDULE_TASK = "schedule_task"
    EXPLAIN = "explain"
    QUERY = "query"  # Just answering a question


@dataclass
class AssistantAction:
    """An action the assistant can execute"""
    intent: ActionIntent
    parameters: Dict[str, Any]
    description: str
    requires_confirmation: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'intent': self.intent.value,
            'parameters': self.parameters,
            'description': self.description,
            'requires_confirmation': self.requires_confirmation,
        }


@dataclass
class AssistantResponse:
    """Response from the assistant"""
    message: str
    suggested_actions: List[AssistantAction] = field(default_factory=list)
    executed_action: Optional[AssistantAction] = None
    context_used: List[str] = field(default_factory=list)
    confidence: float = 0.9
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'message': self.message,
            'suggested_actions': [a.to_dict() for a in self.suggested_actions],
            'executed_action': self.executed_action.to_dict() if self.executed_action else None,
            'context_used': self.context_used,
            'confidence': self.confidence,
        }


class ContextAggregator:
    """Aggregates context from various sources for the assistant"""
    
    def __init__(self):
        self.state_manager = None
        self.observation_loop = None
        self.intelligence_feed = None
        self.scan_mode_manager = None
        self.action_executor = None
    
    def set_components(
        self,
        state_manager=None,
        observation_loop=None,
        intelligence_feed=None,
        scan_mode_manager=None,
        action_executor=None,
    ):
        """Set component references"""
        self.state_manager = state_manager
        self.observation_loop = observation_loop
        self.intelligence_feed = intelligence_feed
        self.scan_mode_manager = scan_mode_manager
        self.action_executor = action_executor
    
    async def get_full_context(self) -> Dict[str, Any]:
        """Get complete context for the assistant"""
        context = {
            'timestamp': datetime.utcnow().isoformat(),
        }
        
        # Agent state
        if self.state_manager:
            context['agent_state'] = self.state_manager.get_control_center_state()
        
        # Recent observations
        if self.observation_loop:
            context['observation_stats'] = self.observation_loop.get_stats()
        
        # Intelligence feed
        if self.intelligence_feed:
            context['recent_events'] = self.intelligence_feed.get_events(limit=10)
            context['feed_summary'] = self.intelligence_feed.get_summary()
        
        # Scan mode
        if self.scan_mode_manager:
            context['scan_mode'] = self.scan_mode_manager.get_status()
        
        # Blocked items
        if self.action_executor:
            context['blocked_items'] = self.action_executor.get_blocked_items()
            context['pending_actions'] = self.action_executor.get_pending_confirmations()
        
        return context


class IntentParser:
    """Parses user input to determine intent and extract parameters"""
    
    def __init__(self):
        # Intent patterns
        self.patterns = {
            ActionIntent.BLOCK_DOMAIN: [
                r"block\s+(?:the\s+)?domain\s+([^\s]+)",
                r"block\s+([^\s]+)",
                r"add\s+([^\s]+)\s+to\s+blocklist",
            ],
            ActionIntent.BLOCK_URL: [
                r"block\s+(?:this\s+)?url\s+([^\s]+)",
                r"block\s+(?:this\s+)?page",
            ],
            ActionIntent.SCAN_URL: [
                r"scan\s+(?:the\s+)?url\s+([^\s]+)",
                r"analyze\s+([^\s]+)",
                r"check\s+([^\s]+)\s+for\s+(?:threats|security)",
            ],
            ActionIntent.SCAN_NETWORK: [
                r"scan\s+(?:the\s+)?network",
                r"network\s+scan",
                r"scan\s+(?:for\s+)?ports",
            ],
            ActionIntent.DEEP_SCAN: [
                r"deep\s+scan",
                r"thorough\s+scan",
                r"full\s+analysis",
            ],
            ActionIntent.GENERATE_REPORT: [
                r"generate\s+(?:a\s+)?report",
                r"create\s+(?:a\s+)?report",
                r"summary\s+report",
                r"forensic\s+report",
            ],
            ActionIntent.INVESTIGATE: [
                r"investigate\s+(.+)",
                r"look\s+into\s+(.+)",
                r"dig\s+deeper",
            ],
            ActionIntent.CHANGE_MODE: [
                r"switch\s+to\s+(quick|deep|stealth|forensic)\s+mode",
                r"enable\s+(quick|deep|stealth|forensic)\s+mode",
                r"use\s+(quick|deep|stealth|forensic)\s+scan",
            ],
            ActionIntent.SCHEDULE_TASK: [
                r"schedule\s+(?:a\s+)?(.+)\s+every\s+(.+)",
                r"run\s+(.+)\s+daily",
                r"set\s+up\s+recurring\s+(.+)",
            ],
            ActionIntent.EXPLAIN: [
                r"explain\s+(.+)",
                r"why\s+(?:did|is|was)\s+(.+)",
                r"what\s+(?:is|does)\s+(.+)",
            ],
        }
    
    def parse(self, user_input: str) -> tuple[ActionIntent, Dict[str, Any]]:
        """Parse user input to determine intent"""
        input_lower = user_input.lower().strip()
        
        for intent, patterns in self.patterns.items():
            for pattern in patterns:
                match = re.search(pattern, input_lower)
                if match:
                    return intent, {'match': match.groups()}
        
        # Default to query (just answering a question)
        return ActionIntent.QUERY, {}


class OperationalAssistant:
    """
    Operational AI Assistant that can:
    1. Understand current context (browser, threats, agent state)
    2. Suggest relevant actions
    3. Execute actions on user approval
    4. Proactively offer help
    
    This is not a chatbot - it's an operational co-pilot.
    """
    
    def __init__(self, gemini_service=None):
        self.gemini = gemini_service
        self.context_aggregator = ContextAggregator()
        self.intent_parser = IntentParser()
        
        # Conversation history
        self.conversation_history: List[Dict[str, Any]] = []
        
        # Action handlers
        self._action_handlers: Dict[ActionIntent, Callable] = {}
        
        # Proactive suggestions
        self.proactive_enabled = True
        self.last_suggestion_time = None
        self.suggestion_cooldown = 60  # seconds
        
        logger.info("🤖 Operational Assistant initialized")
    
    def set_components(
        self,
        state_manager=None,
        observation_loop=None,
        intelligence_feed=None,
        scan_mode_manager=None,
        action_executor=None,
    ):
        """Set component references for context awareness"""
        self.context_aggregator.set_components(
            state_manager=state_manager,
            observation_loop=observation_loop,
            intelligence_feed=intelligence_feed,
            scan_mode_manager=scan_mode_manager,
            action_executor=action_executor,
        )
        
        # Set up action handlers
        if action_executor:
            self._setup_action_handlers(action_executor, scan_mode_manager)
    
    def _setup_action_handlers(self, action_executor, scan_mode_manager):
        """Set up handlers for executable actions"""
        
        async def handle_block_domain(params):
            domain = params.get('domain') or params.get('match', ('',))[0]
            from .action_executor import ActionRequest, ActionType, ActionSeverity
            import uuid
            
            action = ActionRequest(
                id=str(uuid.uuid4())[:8],
                action_type=ActionType.BLOCK_DOMAIN,
                target=domain,
                reason="Blocked via assistant",
                severity=ActionSeverity.HIGH,
            )
            return await action_executor.request_action(action)
        
        async def handle_change_mode(params):
            mode_name = params.get('match', ('quick',))[0]
            from .scan_modes import ScanMode
            
            mode_map = {
                'quick': ScanMode.QUICK,
                'deep': ScanMode.DEEP,
                'stealth': ScanMode.STEALTH,
                'forensic': ScanMode.FORENSIC,
            }
            mode = mode_map.get(mode_name, ScanMode.QUICK)
            await scan_mode_manager.set_mode(mode, "Changed via assistant")
            return {'success': True, 'mode': mode.value}
        
        self._action_handlers[ActionIntent.BLOCK_DOMAIN] = handle_block_domain
        self._action_handlers[ActionIntent.CHANGE_MODE] = handle_change_mode
    
    async def process(
        self,
        user_input: str,
        auto_execute: bool = False,
    ) -> AssistantResponse:
        """Process user input and respond with context-aware suggestions"""
        
        # Parse intent
        intent, params = self.intent_parser.parse(user_input)
        
        # Get current context
        context = await self.context_aggregator.get_full_context()
        context_summary = self._summarize_context(context)
        
        # Determine response based on intent
        if intent == ActionIntent.QUERY:
            # Use AI to answer the question
            response = await self._answer_question(user_input, context)
        else:
            # Create action and optionally execute
            action = self._create_action(intent, params)
            
            if auto_execute and intent in self._action_handlers:
                result = await self._action_handlers[intent](params)
                response = AssistantResponse(
                    message=f"Done! {action.description}",
                    executed_action=action,
                    context_used=context_summary,
                )
            else:
                # Suggest the action
                response = await self._suggest_action(action, context)
        
        # Store in conversation history
        self.conversation_history.append({
            'user': user_input,
            'assistant': response.message,
            'intent': intent.value,
            'timestamp': datetime.utcnow().isoformat(),
        })
        
        # Keep history bounded
        if len(self.conversation_history) > 50:
            self.conversation_history = self.conversation_history[-25:]
        
        return response
    
    async def execute_action(self, action: AssistantAction) -> Dict[str, Any]:
        """Execute a suggested action"""
        handler = self._action_handlers.get(action.intent)
        
        if not handler:
            return {'success': False, 'error': 'No handler for this action'}
        
        try:
            result = await handler(action.parameters)
            return {'success': True, 'result': result}
        except Exception as e:
            logger.error(f"Action execution error: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_proactive_suggestions(self) -> List[AssistantAction]:
        """Get proactive suggestions based on current state"""
        if not self.proactive_enabled:
            return []
        
        # Cooldown check
        now = datetime.utcnow()
        if self.last_suggestion_time:
            elapsed = (now - self.last_suggestion_time).total_seconds()
            if elapsed < self.suggestion_cooldown:
                return []
        
        self.last_suggestion_time = now
        
        # Get context
        context = await self.context_aggregator.get_full_context()
        suggestions = []
        
        # Check for pending alerts
        if context.get('agent_state', {}).get('alerts'):
            alerts = context['agent_state']['alerts']
            critical = [a for a in alerts if a.get('severity') == 'critical']
            
            if critical:
                suggestions.append(AssistantAction(
                    intent=ActionIntent.INVESTIGATE,
                    parameters={'alert_id': critical[0].get('id')},
                    description=f"Investigate critical alert: {critical[0].get('title', 'Unknown')}",
                    requires_confirmation=False,
                ))
        
        # Check for mode recommendation
        scan_status = context.get('scan_mode', {})
        if scan_status.get('recommended_mode') != scan_status.get('current_mode'):
            suggestions.append(AssistantAction(
                intent=ActionIntent.CHANGE_MODE,
                parameters={'mode': scan_status.get('recommended_mode')},
                description=scan_status.get('recommendation_reason', 'Change scan mode'),
                requires_confirmation=True,
            ))
        
        # Check for pending confirmations
        pending = context.get('pending_actions', [])
        if pending:
            suggestions.append(AssistantAction(
                intent=ActionIntent.QUERY,
                parameters={},
                description=f"You have {len(pending)} pending action(s) awaiting confirmation",
                requires_confirmation=False,
            ))
        
        return suggestions
    
    def _summarize_context(self, context: Dict[str, Any]) -> List[str]:
        """Summarize context for response"""
        summary = []
        
        if 'agent_state' in context:
            state = context['agent_state']
            summary.append(f"Agent status: {state.get('status', 'unknown')}")
            
            if state.get('current_goal'):
                summary.append(f"Current goal: {state['current_goal'].get('description', '')[:50]}")
            
            if state.get('alerts'):
                summary.append(f"Active alerts: {len(state['alerts'])}")
        
        if 'scan_mode' in context:
            summary.append(f"Scan mode: {context['scan_mode'].get('current_mode', 'unknown')}")
        
        if 'feed_summary' in context:
            summary.append(f"Recent events: {context['feed_summary'].get('active_events', 0)}")
        
        return summary
    
    def _create_action(self, intent: ActionIntent, params: Dict[str, Any]) -> AssistantAction:
        """Create an action from parsed intent"""
        descriptions = {
            ActionIntent.BLOCK_DOMAIN: f"Block domain: {params.get('match', ('unknown',))[0]}",
            ActionIntent.BLOCK_URL: "Block current URL",
            ActionIntent.SCAN_URL: f"Scan URL for threats",
            ActionIntent.SCAN_NETWORK: "Perform network scan",
            ActionIntent.DEEP_SCAN: "Start deep security scan",
            ActionIntent.GENERATE_REPORT: "Generate security report",
            ActionIntent.INVESTIGATE: "Start investigation",
            ActionIntent.CHANGE_MODE: f"Switch to {params.get('match', ('',))[0]} mode",
            ActionIntent.SCHEDULE_TASK: "Schedule recurring task",
        }
        
        requires_confirmation = intent in [
            ActionIntent.BLOCK_DOMAIN,
            ActionIntent.BLOCK_URL,
            ActionIntent.DEEP_SCAN,
            ActionIntent.CHANGE_MODE,
        ]
        
        return AssistantAction(
            intent=intent,
            parameters=params,
            description=descriptions.get(intent, "Execute action"),
            requires_confirmation=requires_confirmation,
        )
    
    async def _answer_question(
        self,
        question: str,
        context: Dict[str, Any],
    ) -> AssistantResponse:
        """Answer a general question using AI"""
        if not self.gemini:
            return AssistantResponse(
                message="I can help with security questions, but AI service is not available.",
                confidence=0.5,
            )
        
        try:
            # Build context-aware prompt
            context_str = json.dumps(self._summarize_context(context), indent=2)
            
            prompt = f"""You are an AI security analyst assistant for the Cyber Forge platform.
You have access to the current security context:

{context_str}

User question: {question}

Provide a helpful, concise response. If you can suggest specific actions the user can take,
include them as actionable suggestions. Be security-focused and professional.

Response:"""
            
            response = await self.gemini.generate(prompt)
            
            # Parse for suggested actions
            suggested_actions = self._extract_suggested_actions(response)
            
            return AssistantResponse(
                message=response.strip(),
                suggested_actions=suggested_actions,
                context_used=self._summarize_context(context),
                confidence=0.85,
            )
            
        except Exception as e:
            logger.error(f"AI response error: {e}")
            return AssistantResponse(
                message="I encountered an error processing your question. Please try again.",
                confidence=0.3,
            )
    
    async def _suggest_action(
        self,
        action: AssistantAction,
        context: Dict[str, Any],
    ) -> AssistantResponse:
        """Suggest an action with context"""
        if action.requires_confirmation:
            message = f"I can {action.description}. Would you like me to proceed?"
        else:
            message = f"I'll {action.description} for you."
        
        # Add context-aware suggestions
        related_actions = await self._get_related_actions(action, context)
        
        return AssistantResponse(
            message=message,
            suggested_actions=[action] + related_actions,
            context_used=self._summarize_context(context),
            confidence=0.9,
        )
    
    async def _get_related_actions(
        self,
        primary_action: AssistantAction,
        context: Dict[str, Any],
    ) -> List[AssistantAction]:
        """Get related actions to suggest"""
        related = []
        
        # After blocking, suggest generating a report
        if primary_action.intent == ActionIntent.BLOCK_DOMAIN:
            related.append(AssistantAction(
                intent=ActionIntent.GENERATE_REPORT,
                parameters={'type': 'incident'},
                description="Generate incident report",
                requires_confirmation=False,
            ))
        
        # After scanning, suggest deep scan if threats found
        if primary_action.intent == ActionIntent.SCAN_URL:
            related.append(AssistantAction(
                intent=ActionIntent.DEEP_SCAN,
                parameters={},
                description="Perform deep scan for thorough analysis",
                requires_confirmation=True,
            ))
        
        return related
    
    def _extract_suggested_actions(self, ai_response: str) -> List[AssistantAction]:
        """Extract actionable suggestions from AI response"""
        actions = []
        
        # Look for common action phrases
        if 'block' in ai_response.lower() and 'domain' in ai_response.lower():
            actions.append(AssistantAction(
                intent=ActionIntent.BLOCK_DOMAIN,
                parameters={},
                description="Block the suspicious domain",
                requires_confirmation=True,
            ))
        
        if 'scan' in ai_response.lower():
            actions.append(AssistantAction(
                intent=ActionIntent.SCAN_URL,
                parameters={},
                description="Scan for threats",
                requires_confirmation=False,
            ))
        
        if 'report' in ai_response.lower():
            actions.append(AssistantAction(
                intent=ActionIntent.GENERATE_REPORT,
                parameters={},
                description="Generate security report",
                requires_confirmation=False,
            ))
        
        return actions[:3]  # Max 3 suggestions
    
    def get_conversation_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent conversation history"""
        return self.conversation_history[-limit:]


# Global instance
operational_assistant = OperationalAssistant()
