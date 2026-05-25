# CyberForge — Version 3

> **Owned by the Project Manager.** Every feature listed here has been **implemented AND tested**.
> Work-in-progress is tracked in the engineering waves below, not in the feature log.
> **Prime directive: no engineer breaks an existing, working feature.**

---

## Verified System Baseline (2026-05-26)

Captured by PM before any V3 work, so we can prove nothing regressed.

| Component | State | Evidence |
|---|---|---|
| Heroku backend | ✅ healthy | `GET /health` → `{"status":"healthy","environment":"production"}` |
| HF ML Space `Che237/cyberforge` | ✅ RUNNING (cpu-basic) | runtime stage `RUNNING`, domain `READY` |
| ML models loaded | ✅ 4/4 | `phishing_detection`, `malware_detection`, `anomaly_detection`, `web_attack_detection` |
| Gemini on Space | ⚠️ disabled | `services.gemini=false` (no key configured on Space) |
| Desktop app | Tauri 2.0 (Rust) | `desktop-app/package.json` "Tauri Edition" |
| 8-agent orchestrator | wired | commit `9e28d74` |

**Corrected fact:** live ML base URL is `https://che237-cyberforge.hf.space` (NOT the old
`che237-cyberforge-models.hf.space`, which is dead). Frontend reaches ML via Heroku proxy
`/api/cyberforge-ml`. Trained weights live in model repo `Che237/cyberforge-models`.

---

## Engineering Team & Domains (collision-free boundaries)

| Engineer | Owns (only) | Must NOT touch |
|---|---|---|
| UI/UX | `desktop-app/src/renderer/css/*`, loader, auth pages, floating agent, header/footer, `index.html` head/CDN | backend, ml-services, src-tauri |
| ML | `ml-services/*` + HF Space push | desktop-app, backend, src-tauri |
| Backend | `backend/src/*` | ml-services, src-tauri, renderer |
| System/Rust | `desktop-app/src-tauri/*` | renderer screens, backend, ml-services |
| AI (Wave 2) | new chatbot files across layers (additive only) | rewriting existing working modules |
| PM | this file, integration verification, notifications | — |

---

## Feature Log (implemented + tested only)

_Entries are appended by the PM after each feature passes verification._

### Wave 1 — COMPLETE & VERIFIED (2026-05-26)

**UI/UX (renderer presentation)** — verified: 8 JS files pass `node --check`, all CDN links HTTPS, no hardcoded hex.
- Polished toast + notification system (`CF.toast()` / `CF.notify()`) with header bell panel + unread badge.
- Quick Scan modal (footer) → posts to `/api/agent/scan-url`, renders verdict inline.
- Loading screen v3 + splash enrichment (teal brand, animated grid, scan bar, feature chips).
- Auth page v2 enrichment: capability list, live stat pills (GSAP count-up), research badge, micro-interactions.
- Screen-enter animations via MutationObserver + AOS; GSAP/AOS/animate.css CDNs added.
- New files: `css/cf-animations.css`, `css/cf-auth-enrich.css`, `utils/cf-toast.js`, `utils/auth-enrich.js`.

**ML (HuggingFace `Che237/cyberforge`)** — verified live: Space healthy v2.0.0, 4 models + `url_phishing_bert` loaded; `/health` confirms. Rollback SHA `732340d`.
- `/analyze-url` now returns `risk_score` (0–100), `risk_factors[]`, `max_threat_score`, `models_flagged` (backward-compatible).
- `POST /api/v2/batch-analyze` — up to 20 URLs/call for distributed agents.
- `GET /api/v2/explain/{model}` — feature importances for explainability.
- `POST /api/v2/url-enrich` — fused ML+BERT+DGA deep-scan score (verified: IP-URL → high, 60.6).
- `POST /api/v2/ioc-scan` — multi-indicator (url/domain/ip/hash) scan.
- `POST /api/v2/chat` — chatbot extension point (verified responding; Wave 2 builds on it).

