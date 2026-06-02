# CyberForge — Full System Architecture & Implementation

> **Real-Time Agentic AI Cybersecurity Platform**
> Autonomous threat detection, ML-powered risk scoring, and Gemini-driven intelligence — wired end-to-end with zero fallbacks.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [ML Services (HuggingFace Space)](#ml-services-huggingface-space)
4. [Backend (Node.js / Heroku)](#backend-nodejs--heroku)
5. [Desktop App (Tauri v2 + Electron-style Renderer)](#desktop-app-tauri-v2)
6. [Sidebar & UI Components](#sidebar--ui-components)
7. [Real-Time URL Scanning Pipeline](#real-time-url-scanning-pipeline)
8. [Datasets & Training Data](#datasets--training-data)
9. [Deployment](#deployment)

---

## System Overview

CyberForge is a production-grade cybersecurity platform built across four layers:

| Layer | Technology | Deployment |
|-------|-----------|------------|
| **ML Services** | Python / FastAPI / Gemini 2.5 Flash | HuggingFace Spaces (`che237-cyberforge.hf.space`) |
| **Backend API** | Node.js / Express | Heroku (`cyberforge-ddd97655464f.herokuapp.com`) |
| **Desktop App** | Tauri v2 (Rust) + HTML/CSS/JS renderer | macOS native binary |
| **Database** | Appwrite Cloud v1.8.1 | Appwrite managed |
| **Landing Page** | Next.js / Tailwind CSS | Bundled with Heroku |

Every URL visited in the browser is automatically:
1. **Detected** by the Tauri Rust backend (osascript polling)
2. **Scraped** via the webscrapper.live API
3. **Classified** by 4 ML models (phishing, malware, anomaly, web attack)
4. **Analyzed** by Gemini 2.5 Flash for deep threat reasoning
5. **Displayed** in real-time in the desktop app UI and floating agent panel

**No fallbacks. No demo modes. Every scan uses the real ML and Gemini services.**

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    DESKTOP APP (Tauri v2)                    │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Rust Backend │  │  URL Monitor │  │  Browser Detector │  │
│  │  (commands)  │──│ (osascript)  │  │ (Chrome/Safari/   │  │
│  └──────┬───── │  └──────┬───────┘  │  Firefox/Edge/     │  │
│         │       │         │          │  Brave/Arc)        │  │
│  ┌──────┴───────┴─────────┴──────────┴───────────────────┐  │
│  │              JS Renderer (cyberforge-app.js)           │  │
│  │  • Sidebar Navigation (7 sections, 30+ screens)       │  │
│  │  • Floating Agent Panel (real-time URL feed)           │  │
│  │  • Agent Console, Charts, Globe, Tables                │  │
│  └──────────────────────┬────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTP POST /api/agent/scan-url
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (Node.js / Heroku)                │
│                                                             │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ agentRoutes│  │ WebScraper   │  │  mlServiceClient    │ │
│  │ /scan-url  │─→│ API Service  │─→│  .classifyThreat()  │ │
│  └────────────┘  │ (webscrapper │  │  .getExplanation()  │ │
│                  │  .live)       │  └─────────┬───────────┘ │
│                  └──────────────┘            │              │
│  ┌────────────────────────────────┐          │              │
│  │ CyberforgeAgent (autonomous)  │          │              │
│  │ • Task queue & scheduling     │          │              │
│  │ • Evidence storage (Appwrite) │          │              │
│  │ • Alert creation              │          │              │
│  └────────────────────────────────┘          │              │
└──────────────────────────────────────────────┼──────────────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          │                    ▼                    │
                          │   HUGGINGFACE SPACE (che237-cyberforge) │
                          │                                        │
                          │  POST /analyze-url ──→ ML Models       │
                          │    • phishing_detection                │
                          │    • malware_detection                 │
                          │    • anomaly_detection                 │
                          │    • web_attack_detection              │
                          │                                        │
                          │  POST /scan-threats ──→ Gemini 2.5     │
                          │    • Deep threat analysis              │
                          │    • Risk scoring (0-10)               │
                          │    • Recommendations                   │
                          │    • Technical breakdown               │
                          └────────────────────────────────────────┘
```

---

## ML Services (HuggingFace Space)

**Deployment**: `https://che237-cyberforge.hf.space`
**Framework**: Python / FastAPI
**AI Model**: Google Gemini 2.5 Flash (`gemini-2.5-flash`)

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/health` | Health check (returns `gemini: true/false`, `ml_models: true/false`) |
| `GET` | `/models` | List available ML models |
| `POST` | `/analyze-url` | ML model predictions for a URL |
| `POST` | `/scan-threats` | Gemini-powered deep threat analysis |
| `POST` | `/analyze` | General analysis endpoint |
| `POST` | `/api/models/predict` | Direct model prediction |
| `POST` | `/api/insights/generate` | AI-generated security insights |

### `/analyze-url` — ML Model Predictions

Runs 4 independent ML models against URL features:

```json
{
  "url": "https://example.com",
  "aggregate": {
    "average_threat_score": 0.0,
    "overall_risk_level": "low"
  },
  "model_predictions": {
    "phishing_detection": {
      "model": "phishing_detection",
      "prediction": 0,
      "prediction_label": "benign",
      "confidence": 1.0,
      "threat_score": 0.0,
      "reasons": [],
      "inference_source": "heuristic"
    },
    "malware_detection": { ... },
    "anomaly_detection": { ... },
    "web_attack_detection": { ... }
  },
  "features_analyzed": {
    "url_length": 23,
    "hostname_length": 11,
    "is_https": true,
    "has_ip_address": false,
    "has_suspicious_tld": false
  }
}
```

### `/scan-threats` — Gemini Deep Analysis

Sends scan data to Gemini 2.5 Flash for detailed threat reasoning:

```json
{
  "response": "CyberForge AI Analysis Report\n\n1. **Risk Level**: Medium...",
  "confidence": 0.85,
  "risk_level": "Critical",
  "risk_score": 9.0,
  "insights": [...],
  "recommendations": [...],
  "model_used": "gemini-2.5-flash",
  "timestamp": "2026-02-23T08:27:53Z"
}
```

### ML Service Components

| File | Purpose |
|------|---------|
| `app/services/gemini_service.py` | Gemini 2.5 Flash API integration |
| `app/services/ml_models.py` | ML model loading & inference |
| `app/services/threat_analyzer.py` | Threat analysis orchestration |
| `app/services/ai_agent.py` | AI agent service |
| `app/services/enhanced_ai_agent.py` | Enhanced agentic capabilities |
| `app/services/dataset_manager.py` | Dataset loading & management |
| `app/services/advanced_dataset_manager.py` | Advanced dataset operations |
| `app/services/ml_trainer.py` | Model training pipeline |
| `app/services/model_registry.py` | Model version management |
| `app/services/memory_store.py` | Agent memory persistence |
| `app/services/web_security_datasets.py` | Web security dataset utilities |
| `app/routers/threats.py` | `/scan-threats` endpoint |
| `app/routers/analysis.py` | `/analyze-url`, `/analyze` endpoints |
| `app/routers/training.py` | Model training endpoints |
| `app/routers/agent.py` | Agent interaction endpoints |
| `app/routers/insights.py` | AI insights generation |
| `app/routers/control_center.py` | Control center API |
| `app/routers/web_scraping.py` | Web scraping utilities |
| `app/models/schemas.py` | Pydantic data schemas |

---

## Backend (Node.js / Heroku)

**Deployment**: `https://cyberforge-ddd97655464f.herokuapp.com`
**Framework**: Node.js / Express
**Database**: Appwrite Cloud v1.8.1

### API Routes

| File | Base Path | Purpose |
|------|-----------|---------|
| `agentRoutes.js` | `/api/agent` | Agent management, task creation, **real-time URL scanning** |
| `threats.js` | `/api/threats` | Threat CRUD, stats, scan, dismiss, resolve |
| `analysis.js` | `/api/analysis` | Security analysis endpoints |
| `mlRoutes.js` | `/api/ml` | ML model proxy (health, predict, batch predict, URL/website analysis) |
| `auth.js` | `/api/auth` | Authentication (Appwrite sessions) |
| `child-pages.js` | `/api/child-pages` | Browser sessions, cookies, storage, network, console, scan modes |
| `domain-intelligence.js` | `/api/domain-intel` | Domain analysis, deep scan, watch list, activity, statistics |
| `threat-hunting.js` | `/api/threat-hunting` | Threat hunting campaigns |
| `otx.js` | `/api/otx` | AlienVault OTX integration |
| `web-scraping.js` | `/api/web-scraping` | Web scraping operations |
| `ai.js` | `/api/ai` | AI assistant endpoints |
| `features.js` | `/api/features` | Feature flags |
| `ml-training.js` | `/api/ml-training` | ML model training management |

### Key Endpoint: `POST /api/agent/scan-url`

This is the core endpoint the desktop app calls for every new URL detected:

```
Desktop URL Monitor → POST /api/agent/scan-url
  ├── Step 1: webscrapper.live API scrapes the URL
  ├── Step 2: formatForAIAnalysis() structures security data
  ├── Step 3: mlServiceClient.classifyThreat() → HF /analyze-url (NO FALLBACK)
  ├── Step 4: mlServiceClient.getExplanation() → HF /scan-threats (NO FALLBACK)
  ├── Step 5: Create Appwrite alert if riskScore >= 30
  └── Return: full scan results to desktop app
```

### Backend Services

| Service | File | Purpose |
|---------|------|---------|
| **ML Service Client** | `mlServiceClient.js` | Calls HF Space `/analyze-url` and `/scan-threats`. Zero fallbacks. |
| **Web Scraper API** | `WebScraperAPIService.js` | Calls `webscrapper.live/api/scrape` (API key: `sk-fd14...`). Returns title, description, headings, links, images, metaTags, screenshot. |
| **Appwrite Service** | `appwriteService.js` | Database CRUD, alert creation, evidence storage, user management. Uses document-level permissions with `Permission.write(Role.any())`. |
| **CyberForge Agent** | `CyberforgeAgent.js` | Autonomous agent: task queue, web scans, ML classification, Gemini explanation, alert creation, evidence chain. |
| **Agent Manager** | `AgentManager.js` | Agent lifecycle: start, stop, status, task assignment. |
| **Threat Service** | `threatService.js` | Threat aggregation, statistics, resolution workflow. |
| **Domain Intelligence** | `DomainIntelligenceService.js` | Domain analysis, reputation scoring, watched domains. |
| **IOC Analysis** | `IOCAnalysisService.js` | Indicator of Compromise detection and analysis. |
| **MITRE ATT&CK** | `MITREAttackService.js` | MITRE ATT&CK framework mapping. |
| **Threat Hunting** | `ThreatHuntingService.js` | Hypothesis-driven threat hunting campaigns. |
| **Threat Intelligence** | `ThreatIntelligenceService.js` | External threat intelligence feeds. |
| **Analysis Service** | `analysisService.js` | Security analysis orchestration. |
| **CyberForge ML** | `cyberforgeMLService.js` | ML model management and inference. |
| **Datadog Metrics** | `datadogMetrics.js` | Performance metrics, ML inference timing, Gemini usage tracking. |
| **WebSocket** | `websocket.js` | Real-time push notifications to desktop app. |
| **Vector Database** | `vectorDatabase.js` | Embeddings storage for semantic search. |
| **OTX Service** | `otx.js` | AlienVault OTX pulse and IOC integration. |
| **Redis** | `redis.js` | Caching and session management. |

### Middleware

| File | Purpose |
|------|---------|
| `auth.js` | JWT/Appwrite session authentication |
| `firebaseAuth.js` | Firebase authentication (legacy) |
| `errorHandler.js` | Global error handler with structured logging |

---

## Desktop App (Tauri v2)

**Framework**: Tauri v2 (Rust backend) + HTML/CSS/JS renderer
**Platform**: macOS (with osascript browser integration)

### Rust Backend (`src-tauri/src/`)

| File | Purpose |
|------|---------|
| `main.rs` | Tauri app entry point, plugin registration |
| `commands.rs` | Tauri IPC command handlers |
| `auth.rs` | Authentication state management |
| `state.rs` | Application state and configuration |
| `websocket.rs` | WebSocket client for real-time server events |
| `system/mod.rs` | System module declarations |
| `system/url_monitor.rs` | **Real-time URL monitoring** — polls Chrome, Safari, Firefox, Edge, Brave, Arc via osascript for active tab URLs |
| `system/browser_detector.rs` | Detects installed browsers on macOS |
| `system/os_info.rs` | OS version and system information |
| `system/process_checker.rs` | Running process detection |

### URL Monitor (`url_monitor.rs`)

The core innovation — gets the active tab URL from every major browser on macOS using `osascript`:

- **Chrome/Edge/Brave/Arc**: `tell application "Google Chrome" to get URL of active tab of first window`
- **Safari**: `tell application "Safari" to get URL of current tab of first window`
- **Firefox**: Uses accessibility APIs via AppleScript

Returns `ActiveUrlsResult { tabs: Vec<ActiveTabInfo>, scan_timestamp }` where each tab has `browser`, `url`, `title`, `is_active`, `timestamp`.

### JS Renderer Components

| File | Purpose |
|------|---------|
| `cyberforge-app.js` | **Main application controller** (~9000+ lines) — agent management, URL monitoring, scan pipeline, UI state |
| `app.js` | Secondary app controller — sidebar navigation, theme, lottie animations |
| `dashboard.html` | Main HTML layout with sidebar, header, content area, floating agent panel |
| `child-page-layouts.js` | HTML templates for all child/sub pages |
| `agent-ui-controller.js` | Agent start/stop UI controls |
| `auth-page.js` | Login/registration page |
| `loading-screen.js` | App loading animation |
| `api-client.js` | HTTP client for backend API calls |

### Screen Modules (`screens/`)

Each sidebar page has a dedicated JS module:

| Screen | File | Description |
|--------|------|-------------|
| Dashboard | `dashboard.js` | Main threat overview with charts and metrics |
| Threat Center | `threat-center.js` | Centralized threat management |
| Threat Globe | `threat-globe.js` | 3D interactive globe showing global threats |
| AI Assistant | `ai-assistant.js` | Conversational AI security assistant |
| AI Insights | `ai-insights.js` | ML-generated security insights |
| ML Models | `ml-models.js` | Model management, training status, inference |
| Datasets | `datasets.js` | Training dataset viewer and manager |
| Predictions | `predictions.js` | ML prediction history and accuracy |
| API Management | `api-management.js` | API key management, rate limiting |
| Database Connector | `database-connector.js` | Appwrite database viewer |
| Domain Intelligence | `domain-intelligence.js` | Domain reputation & analysis |
| Behavioral Analysis | `behavioral-analysis.js` | User/network behavior analytics |
| Deep Analysis | `deep-analysis.js` | Deep scan results viewer |
| Digital Forensics | `digital-forensics.js` | Forensic investigation tools |
| Incident Response | `incident-response.js` | Incident handling workflow |
| Malware Detection | `malware-detection.js` | Malware scan results |
| Network Analysis | `network-analysis.js` | Network traffic analysis |
| OSINT Tools | `osint-tools.js` | Open source intelligence tools |
| Penetration Testing | `penetration-testing.js` | Pen testing modules |
| Risk Assessment | `risk-assessment.js` | Risk scoring and assessment |
| Real-Time Monitor | `real-time-monitor.js` | Live event monitoring |
| Reports | `reports.js` | Report generation and export |
| Security Metrics | `security-metrics.js` | Security KPIs and dashboards |
| Settings | `settings.js` | App configuration |
| System Logs | `system-logs.js` | Agent and system log viewer |
| Threat Hunting | `threat-hunting.js` | Hypothesis-driven hunting campaigns |
| Vulnerability Scanner | `vulnerability-scanner.js` | Vulnerability detection |
| Web Scraper | `web-scraper.js` | Manual web scraping interface |
| YARA Rules | `yara-rules.js` | YARA rule management |
| Compliance | `compliance.js` | Compliance framework mapping |
| Profile | `profile.js` | User profile management |

### Renderer Utility Modules (`utils/`)

| File | Purpose |
|------|---------|
| `api-client.js` | Axios-based HTTP client with auth headers |
| `websocket-manager.js` | WebSocket connection management |
| `theme-manager.js` | Dark/light theme switching |
| `notification-system.js` | Desktop notification management |

### Renderer Component Modules (`components/`)

| File | Purpose |
|------|---------|
| `chart-factory.js` | Chart.js chart creation (line, bar, doughnut, radar) |
| `data-table.js` | Sortable, filterable data table component |
| `hybrid-globe.js` | 3D threat globe (Three.js/CSS3D hybrid) |
| `ai-assistant-v2.js` | AI chat interface component |
| `modal.js` | Modal dialog system |
| `lottie-manager.js` | Lottie animation management for sidebar icons |

---

## Sidebar & UI Components

The desktop app sidebar is organized into **7 collapsible sections** with **30+ navigable screens** and nested child pages:

### 1. Intelligence

| Screen | Icon | Child Pages |
|--------|------|-------------|
| **Threat Overview** | `fa-gauge` | Main dashboard with threat metrics, risk gauges, activity timeline |
| **Threat Globe** | `fa-globe` | 3D interactive threat map with `LIVE` badge |
| **Signal Pipeline** | `fa-diagram-project` | Ingest → Normalize → Analyze → Reason |
| **Model Inference** | `fa-microchip` | Active Models, Training, Datasets |

### 2. Agent System

| Screen | Icon | Child Pages |
|--------|------|-------------|
| **Agent Core** | `fa-terminal` | Active Tasks (live count badge), Scheduled, Memory — `ACTIVE` status badge |
| **Browser Intelligence** | `fa-history` | HTTP History, WebSocket, Intercept (count badge) |
| **Floating Agent Center** | `fa-broadcast-tower` | Controls the floating agent panel overlay |

### 3. Security Operations

| Screen | Icon | Child Pages |
|--------|------|-------------|
| **Alerts & Evidence** | `fa-bell` | Critical (count badge), High, Evidence — alert count badge |
| **Investigations** | `fa-search-plus` | Active, Closed |
| **Incident Timeline** | `fa-timeline` | Today, This Week, All Events |

### 4. Observability

| Screen | Icon | Child Pages |
|--------|------|-------------|
| **Metrics (Datadog)** | `fa-tachometer-alt` | Agent Metrics, System |
| **Errors** | `fa-exclamation-triangle` | Error tracking and analysis |
| **Latency** | `fa-stopwatch` | API and scan latency monitoring |

### 5. System

| Screen | Icon | Child Pages |
|--------|------|-------------|
| **Settings** | `fa-sliders-h` | General, Agent Config, Network |
| **Privacy** | `fa-user-shield` | Privacy Mode, Data Control |
| **Logs** | `fa-file-alt` | Agent Logs, System Logs, Export |

### 6. Real-Time Intel

| Screen | Icon | Features |
|--------|------|----------|
| **Event Feed** | `fa-stream` | Live event stream with pulse count badge |
| **Risk Analysis** | `fa-chart-line` | Risk scoring trends |
| **Threat Map** | `fa-map-marked-alt` | Geographic threat visualization |

### 7. Scan Modes

| Mode | Icon | Description |
|------|------|-------------|
| **Quick Scan** | `fa-bolt` | Fast surface-level URL scan (default active) |
| **AI Deep Scan** | `fa-brain` | Full Gemini + ML analysis |
| **Stealth Mode** | `fa-user-secret` | Low-profile scanning |
| **Forensic Mode** | `fa-microscope` | Deep forensic evidence collection |

### Floating Agent Panel

A persistent overlay panel (toggle from sidebar or header) showing:

- **Agent Status**: Running/stopped, uptime, task count
- **URL SCANNING** section: Live feed of scanned URLs with risk scores, categories, and Gemini summaries
- **Activity Log**: Real-time agent actions (task creation, scan completion, alerts)
- **Quick Actions**: Start/stop agent, clear log

---

## Real-Time URL Scanning Pipeline

This is the crown jewel of the system — a fully autonomous pipeline that runs on every URL the user visits:

### Flow

```
User opens URL in Chrome/Safari/Firefox/Edge/Brave/Arc
         │
         ▼
    url_monitor.rs (Rust)
    Polls every 5 seconds via osascript
    Detects new URLs, deduplicates
         │
         ▼
    cyberforge-app.js (JS Renderer)
    _autoCreateScanTask(tab)
    Calls POST /api/agent/scan-url
         │
         ▼
    agentRoutes.js (Backend)
    Step 1: WebScraperAPIService.scrapeWebsite(url)
            → webscrapper.live/api/scrape
            → Returns: title, description, links, headers, metaTags, screenshot
         │
    Step 2: formatForAIAnalysis(scrapedData)
            → security_summary, risk_score, missing_headers, suspicious_requests
         │
    Step 3: mlServiceClient.classifyThreat(analysisData)
            → POST che237-cyberforge.hf.space/analyze-url
            → 4 model predictions: phishing, malware, anomaly, web_attack
            → Combined risk score (0-100)
         │
    Step 4: mlServiceClient.getExplanation(mlOutput, analysisData)
            → POST che237-cyberforge.hf.space/scan-threats
            → Gemini 2.5 Flash deep analysis
            → Risk score (0-10 → normalized to 0-100)
            → Recommendations, technical breakdown
         │
    Step 5: Create Appwrite alert if riskScore >= 30
         │
         ▼
    Desktop App receives full scan results
    • Updates URL feed (risk score, category, status badges)
    • Logs to Agent Console
    • Updates floating panel URL feed
    • Shows notification if threat detected
```

### Response Format

Every scan returns:

| Field | Source | Description |
|-------|--------|-------------|
| `riskScore` | ML Models | Combined risk 0-100 |
| `category` | ML Models | benign / phishing / malware / suspicious |
| `confidence` | ML Models | Classification confidence 0-1 |
| `modelPredictions` | HF `/analyze-url` | Per-model predictions (4 models) |
| `summary` | Gemini | Concise threat summary |
| `fullAnalysis` | Gemini | Complete analysis report |
| `recommendations` | Gemini | Actionable security recommendations |
| `geminiRiskScore` | Gemini | Gemini's own risk score (normalized 0-100) |
| `geminiConfidence` | Gemini | Gemini confidence 0-1 |
| `modelUsed` | Gemini | `gemini-2.5-flash` |
| `securitySummary` | Web Scraper | HTTPS, mixed content, headers, cookies |
| `missingHeaders` | Web Scraper | Missing security headers |
| `suspiciousRequests` | Web Scraper | Flagged network requests |
| `alertCreated` | Appwrite | Whether an alert was stored |

---

## Datasets & Training Data

The ML service includes **12 security-focused datasets** for model training:

| Dataset | Purpose |
|---------|---------|
| `anomaly_detection/` | Network anomaly patterns |
| `botnet_detection/` | Botnet command & control signatures |
| `cryptomining_detection/` | Cryptojacking indicators |
| `dns_tunneling/` | DNS tunneling patterns |
| `malware_detection/` | Malware behavioral signatures |
| `network_intrusion/` | Network intrusion patterns |
| `phishing_detection/` | Phishing URL and page features |
| `spam_detection/` | Spam content classification |
| `threat_intelligence/` | Threat intel feed data |
| `vulnerability_assessment/` | Vulnerability scoring data |
| `web_attack_detection/` | Web attack patterns (XSS, SQLi, etc.) |
| `web_security/` | General web security features |

Additional knowledge base:
- `knowledge_base/security_knowledge.json` — Security domain knowledge for the AI agent
- `training_data/` — Curated training examples
- `data/chroma_db/` — Vector embeddings for semantic search

---

## Deployment

### Heroku (Backend)

```bash
# Current: v74
git push heroku featureAgent-Core-+-Browser-Intelligence:main
```

**Environment Variables**:
- `AI_SERVICE_URL=https://che237-cyberforge.hf.space`
- `GEMINI_API_KEY=AIzaSy...` (Gemini API key)
- `GEMINI_MODEL=gemini-pro`
- `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`

### HuggingFace Space (ML)

- **Primary**: `https://che237-cyberforge.hf.space` — Gemini + ML models (ACTIVE)
- **Secondary**: `https://che237-cyberforge-models.hf.space` — Dedicated ML models (sleeping)

### Desktop App

```bash
cd desktop-app
npm run dev     # Development (Tauri dev server)
npm run build   # Production binary
```

### Docker (Local Development)

```bash
docker-compose up  # Starts all services locally
```

---

## Key Design Decisions

1. **Zero Fallbacks**: Every ML classification and Gemini explanation call goes through the real HuggingFace Space. If the service is down, the error propagates — no fake/demo data is ever returned.

2. **Dual Risk Scoring**: The system combines the web scraper's structural risk score (missing headers, HTTPS, etc.) with the ML model's threat score and Gemini's reasoning score. The highest risk wins.

3. **5-Second Polling**: URL monitoring polls every 5 seconds with deduplication. Each new URL triggers an immediate scan — no batching or delay.

4. **Appwrite Document-Level Permissions**: Uses `Permission.write(Role.any())` and `Permission.read(Role.any())` for Appwrite 1.8.1 compatibility where collection-level permissions are insufficient.

5. **Gemini 2.5 Flash**: Chosen for its speed (~10s analysis) and depth of reasoning, producing structured threat reports with confidence scores, MITRE ATT&CK mapping, and actionable recommendations.

---

*Last updated: February 23, 2026 — Heroku v74*
