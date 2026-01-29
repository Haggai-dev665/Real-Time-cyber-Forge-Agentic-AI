# 🤖 Autonomous AI Agent System

## Overview

The Cyber Forge AI platform now includes a **production-ready autonomous AI agent** capable of performing multiple heterogeneous tasks continuously without manual intervention. The agent can decide what to do, when to do it, and how to execute tasks based on goals and system state.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      AUTONOMOUS AGENT CORE                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │   Memory    │  │   Planner   │  │  Scheduler  │               │
│  │  (Vector)   │  │  (Goals)    │  │  (Cron/     │               │
│  │             │  │             │  │   Events)   │               │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │
│         │                │                │                       │
│  ┌──────▼────────────────▼────────────────▼──────┐               │
│  │              AUTONOMOUS AGENT                  │               │
│  │   • Task Queue (Priority-based)               │               │
│  │   • Background Workers                        │               │
│  │   • State Management                          │               │
│  │   • Event System                              │               │
│  └──────────────────────┬────────────────────────┘               │
│                         │                                         │
│  ┌──────────────────────▼────────────────────────┐               │
│  │              TOOL REGISTRY                     │               │
│  │   • Network Scanner                           │               │
│  │   • Website Analyzer                          │               │
│  │   • Threat Detector                           │               │
│  │   • Data Analyzer                             │               │
│  │   • Report Generator                          │               │
│  │   • System Monitor                            │               │
│  └──────────────────────┬────────────────────────┘               │
│                         │                                         │
│  ┌──────────────────────▼────────────────────────┐               │
│  │              TASK EXECUTOR                     │               │
│  │   • Rate Limiting                             │               │
│  │   • Security Policies                         │               │
│  │   • Circuit Breaker                           │               │
│  │   • Retry Logic                               │               │
│  └──────────────────────┬────────────────────────┘               │
│                         │                                         │
│  ┌──────────────────────▼────────────────────────┐               │
│  │              OBSERVABILITY                     │               │
│  │   • Metrics (Counter, Gauge, Histogram)       │               │
│  │   • Distributed Tracing                       │               │
│  │   • Alerting System                           │               │
│  │   • Health Checks                             │               │
│  └───────────────────────────────────────────────┘               │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Autonomous Agent (`autonomous_agent.py`)
The core agent with task queue management and background processing.

**Features:**
- Priority-based task queue
- Multiple background worker loops
- State management (running, paused, stopped)
- Event system for task lifecycle hooks
- Graceful shutdown with configurable grace period

**Key Methods:**
```python
agent = AutonomousAgent(memory, tool_registry, observer, executor)
await agent.start()

task_id = await agent.add_task(
    task_type='network_scan',
    description='Scan target network',
    parameters={'target': '192.168.1.0/24'},
    priority=10
)

await agent.pause()
await agent.resume()
await agent.stop()
```

### 2. Task Scheduler (`task_scheduler.py`)
Multi-type scheduling system for automated task execution.

**Trigger Types:**
- `CRON` - Cron expression-based scheduling
- `INTERVAL` - Fixed interval execution
- `EVENT` - Event-driven triggers
- `ONCE` - Single execution at specified time
- `CONTINUOUS` - Continuous background loops

**Example:**
```python
scheduler = TaskScheduler()

# Daily scan at midnight
schedule_id = await scheduler.create_schedule(
    trigger_type='cron',
    task_type='network_scan',
    cron='0 0 * * *',
    parameters={'target': '192.168.1.0/24'}
)

# Every 5 minutes
await scheduler.create_schedule(
    trigger_type='interval',
    task_type='system_monitor',
    interval_seconds=300
)
```

### 3. Agent Memory (`memory.py`)
Short-term and long-term memory with vector search capabilities.

**Memory Types:**
- `SHORT_TERM` - Session-level memory (auto-expires)
- `LONG_TERM` - Persistent knowledge
- `EPISODIC` - Event history
- `SEMANTIC` - Concept/knowledge storage
- `WORKING` - Current task context

**Features:**
- ChromaDB vector storage
- Semantic search via embeddings
- Automatic consolidation
- TTL-based expiration
- Context building for LLM prompts

### 4. Tool Registry (`tool_registry.py`)
Dynamic tool management and execution framework.

