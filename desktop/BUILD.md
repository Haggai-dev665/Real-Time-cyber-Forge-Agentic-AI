# Building the CyberForge desktop app

The desktop app is a [Tauri 2](https://tauri.app) application: a Rust program
(`src-tauri/`) that shows the pages in `ui/` and makes every network call
itself. There is no JavaScript build step; the pages are plain HTML, CSS and
JavaScript.

**What has been checked, and where.** The commands below were run on Windows 11
with Rust 1.98 and Node 24: `cargo check`, `cargo test --lib` and `npm run dev`
compile. A full installer build (`npm run build`) and builds on macOS and Linux
have **not** been run for the current code. The steps for those two systems
come from Tauri's requirements and from this project's configuration, not from
a build that was watched.

## What you need

| | Windows | macOS | Linux |
| --- | --- | --- | --- |
| Rust | 1.77.2 or newer, MSVC toolchain | 1.77.2 or newer | 1.77.2 or newer |
| Node | 24 | 24 | 24 |
| System | Microsoft C++ Build Tools; WebView2 (part of Windows 11) | Xcode Command Line Tools | WebKitGTK 4.1 and the usual Tauri packages, plus the D-Bus development package |

On Debian or Ubuntu the Linux packages are:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libdbus-1-dev
```

`libdbus-1-dev` is needed because the app keeps its tokens in the Secret
Service (see “Where credentials are kept”). Tauri's own, current list is at
<https://tauri.app/start/prerequisites/>.

## Run it while developing

```bash
cd desktop
npm install        # installs the Tauri command-line tool
npm run dev        # builds the Rust side and opens the app
```

The first build downloads and compiles the Rust dependencies and takes several
minutes. Later builds take seconds.

## Run the tests

```bash
cd desktop/src-tauri
cargo test --lib
```

Three tests are skipped unless asked for by name, because they touch something
outside the test's own files:

| Test | What it touches |
| --- | --- |
| `credential_tests::the_real_credential_store…` | Writes one throwaway entry to this machine's credential store and removes it |
| `redaction_tests::the_file_on_this_machine…` | Reads the browser-history file already in the app's data folder and prints counts |
| `stream_tests::the_live_backend…` | Connects to a backend with a session given in `CF_LIVE_BASE` and `CF_LIVE_TOKEN` |
| `device_tests::the_live_backend…` | Enrolls a throwaway in-memory key with that backend and session, approves it, sends a heartbeat and revokes it (not this machine's credential store) |

Run one with `cargo test --lib <name> -- --ignored --nocapture`.

`acl_tests` runs the app's real command permissions on Tauri's mock runtime and
checks that the threat-alert popup can call only its own four commands.

## The shared core and the `cyberforge` CLI

`desktop/src-tauri` is also the root of a Cargo workspace that holds:

- `crates/cyberforge-core`: the credential store, config directory, HTTP client, server origins, profiles, the operation registry, MCP grants, and the server operations the CLI and the MCP server share;
- `crates/cyberforge-cli`: the `cyberforge` terminal command;
- `crates/cyberforge-mcp`: the MCP server the CLI runs as `cyberforge mcp serve`. It needs Rust 1.88 or later.

Build and test them from the same folder:

```bash
cd desktop/src-tauri
cargo test -p cyberforge-core -p cyberforge-cli -p cyberforge-mcp
cargo build -p cyberforge-cli --release     # target/release/cyberforge(.exe)
```

The CLI's commands so far:

- **`version`.**
- **`status`:** writes nothing. It checks four things: the server's `/health`, whether the credential store can be read, the profile's session if one is kept, and which program owns this computer's CyberForge state. It exits 4 when the server does not answer.
- **`auth login | status | logout`:**
  - the password is read hidden from the terminal, or from standard input with `--password-stdin`, never from an argument;
  - the session is kept only in the credential store;
  - `logout` removes it from this computer, but the backend cannot revoke tokens yet, so it stays valid until it expires.
- **`profile list | use`** and **`config list | get | set origin`:** changing a profile's origin removes the session kept for the old one.
- **`models status`:** what the Analysis Agents can do now, as the server reports it.
- **`scan url <URL> [--fail-on VERDICT]`:** one address analysed by the Analysis Agents. Credentials are removed from the address before it is sent.
- **`mcp serve | grant create | grant list | grant revoke | config`:** the MCP server, below.

Every command takes `--json` and then prints one machine-readable envelope.

### One owner of this computer's state

The first CyberForge program to start becomes the owner of this computer's CyberForge state. Only the owner:

- runs the device heartbeat loop and signs this device's messages;
- keeps the device outbox and changes the hosts file;
- writes local memory, the saved copy of browser history and the privacy settings.

**Another copy of the app** opens normally but refuses those changes, and the Devices page shows which program owns them. It takes over within ten seconds of the owner closing, and first reloads memory from disk so it does not write an old copy back.

**How it is enforced:**

- **Windows:** a per-user named pipe, `\\.\pipe\cyberforge-broker-<your SID>`. Holding it is the lock. Both ends check that the other runs as the same Windows user.
- **macOS and Linux:** an `flock` on `broker.lock` and a socket `broker.sock`, in `$XDG_RUNTIME_DIR/cyberforge-<uid>` (else the temporary folder). The folder is made 0700 and refused if anyone else can enter it. Both ends check the other's user ID. This is compiled for both systems, but has not been run on them yet.
- **Other systems:** there is no broker, so ownership is not enforced and the app behaves as before.

**From the CLI:**

- **`cyberforge broker status`** shows the owner. `cyberforge status` includes it. These ask `broker.status`, the only operation the broker answers so far.
- **`cyberforge broker hold [--for SECONDS]`** takes the lock explicitly and runs nothing on it, so no CyberForge window changes device state while it holds the lock. It releases on Ctrl+C or after `--for`. It never takes the lock from a running owner (exit 7).

### The MCP server

AI clients that speak the Model Context Protocol (Claude Desktop, IDE assistants
and others) can use CyberForge once you approve them. Approving a client creates
a **grant**. The client then starts `cyberforge mcp serve --stdio --grant <id>`
itself. Standard output carries protocol messages only; diagnostics go to
standard error.

**Tools.** A client gets only the tools its grant includes. All of them are read-only:

| Tool | Operation | Granted by default |
|---|---|---|
| `cyberforge_status` | `status`: the server, credential store, session and local owner | yes |
| `cyberforge_model_status` | `models.status`: what the Analysis Agents can do now | yes |
| `cyberforge_analyze_url` | `scan.url`: sends an address you or the client choose to your server for analysis, with credentials removed first | only with `--allow scan.url` |

**Approve, list and revoke.** Use Settings > Integrations in the app, or the CLI:

```bash
cyberforge auth login                                      # the CLI profile the client will act as
cyberforge mcp grant create --name "Claude Desktop" [--allow scan.url] [--days 90]
cyberforge mcp config --grant <id>                         # the configuration to paste into the client
cyberforge mcp grant list
cyberforge mcp grant revoke <id>
```

The configuration names the program and the grant; it holds no password or token:

```json
{ "mcpServers": { "cyberforge": { "command": "<path to cyberforge>", "args": ["mcp", "serve", "--stdio", "--grant", "g_…"] } } }
```

**How a grant works:**

- It acts as the CLI profile that was current when it was made, with that profile's session. That is not the app's session. The app approves clients by running the installed CLI, so only the CLI ever reads the CLI's session.
- A grant is made only for an account the server confirms.
- Every tool list and call checks the grant again. Each of these refuses the next call: revoking the grant, its expiry (1–365 days, 90 by default), signing the profile in to another account, or pointing the profile at another server.
- Each call is logged in `mcp-calls.jsonl` in the CLI's folder (the last 500): the time, grant, tool and outcome, never what was sent. Settings > Integrations shows the last 20.

**Protocol versions.** The server uses the official Rust SDK, `rmcp`, pinned to an
exact version. It answers clients that start with `initialize` (protocol
2024-11-05 to 2025-11-25) and clients of 2026-07-28, which send no
`initialize`. `crates/cyberforge-mcp/tests/protocol.rs` covers both, and every
way a grant stops a call. It runs against a local stand-in server with sessions
held in memory. `crates/cyberforge-cli/tests/mcp.rs` spawns the real binary and
checks that standard output carries only JSON-RPC.

The operations the CLI and the MCP server offer are listed once, in
`crates/cyberforge-core/src/operations.rs`. Two things are checked against that
list: a CLI test fails if the CLI's command tree differs from it, and the MCP
tools are generated from its MCP entries.

One CLI test signs in for real on this machine's credential store and signs out
again; it is skipped unless asked for:
`cargo test -p cyberforge-cli --test auth -- --ignored`.

The CLI keeps its own files and sessions apart from the app's: the folder and
credential-store service `com.cyberforge.cli`, with `profiles.json` (no
secrets). Set `CYBERFORGE_CONFIG_DIR` to an absolute path to use another
folder, and `CYBERFORGE_PROFILE` or `--profile` to choose a profile. MCP
grants (`mcp-grants.json`) and the call log are kept in the same folder.

## Adding a command

The app's own commands are permitted per window. A new `#[tauri::command]` has
to be added in three places, or every call to it is refused at runtime:

1. `generate_handler![…]` in `src/lib.rs`;
2. `COMMANDS` in `build.rs`;
3. `allow-<name-with-dashes>` in `capabilities/main.json`, and in
   `capabilities/threat-alert.json` only if the popup needs it.

`npm run validate:updates` fails if these disagree.

On Windows (MSVC) the application manifest comes from `windows-app-manifest.xml`
through the linker, so the test binary gets it too; see `build.rs`.

The checks that guard this app's behaviour from the outside (no invented
figures, no token in a page, credentials only in the credential store) live
with the backend's tests and run from the repository root:

