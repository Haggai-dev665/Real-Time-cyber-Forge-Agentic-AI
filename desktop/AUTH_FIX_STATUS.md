# Auth fix — status

## The bug
Login failed with: `error sending request for url (https://cyberforge-ddd97655464f.herokuapp.com/api/auth/login)`

That message is a **reqwest (Rust client) error**, not an HTTP error from the
server. Confirmed the server is healthy: `curl` to `/api/auth/login` returns
`401 Invalid credentials` (reachable, TLS fine).

## Root cause
`desktop/src-tauri/Cargo.toml` declared:
```toml
tokio = { version = "1", features = ["sync", "time"] }
```
reqwest needs Tokio's **IO/net driver + multi-thread reactor** to actually send
a request. With only `sync`+`time`, the runtime has no IO driver, so every
request fails immediately with the opaque "error sending request for url (...)".
The proven `desktop-app` uses `features = ["full"]`.

## Fix (applied)
1. **Cargo.toml** → `tokio = { version = "1", features = ["full"] }`.
2. **New `src/http.rs`** — one shared `reqwest::Client` builder (20s timeout +
   `cyber-forge-desktop/1.0` User-Agent) and `error_chain()`, which unwraps
   reqwest's opaque error via its `source()` chain so the UI shows the real
   cause (DNS / connection refused / TLS / timeout) instead of the wrapper.
3. Registered `mod http;` in `lib.rs`.
4. Routed auth/agent/ml/memory HTTP error handling through `http::error_chain`
   and the auth path through `http::client()`.
5. Removed a redundant client builder in `agent.rs`/`ml.rs`/`memory.rs`.

## Verified
`cargo check` → **EXIT=0**, `Finished dev profile` (only one cosmetic
unused-import warning, since cleaned up in `lib.rs`). The fix compiles.

## BLOCKER: disk space
The machine is chronically near-full. The Cargo `target/` debug cache grows to
~1.5 GB; building/running (`npm run dev` / `tauri dev`) needs several GB more
for the full debug binary + WebKit. With <2 GB free, the OS temp filesystem
hits ENOSPC, which breaks tooling.

**To run the app live, free ~5 GB**, then:
```bash
cd desktop
npm install      # if not already (installs @tauri-apps/cli)
npm run dev
```

`target/` was deleted to reclaim space — it regenerates on next build.
