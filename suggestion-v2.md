# CyberForge suggestion V2: live headers and footers

**Date:** October 17, 2026.  
**Status:** proposal only; these V2 features have not been implemented. The preceding responsive-shell repair is separate.  
**Scope:** the global header, each workspace page header, global/page footer, controls, live data, visual design, animation, icons and typography.  
**Basis:** current desktop source, native commands, backend routes and the Hugging Face deployment source. Source inspection establishes available interfaces, not the health or version of a running deployment.

## 1. Recommended direction

Make the header the place to choose scope and perform the next useful action. Make the footer the place to understand connectivity, data freshness and the outcome of that action. Preserve CyberForge's dark surfaces, amber primary actions and cyan telemetry, while replacing decorative status with actual measurements.

More controls should mean better access, not more permanent buttons. Use three layers:

1. **Global header:** brand/home, explicit device/account scope, domain lookup, Analyze, notifications, account and a compact service-status control.
2. **Page header:** title, related-view tabs, filters, up to three relevant measurements, one primary action and a More menu.
3. **Footer:** connection states, last successful update, current operation and outcome, plus a details drawer for secondary telemetry.

Every dynamic value must identify its source, scope and freshness. Counts from a limited result list must say “loaded” or “visible”; they must not masquerade as account totals. A failed request is unknown, not zero. No decorative moving graphs, fake progress, made-up latency, sample incidents or unconditional “Live” badges.

## 2. Problems still present

- `cf-header.js` accepts per-page status text, but status words such as REPORTING and PROTECTION are page labels, not service measurements. Give the page title this job.
- The global Analyze button is useful, but does not replace page-specific actions. Domain lookup must stay labelled as domain lookup until real cross-record search exists.
- `cf-footer.js` still contains fallback values including CPU 0%, MEM 0%, 7 nodes online and System nominal. Remove these defaults before expanding the footer.
- Page scripts still pass fixed strings such as Ready, Live, ML sensors and backend-linked. Examples remain in Reports and Protection. A spinner next to those strings does not establish activity.
- The footer clock measures time since page load. Label it “page session” or remove it; it is not backend/service uptime.
- `v2.0.0` is a footer fallback while the desktop package declares another version. Read the packaged application version from one authoritative build source.
- Native stream status exists, but a connected stream is distinct from fresh page data, available ML and applied protection.
- `ml_status` performs multiple requests; individual pages must not multiply these probes or infer that all models work from one health response.
- Several endpoints return limited lists. Header totals, next-run summaries and historical performance cannot safely be inferred from those slices.

## 3. Visual design specification

### Layout and hierarchy

Keep the viewport shell established by the responsiveness repair: no transform scaling of the workspace. Header and footer stay in normal shell layout; only navigation and content scroll. Use the same component geometry on Overview and every other page.

| Component | Proposed design |
| --- | --- |
| Global header | 56–64 px at desktop widths; brand on left, flexible search/scope in the middle, compact utilities on right. Subtle bottom border and restrained background blur |
| Page header | Title and subtitle at left; measurements grouped beside the title; primary action and More at right. Filters and tabs form a second row when needed |
| Footer | 32–36 px at desktop widths; connection/freshness at left, task state in the middle, details control and application version at right |
| Status chips | Icon + short text + optional age. Neutral loading/unknown, green verified success, amber partial/stale, red failure. Meaning must also be conveyed in text |
| Details drawers | Open on click/keyboard, with source, scope, timestamps, request ID and safe error reason. No essential information available only on hover |
| Action groups | One filled amber primary action; secondary outlined actions; destructive actions separated inside a menu with existing confirmation/approval semantics |

Use an 8 px spacing rhythm, 12–16 px between groups, 16–24 px horizontal page padding and consistent 8 px control radii. Keep borders quieter than selected controls. Avoid glowing boxes around every metric; reserve emphasis for the current action and actionable failures.

### Fonts

Retain the already bundled **Space Grotesk** for titles, labels, menus and explanatory text, and **JetBrains Mono** for IDs, timestamps, measured values and technical detail. Do not add remote font dependencies. Avoid using the report fonts in application chrome.

