# CyberForge — Developer Instructions

## Project Summary
CyberForge is a synchronized agentic AI cybersecurity ecosystem built as a research thesis project. It consists of a desktop app (Tauri/Electron), Node.js backend, FastAPI ML services, a browser extension, and a mobile app (React Native).

---

## Architecture

```
desktop-app/          Tauri desktop app
  src/renderer/       All UI: HTML, JS screens, CSS
    index.html        App shell entry point
    app.js            Navigation, theme toggle, status polling
    screens/          One JS file per screen (renders HTML into #screen-container)
    css/              Design system CSS files
    utils/            API client, WebSocket manager, theme manager

backend/              Node.js/Express API (port 3001)
  src/routes/         threats.js, analysis.js, etc.
  src/services/       threatService.js, etc.

ml-services/          FastAPI Python (port 8001)
  app/services/       ai_agent.py, enhanced_ai_agent.py, gemini_service.py
  app/routers/        analysis.py, threats.py, insights.py
```

---

## Design System

### CSS Load Order (index.html)
1. `css/design-tokens.css` — **Single source of truth for all tokens**
2. `css/enterprise-shell.css` — App shell layout (header, sidebar, content, footer)
3. `css/main.css` — Component styles that use `--cf-*` tokens
4. `css/enhanced-sidebar.css` — Sidebar nav specifics
5. `css/palette-override.css` — ONLY dark mode overrides via `[data-theme="dark"]`

### Token Usage
Always use `--cf-*` variables. Never hardcode colors in screen JS files.

| Token | Use |
|---|---|
| `--cf-bg-app` | Page background |
| `--cf-bg-elevated` | Cards, modals |
| `--cf-surface-1` | Secondary surfaces |
| `--cf-text-primary` | Main text |
| `--cf-text-secondary` | Supporting text |
| `--cf-interactive-default` | Primary brand color (forest green) |
| `--cf-status-success` | Safe / OK |
| `--cf-status-error` | Threat / Danger |
| `--cf-status-warning` | Caution |
| `--cf-status-info` | Info |

### Theme System
- Default: **dark mode** (`<html data-theme="dark">`)
- Toggle writes `document.documentElement.setAttribute('data-theme', theme)`
- Light mode: tokens in `:root {}` block of `design-tokens.css`
- Dark mode: `[data-theme="dark"] {}` block overrides

### Brand Colors
- **Primary**: Forest Green `#2E7D32` (interactive, active states, brand)
- **Background light**: `#F9FAFB` / White
- **Background dark**: `#111213` (darkest), `#1a1c1e`, `#23262a`
- **NO purple, NO violet, NO neon** — these are not part of the brand

---

## Adding a New Screen

1. Create `desktop-app/src/renderer/screens/my-screen.js`
2. Export a `render()` function that returns HTML string using `--cf-*` CSS variables
3. Wire data to backend: `GET http://localhost:3001/api/...` or ML `http://localhost:8001/...`
4. Register the screen in `app.js` screenRegistry
5. Add nav item in `index.html` sidebar with `data-screen="my-screen"`

### Screen Template
```javascript
window.MyScreen = {
  async render() {
    const data = await this.fetchData();
    return `
      <div class="screen-header">
        <h1 class="screen-title">Screen Title</h1>
      </div>
      <div class="screen-content">
        <!-- Use CSS classes from enterprise-shell.css + main.css -->
        <div class="cf-card">
          <div class="cf-card-body">${data}</div>
        </div>
      </div>
    `;
  },

  async fetchData() {
    try {
      const res = await fetch('http://localhost:3001/api/endpoint');
      return await res.json();
    } catch { return null; }
  },

  init() {
    // Attach event listeners after render
  }
};
```

---

## Backend API Reference

| Service | Base URL | Key Endpoints |
|---|---|---|
| Backend | `http://localhost:3001/api` | `/threats`, `/threats/stats`, `/analysis` |
| ML Services | `http://localhost:8001` | `/analyze`, `/analyze-url`, `/health`, `/agent/tasks` |

### Common Response Shapes
```json
// Threat
{ "id": "...", "type": "phishing", "severity": "high", "source": "...", "timestamp": "..." }

// ML Analysis
{ "response": "...", "confidence": 0.87, "insights": [], "recommendations": [] }
```

---

## Common Anti-Patterns to Avoid

- **Never** hardcode hex colors in screen JS files — use CSS variables
- **Never** add a new CSS `!important` override layer — fix the token instead
- **Never** toggle theme by adding/removing a class on `body` — write `data-theme` to `html`
- **Never** use `background-image: linear-gradient(...)` in UI components (enterprise rule)
- **Never** use inline `style="color: #xxx"` in generated HTML — use CSS classes

---

## Running the Stack

```bash
# Backend (port 3001)
cd backend && npm start

# ML Services (port 8001)
cd ml-services && python main.py

# Desktop App
cd desktop-app && npm start
```

Environment variables:
```bash
GEMINI_API_KEY=...      # For ML services
BACKEND_URL=http://localhost:3001
ML_SERVICE_URL=http://localhost:8001
```
