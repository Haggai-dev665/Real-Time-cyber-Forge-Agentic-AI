# Desktop events and local inference

The desktop now performs routine URL-feature checks using the existing trained
detectors in its Rust process. Page content, BERT, live threat-intelligence
enrichment and Qwen chat remain separate cloud capabilities. A quick local
assessment does not claim that those checks ran.

## Why this method

Download the small detector pack during setup, keep it loaded in memory, and
return local results before any optional cloud work. Do not install the entire
Python ML service or put a multi-gigabyte chat model on the routine scan path.
The existing detectors are three HistGradientBoosting classifiers and one
IsolationForest; none requires a language model to evaluate a feature vector.

`ml-services/export_desktop_pack.py` converts the exact trained tree structures,
feature order, fitted thresholds and domain-popularity list into non-executable
data. The standard compressed pack is 2,824,495 bytes (about 2.69 MiB). A small
native evaluator replaces Python at inference time. Pickle is used only by the
developer exporter on the project's trusted, pinned model artifacts; desktop
users never load pickle or download executable model code.

The source model revision is
`Che237/cyberforge-models@298f585f6e9f869636cc491dcde22f108d9b51b6`.
The downloadable artifact is pinned at `ac88d5a8fe57c665a6c701ab26f67a7967b48674`,
with SHA-256 `3f7e1359cfa46360c781cad77d1f8749c4ae091f74e95fa4e6b3f1085d5a4332`.
The release's artifact revision and SHA-256 live in
`desktop/src-tauri/local-ml/manifest.json`; the revision must be an immutable
commit, never `main`. The generated pack is included in the application as an
offline fallback. This also means that a failed installation-time download does
not leave the app without basic URL checks.

This follows Hugging Face's [revision-pinned caching approach](https://huggingface.co/docs/huggingface_hub/guides/manage-cache).
Windows installation uses Tauri's supported [NSIS post-install hook](https://v2.tauri.app/distribute/windows-installer/#extending-the-installer).

## Installation, startup and updates

1. The Windows NSIS installer runs the installed executable with
   `--prepare-local-ml`, without opening a GUI window. The first-run wizard also
   has a real preparation job. Other platforms prepare on first launch.
2. The app loads either the already verified cache or the bundled pack on a
   blocking worker, without blocking the webview. No account token is needed to
   fetch the public detector pack.
3. Downloads use only the repository, path, commit, expected size and hash
   compiled into that release. The webview cannot select an arbitrary URL,
   filesystem path or model to install.
4. A partial file can resume using HTTP Range. A full response restarts it.
   Received bytes are bounded, SHA-256 checked, decompression is bounded to
   64 MiB, and tree structure/schema are checked before atomic activation.
5. Verified files are retained under the app's config directory:
   `models/<sha256>/core-v1.json.gz`. A per-pack lock prevents simultaneous
   downloads; stale locks older than ten minutes are recoverable. A new app
   release uses a new hash directory and leaves the previous pack intact.
6. **Diagnostics → Model capabilities → On-device ML pack** shows actual
   readiness, model count, source, pinned revision, transferred bytes and any
   failure. **Verify / retry download** retries setup. Startup also retries an
   interrupted download. The app never labels a failed download successful.

No automatic unpinned model update or retraining occurs on user machines. To
release updated models, export and validate them, publish the pack, update the
release manifest, and rebuild the application. Training remains a separate
Hugging Face Jobs workflow.

## Scan behaviour and evidence

`scan_url` validates and redacts the address, then evaluates the warm local pack.
The three supervised scores determine the URL-feature risk score; the anomaly
margin is reported separately and is **not** a probability or proof of harm.
Model feature inputs use the original float32 precision, full domain-popularity
list, and trained phishing decision threshold. `serde_json` enables
`float_roundtrip`: a one-ULP threshold parsing change can otherwise move a
boundary case to another leaf.

The result identifies `source: local-ml`, the model source revision, all four
predictions, actual local inference milliseconds and explicit coverage:

- local URL models: evaluated;
- page content: not observed;
- BERT / live intelligence: not evaluated;
- explanation: deterministic summary, no LLM call.

The normal scan performs no backend request, page fetch, DNS resolution or LLM
call. Analyze renders that result immediately. Its separate **Run cloud deep
scan** action requests the backend page/orchestrator scan and ML enrichment in parallel and checks the
cloud-scanning permission. If native models cannot load, the existing cloud
scan path remains available only when that permission is enabled. Disabling
cloud scanning does not disable the local URL-feature assessment.

Local lexical scores do not produce the native popup that claims a page has
been confirmed to steal credentials. They do not imply that an entire web page
is safe, and are not a replacement for cloud page/content analysis. Backend-owned
scheduled agent jobs still execute on the server; this change accelerates the
desktop's scan, active-tab and history workflows that invoke `scan_url`.

The floating agent panel now shows the returned classifier/anomaly results and
marks page content or intelligence as unperformed when coverage is missing. It
no longer invents successful TLS/header/reputation results or waits for a staged
animation before processing the next queued URL. History labels local checks as
URL risk rather than proof that an entire page is clean.

