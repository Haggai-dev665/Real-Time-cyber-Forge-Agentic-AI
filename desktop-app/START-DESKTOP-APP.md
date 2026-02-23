# CyberForge Desktop App — Start Guide

## Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| **Node.js** | 18+ | `node -v` |
| **npm** | 9+ | `npm -v` |
| **Rust** | 1.70+ | `rustc --version` |
| **Cargo** | 1.70+ | `cargo --version` |

> **macOS Users**: Xcode Command Line Tools are also required:
> ```bash
> xcode-select --install
> ```

---

## One-Time Setup

### 1. Install Rust (if not already installed)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

When prompted, choose **option 1** (default installation).

### 2. Fix Rust PATH for VS Code (macOS)

On macOS, the Rust installer adds `cargo` to `~/.zshenv`, but macOS's `path_helper` (in `/etc/zprofile`) reorders PATH **after** `.zshenv` runs, which removes `cargo` from the PATH. This causes VS Code terminals to fail with:

```
failed to run 'cargo metadata' command ... No such file or directory (os error 2)
```

**Fix**: Add the following line to the **end** of `~/.zshrc`:

```bash
# Rust/Cargo PATH (must be in .zshrc, not just .zshenv, because macOS path_helper reorders PATH)
. "$HOME/.cargo/env"
```

You can do this in one command:

```bash
echo '' >> ~/.zshrc
echo '# Rust/Cargo PATH (must be in .zshrc, not just .zshenv, because macOS path_helper reorders PATH)' >> ~/.zshrc
echo '. "$HOME/.cargo/env"' >> ~/.zshrc
```

Then **restart VS Code** (or open a new terminal) for the change to take effect.

### 3. Install Node dependencies

```bash
cd desktop-app
npm install
```

### 4. (Optional) Set up environment

```bash
cp .env.example .env
# Edit .env with your backend URL, Google OAuth, Appwrite credentials, etc.
```

---

## Starting the App

```bash
cd desktop-app
npm run dev
```

This runs `tauri dev`, which will:
1. Compile the Rust backend (first run takes 2-5 minutes)
2. Launch the CyberForge desktop window
3. Hot-reload on frontend changes

### Build for Production

```bash
npm run build        # Release build
npm run build:debug  # Debug build with devtools
```

---

## Troubleshooting

### `cargo metadata` — No such file or directory

**Cause**: Rust/Cargo is not in the terminal's PATH.

**Fix**:
```bash
# Verify cargo is installed
ls ~/.cargo/bin/cargo

# If installed but not in PATH, source it manually
source ~/.cargo/env

# Then add it permanently to ~/.zshrc (see One-Time Setup above)
```

After editing `~/.zshrc`, **close and reopen VS Code** completely (not just the terminal).

### First build is slow

The initial `tauri dev` compiles all Rust dependencies. This is a one-time cost (~2-5 min). Subsequent runs use cached builds and start in seconds.

### `Error: failed to run custom build command for ...`

Usually a missing system dependency. On macOS, ensure Xcode CLI tools are installed:
```bash
xcode-select --install
```

### Port conflicts

The app connects to:
- Backend: `http://localhost:8000` (or your `BACKEND_URL`)
- ML Services: `http://localhost:8001` (or your `ML_SERVICE_URL`)
- WebSocket: `ws://localhost:8000/ws`

Make sure these services are running, or point `.env` to your deployed endpoints.

### Clearing Rust build cache

If builds are broken/corrupted:
```bash
cd desktop-app/src-tauri
cargo clean
cd ..
npm run dev
```

---

## Project Structure

```
desktop-app/
├── package.json              # Node deps + scripts (tauri dev/build)
├── .env.example              # Environment template
├── src/                      # Frontend (HTML/CSS/JS)
│   ├── renderer/             # Main UI pages
│   ├── ai-interface/         # AI assistant interface
│   ├── browser-monitor/      # Browser detection module
│   ├── config/               # App configuration
│   └── auth/                 # Authentication flow
└── src-tauri/                # Rust backend
    ├── Cargo.toml            # Rust dependencies
    ├── tauri.conf.json       # Tauri window/bundle config
    └── src/                  # Rust source (commands, plugins)
```

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev mode with hot-reload |
| `npm run build` | Production build |
| `npm run build:debug` | Debug build with devtools |
| `cargo --version` | Verify Rust toolchain |
| `source ~/.cargo/env` | Manually load Rust PATH |