```bash
npm run validate:updates
```

## Build installers

```bash
cd desktop
npm run build          # release build and installers
npm run build:debug    # the same, unoptimised, with the developer console
```

`tauri.conf.json` asks for every installer type the host system can make
(`"targets": "all"`). Output goes to `src-tauri/target/release/bundle/`
(`target/debug/bundle/` for the debug build):

| Built on | Produces |
| --- | --- |
| Windows | An NSIS setup program (installs for the current user, no administrator needed) and an MSI |
| macOS | `CyberForge.app` and a `.dmg` |
| Linux | `.deb`, `.rpm` and `.AppImage` |

Tauri builds for the system it runs on. To get all three, build on all three.

**The `cyberforge` CLI is part of the installers.**

- **Building:** `npm run build` first runs `scripts/build-cli.mjs`, which builds the CLI in release mode and places it at `src-tauri/binaries/cyberforge-<target>` (not tracked). It then builds with the overlay `src-tauri/tauri.cli.conf.json`, which adds the CLI as a sidecar. The plain `tauri.conf.json` does not name it, because Tauri checks that a sidecar exists whenever the app compiles, and `cargo build` and `tauri dev` must keep working without one.
- **Windows:** the CLI is installed beside `CyberForge.exe` as `cyberforge.exe`.
  - **NSIS (per user):** the setup program adds the install folder to the user's PATH (`installer/hooks.nsh` runs `installer/path-add.ps1`), and the uninstaller removes exactly that entry (`path-remove.ps1`). Other PATH entries are kept as they were, unexpanded.
  - **MSI (per machine):** the installer adds the folder to the system PATH (`installer/cli-path.wxs`), and Windows Installer removes it on uninstall.
  - **After either:** open a new terminal for `cyberforge` to be found.