- Page title: 20–24 px, weight 600, sentence case.
- Header controls: 13–14 px, weight 500–600, line height at least 1.4.
- Footer text: 12 px minimum at normal scale; supporting labels 12–13 px.
- Numeric telemetry: tabular numerals and stable allocated width to prevent jumping.
- Replace tiny widely spaced uppercase status strings with readable sentence-case labels. Uppercase may remain for short abbreviations such as CPU.
- Preserve OS/browser zoom and high-DPI rendering; never shrink the entire app to compensate for larger text.

### Icons

Consolidate the duplicated inline icon definitions into one local SVG registry with a 24×24 view box, consistent 1.75–2 px stroke, rounded ends, and 16/18/20 px display sizes. Reuse the existing visual language; do not mix filled illustrations, emoji and outline controls.

| Meaning | Icon |
| --- | --- |
| Account/device scope | User / monitor |
| Lookup / Analyze | Search / scan target |
| Backend / live stream | Server / radio signal |
| ML capabilities | CPU or brain, always accompanied by readiness text |
| Last update / refresh | Clock / refresh arrows |
| Pending approval / verified result | Shield-question / shield-check |
| Partial coverage / failure | Triangle warning / circle-x |
| Export / filter / More | Download / sliders / ellipsis |
| Privacy / diagnostics | Lock / activity |

Icons in labelled buttons are decorative (`aria-hidden`). Icon-only buttons need accessible names, visible focus and tooltips. Make interactive hit areas at least 36×36 px on desktop and 44×44 px in touch layouts, even when the icon is smaller.

### Animation

Use motion to acknowledge real state changes, not to imply invisible work.

| Trigger | Animation | Truth constraint |
| --- | --- | --- |
| Request in flight | Small 800–1000 ms spinner on that operation | Starts on dispatch; stops on success, failure, timeout or cancellation |
| New backend event | One 300–500 ms highlight on the affected counter/row | Only when an actual new event is accepted; deduplicate replay |
| Status transition | 120–180 ms color/opacity transition | State text changes at the same time; preserve readable contrast |
| Drawer/menu | 160–200 ms opacity and short translation | Focus enters the panel; Escape closes and restores focus |
| Successful action | One short checkmark transition after receipt | “Applied” requires an applied receipt, not an HTTP acknowledgement |
| Progress | Determinate bar only with actual completed/total work | Otherwise show named phase and elapsed time, with no percentage or ETA |

Stop infinite decorative pulses and rotating badges. Respect `prefers-reduced-motion` and the app preference: use static icons/text instead of motion. Do not announce every metric tick to screen readers; announce completion, failure and consent changes politely.

### Responsive behavior

- At wide widths, show full labels and at most three page measurements.
- At laptop widths, retain the primary action and move secondary controls into More; collapse measurements into a labelled summary control.
- At narrow widths, allow a second search/filter row, stack page-header actions, and show a compact footer with Connection, Last update and Details. The details drawer contains the remaining data without removing access to it.
- Breakpoints depend on available content width, including the sidebar. Expanded and collapsed sidebars must both work.
- Do not hide failures, pending approvals or active operation state in order to fit decorative elements.
- Test 1920×1080, 1366×768, 1024×768, 640×720 and 200% zoom/high-DPI layouts. Include long account/device names and translated-length labels.

## 4. Global header and footer functionality

| Proposed control/data | Existing source | Required work |
| --- | --- | --- |
| Account and selected device | `auth_get_user`, `device_status`, `devices_list` | Shared scope state; label account vs this installation. Do not advertise a multi-workspace switch until switching is supported |
| Backend request status | Authenticated native/backend responses | Shared last-success/failure snapshot and retry control. A TCP/health response alone does not prove authenticated operations work |
| Live event connection | `stream_status`, native `cf-stream-status`, DOM `cf:stream-status` | Bind footer state directly, retain reason and last event time; add a native reconnect command only if needed and implemented |
| Hugging Face ML status | `ml_status({includeCapabilities:true})` → backend capabilities | One shared cached snapshot; readiness breakdown in a drawer, not a blanket “AI online” |
| Notification/approval access | `agent_alerts`, `agents_call` actions | Show loaded pending items immediately; add a scoped aggregate before claiming an exact account-wide count |
| Lookup and Analyze | Existing domain lookup and Analyze route | Keep explicit lookup semantics. Use page-specific primary actions separately |
| Current operation | Native request lifecycle and returned records/receipts | Shared operation state keyed by request/run/scan ID; distinguish submitting, queued, running, completed, failed and applied |
| Privacy controls | `privacy_get` / `privacy_set` | Quick drawer for separate collection/cloud/LLM/sync choices. Never a single misleading “all protection on” switch |
| App version and diagnostics | Packaged application metadata; native diagnostics | Replace hard-coded version and expose Copy diagnostic summary with redacted fields |

