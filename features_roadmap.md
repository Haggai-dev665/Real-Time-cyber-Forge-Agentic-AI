# CyberForge Platform — Feature Roadmap

> Last updated: 2026-05-04
> Branch: request-response-life-cycle

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ Done | Feature is built, wired to backend, and functional |
| ⚠️ Partial | Screen/route exists but depth is shallow or a sub-feature is missing |
| ❌ Not done | Not yet built — no screen, no backend route |

---

## TODO 1 — Foundation & Secure Architecture

### Goal
Establish the core security infrastructure: authentication, session management, browser intelligence from the desktop OS layer, and an observable dashboard baseline.

| Feature | Status | Detail |
|---------|--------|--------|
| Appwrite / Firebase authentication (login + register) | ✅ Done | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/firebase-sync`, Google OAuth (`/api/auth/google`, `/api/auth/google/token`, `/api/auth/google/callback`) |
| Persistent secure session handling | ✅ Done | JWT access tokens + `POST /api/auth/refresh`; token stored in localStorage; `GET /api/auth/verify-token` validates on every load |
| Desktop OS-aware browser intelligence (Rust core) | ⚠️ Partial | `screens/browser-intel.js` exists and calls `POST /api/browser-intelligence/session`; Tauri Rust layer is a thin `tauri-bridge.js` shim — native OS process inspection not implemented |
| Modern enterprise-grade UI baseline | ✅ Done | Full `design-tokens.css` token set, `enhanced-sidebar.css`, Font Awesome 6.5, Roboto + Roboto Mono, dark/light theme from `data-theme` attribute |
| Structured event emission system | ⚠️ Partial | `utils/websocket-manager.js` handles WS connection + reconnect; `utils/notification-system.js` dispatches toast events — no formal typed event-bus or pub/sub interface |
| Initial observability & dashboard structure | ✅ Done | `screens/dashboard.js` → `GET /api/threats/stats`; `screens/real-time-monitor.js` → `GET /api/threats` with live polling |

**TODO 1 verdict: 4/6 fully done, 2 partial.**

---

## TODO 2 — System Hardening & UI/UX Elevation

### Goal
Raise the UI to enterprise-grade, formalise motion and animation, embed the threat globe, and lock in a performant modular screen architecture.

| Feature | Status | Detail |
|---------|--------|--------|
| Advanced design system & token architecture | ✅ Done | `css/design-tokens.css` — all `--cf-*` tokens (bg, text, border, interactive, status, surface); `css/palette-override.css` layers brand teal |
| Motion timing matrix & animation standards | ⚠️ Partial | Loader animation (cfLoaderSpin + cfScanPulse), CSS `transition` on sidebar and nav items; no centralised `--cf-duration-*` motion token set |
| Floating agent control center | ⚠️ Partial | `renderer/agent-ui-controller.js` handles agent panel toggle; panel renders agent state in the header — not floating/draggable, not always visible |
| Threat globe integration | ✅ Done | `screens/threat-globe.js` — WebGL globe with threat markers, loaded alongside `screens/threat-center.js` |
| Theme system (dark / light) | ✅ Done | `utils/theme-manager.js` — toggles `data-theme` on `<html>`, persists to `localStorage`; `#theme-toggle` button in header |
| Performance optimisation & structured layout | ✅ Done | All 31 screens follow `show(container)` / `hide()` lazy-render SPA pattern; `utils/api-client.js` wraps all fetch calls centrally |

**TODO 2 verdict: 4/6 fully done, 2 partial.**

---

## TODO 3 — Behavioral Intelligence Engine

### Goal
Collect real-time behavioural signals, compute risk scores with configurable thresholds, produce human-readable alert explanations, and visualise event timelines.

| Feature | Status | Detail |
|---------|--------|--------|
| Real-time signal collection & feature extraction | ⚠️ Partial | `screens/behavioral-analysis.js` → `GET /api/threats` + `POST /api/ai/analyze/network` for ML feature extraction; signal collection is periodic poll, not a streaming pipeline |
| Risk scoring engine with thresholds | ⚠️ Partial | `screens/risk-assessment.js` → `GET /api/threats/stats`; scores are displayed but thresholds are hardcoded — no UI to configure low/medium/critical cutoffs |
| Explainable alert generation | ⚠️ Partial | `screens/ai-insights.js` → `POST /api/ai/insights`; `screens/ai-assistant.js` → `POST /api/ai/chat`; explanations are freeform AI text, not structured per-alert rationale with evidence links |
| Threat timeline visualisation | ⚠️ Partial | Chart.js time-series used in `screens/real-time-monitor.js` and `screens/threat-center.js`; no dedicated interactive timeline screen with zoom, filter, and drill-down |
| Live event streaming system | ✅ Done | `utils/websocket-manager.js` + polling fallback in `screens/real-time-monitor.js`; `GET /api/ai/monitoring/status`, `POST /api/ai/monitoring/start` / `stop` |
| Agent behavioral reaction model | ⚠️ Partial | `POST /api/agent/start`, `POST /api/agent/stop`, `GET /api/agent/status/:name`; agents respond to manual commands — no autonomous trigger-on-threshold behaviour |