- **Linux:** the `.deb` and `.rpm` install it as `/usr/bin/cyberforge`.
- **macOS:** it is in `CyberForge.app/Contents/MacOS/cyberforge`. Link it onto your PATH yourself, for example `ln -s /Applications/CyberForge.app/Contents/MacOS/cyberforge /usr/local/bin/cyberforge`.

### Signing

Nothing is signed as configured:

- **Windows:** `certificateThumbprint` is `null`. An unsigned installer runs,
  and Windows SmartScreen warns about it. To sign, put your certificate's
  thumbprint there; the timestamp server is already set.
- **macOS:** no signing identity and no notarisation are configured. An
  unsigned app is blocked by Gatekeeper until the user allows it by hand.
- **Linux:** packages are unsigned.

## Settings read at start

| Variable | Effect |
| --- | --- |
| `CYBERFORGE_BACKEND_URL` | The backend to talk to. Without it, the deployed backend is used |
| `HF_TOKEN` | A Hugging Face token for the assistant, used instead of the saved one |
| `HF_CONFIG` | Path to a JSON file holding such a token (`{"active": "hf_…"}`). For development; the file is read and never changed |

## Where credentials are kept

The session token and the Hugging Face token are kept in the operating
system's credential store and in no file:

| System | Store | Entries |
| --- | --- | --- |
| Windows | Credential Manager | `auth_token.com.cyberforge.console`, `hf_token.com.cyberforge.console` |
| macOS | Keychain | service `com.cyberforge.console`, accounts `auth_token` and `hf_token` |
| Linux | Secret Service (GNOME Keyring, KWallet) | service `com.cyberforge.console`, usernames `auth_token` and `hf_token` |