Qwen remains the deployed fine-tuned and reference-constrained service. Moving
its weights onto every machine would increase download size and CPU/memory cost
without speeding up the classifiers. A future optional accelerated chat pack
should have separate hardware checks, provenance, evaluation and explicit UI;
it is not silently installed by this change.

## Event Stream

The previous page listened only after navigation, lost earlier events, ignored
runtime/model activity, and wrote the event rate to an element ID that did not
exist. Local scans did not publish to the shared feed at all.

`event_journal.rs` now records both backend SSE events and actual local activity.
It retains up to 500 redacted events for one hour in memory. The journal survives
page navigation, not a process restart. It does not invent events or fetch a
user's entire scan/history database just to fill the page.

The page registers its live listener before requesting `stream_history`, then
deduplicates by event ID. It restores original timestamps, shows desktop/backend
sources, counts only retained events, supports filtering, reload and pause/resume
without losing the paused backlog. Empty and unavailable states explain what
is missing. Service connection changes and real model download/load transitions
also appear, including when there are no scans yet.

Account entries are scoped to backend plus signed-in user and cleared when the
scope changes. Device-only model/connection states contain no user URL payload.
SSE consumption checks the active session on received chunks as well as during
idle checks, so old-session bytes are not delivered after an account switch.
Only a small projection of fields enters the journal; URL credentials and secret
parameters are redacted. New journal/model commands are granted to the main
window and not the threat-popup window.

## Reproducing validation

### Windows release verified on 2026-10-23

The rebuilt installer is
[`CyberForge_1.0.0_x64-setup.exe`](../desktop/src-tauri/target/release/bundle/nsis/CyberForge_1.0.0_x64-setup.exe).
Run this installer to replace an older installed build. Validation exercised the
packaged executable in isolated project caches; it did not install over or close
the user's running app. The generated NSIS script includes the post-install hook
and resolves its executable to `cyberforge-console.exe`.

| Release executable check | Observed result |
| --- | --- |
| Public HF download and SHA-256 verification | Passed; 2,824,495 bytes, 19.225 s |
| Existing verified cache, networking disabled | Passed; 0.716 s |
| Interrupted download | Passed; resumed at byte 65,536, 9.420 s |
| Damaged cache replacement on Windows | Passed; 15.163 s |
| Fresh setup, networking disabled | Passed; four bundled models ready, 2.665 s |

These are single-run setup timings on this development machine, not scan latency
benchmarks. An initial release verification encountered a connection failure;
it kept all four verified bundled models ready, and the subsequent online run
completed all five checks. No Hugging Face token was required by these checks.

Other completed checks: 47 core tests; 93 desktop native tests (four ignored);
102 selected backend contract/security tests; and the focused Event Stream,
Analyze and model-capabilities browser fixture. The browser fixture covers
1440-, 1024- and 640-pixel layouts. The full navigation harness has a separate,
outdated sidebar-count assertion and is not reported as passing here.

Release SHA-256 values:

- Executable: `1dda3bf2bc012ab7f4b291e5852da7dda956edaf24769d35ea2e89db5be3f7e7`
- Installer: `3136ebdb74f002ee47fc7cc9bae520be90871c7031516a22101dfc780f4eecb4`

### Commands

From `desktop/src-tauri`:

```powershell
cargo test --offline -p cyberforge-core local_ml -- --nocapture
cargo test --offline --lib event_journal -- --nocapture
cargo test --offline --lib local_ml -- --nocapture
cargo test --offline --lib stream_tests -- --nocapture
cargo check --offline --lib
```

The parity fixture contains 271 varied URLs and 1,084 independent sklearn model
predictions, plus every Python feature. It covers benign sites, IP literals,
ports, hosted user content, URL parameters, encoded SQL/XSS payloads, traversal,
punycode and float32 boundary cases. Matching these predictions verifies the
port; it does not establish new detector accuracy. The initial debug run scored
the 271 URL/model groups in about 0.74 seconds, excluding load; this is a
development observation, not an end-to-end latency guarantee.

Native installation checks also passed against the actual public artifact: fresh
HF download, cache with networking disabled, a 65,536-byte partial resume,
corrupted-cache repair on Windows, and fresh offline fallback.

From the project root:

```powershell
$env:CYBERFORGE_TEST_EVENTS_ONLY='1'
node desktop/scripts/check-navigation.cjs
python desktop/scripts/check-local-models.py
npm.cmd --prefix backend test -- --runInBand tests/security/desktop-rendering.test.js
```

The isolated browser fixture checks retained events, history/live deduplication,
pause/resume, safe rendering of hostile payloads, filtering, responsive layout,
local results without a cloud/DNS call, and explicit cloud enrichment.

Developer export/publish (requires numpy, sklearn1.8, joblib and huggingface_hub;
the desktop application does not require them):

```powershell
python ml-services/export_desktop_pack.py
python ml-services/export_desktop_pack.py --publish-only --token-stdin
```

The token prompt does not echo the token or write it to source. The manifest is
rewritten with the successful Hub commit. Rebuild after publishing, because the
manifest and verified fallback are embedded in the executable.