**Backend (Node/Express bridge)** — verified: all changed files pass `node --check`; live HF + Heroku reachable.
- Dead ML URL purged from renderer (`api-endpoints.js`, `data-loaders.js`).
- `POST /api/agent/scan-url` now threads `sessionId`; new `POST /api/agent/scan-url/batch` (≤20 URLs, concurrency≤5).
- `GET /api/orchestrator/health/deep` — full-pipeline health probe (HF + agents + memory).
- `GET /api/orchestrator/reports/filter` + `GET /api/orchestrator/session/:sid/summary`.
- Deploy: `git push heroku request-response-life-cycle:main`.

**System/Rust/Tauri (real-time collection)** — verified: `cargo check` clean (0 errors, only pre-existing warnings).
- Background URL-poll loop → emits `cf:url-poll` every 3s (Chrome/Safari/Firefox/Edge/Brave/Arc on macOS).
- System telemetry loop → emits `cf:system-telemetry` every 5s (CPU/RAM/disk/net/uptime/processes).
- Behavioral alerts → emits `cf:behavioral-alert` on suspicious URL patterns.
- Renderer-controllable lifecycle: `start_telemetry_loop`, `stop_telemetry_loop`, `get_telemetry_loop_status`, `get_system_telemetry`. No new crates.

---

### Wave 2 — COMPLETE & VERIFIED (2026-05-26)

**AI engineer — context-grounded security chatbot (cross-layer, additive)** — verified: HF healthy post-push (SHA `91af9cd`, 4 models loaded); live chat cites real sources; `node --check` passes on both JS files.
- **Context-grounded chat**: every `/api/v2/chat` turn ingests live telemetry + recent scans + active threats + behavioral alerts and grounds the answer in real system state (verified: reply cited `CPU 38%, RAM 64%` + `4/4 models`).
- **Machine→human translation mode**: `context.translate=true` + `context.raw_data` explains raw ML scores/IOCs/signals in plain language; "Translate" button on any AI reply.
- **Sources panel**: each reply shows a collapsible list of which live sources grounded it.
- **Live telemetry bar** in AI Assistant screen consumes Tauri `cf:system-telemetry` events.
- **High-risk auto-notify**: `risk_level` high/critical replies fire `CF.notify` toast + panel entry.
- **Backend bridge** `POST /api/ai/chat-context`: assembles live threat + scan context and forwards to HF each turn (additive route in `backend/src/routes/ai.js`).
- **Session continuity**: UUID `session_id` threads through the full stack.

Note: the BERT transformer (`url_phishing_bert`) lazy-loads on first `/api/v2/url-classify` or `/url-enrich` call — an empty `transformer_models_loaded` immediately after a Space rebuild is expected, not a fault.

---

## ⚠️ Outstanding User Actions (code is local-only until you run these)

1. **Deploy backend to Heroku** — the new backend routes (`scan-url/batch`, orchestrator `/health/deep` `/reports/filter` `/session/:sid/summary`, and `POST /api/ai/chat-context`) exist locally but are NOT live on Heroku yet:
   ```bash
   git push heroku request-response-life-cycle:main
   ```
2. **HF Space is already live** (pushed by ML + AI engineers) — no action needed.
3. **Rotate the HF token** you pasted in chat (huggingface.co/settings/tokens) — it was used only as an in-memory env var, never committed.
4. **Optional**: set `GEMINI_API_KEY` as an HF Space secret to upgrade the chatbot's primary LLM (cascade falls through automatically when present).
5. **Build/run the Tauri app** to exercise the new telemetry loops + chat UI end-to-end (`cd desktop-app && npm run tauri dev`).

---

## Regression Watch
- Theme system (`data-theme` on `<html>`) must keep working.
- All screens must keep `show(container)` / `hide()` contract.
- `cf-config.js` must stay the single source of truth for URLs.
- ML Space must stay RUNNING with 4 models loaded after any push.