**TODO 3 verdict: 1/6 fully done, 5 partial.**

---

## TODO 4 — Distributed Intelligence & Multi-Node Sync

### Goal
Give each desktop node a unique identity, sync telemetry to the cloud, aggregate cross-node signals, and broadcast updated threat weights back to all nodes.

| Feature | Status | Detail |
|---------|--------|--------|
| Node identity system (UUID + secure fingerprint) | ✅ Done | `POST /api/distributed/nodes/register` — stores node UUID and metadata; `screens/distributed-intelligence.js` calls this on init |
| Secure telemetry synchronisation | ✅ Done | `POST /api/browser-intelligence/session` sends full browser snapshot; `POST /api/distributed/nodes/register` syncs node state |
| Cloud aggregation & correlation engine | ⚠️ Partial | `GET /api/distributed/nodes` returns all nodes for the user; `GET /api/distributed/nodes/all` returns global view (admin) — no cross-node threat correlation or clustering logic |
| Dynamic global risk weight adjustment | ❌ Not done | No backend route for weight tuning; no UI control; no model update pipeline |
| Intelligence broadcast system | ⚠️ Partial | Nodes pull data via `GET /api/distributed/nodes`; no push/WebSocket broadcast from cloud to nodes |
| Global threat heatmap & distributed observability | ✅ Done | `screens/threat-globe.js` renders node positions + threat intensity; `screens/distributed-intelligence.js` shows live node table with status |

**TODO 4 verdict: 3/6 fully done, 2 partial, 1 not done.**

---

## TODO 5 — Autonomous Defensive Response Engine

### Goal
Build a policy framework that automatically triggers defensive actions (block, quarantine, escalate) when risk thresholds are crossed, with full logging and human-readable explanations.

| Feature | Status | Detail |
|---------|--------|--------|
| Policy definition framework | ❌ Not done | No policy data model in backend or database; no schema, no route |
| Risk-triggered automated responses | ❌ Not done | Agent routes exist (`/api/agent/start`) but nothing triggers them automatically based on risk score |
| Escalation ladder system | ❌ Not done | No escalation tiers (notify → restrict → isolate → block) |
| Containment & restriction mechanisms | ❌ Not done | No network block, process kill, or session termination capability via API |
| Explainability & intervention logging | ❌ Not done | No immutable log of automated actions taken; no "why did the system do X" record |
| Policy management control center UI | ❌ Not done | No screen exists; no sidebar item; not in any roadmap sprint |

**TODO 5 verdict: 0/6 done. Entire phase not started.**

---

## TODO 6 — Enterprise Multi-Tenancy & RBAC

### Goal
Isolate data by organisation, enforce role-based access (admin, analyst, viewer), provide a SOC command view, and produce an immutable audit trail for compliance.

| Feature | Status | Detail |
|---------|--------|--------|
| Organisation-level data isolation | ❌ Not done | All data is scoped per-user; no `org_id` field in any schema; no tenant model |
| Role-based access control (RBAC) | ❌ Not done | No role model in auth layer; no middleware guards checking user role before route access |
| SOC command dashboard | ❌ Not done | No dedicated SOC screen; no sidebar entry; would require org + role data to be meaningful |
| Scoped policy inheritance (global → org → node) | ❌ Not done | Depends on RBAC and policy framework (both not done) |
| Immutable audit trail system | ❌ Not done | No append-only log table; no audit event emission on sensitive actions |
| Enterprise-grade access governance | ❌ Not done | No MFA enforcement, no session timeout policy, no IP allowlist management |

**TODO 6 verdict: 0/6 done. Entire phase not started.**

---

## Overall Progress

| Phase | Done | Partial | Not Done | % Complete |
|-------|------|---------|----------|-----------|
| TODO 1 — Foundation | 4 | 2 | 0 | ~75% |
| TODO 2 — UI/UX | 4 | 2 | 0 | ~75% |
| TODO 3 — Behavioral Intelligence | 1 | 5 | 0 | ~30% |
| TODO 4 — Distributed Intel | 3 | 2 | 1 | ~55% |
| TODO 5 — Autonomous Response | 0 | 0 | 6 | 0% |
| TODO 6 — Enterprise RBAC | 0 | 0 | 6 | 0% |
| **Total** | **12** | **11** | **13** | **~38%** |

---

## Working Backend Endpoints (confirmed in route files as of 2026-05-04)