Suggested footer order: **Backend · Events · ML · Updated · Current task · Details**. User-customizable secondary metrics can include local CPU/RAM and session duration, with local provenance. Backend/HF integration does not justify sending local history or telemetry to the cloud without the relevant consent.

## 5. Proposal for every page

“Existing” below means an interface is present in source, not that a live deployment has been verified. New aggregate or monitoring fields are explicitly identified as additions.

| Page/view | Header controls and data | Footer data and actions | Integration/gaps |
| --- | --- | --- | --- |
| **Overview** | Device scope, refresh, review approvals; coverage and open critical/high findings | Backend/events/ML states, coverage snapshot age, latest verified outcome | Existing `devices_list`, `get_threats`, `agents_call`. Add scoped summary counts for exact totals and filters |
| **Devices** | Search/filter inventory, enroll this computer, select device; enrollment and last heartbeat | Selected-device connection, capability coverage, command queued/delivered/applied state | Existing device status/list/enrollment/commands. Use backend heartbeat age; never infer health from local agent animation |
| **Agents** | Agent/state filters, create agent, selected agent Run/Pause; loaded runs and approvals | Run ID, latest recorded step, engine, cancellation/result receipt | Existing `agents_call` operations. Server-side totals and run-status events are additions where absent; preserve approval flow |
| **Schedules** | Agent/timezone filter, edit selected schedule, pause/resume selected agent | Last recorded run/outcome and authoritative next due time | Existing agent definitions/runs. Add next-due timestamp from the scheduler if not returned; do not make a browser countdown the scheduler |
| **AI Assistant** | New conversation, saved context, context/privacy scope, capability drawer | Request phase, actual answer engine/model, fallback label, elapsed request time | Existing `ml_security_chat`, `hf_token_status`, capability report and answer metadata. Model switching, token rate, queue position and true cancellation require added support |
| **Saved context** | Search, category/source filters, refresh, Privacy/storage controls | Loaded record count, installation scope, last successful sync or sync disabled | Existing `memory_list`, `memory_search`, `memory_sync`, privacy controls. No “learning progress”; exact totals and record deletion require supported APIs |
| **Analyze** | Indicator type, target input, Analyze, copy result/reference; relevant model readiness | Scan/request ID, observed coverage, real verdict source, elapsed time, partial-provider failures | Existing `scan_url`, `ml_ioc_scan`, `ml_url_enrich`. No fake phase completion or cancellation unless the scan protocol supports it |
| **Alerts** | Severity/state filters, refresh, selected alert acknowledge/dismiss | Selected alert's persisted state, linked evidence, last update | Existing `agent_alerts`, `alert_state`. Keep “seen here” separate from backend acknowledgement; add filter-aware totals if needed |
| **Findings** | Status/device/severity filters, investigate/resolve/exception for selected finding | Stable finding ID, persisted state, evidence availability and action result | Existing `get_threats`, `finding_state`, `finding_exception`; extend backend filtering/aggregates before implying full-account search |
| **Incidents & timeline** | Incident selection, state filter, resolve, export evidence | Incident ID, latest recorded event, resolution receipt, export signature status | Existing `incidents_list`, `incident_resolve`, `incident_evidence`; signature present is not the same as cryptographically verified |
| **Protection** | Site lists/Policies/Outcomes tabs, create policy, scope, enabled-policy count | Last evaluation, matched policy, action receipt, local blocking capability | Existing policy list/stats/log and native site controls. Live evaluation remains explicitly consequential; do not call it simulation |
| **Reports** | Period/timezone, evidence vs AI report, classification, Generate/Export | Generation phase, source window, actual AI engine or signed evidence, last export | Existing `evidence_report`, `CF.findingsReport`, local export. Session library stays labelled; persistent report jobs/library need new APIs |
| **Browser Activity** | Browser filter, current observations, refresh, collection controls | Observation timestamp, active-tab/history/cloud-scan consent, loaded pages | Existing `browser_intel`, history commands, `privacy_get`. No HTTP status, transfer bytes or request rate without real capture |
| **History & scans** | Browser/date/search filters, selected URL scan, clear-history via Privacy | Loaded/filtered rows, collection time, selected scan result and source | Existing history and scan commands. Distinguish browser history visit time from collection and scan time |
| **Threat Intelligence** | Feed search, source/time filters, Feed/Globe, Refresh, Save selected context | Upstream source, fetched time, visible records, explicit save receipt | Existing `otx_fetch`, `memory_save`. New arbitrary server-side source/time filters need backend support. Public feed is not a private-device alert stream |
| **Local runtime** | This-device identity, refresh snapshot, display pause, scan recent page | Actual runtime state, CPU/RAM with sample age, current local operation | Existing `agent_status`, `get_system_stats`, telemetry and scan commands. Display pause does not stop monitoring; no fake quarantine/restart controls |
| **Event stream** | Type filter, pause display, resume, clear visible rows | Native connection, last received event, observed event count, buffer size | Existing `cf:event`, `cf:stream-status`. Replay-gap/cursor status requires native exposure; local counts are session observations, not global throughput |
| **Model capabilities** | Capability/type/readiness filter, refresh, inspect limits/source | Service response time, report age, ready vs unavailable capability counts | Existing `/api/v1/ml/capabilities` and `ml_status`. GPU usage, queue depth, p95 latency and model deployment controls are not supplied by this report |
| **Settings** | Current section, relevant save/test action, changed/unsaved state | Last save/test result, configuration scope, storage/provider status | Existing settings/native commands. Apply only actual per-section changes; never show Saved before persistence succeeds |

