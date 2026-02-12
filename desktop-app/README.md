# Cyber Forge AI — Desktop Application (Tauri v2)

A high-performance desktop application built with **Tauri 2 (Rust + WebView)** for real-time web browsing analysis and AI-powered cybersecurity monitoring.

## Features

- **Real-time Browser Monitoring** — Tracks all web pages visited
- **Security Analysis** — ML-powered threat detection and analysis
- **AI Assistant** — Interactive AI for security insights and recommendations
- **Dashboard** — Live metrics and activity monitoring
- **Threat Detection** — Real-time security threat alerts
- **Cross-platform** — Works on Windows, macOS, and Linux

## Architecture

```
desktop-app/
├── package.json              # Tauri CLI & @tauri-apps/api
├── src/
│   ├── tauri-bridge.js       # Bridge layer (window.electronAPI → Tauri invoke)
│   ├── config/               # Shared constants & API endpoints
│   ├── assets/               # App icons, logos
│   └── renderer/             # Frontend UI (HTML / CSS / JS)
│       ├── caido-index.html  # Main dashboard
│       ├── auth-page.html    # Auth / login page
│       ├── caido-app.js      # Main controller (7k lines)
│       ├── auth-page.js      # Auth controller
│       ├── api-client.js     # REST client
│       ├── components/       # Reusable UI components
│       ├── screens/          # Feature-specific screen JS
│       ├── css/              # Stylesheets
│       └── utils/            # Helpers
└── src-tauri/
    ├── Cargo.toml            # Rust manifest
    ├── tauri.conf.json       # Tauri config (window, CSP, plugins)
    ├── icons/                # App icons
    └── src/
        ├── main.rs           # Entry point — plugin & command registration
        ├── state.rs          # Shared AppState (auth, WS, config)
        ├── commands.rs       # All invoke commands (auth, health, threats, …)
        ├── auth.rs           # OS Keychain token storage (keyring)
        ├── websocket.rs      # Persistent WS client with auto-reconnect
        └── system.rs         # Cross-platform browser detection
```

## Prerequisites

| Tool   | Version | Install |
| ------ | ------- | ------- |
| Rust   | 1.77+   | [rustup.rs](https://rustup.rs) |
| Node   | 18+     | [nodejs.org](https://nodejs.org) |
| Tauri CLI | 2.x  | Included in devDependencies |

### macOS extras
```bash
xcode-select --install
```

### Linux extras (Ubuntu / Debian)
```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

## Quick Start

```bash
# 1 — Install Node dependencies (Tauri CLI + API)
npm install

# 2 — Start dev mode (compiles Rust & opens window)
npm run dev

# 3 — Build a release bundle
npm run build
```

## Configuration

The app connects to:

| Service | URL |
| ------- | --- |
| Backend API | `https://cyberforge-ddd97655464f.herokuapp.com` |
| WebSocket | `wss://cyberforge-ddd97655464f.herokuapp.com/ws` |
| ML Service | `https://che237-cyberforge-models.hf.space` |

Backend URL is configured in `src-tauri/src/state.rs`.

## Security Features

- **Protocol Analysis** — Detects insecure HTTP connections
- **Domain Reputation** — Checks for suspicious domain patterns
- **Header Analysis** — Validates security headers
- **Risk Scoring** — Calculates security risk scores
- **Real-time Alerts** — Immediate threat notifications via WebSocket
- **OS Keychain Auth** — Tokens stored in macOS Keychain / Windows Credential Manager / Linux Secret Service

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Backend | Rust (Tauri 2) |
| Frontend | HTML / CSS / Vanilla JS (WebView) |
| HTTP Client | reqwest |
| WebSocket | tokio-tungstenite |
| System Info | sysinfo |
| Secrets | keyring |
| Async Runtime | tokio |

## License

MIT — Copyright © 2026 CyberForge