### Authentication — `backend/src/routes/auth.js`
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/profile
PUT    /api/auth/profile
PUT    /api/auth/change-password
POST   /api/auth/google
POST   /api/auth/google/token
GET    /api/auth/google/callback
POST   /api/auth/firebase-sync
GET    /api/auth/me
GET    /api/auth/verify-token
```

### Threats — `backend/src/routes/threats.js`
```
GET    /api/threats
GET    /api/threats/stats
POST   /api/threats/scan
GET    /api/threats/:threatId
PUT    /api/threats/:threatId/dismiss
PUT    /api/threats/:threatId/resolve
```

### Analysis — `backend/src/routes/analysis.js`
```
GET    /api/analysis/stats
GET    /api/analysis/history
POST   /api/analysis/url
POST   /api/analysis/bulk
GET    /api/analysis/:analysisId
DELETE /api/analysis/:analysisId
```

### AI — `backend/src/routes/ai.js`
```
POST   /api/ai/analyze/url
POST   /api/ai/analyze/file
POST   /api/ai/analyze/network
GET    /api/ai/analysis/history
GET    /api/ai/threats/summary
GET    /api/ai/monitoring/status
POST   /api/ai/monitoring/start
POST   /api/ai/monitoring/stop
GET    /api/ai/models/status
GET    /api/ai/ml-health
GET    /api/ai/ml-status
POST   /api/ai/chat
POST   /api/ai/chat-ml
POST   /api/ai/insights
POST   /api/ai/insights-ml
POST   /api/ai/analyze-website
POST   /api/ai/analyze-website-ml
POST   /api/ai/scan-threats
POST   /api/ai/scan-threats-ml
POST   /api/ai/network-analysis-ml
POST   /api/ai/execute-task
POST   /api/ai/execute-task-ml
POST   /api/ai/scrape-website
```

### ML Models — `backend/src/routes/mlRoutes.js`
```
GET    /api/ml/health
GET    /api/ml/models
GET    /api/ml/models/:modelName
POST   /api/ml/predict
POST   /api/ml/predict/batch
POST   /api/ml/analyze/url
POST   /api/ml/analyze/website
POST   /api/ml/scan
```

### Agents — `backend/src/routes/agentRoutes.js`
```
POST   /api/agent/start
POST   /api/agent/stop
GET    /api/agent/status/:agentName
GET    /api/agent/list
POST   /api/agent/task/create
GET    /api/agent/task/:taskId
GET    /api/agent/alerts
POST   /api/agent/browser-intelligence
GET    /api/agent/browser-intelligence
POST   /api/agent/scan-url
```

### Threat Hunting — `backend/src/routes/threat-hunting.js`
```
GET    /api/threat-hunting/hunts
POST   /api/threat-hunting/quick-hunt
POST   /api/threat-hunting/ai-hunt
POST   /api/threat-hunting/custom-hunt
POST   /api/threat-hunting/analyze-ioc
GET    /api/threat-hunting/iocs
GET    /api/threat-hunting/intelligence-feed
GET    /api/threat-hunting/mitre-techniques
POST   /api/threat-hunting/map-to-mitre
GET    /api/threat-hunting/hunt/:huntId
POST   /api/threat-hunting/hunt/:huntId/pause
POST   /api/threat-hunting/hunt/:huntId/stop
POST   /api/threat-hunting/behavioral-analysis
GET    /api/threat-hunting/statistics
POST   /api/threat-hunting/export
```

### Domain Intelligence — `backend/src/routes/domain-intelligence.js`
```
POST   /api/domain-intel/analyze
POST   /api/domain-intel/deep-scan
```

### Distributed Intelligence — `backend/src/routes/distributed.js`
```
GET    /api/distributed/health
POST   /api/distributed/nodes/register
GET    /api/distributed/nodes
GET    /api/distributed/nodes/all
```

### Browser Intelligence — `backend/src/routes/browser-intelligence.js`
```
POST   /api/browser-intelligence/session
```

### OTX Threat Intel — `backend/src/routes/otx.js`
```
GET    /api/otx/pulses
GET    /api/otx/search
GET    /api/otx/indicator/:type/:indicator
```

### Web Scraping — `backend/src/routes/web-scraping.js`
```
GET    /api/scraping/tasks
POST   /api/scraping/domain
```

---

## What Needs to Be Built Next

### Immediate (completes TODO 3 & 4)
1. **Configurable risk thresholds** — UI in `risk-assessment.js` + backend `PUT /api/threats/thresholds`
2. **Structured per-alert explanations** — `GET /api/threats/:id/explain` using ML reasoning chain
3. **Cross-node correlation** — aggregate threats across all nodes in `/api/distributed/correlate`
4. **Intelligence broadcast** — WebSocket push from backend to all registered nodes on new high-severity threat

### Medium-term (TODO 5)
5. **Policy schema** — `policies` collection in DB + CRUD routes `/api/policies`
6. **Response triggers** — background worker checks risk score vs. policy, fires agent actions
7. **Audit log** — append-only `audit_events` table + `GET /api/audit/log`

### Long-term (TODO 6)
8. **Org model** — `organisations` table, `org_id` FK on all user data
9. **RBAC middleware** — role checks on every protected route
10. **SOC dashboard screen** — new sidebar entry under Response, requires org + role data