The old Sandbox URL continues to redirect to Analyze and does not get a second header/footer implementation. Sign-in, registration and loading retain a simpler shell with connectivity/error and version information, without private account metrics. The separate threat-alert window stays compact and uses the selected alert's real identity and available action outcomes.

## 6. Backend and Hugging Face integration design

### Reuse the existing boundaries

```text
Desktop components
  → allow-listed Tauri commands and native event listeners
    → authenticated CyberForge backend
      → configured Hugging Face Space with backend-held service key
```

Keep service credentials out of the WebView. The existing optional user HF token path must continue through native credential storage, labelled as a different provider path; never expose the token in a header, URL, diagnostic export or event payload.

Use these existing contracts:

- `GET /api/v1/ml/capabilities` supplies the normalized capability report, backed by the Space's `GET /api/v2/capabilities`.
- `GET /api/cyberforge-ml/health` and `/api/cyberforge-ml/v2/status` give service/status information. They do not prove the selected model can answer.
- The capability schema distinguishes trained models, transformers, heuristics, reference lists and a language model, with readiness, reasons, limits and model metadata where supplied.
- The native connection owns `/api/stream`. The renderer consumes the existing mapped threat, scan, explanation, alert, agent and metric events rather than opening another connection.
- Model/provider attribution belongs to the returned result. A capability report taken before a request cannot establish which engine actually produced the answer.

The deployment source currently reports training as running in the inference process and reserved for the Space owner. Do not describe training isolation as complete, or add ordinary desktop Train/Deploy controls. Link operators to the ML guide and V2 work instead.

### Additions required for richer live chrome

These are proposed contracts, not existing routes:

| Addition | Purpose and required fields |
| --- | --- |
| `GET /api/v1/console/summary` | Authenticated, scoped, bounded summary: device coverage, open findings/incidents, pending approvals and run states. Include filter/time window, exact vs partial counts, generatedAt and source freshness |
| `GET /api/v1/console/operations` | Only if persistent background jobs are introduced: request/job ID, owner scope, kind, state, started/updated/finished timestamps, cancellable flag and result reference |
| Shared native console snapshot | Merge backend summary, native stream state, local privacy/device state and cached ML capability report. Expose per-source errors and timestamps rather than one global boolean |
| HF operational metadata | Instrument actual inference start/end, queue wait, result kind, model revision and failures. Provide a protected backend-consumed health/metrics contract; no fabricated GPU metrics on CPU deployments |
| Scoped change events | Add documented events for device, approval, run, policy and report changes where current events do not cover them. Publish only after persistence; preserve workspace/account authorization |
| Cancellation protocol | Add only where backend and Space can genuinely stop or mark cancelled work. Aborting a renderer request alone must be labelled “stopped waiting,” not “job cancelled” |

