"""
Executor Module - Task Execution with Security and Rate Limiting
Production-ready execution layer with safety controls.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable, Set
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict
import time

logger = logging.getLogger(__name__)


class RateLimitStrategy(Enum):
    """Rate limiting strategies"""
    FIXED_WINDOW = "fixed_window"
    SLIDING_WINDOW = "sliding_window"
    TOKEN_BUCKET = "token_bucket"


@dataclass
class RateLimitConfig:
    """Rate limit configuration"""
    requests_per_second: float = 10.0
    requests_per_minute: float = 100.0
    burst_size: int = 20
    strategy: RateLimitStrategy = RateLimitStrategy.TOKEN_BUCKET


@dataclass
class ExecutionResult:
    """Result from task execution"""
    success: bool
    data: Any
    error: Optional[str] = None
    execution_time: float = 0.0
    retries: int = 0
    rate_limited: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'success': self.success,
            'data': self.data,
            'error': self.error,
            'execution_time': self.execution_time,
            'retries': self.retries,
            'rate_limited': self.rate_limited,
            'metadata': self.metadata,
        }


class RateLimiter:
    """Token bucket rate limiter"""
    
    def __init__(self, config: RateLimitConfig):
        self.config = config
        self.tokens = config.burst_size
        self.last_update = time.time()
        self._lock = asyncio.Lock()
    
    async def acquire(self) -> bool:
        """Acquire a token, returns True if allowed"""
        async with self._lock:
            now = time.time()
            elapsed = now - self.last_update
            self.last_update = now
            
            # Add tokens based on time elapsed
            new_tokens = elapsed * self.config.requests_per_second
            self.tokens = min(self.config.burst_size, self.tokens + new_tokens)
            
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            
            return False
    
    async def wait_for_token(self, timeout: float = 30.0) -> bool:
        """Wait until a token is available"""
        start = time.time()
        
        while time.time() - start < timeout:
            if await self.acquire():
                return True
            await asyncio.sleep(0.1)
        
        return False


class SecurityPolicy:
    """Security policy for task execution"""
    
    def __init__(self):
        # Allowed task types
        self.allowed_task_types: Set[str] = {
            'analysis', 'monitoring', 'reporting', 'automation',
            'network_scan', 'website_analysis', 'threat_detection',
            'data_analysis', 'system_monitor',
        }
        
        # Blocked domains/IPs for network operations
        self.blocked_targets: Set[str] = {
            'localhost', '127.0.0.1', '0.0.0.0',
            '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16',
        }
        
        # Max execution time per task type
        self.max_execution_times: Dict[str, int] = {
            'network_scan': 300,
            'website_analysis': 60,
            'analysis': 120,
            'default': 60,
        }
        
        # Max concurrent tasks per type
        self.max_concurrent: Dict[str, int] = {
            'network_scan': 5,
            'website_analysis': 10,
            'default': 20,
        }
        
        # Dangerous patterns to block
        self.dangerous_patterns: List[str] = [
            'rm -rf', 'format c:', 'del /f',
            '; drop table', '| nc ', '&& curl',
        ]
    
    def is_task_allowed(self, task_type: str) -> tuple[bool, Optional[str]]:
        """Check if task type is allowed"""
        if task_type not in self.allowed_task_types:
            return False, f"Task type not allowed: {task_type}"
        return True, None
    
    def is_target_allowed(self, target: str) -> tuple[bool, Optional[str]]:
        """Check if target is allowed for network operations"""
        target_lower = target.lower()
        
        for blocked in self.blocked_targets:
            if blocked in target_lower:
                return False, f"Target is blocked: {target}"
        
        return True, None
    
    def check_dangerous_content(self, content: str) -> tuple[bool, Optional[str]]:
        """Check for dangerous patterns in content"""
        content_lower = content.lower()
        
        for pattern in self.dangerous_patterns:
            if pattern in content_lower:
                return False, f"Dangerous pattern detected: {pattern}"
        
        return True, None
    
    def get_max_execution_time(self, task_type: str) -> int:
        """Get max execution time for task type"""
        return self.max_execution_times.get(
            task_type,
            self.max_execution_times['default']
        )
    
    def get_max_concurrent(self, task_type: str) -> int:
        """Get max concurrent tasks for type"""
        return self.max_concurrent.get(
            task_type,
            self.max_concurrent['default']
        )


class CircuitBreaker:
    """Circuit breaker for fault tolerance"""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        half_open_requests: int = 3,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_requests = half_open_requests
        
        self.failures = 0
        self.successes = 0
        self.state = "closed"  # closed, open, half_open
        self.last_failure_time: Optional[datetime] = None
        self.half_open_count = 0
    
    def can_execute(self) -> bool:
        """Check if execution is allowed"""
        if self.state == "closed":
            return True
        
        if self.state == "open":
            # Check if recovery timeout has passed
            if self.last_failure_time:
                elapsed = (datetime.utcnow() - self.last_failure_time).total_seconds()
                if elapsed >= self.recovery_timeout:
                    self.state = "half_open"
                    self.half_open_count = 0
                    return True
            return False
        
        if self.state == "half_open":
            if self.half_open_count < self.half_open_requests:
                return True
            return False
        
        return True
    
    def record_success(self):
        """Record a successful execution"""
        self.successes += 1
        
        if self.state == "half_open":
            self.half_open_count += 1
            if self.half_open_count >= self.half_open_requests:
                # Recovery successful
                self.state = "closed"
                self.failures = 0
        
        if self.state == "closed":
            # Reset failure count on success
            self.failures = 0
    
    def record_failure(self):
        """Record a failed execution"""
        self.failures += 1
        self.last_failure_time = datetime.utcnow()
        
        if self.state == "half_open":
            # Recovery failed, open circuit again
            self.state = "open"
            return
        
        if self.failures >= self.failure_threshold:
            self.state = "open"
    
    def get_state(self) -> Dict[str, Any]:
        return {
            'state': self.state,
            'failures': self.failures,
            'successes': self.successes,
            'last_failure': self.last_failure_time.isoformat() if self.last_failure_time else None,
        }


class TaskExecutor:
    """
    Secure Task Executor with Rate Limiting and Safety Controls
    
    Features:
    - Rate limiting
    - Security policies
    - Circuit breaker
    - Retry logic
    - Timeout enforcement
    """
    
    def __init__(
        self,
        rate_limit_config: Optional[RateLimitConfig] = None,
        security_policy: Optional[SecurityPolicy] = None,
    ):
        self.rate_limiter = RateLimiter(rate_limit_config or RateLimitConfig())
        self.security = security_policy or SecurityPolicy()
        
        # Circuit breakers per task type
        self.circuit_breakers: Dict[str, CircuitBreaker] = defaultdict(CircuitBreaker)
        
        # Execution tracking
        self.active_executions: Dict[str, int] = defaultdict(int)
        self.execution_history: List[Dict[str, Any]] = []
        
        # Retry configuration
        self.max_retries = 3
        self.retry_delay = 1.0
        self.retry_multiplier = 2.0
        
        logger.info("⚡ Task Executor initialized")
    
    async def execute(
        self,
        task_type: str,
        task_fn: Callable,
        parameters: Dict[str, Any],
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        """Execute a task with all safety controls"""
        start_time = time.time()
        retries = 0
        
        # Security check - task type
        allowed, error = self.security.is_task_allowed(task_type)
        if not allowed:
            return ExecutionResult(
                success=False,
                data=None,
                error=error,
                execution_time=0,
            )
        
        # Security check - parameters
        if 'target' in parameters:
            allowed, error = self.security.is_target_allowed(parameters['target'])
            if not allowed:
                return ExecutionResult(
                    success=False,
                    data=None,
                    error=error,
                    execution_time=0,
                )
        
        # Check for dangerous content in string parameters
        for key, value in parameters.items():
            if isinstance(value, str):
                safe, error = self.security.check_dangerous_content(value)
                if not safe:
                    return ExecutionResult(
                        success=False,
                        data=None,
                        error=error,
                        execution_time=0,
                    )
        
        # Circuit breaker check
        breaker = self.circuit_breakers[task_type]
        if not breaker.can_execute():
            return ExecutionResult(
                success=False,
                data=None,
                error="Circuit breaker is open - too many recent failures",
                execution_time=0,
                metadata={'circuit_state': breaker.get_state()},
            )
        
        # Concurrency limit check
        max_concurrent = self.security.get_max_concurrent(task_type)
        if self.active_executions[task_type] >= max_concurrent:
            return ExecutionResult(
                success=False,
                data=None,
                error=f"Max concurrent executions reached for {task_type}",
                execution_time=0,
            )
        
        # Rate limiting
        if not await self.rate_limiter.acquire():
            # Wait for token
            if not await self.rate_limiter.wait_for_token(timeout=5.0):
                return ExecutionResult(
                    success=False,
                    data=None,
                    error="Rate limit exceeded",
                    execution_time=time.time() - start_time,
                    rate_limited=True,
                )
        
        # Get timeout
        exec_timeout = timeout or self.security.get_max_execution_time(task_type)
        
        # Execute with retries
        self.active_executions[task_type] += 1
        
        try:
            while retries <= self.max_retries:
                try:
                    # Execute with timeout
                    result = await asyncio.wait_for(
                        task_fn(**parameters),
                        timeout=exec_timeout
                    )
                    
                    # Record success
                    breaker.record_success()
                    
                    execution_time = time.time() - start_time
                    
                    # Record history
                    self._record_execution(task_type, True, execution_time, retries)
                    
                    return ExecutionResult(
                        success=True,
                        data=result,
                        execution_time=execution_time,
                        retries=retries,
                    )
                    
                except asyncio.TimeoutError:
                    breaker.record_failure()
                    return ExecutionResult(
                        success=False,
                        data=None,
                        error=f"Task timed out after {exec_timeout}s",
                        execution_time=time.time() - start_time,
                        retries=retries,
                    )
                    
                except Exception as e:
                    retries += 1
                    
                    if retries > self.max_retries:
                        breaker.record_failure()
                        return ExecutionResult(
                            success=False,
                            data=None,
                            error=str(e),
                            execution_time=time.time() - start_time,
                            retries=retries - 1,
                        )
                    
                    # Exponential backoff
                    delay = self.retry_delay * (self.retry_multiplier ** (retries - 1))
                    await asyncio.sleep(delay)
        
        finally:
            self.active_executions[task_type] -= 1
        
        return ExecutionResult(
            success=False,
            data=None,
            error="Unexpected execution error",
            execution_time=time.time() - start_time,
        )
    
    def _record_execution(
        self,
        task_type: str,
        success: bool,
        execution_time: float,
        retries: int,
    ):
        """Record execution in history"""
        self.execution_history.append({
            'task_type': task_type,
            'success': success,
            'execution_time': execution_time,
            'retries': retries,
            'timestamp': datetime.utcnow().isoformat(),
        })
        
        # Limit history size
        if len(self.execution_history) > 10000:
            self.execution_history = self.execution_history[-5000:]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get execution statistics"""
        if not self.execution_history:
            return {'total_executions': 0}
        
        total = len(self.execution_history)
        successes = sum(1 for e in self.execution_history if e['success'])
        
        return {
            'total_executions': total,
            'success_count': successes,
            'failure_count': total - successes,
            'success_rate': (successes / total) * 100 if total > 0 else 0,
            'avg_execution_time': sum(e['execution_time'] for e in self.execution_history) / total,
            'avg_retries': sum(e['retries'] for e in self.execution_history) / total,
            'active_executions': dict(self.active_executions),
            'circuit_breakers': {
                k: v.get_state() for k, v in self.circuit_breakers.items()
            },
        }
    
    def get_status(self) -> Dict[str, Any]:
        """Get executor status"""
        return {
            'rate_limit_tokens': self.rate_limiter.tokens,
            'active_executions': dict(self.active_executions),
            'circuit_breakers': {
                k: v.get_state() for k, v in self.circuit_breakers.items()
            },
            'allowed_task_types': list(self.security.allowed_task_types),
            'stats': self.get_stats(),
        }