**Built-in Tools:**
| Tool | Description |
|------|-------------|
| `NetworkScanTool` | Port scanning and host discovery |
| `WebsiteAnalysisTool` | Security analysis of web pages |
| `ThreatDetectionTool` | Pattern-based threat detection |
| `DataAnalysisTool` | Data processing and analysis |
| `ReportGeneratorTool` | Report generation |
| `SystemMonitorTool` | System metrics collection |

**Adding Custom Tools:**
```python
tool_registry.register_tool(Tool(
    name='custom_tool',
    description='My custom tool',
    category=ToolCategory.ANALYSIS,
    parameters={'param1': {'type': 'string', 'required': True}},
    handler=my_async_handler
))
```

### 5. Agent Planner (`planner.py`)
Goal decomposition and plan execution engine.

**Features:**
- Template-based plan generation
- LLM-based dynamic planning
- Dependency resolution
- Adaptive re-planning on failures
- Progress tracking

**Built-in Plan Templates:**
- `network_security_scan` - Network scan → Threat detection → Report
- `website_security_audit` - Website analysis → Threat detection → Report
- `system_health_check` - Monitoring → Analysis → Report

### 6. Task Executor (`executor.py`)
Secure execution layer with safety controls.

**Features:**
- **Rate Limiting** - Token bucket algorithm
- **Security Policies** - Task type and target validation
- **Circuit Breaker** - Fault tolerance
- **Retry Logic** - Exponential backoff
- **Timeout Enforcement** - Per-task-type limits

### 7. Observability (`observability.py`)
Comprehensive monitoring and alerting.

**Metrics:**
```python
observer.record_metric('tasks_completed', 1, MetricType.COUNTER)
observer.record_metric('queue_depth', 42, MetricType.GAUGE)
```

**Tracing:**
```python
span_id = observer.start_span('task_execution', {'task_id': 'abc123'})
# ... do work ...
observer.end_span(span_id)
```

**Alerting:**
```python
observer.add_alert_rule(
    name='high_failure_rate',
    metric_name='task_failures',
    condition='gt',
    threshold=10,
    severity='error'
)
```

## API Endpoints

### Task Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/tasks` | POST | Create a new task |
| `/agent/tasks` | GET | List all tasks |
| `/agent/tasks/{id}` | GET | Get task details |
| `/agent/tasks/{id}/cancel` | POST | Cancel a task |
| `/agent/tasks/{id}/retry` | POST | Retry a failed task |

### Scheduling
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/schedules` | POST | Create schedule |
| `/agent/schedules` | GET | List schedules |
| `/agent/schedules/{id}/pause` | POST | Pause schedule |
| `/agent/schedules/{id}/resume` | POST | Resume schedule |
| `/agent/schedules/{id}` | DELETE | Delete schedule |

### Goals & Planning
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/goals` | POST | Create goal with auto-planning |
| `/agent/goals/{id}` | GET | Get goal status |

### Memory
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/memory` | POST | Store memory |
| `/agent/memory/search` | POST | Search memory |
| `/agent/memory/context` | GET | Get relevant context |

### Observability
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/metrics` | GET | Get all metrics |
| `/agent/alerts` | GET | Get active alerts |
| `/agent/alerts/rules` | POST | Create alert rule |
| `/agent/health` | GET | Get agent health |

### Control
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/status` | GET | Get agent status |
| `/agent/start` | POST | Start agent |
| `/agent/stop` | POST | Stop agent |
| `/agent/pause` | POST | Pause processing |
| `/agent/resume` | POST | Resume processing |

### Streaming
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/stream/tasks` | GET | SSE task updates |
| `/agent/stream/logs` | GET | SSE log stream |

## Desktop App Integration

The desktop app includes a new `AgentClient` class for seamless integration:

```javascript
const { AgentClient } = require('./ai-interface/agent-client');

const agent = new AgentClient();

// Create a security scan task
const task = await agent.scanNetwork('192.168.1.0/24');

// Create a goal with automatic planning
const goal = await agent.securityAudit('example.com');

// Schedule daily scans
await agent.scheduleDailyScan('192.168.1.0/24');

// Enable continuous monitoring
await agent.enableContinuousMonitoring();

// Listen for events
agent.on('taskCreated', (task) => console.log('New task:', task));
agent.on('goalCreated', (goal) => console.log('Goal created:', goal));
```