Avoid a separate backend request for every header chip. Share a store and coalesce refreshes. Snapshot on page entry, apply authorized events, and refresh snapshots after reconnect to reconcile gaps. Start with a configurable 30-second active-window fallback for summaries and 60-second ML capability cache; back off on failure, avoid overlapping requests and suspend unnecessary hidden-window polling. Do not request a model inference just to animate a health indicator.

For each measurement carry: value or null, source, scope, source timestamp, fetched timestamp, state, and safe error reason. A proposed metric envelope is a schema requirement, not seed data. Define freshness thresholds per source: heartbeat cadence, provider timeout and summary refresh cadence differ. Preserve last known values with a stale label; initial loading and unavailable states must remain distinct from a measured zero.

Treat HTTP acknowledgement, queue acceptance, execution and verified application as separate states. Disable in-flight duplicate actions, preserve selected record IDs, and use backend permissions/approval rules for every state-changing control. On logout or scope change, clear private snapshots and unsubscribe old scope listeners before showing a new account.

## 7. Implementation sequence

1. **Truthful foundation:** remove static footer defaults, build shared source-aware state, expose app version, audit result attribution and all status text. Define aggregate/metrics contracts before adding their widgets.
2. **Component design:** one header/footer/icon system and typography scale, shared spacing/status tokens, accessible menus/drawers and reduced-motion variants. Preserve responsive shell geometry.
3. **Existing integrations:** wire connectivity, privacy, capabilities, timestamps and existing page actions. This phase must work with unavailable ML and disabled collection.
4. **Backend/HF additions:** implement scoped aggregates, missing events, operational metadata and cancellation only where supported. Add authentication, ownership, contract and failure tests.
5. **Page rollout:** Overview/Devices/Agents/Analyze first; then Alerts/Incidents/Protection/Reports; then Assistant/context/browser/intelligence and diagnostics. Remove superseded page-specific status markup.
6. **Live acceptance:** test the packaged desktop against the actual backend and Space. Source review and mocked browser tests are insufficient to declare an integration complete.

## 8. Acceptance criteria

- Each displayed number/state has a documented source and unit, scope, timestamp and missing-data behavior. A reviewer can trace it to a real response or event.
- Healthy HTTP response + unavailable model shows the model unavailable. Heuristic fallback remains labelled heuristic; reasoning text is not a trained-detector verdict.
- Provider timeout, Space startup/loading, missing credentials, rate limit, partial result, signed-out and privacy-disabled states are exercised without synthetic success data.
- Filters affect both data and counts consistently. Pagination/truncated lists never generate false totals. Replayed events do not double-count.
- Header actions work end to end; queued/delivered/applied and “stop waiting”/cancelled are not conflated.
- Footer update age advances from the actual last successful fetch/event, not a timer that pretends a refresh succeeded.
- No polling flood, duplicate stream or credentials in renderer state. Scope switching cannot show another account's cached counts.
- Keyboard-only navigation, focus return, reduced motion, readable contrast and 200% zoom work. Status updates do not continuously interrupt screen readers.
- Test every page with both sidebar modes, long labels, empty and populated data. Header/footer stay visible; menus and drawers remain on-screen; content does not slide behind them.
- Production screens contain no mock metrics. Deterministic fixtures may exist only in automated tests and must never be imported into runtime code.

## 9. Source references

