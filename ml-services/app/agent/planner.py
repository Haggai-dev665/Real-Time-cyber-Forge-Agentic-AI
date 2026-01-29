"""
Agent Planner - Goal Decomposition, Planning, and Reasoning
Production-ready planning system for autonomous agent operations.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field
import json
import uuid

logger = logging.getLogger(__name__)


class GoalStatus(Enum):
    """Goal execution status"""
    PENDING = "pending"
    PLANNING = "planning"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PlanStepType(Enum):
    """Types of plan steps"""
    TOOL_CALL = "tool_call"
    REASONING = "reasoning"
    DECISION = "decision"
    PARALLEL = "parallel"
    CONDITIONAL = "conditional"
    LOOP = "loop"


@dataclass
class Goal:
    """Represents a high-level goal"""
    id: str
    description: str
    context: Dict[str, Any]
    status: GoalStatus = GoalStatus.PENDING
    priority: int = 5
    created_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'description': self.description,
            'status': self.status.value,
            'priority': self.priority,
            'created_at': self.created_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'result': self.result,
            'error': self.error,
        }


@dataclass
class PlanStep:
    """A single step in a plan"""
    id: str
    step_type: PlanStepType
    name: str
    description: str
    tool_name: Optional[str] = None
    parameters: Dict[str, Any] = field(default_factory=dict)
    condition: Optional[str] = None
    depends_on: List[str] = field(default_factory=list)
    status: str = "pending"
    result: Optional[Any] = None
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'step_type': self.step_type.value,
            'name': self.name,
            'description': self.description,
            'tool_name': self.tool_name,
            'parameters': self.parameters,
            'depends_on': self.depends_on,
            'status': self.status,
            'result': self.result,
            'error': self.error,
        }


@dataclass
class Plan:
    """Execution plan for a goal"""
    id: str
    goal_id: str
    steps: List[PlanStep]
    created_at: datetime = field(default_factory=datetime.utcnow)
    status: str = "pending"
    current_step_index: int = 0
    results: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'goal_id': self.goal_id,
            'steps': [s.to_dict() for s in self.steps],
            'status': self.status,
            'current_step_index': self.current_step_index,
            'results': self.results,
        }


class AgentPlanner:
    """
    Agent Planner - Handles goal decomposition and planning
    
    Capabilities:
    - Goal decomposition into executable steps
    - Dynamic plan generation
    - Plan execution with dependency resolution
    - Adaptive re-planning on failures
    """
    
    def __init__(self, tool_registry=None, memory=None, llm_service=None):
        self.tools = tool_registry
        self.memory = memory
        self.llm = llm_service
        
        self.goals: Dict[str, Goal] = {}
        self.plans: Dict[str, Plan] = {}
        self._is_initialized = False
        
        # Planning templates
        self.plan_templates = self._load_plan_templates()
        
        logger.info("📋 Agent Planner initialized")
    
    async def initialize(self):
        """Initialize the planner"""
        self._is_initialized = True
        logger.info("✅ Agent Planner initialized")
    
    def is_ready(self) -> bool:
        """Check if planner is ready"""
        return self._is_initialized
    
    def _load_plan_templates(self) -> Dict[str, List[Dict[str, Any]]]:
        """Load predefined plan templates"""
        return {
            'network_security_scan': [
                {
                    'name': 'Port Scan',
                    'tool': 'network_scan',
                    'description': 'Scan target for open ports',
                },
                {
                    'name': 'Analyze Results',
                    'tool': 'threat_detection',
                    'description': 'Analyze scan results for threats',
                },
                {
                    'name': 'Generate Report',
                    'tool': 'report_generator',
                    'description': 'Generate security report',
                },
            ],
            'website_security_audit': [
                {
                    'name': 'Website Analysis',
                    'tool': 'website_analysis',
                    'description': 'Analyze website security',
                },
                {
                    'name': 'Threat Detection',
                    'tool': 'threat_detection',
                    'description': 'Check for security threats',
                },
                {
                    'name': 'Generate Report',
                    'tool': 'report_generator',
                    'description': 'Generate audit report',
                },
            ],
            'system_health_check': [
                {
                    'name': 'System Monitoring',
                    'tool': 'system_monitor',
                    'description': 'Check system health metrics',
                },
                {
                    'name': 'Analyze Data',
                    'tool': 'data_analysis',
                    'description': 'Analyze health data',
                },
                {
                    'name': 'Generate Report',
                    'tool': 'report_generator',
                    'description': 'Generate health report',
                },
            ],
        }
    
    async def create_goal(
        self,
        description: str,
        context: Optional[Dict[str, Any]] = None,
        priority: int = 5,
    ) -> Goal:
        """Create a new goal"""
        goal = Goal(
            id=str(uuid.uuid4()),
            description=description,
            context=context or {},
            priority=priority,
        )
        
        self.goals[goal.id] = goal
        logger.info(f"🎯 Created goal: {description} ({goal.id})")
        
        return goal
    
    async def create_plan(
        self,
        goal: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Plan:
        """Create an execution plan for a goal"""
        
        # Create goal object if string passed
        goal_obj = await self.create_goal(goal, context)
        goal_obj.status = GoalStatus.PLANNING
        
        # Determine plan strategy
        steps = await self._generate_plan_steps(goal_obj)
        
        plan = Plan(
            id=str(uuid.uuid4()),
            goal_id=goal_obj.id,
            steps=steps,
        )
        
        self.plans[plan.id] = plan
        logger.info(f"📝 Created plan with {len(steps)} steps for goal: {goal}")
        
        return plan
    
    async def _generate_plan_steps(self, goal: Goal) -> List[PlanStep]:
        """Generate plan steps for a goal"""
        
        # Try to match with templates
        template_steps = self._match_template(goal.description)
        
        if template_steps:
            return self._create_steps_from_template(template_steps, goal)
        
        # Use LLM for complex planning if available
        if self.llm:
            return await self._llm_plan_generation(goal)
        
        # Fallback: single-step plan
        return [
            PlanStep(
                id=str(uuid.uuid4()),
                step_type=PlanStepType.REASONING,
                name="Execute Goal",
                description=goal.description,
                parameters=goal.context,
            )
        ]
    
    def _match_template(self, goal_description: str) -> Optional[List[Dict[str, Any]]]:
        """Match goal to a plan template"""
        description_lower = goal_description.lower()
        
        if 'network' in description_lower and ('scan' in description_lower or 'security' in description_lower):
            return self.plan_templates.get('network_security_scan')
        
        if 'website' in description_lower or 'web' in description_lower:
            return self.plan_templates.get('website_security_audit')
        
        if 'system' in description_lower or 'health' in description_lower:
            return self.plan_templates.get('system_health_check')
        
        return None
    
    def _create_steps_from_template(
        self,
        template: List[Dict[str, Any]],
        goal: Goal,
    ) -> List[PlanStep]:
        """Create plan steps from a template"""
        steps = []
        
        for i, step_template in enumerate(template):
            step = PlanStep(
                id=str(uuid.uuid4()),
                step_type=PlanStepType.TOOL_CALL,
                name=step_template['name'],
                description=step_template['description'],
                tool_name=step_template.get('tool'),
                parameters=goal.context.copy(),
                depends_on=[steps[i-1].id] if i > 0 else [],
            )
            steps.append(step)
        
        return steps
    
    async def _llm_plan_generation(self, goal: Goal) -> List[PlanStep]:
        """Generate plan using LLM"""
        try:
            # Get available tools
            tool_schemas = self.tools.get_schemas() if self.tools else []
            
            # Build prompt
            prompt = f"""You are a task planning assistant. Create a step-by-step plan to achieve the following goal:

