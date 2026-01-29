"""
Agent Observability - Logging, Metrics, Tracing, and Health Monitoring
Production-ready observability stack for autonomous agent operations.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from collections import deque
import json
import time

logger = logging.getLogger(__name__)


class MetricType(Enum):
    """Types of metrics"""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    SUMMARY = "summary"


class AlertSeverity(Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class Metric:
    """A single metric data point"""
    name: str
    type: MetricType
    value: float
    labels: Dict[str, str]
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'name': self.name,
            'type': self.type.value,
            'value': self.value,
            'labels': self.labels,
            'timestamp': self.timestamp.isoformat(),
        }


@dataclass
class Span:
    """A trace span for distributed tracing"""
    trace_id: str
    span_id: str
    name: str
    parent_span_id: Optional[str] = None
    start_time: datetime = field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    duration_ms: float = 0.0
    status: str = "ok"
    attributes: Dict[str, Any] = field(default_factory=dict)
    events: List[Dict[str, Any]] = field(default_factory=list)
    
    def end(self):
        self.end_time = datetime.utcnow()
        self.duration_ms = (self.end_time - self.start_time).total_seconds() * 1000
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'trace_id': self.trace_id,
            'span_id': self.span_id,
            'name': self.name,
            'parent_span_id': self.parent_span_id,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'duration_ms': self.duration_ms,
            'status': self.status,
            'attributes': self.attributes,
            'events': self.events,
        }


@dataclass
class Alert:
    """An alert/notification"""
    id: str
    severity: AlertSeverity
    title: str
    message: str
    source: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    acknowledged: bool = False
    resolved: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'severity': self.severity.value,
            'title': self.title,
            'message': self.message,
            'source': self.source,
            'timestamp': self.timestamp.isoformat(),
            'acknowledged': self.acknowledged,
            'resolved': self.resolved,
            'metadata': self.metadata,
        }


@dataclass
class AgentMetrics:
    """Aggregated agent metrics"""
    tasks_total: int = 0
    tasks_completed: int = 0
    tasks_failed: int = 0
    tasks_active: int = 0
    avg_task_duration: float = 0.0
    uptime_seconds: float = 0.0
    memory_usage_mb: float = 0.0
    error_rate: float = 0.0
    last_updated: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'tasks_total': self.tasks_total,
            'tasks_completed': self.tasks_completed,
            'tasks_failed': self.tasks_failed,
            'tasks_active': self.tasks_active,
            'avg_task_duration': self.avg_task_duration,
            'uptime_seconds': self.uptime_seconds,
            'memory_usage_mb': self.memory_usage_mb,
            'error_rate': self.error_rate,
            'last_updated': self.last_updated.isoformat(),
        }


class AgentObserver:
    """
    Agent Observability System
    
    Features:
    - Metrics collection and aggregation
    - Distributed tracing
    - Health monitoring
    - Alerting
    - Log aggregation
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Metrics storage
        self.metrics: Dict[str, deque] = {}
        self.metric_configs: Dict[str, Dict[str, Any]] = {}
        self.max_metrics_per_name = 10000
        
        # Tracing
        self.traces: Dict[str, List[Span]] = {}
        self.active_spans: Dict[str, Span] = {}
        self.max_traces = 1000
        
        # Alerts
        self.alerts: deque = deque(maxlen=1000)
        self.alert_rules: List[Dict[str, Any]] = []
        self.alert_handlers: List[Callable] = []
        
        # Health
        self.health_checks: Dict[str, Callable] = {}
        self.last_health: Dict[str, Any] = {}
        
        # Logs
        self.logs: deque = deque(maxlen=10000)
        
        self._is_running = False
        self._background_tasks: List[asyncio.Task] = []
        
        # Aggregated metrics
        self.agent_metrics = AgentMetrics()
        
        logger.info("👁️ Agent Observer initialized")
    
    async def start(self):
        """Start the observer"""
        self._is_running = True
        
        # Start background workers
        self._background_tasks.append(
            asyncio.create_task(self._metrics_aggregator())
        )
        self._background_tasks.append(
            asyncio.create_task(self._health_checker())
        )
        self._background_tasks.append(
            asyncio.create_task(self._alert_evaluator())
        )
        
        logger.info("✅ Agent Observer started")
    
    async def stop(self):
        """Stop the observer"""
        self._is_running = False
        
        for task in self._background_tasks:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        
        self._background_tasks.clear()
        logger.info("🛑 Agent Observer stopped")
    
    # =========================================
    # METRICS
    # =========================================
    
    def register_metric(
        self,
        name: str,
        metric_type: MetricType,
        description: str = "",
        labels: Optional[List[str]] = None,
    ):
        """Register a new metric"""
        self.metric_configs[name] = {
            'type': metric_type,
            'description': description,
            'labels': labels or [],
        }
        self.metrics[name] = deque(maxlen=self.max_metrics_per_name)
        logger.debug(f"📊 Registered metric: {name}")
    
    def record_metric(
        self,
        name: str,
        value: float,
        labels: Optional[Dict[str, str]] = None,
    ):
        """Record a metric value"""
        if name not in self.metrics:
            # Auto-register as gauge
            self.register_metric(name, MetricType.GAUGE)
        
        metric = Metric(
            name=name,
            type=self.metric_configs.get(name, {}).get('type', MetricType.GAUGE),
            value=value,
            labels=labels or {},
        )
        
        self.metrics[name].append(metric)
    
    def increment_counter(self, name: str, value: float = 1.0, labels: Optional[Dict[str, str]] = None):
        """Increment a counter metric"""
        if name not in self.metrics:
            self.register_metric(name, MetricType.COUNTER)
        
        self.record_metric(name, value, labels)
    
    async def record_metrics(self, metrics_dict: Dict[str, Any]):
        """Record multiple metrics from a dictionary"""
        for name, value in metrics_dict.items():
            if isinstance(value, (int, float)):
                self.record_metric(name, value)
    
    def get_metrics(
        self,
        name: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> List[Metric]:
        """Get recorded metrics"""
        if name:
            metrics = list(self.metrics.get(name, []))
        else:
            metrics = []
            for metric_list in self.metrics.values():
                metrics.extend(metric_list)
        
        if since:
            metrics = [m for m in metrics if m.timestamp >= since]
        
        return metrics
    
    def get_metric_summary(self, name: str) -> Dict[str, Any]:
        """Get summary statistics for a metric"""
        metrics = list(self.metrics.get(name, []))
        
        if not metrics:
            return {'count': 0}
        
        values = [m.value for m in metrics]
        
        return {
            'count': len(values),
            'min': min(values),
            'max': max(values),
            'avg': sum(values) / len(values),
            'latest': values[-1],
            'latest_timestamp': metrics[-1].timestamp.isoformat(),
        }
    
    async def _metrics_aggregator(self):
        """Background task to aggregate metrics"""
        while self._is_running:
            try:
                await asyncio.sleep(10)
                
                # Update aggregated metrics
                self.agent_metrics.last_updated = datetime.utcnow()
                
                # Calculate error rate
                if self.agent_metrics.tasks_total > 0:
                    self.agent_metrics.error_rate = (
                        self.agent_metrics.tasks_failed / self.agent_metrics.tasks_total
                    ) * 100
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Metrics aggregation error: {e}")
    
    # =========================================
    # TRACING
    # =========================================
    
    def start_span(
        self,
        name: str,
        trace_id: Optional[str] = None,
        parent_span_id: Optional[str] = None,
        attributes: Optional[Dict[str, Any]] = None,
    ) -> Span:
        """Start a new trace span"""
        import uuid
        
        if not trace_id:
            trace_id = str(uuid.uuid4())
        
        span = Span(
            trace_id=trace_id,
            span_id=str(uuid.uuid4()),
            name=name,
            parent_span_id=parent_span_id,
            attributes=attributes or {},
        )
        
        # Store active span
        self.active_spans[span.span_id] = span
        
        # Initialize trace if needed
        if trace_id not in self.traces:
            self.traces[trace_id] = []
        
        return span
    
    def end_span(self, span: Span, status: str = "ok"):
        """End a trace span"""
        span.status = status
        span.end()
        
        # Move from active to completed
        if span.span_id in self.active_spans:
            del self.active_spans[span.span_id]
        
        # Add to trace
        if span.trace_id in self.traces:
            self.traces[span.trace_id].append(span)
        
        # Cleanup old traces
        if len(self.traces) > self.max_traces:
            oldest_trace_id = next(iter(self.traces))
            del self.traces[oldest_trace_id]
    
    def add_span_event(self, span: Span, name: str, attributes: Optional[Dict[str, Any]] = None):
        """Add an event to a span"""
        span.events.append({
            'name': name,
            'timestamp': datetime.utcnow().isoformat(),
            'attributes': attributes or {},
        })
    
    def get_trace(self, trace_id: str) -> List[Span]:
        """Get all spans for a trace"""
        return self.traces.get(trace_id, [])
    
    # =========================================
    # HEALTH
    # =========================================
    
    def register_health_check(self, name: str, check_fn: Callable):
        """Register a health check function"""
        self.health_checks[name] = check_fn
        logger.debug(f"💓 Registered health check: {name}")
    
    async def run_health_checks(self) -> Dict[str, Any]:
        """Run all health checks"""
        results = {
            'status': 'healthy',
            'checks': {},
            'timestamp': datetime.utcnow().isoformat(),
        }
        
        for name, check_fn in self.health_checks.items():
            try:
                if asyncio.iscoroutinefunction(check_fn):
                    check_result = await check_fn()
                else:
                    check_result = check_fn()
                
                results['checks'][name] = {
                    'status': 'healthy' if check_result else 'unhealthy',
                    'result': check_result,
                }
                
                if not check_result:
                    results['status'] = 'degraded'
                    
            except Exception as e:
                results['checks'][name] = {
                    'status': 'unhealthy',
                    'error': str(e),
                }
                results['status'] = 'unhealthy'
        
        self.last_health = results
        return results
    
    async def record_health(self, health_data: Dict[str, Any]):
        """Record health status"""
        self.last_health = {
            **health_data,
            'timestamp': datetime.utcnow().isoformat(),
        }
    
    async def _health_checker(self):
        """Background health check loop"""
        while self._is_running:
            try:
                await asyncio.sleep(30)
                await self.run_health_checks()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health check error: {e}")
    
    # =========================================
    # ALERTING
    # =========================================
    
    def add_alert_rule(
        self,
        name: str,
        metric_name: str,
        condition: str,
        threshold: float,
        severity: AlertSeverity,
        message: str,
    ):
        """Add an alert rule"""
        self.alert_rules.append({
            'name': name,
            'metric_name': metric_name,
            'condition': condition,  # 'gt', 'lt', 'eq', 'gte', 'lte'
            'threshold': threshold,
            'severity': severity,
            'message': message,
        })
        logger.info(f"🔔 Added alert rule: {name}")
    
    def add_alert_handler(self, handler: Callable):
        """Add an alert handler function"""
        self.alert_handlers.append(handler)
    
    async def trigger_alert(
        self,
        severity: AlertSeverity,
        title: str,
        message: str,
        source: str = "agent",
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Trigger an alert"""
        import uuid
        
        alert = Alert(
            id=str(uuid.uuid4()),
            severity=severity,
            title=title,
            message=message,
            source=source,
            metadata=metadata or {},
        )
        
        self.alerts.append(alert)
        
        # Call handlers
        for handler in self.alert_handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(alert)
                else:
                    handler(alert)
            except Exception as e:
                logger.error(f"Alert handler error: {e}")
        
        logger.warning(f"🚨 Alert triggered: [{severity.value}] {title}")
    
    async def _alert_evaluator(self):
        """Background alert evaluation loop"""
        while self._is_running:
            try:
                await asyncio.sleep(60)
                
                for rule in self.alert_rules:
                    await self._evaluate_alert_rule(rule)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Alert evaluation error: {e}")
    
    async def _evaluate_alert_rule(self, rule: Dict[str, Any]):
        """Evaluate a single alert rule"""
        metrics = self.get_metrics(rule['metric_name'])
        if not metrics:
            return
        
        latest_value = metrics[-1].value
        threshold = rule['threshold']
        condition = rule['condition']
        
        triggered = False
        if condition == 'gt' and latest_value > threshold:
            triggered = True
        elif condition == 'lt' and latest_value < threshold:
            triggered = True
        elif condition == 'eq' and latest_value == threshold:
            triggered = True
        elif condition == 'gte' and latest_value >= threshold:
            triggered = True
        elif condition == 'lte' and latest_value <= threshold:
            triggered = True
        
        if triggered:
            await self.trigger_alert(
                severity=rule['severity'],
                title=rule['name'],
                message=rule['message'].format(value=latest_value, threshold=threshold),
                source='alert_rule',
                metadata={'rule': rule, 'value': latest_value},
            )
    
    def get_alerts(
        self,
        severity: Optional[AlertSeverity] = None,
        unresolved_only: bool = False,
    ) -> List[Alert]:
        """Get alerts"""
        alerts = list(self.alerts)
        
        if severity:
            alerts = [a for a in alerts if a.severity == severity]
        
        if unresolved_only:
            alerts = [a for a in alerts if not a.resolved]
        
        return alerts
    
    def acknowledge_alert(self, alert_id: str):
        """Acknowledge an alert"""
        for alert in self.alerts:
            if alert.id == alert_id:
                alert.acknowledged = True
                return True
        return False
    
    def resolve_alert(self, alert_id: str):
        """Resolve an alert"""
        for alert in self.alerts:
            if alert.id == alert_id:
                alert.resolved = True
                return True
        return False
    
    # =========================================
    # LOGGING
    # =========================================
    
    def log(
        self,
        level: str,
        message: str,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Add a log entry"""
        self.logs.append({
            'level': level,
            'message': message,
            'metadata': metadata or {},
            'timestamp': datetime.utcnow().isoformat(),
        })
    
    def get_logs(
        self,
        level: Optional[str] = None,
        since: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Get log entries"""
        logs = list(self.logs)
        
        if level:
            logs = [l for l in logs if l['level'] == level]
        
        if since:
            logs = [l for l in logs if datetime.fromisoformat(l['timestamp']) >= since]
        
        return logs[-limit:]
    
    # =========================================
    # STATUS
    # =========================================
    
    def get_status(self) -> Dict[str, Any]:
        """Get observer status"""
        return {
            'is_running': self._is_running,
            'metrics_count': sum(len(m) for m in self.metrics.values()),
            'traces_count': len(self.traces),
            'active_spans': len(self.active_spans),
            'alerts_count': len(self.alerts),
            'unresolved_alerts': len([a for a in self.alerts if not a.resolved]),
            'health_checks': list(self.health_checks.keys()),
            'alert_rules': len(self.alert_rules),
            'last_health': self.last_health,
            'agent_metrics': self.agent_metrics.to_dict(),
        }