## Usage Examples

### Example 1: Comprehensive Security Audit
```python
# Create a high-level goal
goal = await planner.create_goal(
    description="Perform comprehensive security audit of production network",
    context={"network": "10.0.0.0/8"},
    priority="critical"
)

# The planner automatically:
# 1. Breaks down the goal into steps
# 2. Creates tasks for each step
# 3. Executes in proper order
# 4. Handles failures and retries
```

### Example 2: Scheduled Monitoring
```python
# Schedule hourly system health checks
await scheduler.create_schedule(
    trigger_type='cron',
    task_type='system_monitor',
    description='Hourly health check',
    cron='0 * * * *'
)

# Schedule daily security scans
await scheduler.create_schedule(
    trigger_type='cron',
    task_type='network_scan',
    description='Daily security scan',
    cron='0 2 * * *',
    parameters={'target': '192.168.1.0/24'}
)
```

### Example 3: Event-Driven Response
```python
# Trigger threat analysis on new URL detection
await scheduler.create_schedule(
    trigger_type='event',
    task_type='threat_detection',
    description='Analyze detected URLs',
    event_type='url_detected'
)

# Emit event to trigger analysis
await scheduler.emit_event('url_detected', {'url': 'http://suspicious.com'})
```

## Configuration

The agent uses the following configuration from `app/core/config.py`:

```python
# Agent Settings
AGENT_WORKERS = 4          # Number of parallel task workers
AGENT_QUEUE_SIZE = 1000    # Maximum task queue size
AGENT_RETRY_MAX = 3        # Maximum retry attempts
AGENT_GRACE_PERIOD = 30    # Shutdown grace period (seconds)

# Rate Limiting
RATE_LIMIT_RPS = 10.0      # Requests per second
RATE_LIMIT_BURST = 20      # Burst size

# Memory
MEMORY_TTL_SHORT = 3600    # Short-term memory TTL (1 hour)
MEMORY_CONSOLIDATE = 86400 # Consolidation interval (24 hours)
```

## Dependencies

Add to `requirements.txt`:
```
croniter>=1.3.0  # Cron expression parsing
chromadb>=0.4.0  # Vector database
```

## Quick Start

1. **Start the ML services:**
```bash
cd ml-services
pip install -r requirements.txt
python main.py
```

2. **Verify agent is running:**
```bash
curl http://localhost:8001/agent/health
```

3. **Create your first task:**
```bash
curl -X POST http://localhost:8001/agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "network_scan",
    "description": "Scan local network",
    "parameters": {"target": "192.168.1.0/24"},
    "priority": "high"
  }'
```

4. **Create a goal with planning:**
```bash
curl -X POST http://localhost:8001/agent/goals \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Perform security audit of example.com",
    "priority": "high"
  }'
```

## Safety & Security

The agent includes multiple safety mechanisms:

1. **Rate Limiting** - Prevents overwhelming target systems
2. **Security Policies** - Blocks dangerous operations
3. **Circuit Breaker** - Stops execution after repeated failures
4. **Input Validation** - Sanitizes all parameters
5. **Blocked Targets** - Prevents scanning internal/sensitive IPs
6. **Timeout Enforcement** - Prevents runaway tasks

## Monitoring Dashboard

Access the agent monitoring via:
- **API Docs**: http://localhost:8001/docs
- **Health Check**: http://localhost:8001/agent/health
- **Metrics**: http://localhost:8001/agent/metrics
- **Alerts**: http://localhost:8001/agent/alerts

---

## Files Created

| File | Description |
|------|-------------|
| `ml-services/app/agent/__init__.py` | Module exports |
| `ml-services/app/agent/autonomous_agent.py` | Core agent logic |
| `ml-services/app/agent/task_scheduler.py` | Scheduling system |
| `ml-services/app/agent/memory.py` | Vector memory store |
| `ml-services/app/agent/tool_registry.py` | Tool management |
| `ml-services/app/agent/planner.py` | Goal planning |
| `ml-services/app/agent/executor.py` | Secure execution |
| `ml-services/app/agent/observability.py` | Metrics & tracing |
| `ml-services/app/routers/agent.py` | REST API endpoints |
| `desktop-app/src/ai-interface/agent-client.js` | Desktop integration |

---

**The autonomous agent is now ready for production deployment! 🚀**
