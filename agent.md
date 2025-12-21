# 🤖 Real-Time Cyber Forge Agentic AI - Agent Documentation

<div align="center">
  
[![AI Powered](https://img.shields.io/badge/AI-Agentic-red.svg)]()
[![Gemini](https://img.shields.io/badge/Gemini-API-blue.svg)]()
[![TensorFlow](https://img.shields.io/badge/TensorFlow-ML-orange.svg)]()
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_DB-green.svg)]()

**Comprehensive documentation of the Agentic AI system powering the Cyber Forge platform**

</div>

---

## 📋 Table of Contents

1. [Overview](#-overview)
2. [Research Context](#-research-context)
3. [Agent Architecture](#-agent-architecture)
4. [Core Agent Components](#-core-agent-components)
5. [Agent Capabilities](#-agent-capabilities)
6. [Task Management System](#-task-management-system)
7. [Memory & Learning](#-memory--learning)
8. [AI Services Integration](#-ai-services-integration)
9. [API Endpoints](#-api-endpoints)
10. [Data Flow](#-data-flow)
11. [Configuration](#-configuration)
12. [Usage Examples](#-usage-examples)

---

## 🌟 Overview

The **Real-Time Cyber Forge Agentic AI** is an advanced autonomous cybersecurity assistant that combines multiple AI/ML technologies to provide intelligent threat detection, security analysis, and automated task management. The agent system is designed to:

- **Learn and Adapt**: Persistent memory capabilities for continuous learning
- **Execute Autonomously**: Independent task execution with user oversight
- **Analyze Threats**: Real-time threat detection using ML models
- **Provide Insights**: Contextual security recommendations and analysis
- **Manage Tasks**: Autonomous task queue management with priority handling

### Key Features

| Feature | Description |
|---------|-------------|
| 🧠 **Memory-Enhanced AI** | Persistent learning from security events using ChromaDB |
| 🎯 **Task Automation** | Autonomous execution of security tasks |
| 🔍 **Threat Detection** | ML-powered threat analysis and scoring |
| 💬 **Natural Language** | Conversational interface for security queries |
| 📊 **Dataset Analysis** | Automated cybersecurity dataset processing |
| 🌐 **Network Scanning** | Port scanning and network security assessment |

---

## 🎓 Research Context

### Background of the Study
- Web applications remain the primary attack vector in 2025, responsible for over 80% of successful breaches (Verizon DBIR 2024).
- Traditional reactive tools (firewalls, signature-based antivirus, WAFs) struggle against zero-day exploits, polymorphic malware, and sophisticated phishing.
- Agentic AI combined with real-time machine learning provides proactive defense. CyberForge delivers a synchronized multi-platform ecosystem (desktop app, browser extension, and mobile app) that shares threat intelligence, user behavior profiles, and automated response actions in real time to protect users wherever they browse.

### Problem Statement
No existing solution offers a unified agentic AI layer that maintains continuous situational awareness and proactive mitigation of web threats (phishing, malicious scripts, drive-by downloads, credential theft) as users transition between desktop, browser, and mobile contexts. The absence of real-time cross-platform synchronization of behavioral context and threat intelligence leaves critical protection gaps.

### Research Questions
1) How can an agentic AI system be designed to maintain real-time proactive web threat detection and response when synchronized across desktop, browser, and mobile environments?
2) What is the effectiveness of using vector embeddings and different learning paradigms in training models for cross-platform malicious behavior detection and automated remediation?
3) How does the CyberForge synchronized agentic AI ecosystem compare with current industry solutions in detection accuracy, response latency, and prevention of real-world web attacks?

### Research Objectives
**General Objective**
To design, implement, and evaluate CyberForge as a synchronized agentic AI ecosystem comprising a desktop application, browser extension, and mobile application for real-time proactive web security using advanced machine learning and vector embeddings.

**Specific Objectives**
1) Develop and train machine learning models using supervised, unsupervised, and reinforcement learning to generate high-dimensional vector embeddings for web entities (URLs, scripts, DOM elements, network flows, user behavior).
2) Design an agentic AI architecture that uses vector embeddings and similarity-based reasoning for real-time anomaly detection, phishing identification, and malicious script classification across synchronized platforms.
3) Create a secure real-time synchronization framework that enables continuous exchange of learned embeddings, threat intelligence, network protocol behavioral baselines, and autonomous remediation decisions among desktop, browser, and mobile clients.
4) Evaluate performance of the trained models and the synchronized ecosystem for detection accuracy, false-positive rate, response time, and effectiveness against live and simulated web-based attacks compared to existing solutions.

### Estimated Cost (6-9 months)
The project will leverage the following tools, platforms, and programming languages to minimize expenses beyond standard access (free tiers and open-source resources):
- Programming Languages and Frameworks: Python for ML model development and training; JavaScript/Node.js for backend APIs and desktop logic; Dart for mobile application development.
- AI and ML Tools: Google Gemini API for NLP tasks (threat intelligence, phishing detection). Models trained with supervised, unsupervised, and reinforcement learning; vector embeddings via TensorFlow or PyTorch.
- Data Acquisition: Cybersecurity datasets from Kaggle for training and evaluation, including threat intelligence feeds, malicious URL samples, and network traffic logs.
- Agentic AI APIs: Custom web scraper invoked by the AI agent for real-time web content analysis and threat gathering.
- Model Hosting: Training on AWS with fine-tuned models hosted on Hugging Face for sharing and inference.
- Backend and Deployment: Node.js services hosted on Heroku for synchronization, real-time data exchange, and agent coordination across platforms.
- Other Platforms: Open-source tools for browser extension development (WebExtensions API) and cross-platform testing environments.

This section formalizes the research framing behind the agentic AI approach and aligns the build with measurable objectives and resource planning.

---

## 🏗 Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AGENTIC AI SYSTEM                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   AI Agent   │    │  Enhanced    │    │   Gemini     │          │
│  │   (Core)     │◄──►│  AI Agent    │◄──►│   Service    │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                   │                   │                   │
│         ▼                   ▼                   ▼                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Memory     │    │    Task      │    │    ML        │          │
│  │   Store      │    │   Manager    │    │   Models     │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                   │                   │                   │
│         ▼                   ▼                   ▼                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  ChromaDB    │    │   Dataset    │    │   Threat     │          │
│  │  (Vector DB) │    │   Manager    │    │   Analyzer   │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
ml-services/
├── main.py                      # FastAPI application entry point
├── app/
│   ├── services/
│   │   ├── ai_agent.py          # Core AI Agent with Gemini integration
│   │   ├── enhanced_ai_agent.py # Enhanced agent with task management
│   │   ├── gemini_service.py    # Google Gemini API integration
│   │   ├── memory_store.py      # ChromaDB-based memory system
│   │   ├── ml_models.py         # ML model management
│   │   ├── threat_analyzer.py   # Threat detection and analysis
│   │   ├── dataset_manager.py   # Kaggle dataset management
│   │   └── advanced_dataset_manager.py  # Advanced dataset operations
│   ├── models/
│   │   └── schemas.py           # Pydantic models and schemas
│   ├── routers/
│   │   ├── analysis.py          # Analysis endpoints
│   │   ├── threats.py           # Threat-related endpoints
│   │   ├── insights.py          # AI insights endpoints
│   │   └── web_scraping.py      # Web scraping functionality
│   └── core/
│       └── config.py            # Configuration management
└── datasets/                    # Security datasets
    ├── malware_detection/
    ├── network_intrusion/
    ├── phishing_detection/
    ├── anomaly_detection/
    └── ... (12 categories)
```

---

## 🔧 Core Agent Components

### 1. AI Agent (`ai_agent.py`)

The primary AI agent that handles natural language interactions and security analysis.

```python
class AIAgent:
    """Advanced AI agent with memory and reasoning capabilities using Gemini API"""
    
    def __init__(self, memory_store, threat_analyzer, ml_manager=None):
        self.memory_store = memory_store
        self.threat_analyzer = threat_analyzer
        self.ml_manager = ml_manager
        self.gemini_service = GeminiService()
        self.conversation_history = []
```

**Key Methods:**
| Method | Description |
|--------|-------------|
| `initialize()` | Initialize the agent with Gemini service |
| `analyze()` | Perform AI analysis with memory and context |
| `_prepare_context()` | Prepare context for Gemini analysis |
| `_store_memory()` | Store analysis results in memory |
| `is_ready()` | Check agent readiness status |

### 2. Enhanced AI Agent (`enhanced_ai_agent.py`)

Extended agent with task management and autonomous execution capabilities.

```python
class EnhancedAIAgent:
    """Enhanced AI agent with task management and advanced analysis capabilities"""
    
    # Task Types
    class TaskType(Enum):
        NETWORK_SCAN = "network_scan"
        WEBSITE_ANALYSIS = "website_analysis"
        DATASET_ANALYSIS = "dataset_analysis"
        THREAT_DETECTION = "threat_detection"
        SECURITY_REPORT = "security_report"
        CUSTOM_ANALYSIS = "custom_analysis"
```

**System Prompt (CYBER-FORGE AI Identity):**
```
CORE COMPETENCIES:
🛡️ Real-time threat detection and analysis
🌐 Website security assessment and analysis  
🔍 Network scanning and port analysis
📊 Security dataset analysis and insights
🎯 Task management and automation
🚨 Incident response and recommendations
```

### 3. Gemini Service (`gemini_service.py`)

Integration with Google's Gemini AI for advanced language understanding.

```python
class GeminiService:
    """Google Gemini AI Service with custom training data integration"""
    
    # Cybersecurity-focused system prompt
    EXPERTISE_AREAS:
    - Real-time threat detection and analysis
    - Malware and phishing identification
    - Network security assessment
    - Browser security monitoring
    - Risk assessment and mitigation
    - Security incident response
```

**Configuration:**
- Model: Configurable via `settings.GEMINI_MODEL`
- Safety Settings: Optimized for cybersecurity analysis
- Custom Knowledge Base: Loaded from training data

### 4. Memory Store (`memory_store.py`)

Persistent memory using ChromaDB vector database.

```python
class MemoryStore:
    """Memory store for AI agent using free ChromaDB"""
    
    # Storage path: ./data/chroma_db
    # Collection: cyber_forge_memory
```

**Features:**
- Vector-based similarity search
- Persistent storage across sessions
- Context retrieval for conversation continuity
- Analysis history tracking

### 5. Threat Analyzer (`threat_analyzer.py`)

ML-powered threat detection and analysis engine.

```python
class ThreatAnalyzer:
    """Analyzes threats using free ML models and heuristics"""
    
    # Detection Categories:
    - Phishing patterns
    - Malware indicators
    - Suspicious URL patterns
    - Insecure connections
    - Network attack signatures
```

**Analysis Methods:**
- URL analysis with pattern matching
- Protocol security checking
- ML-enhanced threat scoring
- Risk-based recommendations

---

## 🎯 Agent Capabilities

### Threat Detection & Analysis

| Capability | Description | Risk Levels |
|------------|-------------|-------------|
| URL Analysis | Scans URLs for malicious patterns | Low → Critical |
| Phishing Detection | Identifies phishing attempts | 0.0 - 1.0 score |
| Malware Analysis | Detects malware signatures | Categorized threats |
| Network Scanning | Port and service enumeration | Open/Filtered/Closed |

### Security Assessment

- **Website Security Analysis**: SSL/TLS verification, security headers
- **Vulnerability Assessment**: CVE checking, misconfiguration detection
- **Risk Scoring**: Numerical risk assessment (0-10 scale)
- **Behavioral Analysis**: Pattern-based anomaly detection

### Natural Language Interface

```
User: "Analyze this URL for security threats"
Agent Response:
{
  "risk_level": "Medium",
  "threat_types": ["suspicious_pattern", "insecure_connection"],
  "confidence": 0.85,
  "recommendations": [
    "Exercise caution with this URL",
    "Verify the source before proceeding",
    "Check for HTTPS and valid certificates"
  ]
}
```

---

## 📋 Task Management System

### Task Types

```python
class TaskType(Enum):
    NETWORK_SCAN = "network_scan"       # Port scanning and network analysis
    WEBSITE_ANALYSIS = "website_analysis"   # Web security assessment
    DATASET_ANALYSIS = "dataset_analysis"   # ML dataset processing
    THREAT_DETECTION = "threat_detection"   # Real-time threat analysis
    SECURITY_REPORT = "security_report"     # Automated report generation
    CUSTOM_ANALYSIS = "custom_analysis"     # User-defined analysis
```

### Task Priority Levels

| Priority | Behavior |
|----------|----------|
| `LOW` | Queued for background processing |
| `MEDIUM` | Standard processing queue |
| `HIGH` | Auto-started on creation |
| `CRITICAL` | Immediate execution, alerts enabled |

### Task Lifecycle

```
┌─────────┐     ┌─────────────┐     ┌───────────┐     ┌───────────┐
│ PENDING │ ──► │ IN_PROGRESS │ ──► │ COMPLETED │  or │  FAILED   │
└─────────┘     └─────────────┘     └───────────┘     └───────────┘
     │                                    │                │
     │          ┌───────────┐            │                │
     └─────────►│ CANCELLED │◄───────────┴────────────────┘
                └───────────┘
```

### Task Structure

```python
class Task(BaseModel):
    id: str                          # Unique identifier
    type: TaskType                   # Task category
    priority: TaskPriority           # Execution priority
    status: TaskStatus               # Current state
    title: str                       # Display title
    description: str                 # Task details
    parameters: Dict[str, Any]       # Task-specific params
    created_at: datetime             # Creation timestamp
    started_at: Optional[datetime]   # Execution start
    completed_at: Optional[datetime] # Completion time
    result: Optional[Dict[str, Any]] # Task output
    error: Optional[str]             # Error message
    progress: float                  # 0.0 - 1.0
```

### Concurrent Execution

- Maximum concurrent tasks: **5**
- Auto-scaling based on system resources
- Priority-based queue management
- Background task execution with asyncio

---

## 🧠 Memory & Learning

### ChromaDB Integration

The agent uses ChromaDB as a persistent vector database for memory storage.

```python
# Collection Configuration
collection = client.get_or_create_collection(
    name="cyber_forge_memory",
    metadata={"description": "AI agent memory storage"}
)
```

### Memory Operations

| Operation | Method | Description |
|-----------|--------|-------------|
| Store | `store_analysis()` | Save analysis results with metadata |
| Query | `query_similar()` | Find similar past analyses |
| Cleanup | `cleanup()` | Remove old or irrelevant memories |

### Context Retrieval

```python
async def query_similar(self, query: str, limit: int = 5):
    """Query for similar analyses"""
    results = self.collection.query(
        query_texts=[query],
        n_results=limit
    )
    return formatted_results
```

### Learning from Interactions

1. **Conversation History**: Last 5 messages retained for context
2. **Analysis Storage**: All analyses stored for future reference
3. **Pattern Recognition**: Similar queries identified and leveraged
4. **Feedback Loop**: User interactions improve future responses

---

## 🔌 AI Services Integration

### Service Initialization Flow

```python
@app.on_event("startup")
async def startup_event():
    # 1. Initialize memory store
    memory_store = MemoryStore()
    await memory_store.initialize()
    
    # 2. Initialize ML models
    ml_manager = MLModelManager()
    await ml_manager.load_models()
    
    # 3. Initialize threat analyzer
    threat_analyzer = ThreatAnalyzer(ml_manager)
    
    # 4. Initialize AI agent
    ai_agent = AIAgent(memory_store, threat_analyzer, ml_manager)
    await ai_agent.initialize()
    
    # 5. Initialize enhanced agent
    enhanced_ai_agent = EnhancedAIAgent()
    await enhanced_ai_agent.initialize()
```

### Service Health Monitoring

```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "services": {
            "ai_agent": ai_agent.is_ready(),
            "threat_analyzer": threat_analyzer.is_ready(),
            "ml_models": ml_manager.is_ready(),
            "memory_store": memory_store.is_ready()
        },
        "version": "1.0.0"
    }
```

---

## 🌐 API Endpoints

### Core Analysis Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/analyze` | POST | General AI analysis |
| `/analyze-url` | POST | URL threat analysis |
| `/health` | GET | Service health check |

### Request/Response Schema

**Analysis Request:**
```json
{
  "query": "Analyze this suspicious activity",
  "context": {
    "type": "threat_analysis",
    "source": "browser_monitor"
  },
  "conversation_history": []
}
```

**Analysis Response:**
```json
{
  "response": "Analysis indicates potential threat...",
  "confidence": 0.87,
  "insights": [
    "Risk Level: High",
    "Threat Types: phishing, suspicious_pattern"
  ],
  "recommendations": [
    "Do not enter credentials on this page",
    "Report the URL to IT security"
  ],
  "timestamp": "2024-12-16T10:30:00Z"
}
```

---

## 📊 Data Flow

### Analysis Pipeline

```
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│   User     │     │  Desktop   │     │  Backend   │     │    ML      │
│  Request   │ ──► │    App     │ ──► │  Services  │ ──► │  Services  │
└────────────┘     └────────────┘     └────────────┘     └────────────┘
                                                               │
┌────────────┐     ┌────────────┐     ┌────────────┐          │
│  Response  │ ◄── │  Format &  │ ◄── │  AI Agent  │ ◄────────┘
│  Display   │     │  Present   │     │  Process   │
└────────────┘     └────────────┘     └────────────┘
```

### Desktop to ML Service Communication

```javascript
// AI Client (Desktop App)
class AIInterface {
  async queryAI(query, context = {}) {
    const payload = {
      query: query,
      context: context,
      conversation_history: this.conversationHistory.slice(-10),
      timestamp: new Date().toISOString()
    };
    
    const response = await axios.post(`${this.apiUrl}/analyze`, payload);
    return response.data;
  }
}
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# AI Service Configuration
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-pro
AI_SERVICE_URL=http://localhost:8001

# Memory Store
CHROMA_DB_PATH=./data/chroma_db

# ML Configuration
ML_MODEL_PATH=./models
THREAT_THRESHOLD=0.7

# Service Settings
MAX_CONCURRENT_TASKS=5
CONVERSATION_HISTORY_LIMIT=10
```

### Gemini Safety Settings

```python
safety_settings = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}
```

---

## 💡 Usage Examples

### 1. Basic Security Query

```python
# Send analysis request
response = await ai_agent.analyze(
    query="Is this URL safe? https://example-bank.suspicious-domain.com",
    context={"source": "user_input", "type": "url_check"}
)

print(response.response)
# "The URL displays characteristics commonly associated with phishing attacks..."
print(response.confidence)
# 0.92
print(response.recommendations)
# ["Do not enter any credentials", "Report to IT security", ...]
```

### 2. Creating and Executing Tasks

```python
# Create a network scan task
task_id = await enhanced_ai_agent.create_task(
    task_type=TaskType.NETWORK_SCAN,
    title="Scan Internal Network",
    description="Scan 192.168.1.0/24 for open ports",
    parameters={
        "target": "192.168.1.0/24",
        "ports": [22, 80, 443, 8080],
        "scan_type": "tcp"
    },
    priority=TaskPriority.HIGH
)

# Check task status
task = enhanced_ai_agent.get_task(task_id)
print(f"Status: {task.status}, Progress: {task.progress * 100}%")
```

### 3. Dataset Analysis

```python
# Analyze security dataset
task_id = await enhanced_ai_agent.create_task(
    task_type=TaskType.DATASET_ANALYSIS,
    title="Analyze Phishing Dataset",
    description="Process phishing detection dataset for model training",
    parameters={
        "dataset": "phishing_detection",
        "operations": ["statistics", "feature_extraction", "anomaly_detection"]
    },
    priority=TaskPriority.MEDIUM
)
```

### 4. Conversation with Context

```python
# First message
result1 = await ai_agent.analyze(
    query="What are the indicators of a ransomware attack?",
    context={"topic": "ransomware"}
)

# Follow-up with conversation history
result2 = await ai_agent.analyze(
    query="How can I protect against these?",
    context={"topic": "ransomware"},
    conversation_history=[
        {"role": "user", "content": "What are the indicators of a ransomware attack?"},
        {"role": "assistant", "content": result1.response}
    ]
)
```

---

## 🗃️ Supported Datasets

The agent can analyze and learn from the following security datasets:

| Category | Dataset | Samples | Description |
|----------|---------|---------|-------------|
| Malware | `malware_detection` | 10,000 | PE file features for malware classification |
| Network | `network_intrusion` | 125,973 | NSL-KDD intrusion detection data |
| Phishing | `phishing_detection` | 11,055 | Website features for phishing detection |
| Anomaly | `anomaly_detection` | - | System log anomaly patterns |
| Botnet | `botnet_detection` | - | Botnet traffic patterns |
| DNS | `dns_tunneling` | - | DNS tunneling detection |
| Spam | `spam_detection` | - | Email spam classification |
| Web | `web_attack_detection` | - | Web application attack patterns |

---

## 🔒 Security Considerations

### Agent Permissions

- **Read Access**: Security logs, network data, user queries
- **Write Access**: Analysis results, memory storage, task results
- **Execute**: Network scans, file analysis (sandboxed)

### Rate Limiting

- API requests: 100/minute per client
- Analysis requests: 10/minute for heavy operations
- Task creation: 20/minute per user

### Data Protection

- All communications encrypted via TLS
- Sensitive data masked in logs
- Memory retention policies enforced
- User consent required for data storage

---

## 📈 Performance Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Response Time | < 2s | Average AI analysis response |
| Throughput | 100 req/s | Maximum concurrent requests |
| Accuracy | > 90% | Threat detection accuracy |
| Uptime | 99.9% | Service availability |

---

## 🚀 Future Enhancements

- [ ] Multi-agent collaboration system
- [ ] Federated learning capabilities
- [ ] Advanced reasoning chains
- [ ] Real-time model fine-tuning
- [ ] Extended external API integrations
- [ ] Custom model training interface

---

## 📚 Related Documentation

- [System Architecture](docs/architecture/system-architecture.md)
- [API Reference](docs/api/api-reference.md)
- [Quick Start Guide](docs/QUICK_START.md)
- [Desktop App README](desktop-app/README.md)
- [ML Services README](ml-services/README.md)

---

<div align="center">
  
**🛡️ Real-Time Cyber Forge Agentic AI**

*Intelligent Security Through Autonomous AI Agents*

</div>