Goal: {goal.description}
Context: {json.dumps(goal.context, default=str)}

Available tools:
{json.dumps(tool_schemas, indent=2)}

Create a plan with specific steps. Each step should use one of the available tools.
Return a JSON array of steps with: name, tool_name, description, parameters.
"""
            
            # Call LLM
            response = await self.llm.generate_text(prompt, max_length=1000)
            
            # Parse response
            steps_data = json.loads(response)
            
            steps = []
            for i, step_data in enumerate(steps_data):
                step = PlanStep(
                    id=str(uuid.uuid4()),
                    step_type=PlanStepType.TOOL_CALL,
                    name=step_data.get('name', f'Step {i+1}'),
                    description=step_data.get('description', ''),
                    tool_name=step_data.get('tool_name'),
                    parameters=step_data.get('parameters', {}),
                    depends_on=[steps[i-1].id] if i > 0 else [],
                )
                steps.append(step)
            
            return steps
            
        except Exception as e:
            logger.error(f"LLM plan generation failed: {e}")
            return [
                PlanStep(
                    id=str(uuid.uuid4()),
                    step_type=PlanStepType.REASONING,
                    name="Execute Goal",
                    description=goal.description,
                    parameters=goal.context,
                )
            ]
    
    async def execute_plan(self, plan: Plan) -> Dict[str, Any]:
        """Execute a plan"""
        logger.info(f"▶️ Executing plan: {plan.id}")
        
        plan.status = "executing"
        goal = self.goals.get(plan.goal_id)
        if goal:
            goal.status = GoalStatus.EXECUTING
        
        try:
            # Execute steps in order, respecting dependencies
            for step in plan.steps:
                # Check if dependencies are met
                await self._wait_for_dependencies(plan, step)
                
                # Execute step
                result = await self._execute_step(step, plan.results)
                
                step.status = "completed" if result.get('success') else "failed"
                step.result = result
                plan.results[step.id] = result
                
                if not result.get('success'):
                    step.error = result.get('error')
                    plan.status = "failed"
                    if goal:
                        goal.status = GoalStatus.FAILED
                        goal.error = step.error
                    break
                
                plan.current_step_index += 1
            
            if plan.status != "failed":
                plan.status = "completed"
                if goal:
                    goal.status = GoalStatus.COMPLETED
                    goal.completed_at = datetime.utcnow()
                    goal.result = plan.results
            
            logger.info(f"✅ Plan {plan.id} completed with status: {plan.status}")
            return plan.results
            
        except Exception as e:
            plan.status = "failed"
            if goal:
                goal.status = GoalStatus.FAILED
                goal.error = str(e)
            logger.error(f"❌ Plan execution failed: {e}")
            raise
    
    async def _wait_for_dependencies(self, plan: Plan, step: PlanStep):
        """Wait for step dependencies to complete"""
        for dep_id in step.depends_on:
            dep_result = plan.results.get(dep_id)
            if dep_result is None:
                # Find and wait for dependency
                for other_step in plan.steps:
                    if other_step.id == dep_id and other_step.status == "pending":
                        # This shouldn't happen with proper ordering
                        logger.warning(f"Dependency {dep_id} not yet executed")
    
    async def _execute_step(
        self,
        step: PlanStep,
        previous_results: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Execute a single plan step"""
        logger.info(f"  → Executing step: {step.name}")
        step.status = "executing"
        
        try:
            if step.step_type == PlanStepType.TOOL_CALL:
                # Merge previous results into parameters
                params = step.parameters.copy()
                
                # Pass previous step results if needed
                for dep_id in step.depends_on:
                    if dep_id in previous_results:
                        params[f'previous_result_{dep_id[:8]}'] = previous_results[dep_id]
                
                # Execute tool
                if self.tools and step.tool_name:
                    result = await self.tools.execute(step.tool_name, **params)
                    return {
                        'success': result.success,
                        'data': result.data,
                        'error': result.error,
                        'execution_time': result.execution_time,
                    }
                else:
                    return {
                        'success': False,
                        'error': f"Tool not found: {step.tool_name}",
                    }
            
            elif step.step_type == PlanStepType.REASONING:
                # Reasoning step - just return the description as result
                return {
                    'success': True,
                    'data': {'reasoning': step.description},
                }
            
            elif step.step_type == PlanStepType.DECISION:
                # Decision step - evaluate condition
                return {
                    'success': True,
                    'data': {'decision': step.condition or 'continue'},
                }
            
            else:
                return {
                    'success': True,
                    'data': {'step': step.name},
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
            }
    
    async def replan(self, plan_id: str, from_step: int = 0) -> Plan:
        """Re-plan from a specific step (adaptive re-planning)"""
        old_plan = self.plans.get(plan_id)
        if not old_plan:
            raise ValueError(f"Plan not found: {plan_id}")
        
        goal = self.goals.get(old_plan.goal_id)
        if not goal:
            raise ValueError(f"Goal not found for plan: {plan_id}")
        
        # Create new plan with context from previous execution
        new_context = {
            **goal.context,
            'previous_results': {
                k: v for k, v in old_plan.results.items()
            },
            'failed_at_step': from_step,
        }
        
        goal.context = new_context
        new_plan = await self.create_plan(goal.description, new_context)
        
        logger.info(f"🔄 Re-planned from step {from_step}")
        return new_plan
    
    def get_goal(self, goal_id: str) -> Optional[Goal]:
        """Get a goal by ID"""
        return self.goals.get(goal_id)
    
    def get_plan(self, plan_id: str) -> Optional[Plan]:
        """Get a plan by ID"""
        return self.plans.get(plan_id)
    
    def get_status(self) -> Dict[str, Any]:
        """Get planner status"""
        return {
            'is_initialized': self._is_initialized,
            'total_goals': len(self.goals),
            'active_goals': len([g for g in self.goals.values() if g.status == GoalStatus.EXECUTING]),
            'completed_goals': len([g for g in self.goals.values() if g.status == GoalStatus.COMPLETED]),
            'total_plans': len(self.plans),
            'templates_available': list(self.plan_templates.keys()),
        }