If the store cannot keep a value, the app says so: sign-in lasts until the app
is closed, and a Hugging Face token cannot be saved. Settings → Security shows
the store's state. On Linux this is what happens in a session with no Secret
Service running.

Builds made before this arrangement kept both tokens in plaintext files. The
first run of a newer build moves them into the credential store and removes
them from the files.

## The app's data folder

Everything else the app keeps is in one folder, created at first run:

| System | Folder |
| --- | --- |
| Windows | `%APPDATA%\com.cyberforge.console` |
| macOS | `~/Library/Application Support/com.cyberforge.console` |
| Linux | `~/.config/com.cyberforge.console` |

It holds the cached profile, the local memory, the site lists and a copy of
collected browser history. A `README.txt` inside describes each file.
Credentials in visited addresses (sign-in codes, session tokens) are removed
before an address is stored.

`device.json` holds this installation's ID, its device ID once enrolled, and
the last heartbeat sequence number; none of it is secret. The device's private
key is only in the system credential store (entry `device_key`), and is kept
when you sign out: the computer stays enrolled until it is revoked.
`device_outbox.json` holds the device's telemetry waiting to be sent (at most
500 events; events too old for the backend, or a batch it refuses, are dropped
and counted on the Devices page).

`privacy.json` holds the Privacy choices, the consent version and the last 50
changes.

Before each change to the hosts file, its previous content is copied here as
`hosts.previous`; the content from before the first change is kept as
`hosts.original`. A change made with administrator approval also leaves
`hosts.cyberforge-backup` beside the hosts file. To undo every block by hand,
copy `hosts.original` over the hosts file (administrator rights needed).
CyberForge only ever rewrites the lines between its two marker lines.

## First run

The first launch shows a setup wizard. It does two things: adds the program's
`bin` folder to your PATH if you ask it to, and records that setup is complete
so it does not appear again. Both results are shown.

Until you choose in **Settings → Privacy**, every page shows "Choose what
CyberForge may collect and send", and reading browser history, watching the
active tab, cloud scanning, the assistant and sync are all off. Each control
says what it sends and where.

## Uninstall

Remove the program the way your system removes programs. That leaves the data
folder, the PATH entry and the credential-store entries. The scripts in
`desktop/scripts/` remove those:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\uninstall.ps1    # Windows
```

```bash
./scripts/uninstall.sh                                            # macOS, Linux
```

Each asks before deleting. `-Force` or `--force` skips the questions;
`-KeepData` or `--keep-data` leaves the data folder.

## Known limits

- The live feed, the credential migration and several corrected pages have
  been tested as code and against the deployed backend, and have not yet been
  looked at in a built app.
- Blocking a site edits the hosts file, which needs administrator rights and
  affects name lookup only.
- The page called “Sandbox” runs a URL scan. Nothing is opened in a virtual
  machine.
- The interface is drawn at 1440 × 824 and fitted to the window. With display
  or text scaling at 175% or more, or in a window too small to fit at 75%, it
  keeps full size and scrolls instead of shrinking. Keyboard operation, focus
  and reduced motion are in place; a screen-reader walkthrough and a contrast
  check have not been done.
- Recovery and rollback: see [`docs/RECOVERY.md`](../docs/RECOVERY.md).
