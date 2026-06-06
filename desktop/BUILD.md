# CyberForge — Production Build & Packaging

CyberForge Console is a **Tauri 2** desktop app (Rust + static HTML/JS UI in `ui/`).
`tauri build` compiles the Rust binary in release mode and produces native, signed-able
installers for the OS you build on. **Tauri does not cross-compile installers** — build each
platform on that platform (or a CI runner / VM for it).

On first launch the app prepares its per-user data directory and seeds the crucial
files (`hf_config.json`, `README.txt`); see [First-run filesystem](#first-run-filesystem).

---

## 1. Prerequisites (all platforms)

- **Rust** (stable): https://rustup.rs  → `rustup default stable`
- **Node.js 18+** and npm (for the Tauri CLI)
- Install the Tauri CLI for this project once:
  ```bash
  cd desktop
  npm install
  ```

Platform toolchains:

| Platform | Also install |
|----------|--------------|
| **Windows** | Visual Studio **Build Tools** (Desktop C++), **WebView2 Runtime** (preinstalled on Win10/11). NSIS is fetched by Tauri automatically. |
| **macOS** | `xcode-select --install` (Command Line Tools) |
| **Linux**  | `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev` (Debian/Ubuntu names) |

> The release profile is already tuned for production in `src-tauri/Cargo.toml`
> (`strip`, `lto`, `panic=abort`, `opt-level="s"`).

---

## 2. Build commands

Run all commands from the **`desktop/`** folder. The base command is the same everywhere:

```bash
npm run build           # = tauri build  (release binary + installers for the host OS)
```

### Windows  → `.msi` + `.exe`
```powershell
cd desktop
npm run build
```
Outputs in `src-tauri\target\release\bundle\`:
- `msi\CyberForge_1.0.0_x64_en-US.msi`   (WiX installer)
- `nsis\CyberForge_1.0.0_x64-setup.exe`  (NSIS installer — **registers an uninstaller** in *Settings → Apps*)

Build only one installer type if you prefer:
```powershell
npm run tauri -- build --bundles nsis      # or:  --bundles msi
```

### macOS  → `.app` + `.dmg`
```bash
cd desktop
npm run build                                   # builds for the host arch
# Universal (Intel + Apple Silicon) build:
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri -- build --target universal-apple-darwin
```
Outputs in `src-tauri/target/release/bundle/` (or `.../universal-apple-darwin/release/bundle/`):
- `macos/CyberForge.app`
- `dmg/CyberForge_1.0.0_<arch>.dmg`

### Linux  → `.deb` + `.rpm` + `.AppImage`
```bash
cd desktop
npm run build
# Or a single type:
npm run tauri -- build --bundles appimage      # or: deb / rpm
```
Outputs in `src-tauri/target/release/bundle/`:
- `deb/cyber-forge_1.0.0_amd64.deb`
- `rpm/cyber-forge-1.0.0-1.x86_64.rpm`
- `appimage/cyber-forge_1.0.0_amd64.AppImage`

A quick debug bundle (faster, unoptimised) for smoke-testing:
```bash
npm run build:debug
```

---

## 3. Code signing (optional but recommended for distribution)

- **Windows:** set `bundle.windows.certificateThumbprint` in `src-tauri/tauri.conf.json`
  to your code-signing cert thumbprint (timestamp URL is already set to DigiCert).
- **macOS:** export `APPLE_SIGNING_IDENTITY` (and notarisation creds `APPLE_ID`,
  `APPLE_PASSWORD`, `APPLE_TEAM_ID`) before `npm run build`.
- Unsigned builds run fine locally; users will see an OS "unverified developer" prompt.

---

## 4. First-run filesystem

`prepare_filesystem()` runs on every launch (idempotent) and guarantees the per-user
data directory + crucial files exist after install:

| OS | Data directory |
|----|----------------|
| Windows | `%APPDATA%\com.cyberforge.console` |
| macOS   | `~/Library/Application Support/com.cyberforge.console` |
| Linux   | `~/.config/com.cyberforge.console` |

Seeded / created there: `hf_config.json` (editable HF token, empty by default),
`README.txt`, plus — created on demand by the app — `memories.json`, `blocklist.json`,
`protected.json`, `allowed.json`, `session.json`, `install.json`.
**All data stays on-device.**

---

## 5. Uninstalling

The installers register a real uninstaller (Windows: *Settings → Apps → CyberForge*;
Linux `.deb/.rpm`: `sudo apt remove cyberforge` / `sudo dnf remove cyberforge`;
macOS/AppImage: delete the app). Those intentionally leave your **data** behind.
To also remove the data directory and the PATH entry, run the bundled script:

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File scripts\uninstall.ps1
```
```bash
# macOS / Linux
chmod +x scripts/uninstall.sh
./scripts/uninstall.sh
```
Flags: `--force` (no prompts), `--keep-data` / `-KeepData` (remove app, keep data).
