# CyberForge — AI Security Console (Desktop)

A standalone **Rust + Tauri v2** desktop application that ships the CyberForge SOC
interface exactly as designed. It is a pure frontend shell for now — **no backend
is wired up** — so it loads the static HTML/CSS/JS UI directly.

## Project structure

```
desktop/
├── package.json            # npm scripts (tauri dev / build)
├── README.md
├── .gitignore
├── ui/                     # frontend — this is Tauri's frontendDist
│   ├── index.html          # entry → redirects to pages/loading.html
│   ├── pages/              # all 17 screens (Loading, Login, Threat Overview, …)
│   ├── styles/             # cyberforge.css, cf-auth.css
│   ├── scripts/            # cf-header / cf-sidebar / cf-footer / cf-forge / shared
│   └── assets/             # brand SVGs
└── src-tauri/              # Rust side
    ├── Cargo.toml
    ├── build.rs
    ├── tauri.conf.json     # window + bundle config, frontendDist = ../ui
    ├── capabilities/
    │   └── default.json    # core permissions for the main window
    ├── icons/              # app icons (png/ico/icns)
    └── src/
        ├── main.rs         # thin binary entry → lib::run()
        └── lib.rs          # Tauri builder (add #[tauri::command]s here later)
```

### App flow

`Loading` → `Login` / `Register` → `Threat Overview` (dashboard). From the
dashboard, the shared sidebar/header navigate between every screen. Screens that
were placeholders in the design (`#` links such as *8-Agent Orchestrator*,
*Active Tasks*, *Floating Agent Center*) remain intentionally inert.

## Prerequisites

- [Rust](https://rustup.rs/) (stable, 1.77.2+)
- Node.js 18+ and npm
- Platform toolchain for Tauri v2 — see <https://v2.tauri.app/start/prerequisites/>

## Run in development

```bash
cd desktop
npm install        # installs the Tauri CLI (@tauri-apps/cli)
npm run dev        # launches the desktop app with devtools
```

## Build a release bundle

```bash
cd desktop
npm install
npm run build      # produces installers under src-tauri/target/release/bundle/
```

## Notes

- Fonts (Space Grotesk / JetBrains Mono) load from Google Fonts when online and
  fall back to system fonts offline — the design's CSS already declares fallbacks.
- This app is independent of the existing `desktop-app/` (different bundle
  identifier `com.cyberforge.console`), so both can be installed side by side.
- To add backend functionality, define `#[tauri::command]` functions in
  `src-tauri/src/lib.rs`, register them via `invoke_handler`, and call them from
  the frontend with the global `window.__TAURI__` API.