- [Shared header](desktop/ui/scripts/cf-header.js), [footer](desktop/ui/scripts/cf-footer.js), [navigation/layout](desktop/ui/styles/cf-navigation.css), [bundled fonts](desktop/ui/styles/fonts.css).
- [Native ML commands](desktop/src-tauri/src/ml.rs), [native agents operations](desktop/src-tauri/src/agents_api.rs), [device commands](desktop/src-tauri/src/device.rs), [finding/incident/report commands](desktop/src-tauri/src/finding_api.rs).
- [Renderer event bridge](desktop/ui/scripts/cf-realtime.js), [native stream](desktop/src-tauri/src/stream.rs), [backend stream](backend/src/routes/stream.js).
- [Capabilities route](backend/src/routes/mlCapabilitiesV1.js), [normalized report](backend/src/services/mlCapabilityReport.js), [supported/retired ML routes](backend/src/services/mlCapabilities.js), [ML routing/configuration](backend/src/config/ml.config.js).
- [HF deployment service](ml-services/hf_space_deploy/app.py), [ML services guide](docs/ML-SERVICES.md), [Plan V2](plan-update-v2.md), [original sidebar suggestions](suggestion.md).


## 10. Implementation record ? October 18, 2026

The workspace pages now use [shared console state and controls](desktop/ui/scripts/cf-console.js) and [shared chrome styles](desktop/ui/styles/cf-console.css). Headers provide account/device details, service inspection, page refresh, loaded-row search on supported lists, and shortcuts to privacy, devices, approvals and model capabilities. Existing page actions remain available. Footer buttons expose backend connection, event stream, ML readiness, actual data-receipt age, current/last operation and the native app version. Narrow layouts move secondary status into the details drawer. SVG icons, bundled font families, consistent controls, focus restoration and reduced-motion behavior are shared across pages.

### Data contracts and sources

| Display | Actual source | Scope and missing-data behavior |
| --- | --- | --- |
| Devices online, active agents, pending approvals, active runs | Authenticated `GET /api/v1/console/summary`, database counts | Verified workspace membership; exact stored-record counts, null on query failure; online uses the existing heartbeat threshold |
| Open and critical/high findings | Same summary route with owned-threat filter | Signed-in account; does not infer global totals from a paginated page |
| Backend and ML response timing | Native `console_snapshot` | HTTP round-trip milliseconds, not inference time; missing responses are unavailable |
| ML readiness, engine kind, model metadata, limitations | Backend-normalized Hugging Face `/api/v2/capabilities` | Per capability; a reachable backend does not imply loaded models |
| Space request activity | HF `operational_report()` via capabilities | Process-wide POST counts since startup, not account usage; excludes admin training and GET polling; HTTP failures include exceptions/statuses >=400; average request duration is not GPU time or pure model latency |
| Event status and observed events | Native stream status and authorized renderer event bridge | Current connection/page session; replayed event IDs are deduplicated |
| Data receipt age and operation result | Actual native command responses | Latest successful observed data response, not a guarantee every visible row is current; result state is reported only when returned by the operation |
| Privacy, installation, local CPU/memory | Native privacy/device commands and telemetry | This installation; unknown until reported |
| Loaded-row filter count | Already rendered records | Explicitly a loaded subset, never a backend global total |

The native snapshot cache is keyed by authenticated session and backend, with 30-second summary and 60-second capability intervals, a five-second minimum forced refresh interval and bounded HTTP requests. Renderer refreshes coalesce, back off on failure and suspend periodic console refresh while hidden. Sign-out clears private renderer state; native requests check session identity before returning. Successful server audit writes publish a private invalidation event without record contents. Polling reconciles missed events.

### Verification and operational limits

Local verification includes the Rust compile check, authenticated HTTP ownership/membership tests, capability normalization tests, production Python request-counter tests, HTML safety/accessibility contracts and browser navigation/responsive checks across the workspace routes and both sidebar states. Browser/native-bridge fixtures exist only in the test harness; runtime code does not import them.

Deployment and packaged-desktop acceptance against the actual backend and Hugging Face Space remain required. The updated backend and Space must be deployed for the new counts and operational metadata to appear. Older or unreachable services report unavailable instead of inventing values. No deployment was performed as part of this local implementation.

No GPU utilization, token billing, provider queue depth, account-specific Space throughput or training progress is claimed: these require upstream measurements. This change does not add a new durable inference-job/cancellation API. Existing agent run controls retain their backend semantics. Incident pages retain their service-derived grouping rather than displaying an invented exact global incident count. After a failed refresh, last-good summary counts stay visible with an explicit stale label for the current page session; ML readiness remains unavailable until a successful report returns.
