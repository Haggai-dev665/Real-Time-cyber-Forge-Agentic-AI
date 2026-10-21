# CyberForge desktop: sidebar and screen suggestions

**Reviewed:** October 17, 2026.  
**Scope:** all 19 sidebar destinations, all six sidebar group headings, badges/icons/collapse behavior, the eight Settings sections, and related navigation controls.  
**Basis:** the current desktop HTML, page scripts, shared components, native/CLI entry points, and the latest V2 implementation log. This is a source-based product review; I did not launch or visually test a packaged desktop build.  
**Status:** implemented after approval on October 17, 2026. The review below is retained as the original rationale; implementation notes follow.

## 1. Main recommendation

Keep CyberForge focused on protecting devices, analyzing suspicious activity, reviewing evidence, and running controlled security agents. The sidebar currently gives internal components, overlapping views, and unfinished capabilities the same prominence as those core tasks.

Reduce the main navigation to **eight primary destinations**, with two secondary browsing/intelligence destinations and a permanent Settings entry. Preserve useful features as tabs or detail views instead of deleting their underlying functionality.

The largest changes should be:

1. Combine **Threat Analyzer and Sandbox** into **Analyze**.
2. Bring **Alerts & Evidence, Investigations, and Incident Timeline** together under **Alerts & Incidents**.
3. Put **Scheduled** inside **Agents**, and move **Agent Core** to local runtime diagnostics.
4. Combine **Browser Intelligence and Browser History** under **Browser Activity**.
5. Move **Signal Pipeline and Model Inference** into advanced diagnostics/settings.
6. Rename **Security Functions** to **Protection** and **AI Assistance** to **AI Assistant**.
7. Remove hard-coded navigation counts and status claims.

These are navigation changes, not a recommendation to replace the existing device, agent, approval, finding, or evidence services.

## 2. Suggested sidebar

```text
WORKSPACE
  Overview
  Devices
  Agents
  AI Assistant

SECURITY
  Analyze
  Alerts & Incidents
  Protection
  Reports

EXPLORE
  Browser Activity
  Threat Intelligence

BOTTOM UTILITY
  Settings
```

Use tabs within the destinations:

| Destination | Contents |
| --- | --- |
| Overview | This computer's monitoring state, urgent findings, device coverage, pending approvals, recent outcomes |
| Devices | Inventory, this computer, enrollment, connection/coverage, device actions |
| Agents | Agents, templates, runs, schedules, approvals |
| AI Assistant | Conversations and contextual explanation; saved context/memory as a secondary view |
| Analyze | URL/domain analysis, IP/hash inspection, results and evidence; file analysis only when the desktop flow actually supports it |
| Alerts & Incidents | Alerts, findings, incidents; investigation, evidence and timeline inside the selected record |
| Protection | Blocked/allowed sites, saved sites, policies, action history; advanced policy tools only where permitted |
| Reports | Signed evidence reports and clearly distinguished AI-written summaries |
| Browser Activity | Current observed pages, history, scan results, collection controls |
| Threat Intelligence | Public feed first; optional globe/map views |
| Settings | Account, privacy, appearance, AI/providers, connection, integrations, system/about, advanced diagnostics |

Keep the eight primary links stable. Secondary groups can collapse, but the user should not have to guess where a feature moved. Diagnostics should be reachable from Settings and contextual error messages, rather than permanently competing with everyday tasks.

## 3. Decision for every current sidebar item

“Remove from sidebar” below means relocate the useful content, not delete the feature or its records.

| Current item | Decision | Proposed location/name | Reason |
| --- | --- | --- | --- |
| **Threat Overview** | **Keep; rename and edit** | **Overview** | A home screen belongs here. Its current threat-count emphasis misses monitoring coverage, device health and decisions awaiting the user |
| **Threat Globe** | **Keep as a secondary view; rename parent** | **Threat Intelligence → Globe** | Public intelligence is useful context, but the globe is a visualization, not the product's primary security workflow |
| **Sandbox** | **Combine; remove standalone entry** | **Analyze → Results / static analysis** | The desktop page is a URL scanner with a sandbox-style presentation; it does not run a virtual machine or detonate files |
| **Browser Intelligence** | **Combine and edit** | **Browser Activity → Current activity** | Actual browser observations belong together with history. Some HTTP/capture labels overstate what this page observes |
| **AI Assistance** | **Keep; rename** | **AI Assistant** | A central explanation and interaction surface fits the agentic product and V2 direction |
| **Security Functions** | **Keep functionality; rename and simplify** | **Protection** | Site controls and policy outcomes are meaningful; “functions” does not tell a user what they can manage |
| **Signal Pipeline** | **Remove from primary sidebar; simplify** | **Settings → Diagnostics → Event stream** | It shows received events and connection information, not a fully instrumented processing pipeline |
| **Devices** | **Keep name and primary placement** | **Devices** | Enrollment, identity, connection and real coverage are core product functions |
| **Agents** | **Keep name and primary placement; consolidate related views** | **Agents** | This is the real definition/run/approval workflow and should remain the authoritative agent management screen |
| **Model Inference** | **Remove from primary sidebar; rewrite content** | **Settings → AI & Models / Diagnostics** | Model readiness and limitations matter; a general user's security app does not need a model-deployment dashboard |
| **Agent Core** | **Remove standalone entry; split useful content** | **Devices → This computer**, plus **Diagnostics → Local runtime** | It mostly shows local telemetry, a console and scans; that is different from the persistent agents managed in Agents |
| **Threat Analyzer** | **Keep capability; rename and consolidate** | **Analyze** | Manual investigation of a URL, domain, IP or hash is a clear core task |
| **Scheduled** | **Remove standalone entry; keep functionality** | **Agents → Schedules** | Its schedules already belong to backend agent definitions; they are not an independent scheduling product |
| **Memory** | **Keep as a secondary view; rename for clarity** | **AI Assistant → Saved context** | Users benefit from inspecting what the assistant recalls; vector dimensions and learning taxonomy need not dominate navigation |
| **Browser History** | **Keep functionality; combine** | **Browser Activity → History** | History, browser selection, rescanning and collection consent form one coherent workflow |
| **Alerts & Evidence** | **Keep as a primary workflow; broaden parent** | **Alerts & Incidents → Alerts** | This is the triage queue. Evidence should remain directly accessible from an alert/finding/incident |
| **Investigations** | **Remove standalone entry; preserve workflow** | **Alerts & Incidents → Finding detail / Investigate** | It currently presents threats as cases; a separate case-management destination overstates the underlying model |
| **Incident Timeline** | **Remove standalone entry; retain real incident view** | **Alerts & Incidents → Incident detail → Timeline** | The actual grouped incidents, resolution and evidence exports are useful. A timeline is a view of an incident |
| **Reports** | **Keep name and primary placement; edit library/export behavior** | **Reports** | Reports are a real output of security work; preserve both evidence reporting and explicitly labelled AI summaries |

## 4. What to edit inside the screens

### Overview

Make the first question it answers: **“What needs my attention, and what is CyberForge currently monitoring?”**

- Show separate states for this computer's monitoring, backend connectivity, model availability and applied protection. One green “Live” indicator cannot summarize all four.
- Replace **Active Nodes / Distributed / Node Health** with actual enrolled-device coverage or clearly named **Service health**. The current page uses `agentCount` and renders the local agent, backend and ML service together; those are not three enrolled endpoints.
- Fix **Threat Volume · 24h**: the script appends observed total counts into a rolling 24-sample array. That is not an hourly count of detections over 24 hours. Use timestamped buckets, or label the graph as recent observed totals.
- Add pending approvals and links to an affected device, finding or run. Keep severity summaries and the recent feed, with timestamps and an explicit data scope.

Evidence: [threat-overview.js](desktop/ui/scripts/pages/threat-overview.js).

### Analyze: combine Threat Analyzer and Sandbox

Use one input and one result layout. Let users choose a supported input type, see which checks ran, review evidence, and take a permitted next step.

- **Immediately stop treating FILE/HASH input as a URL on Sandbox.** Its script currently warns that those modes are unavailable and then calls `scan_url` anyway. Disable unsupported modes with a reason, or wire a real matching flow.
- Keep the Analyzer's distinction between URL/domain analysis and IP/hash inspection. Do not describe a parsed IP/hash as a confirmed reputation verdict.
- Remove the unused CPU/MEM/NET/DSK bars, sample/gateway/remote machine scene, and “Behavior Timeline” wording that suggests execution telemetry. Replace them with **Checks performed**, **Results**, **Evidence**, and **Unavailable checks**.
- Keep useful detection breakdowns, IOC extraction and evidence-linked MITRE suggestions. Label external host references as references unless a network connection was actually observed.
- Move background history scanning to Browser Activity or an explicitly configured agent. Opening a manual analysis page should not unexpectedly start a history queue when existing consent permits scanning. The current Analyzer starts its page-local queue automatically.
- Use a common verdict vocabulary and show model/source, time and coverage. Do not turn missing scores into “clean.”

Evidence: [sandbox.js](desktop/ui/scripts/pages/sandbox.js), [analyzer.js](desktop/ui/scripts/pages/analyzer.js).

### Browser Activity: combine Browser Intelligence and Browser History

Keep this capability: browser-focused protection is central to CyberForge. Change how it is described.

- Replace **HTTP History**, **CAPTURING**, METHOD/ST/SIZE labels and generated `GET` entries with **Observed pages**, browser, URL, observed/visited time, scheme and scan status. `browser-intelligence.js` constructs these rows from browser observations/history; it is not measuring request methods, HTTP responses or transfer sizes.
- Prefer **Observed tabs/pages** over **Active sessions** where the latter could imply authenticated website sessions.
- Show history access, active-tab monitoring and cloud scanning consent separately. Provide a clear route to Privacy.
- Keep search, browser filters, scan and rescan. Distinguish “collection disabled,” “permission denied,” “no history,” and “read failed.” Do not advise visiting more sites when collection is disabled.
- Keep the domain visualization only as an optional view; the list should be the default usable view, and graph links must explain their meaning.
- Define what **Clear** removes: the visible list, CyberForge's local copy, scan results or synced records. Never imply it clears browser-owned history unless that is actually implemented.

Evidence: [browser-intelligence.js](desktop/ui/scripts/pages/browser-intelligence.js), [web-history.js](desktop/ui/scripts/pages/web-history.js).

### Agents, Scheduled and Agent Core

**Keep Agents as the main destination.** Keep its creation/validation flow, real runs, budgets, permissions, pause/resume, proposals and human approval.

- Move Scheduled into an Agents tab. Preserve its real interval schedules, run-now controls and execution history; do not replace them with local UI timers.
- Place the local runtime's CPU/memory/connectivity under This computer or Diagnostics. Label local monitoring separately from a user-created backend agent.
- Retain **Pause display** only on the console. **Pause agent** belongs to the actual agent runtime controls.
- Rename **Run Sweep** to match its current scope, such as **Scan current/recent page**. Its handler selects an active URL or recent history URL; it is not a full-machine sweep.
- Remove prominent **Isolate / Snapshot** shortcuts and non-configurable capability switches from ordinary workflows. A small advanced capabilities panel can explain what is unavailable.
- Replace **Reasoning Chain** with **Run steps** or **Activity**, according to the source. Do not imply that a console is a model's reasoning trace.

Evidence: [agents.js](desktop/ui/scripts/pages/agents.js), [scheduled.js](desktop/ui/scripts/pages/scheduled.js), [agent-core.js](desktop/ui/scripts/pages/agent-core.js).

### Devices

**Leave the name, purpose and primary placement as they are.** Preserve enrollment, one-time pairing, fingerprint comparison, approval, revocation, key rotation, outbox state and the distinction between connectivity and coverage.

Optional presentation improvement: prioritize device name, state, last seen, enabled capabilities and the next useful action. Put installation IDs, key versions and detailed outbox counters behind **Technical details**. Keep fingerprints visible during approval.

The new local-owner information is useful when another CyberForge process owns the device runtime. Explain the effect in plain language and put broker/process details in diagnostics.

Evidence: [devices.js](desktop/ui/scripts/pages/devices.js).

### Alerts, Investigations and Incident Timeline

Make these one workspace with a selectable record, its evidence, workflow actions and timeline.

- Keep **Alerts**, **Findings** and **Incidents** distinguishable. They currently have different sources and persistence; combining navigation must not silently merge their identities or invent equivalent states.
- Preserve the actual saved acknowledge/escalate behavior for stored alerts, the finding workflow, exceptions, grouped incidents and signed evidence exports.
- Distinguish **Mark all seen** from **Acknowledge**. The bulk button currently changes the display locally; it should not look like an audited bulk workflow update.
- Remove **New Case** until there is a genuine case-creation workflow. The present Investigations view derives cases from threat records and formats display IDs as `CASE-…`.
- Replace the derived **STEPS RECORDED %** with the finding's actual state and events. Counting detection/risk/response rows does not measure investigation completion.
- Remove the Detection → Triage → Containment → Eradication → Recovery strip from the default incident view while those phases are only a template. Show the stored incident timeline instead.
- Keep unmeasured response/resolve times out of headline KPI cards. A small limitation note is clearer than repeatedly showing empty performance metrics.
- Keep a selected incident's timeline stable during refresh; the current page has both general-threat refresh and selected-incident refresh paths.
- Fetch evidence by stable source IDs. If nothing is linked, say **No linked evidence** rather than presenting an empty “locker” as a separate implemented system.

Evidence: [alerts-evidence.js](desktop/ui/scripts/pages/alerts-evidence.js), [investigations.js](desktop/ui/scripts/pages/investigations.js), [incident-timeline.js](desktop/ui/scripts/pages/incident-timeline.js).

### Protection: replace Security Functions

Separate local site lists, policies and recorded actions into understandable tabs.

- Keep **Blocked**, **Allowed**, **Saved**, and action outcomes. Continue explaining that Saved applies no protection and Allowed does not make a site trustworthy.
- Replace **Armed / functions / actions taken** with **Enabled policies / supported responses / action outcomes**. Count applied, failed, pending and unsupported outcomes separately.
- Show policy scope and editing permissions. A rule being displayed does not mean an ordinary member may edit it or that it belongs only to this computer.
- Move the **Threat Simulator** into an advanced policy area. It currently calls the real `policy_evaluate` path and appends response records. Do not present it as a harmless preview. Prefer a genuinely side-effect-free preview; otherwise clearly describe the effect before submission.
- Move repeated ML engine status to diagnostics, leaving only a useful warning/link when a required engine is unavailable.

Evidence: [security-functions.js](desktop/ui/scripts/pages/security-functions.js).

### AI Assistant and Memory

Keep the assistant as a first-class destination. Use one full conversation surface; the floating assistant should open the same context rather than feel like a separate product.

- Preserve engine attribution, privacy controls and links to relevant evidence. Replace blanket **Online / AGENTIC / grounded in live telemetry** labels with the provider and context actually used.
- Clearly distinguish explaining, proposing, running and applying an action. Chat text must not look like an execution receipt.
- Rename Memory to **Saved context** and access it from the assistant. Keep search, provenance, stored time, source, sync state and deletion controls; label proposed controls as additions where not yet implemented.
- Translate Episodic/Semantic/Procedural into user-facing descriptions such as activity records, reference information and saved guidance, retaining technical names in details if useful.
- Move vector dimensions and recall latency to advanced details. The current memory graph connects items by category; keep that explanation and do not present it as learned causal relationships.
- Remove **Consolidate** unless an actual operation is wired and its effect is explained. No handler was found in the reviewed page script.
- Show which profile/account/local store a conversation uses. Test conversation and saved-context behavior on logout/account switch before claiming workspace isolation in the UI.

Evidence: [ai-assistance.js](desktop/ui/scripts/pages/ai-assistance.js), [memory.js](desktop/ui/scripts/pages/memory.js), [cf-agent.js](desktop/ui/scripts/cf-agent.js).

### Threat Intelligence and the globe

Keep OTX enrichment and the existing explanation that pulses are public intelligence and locations are approximate. Make the searchable feed the default and retain the globe/map as optional views.

- Replace **AI learned** with **Saved to context** and count successful saves. The page writes pulse text to memory; that does not retrain a model.
- Do not let a saved intelligence digest silently become response policy or stronger scoring instructions. Label imported intelligence as untrusted reference material with source and age.
- Move the user's own device incidents to the main alert workflow, or show only a clearly separated link/summary here.
- Use **Last refreshed** and actual feed availability rather than an unconditional LIVE sidebar badge. Keep the globe's approximate-location disclaimer.

Evidence: [threat-globe.js](desktop/ui/scripts/pages/threat-globe.js).

### Diagnostics: replace Signal Pipeline and Model Inference navigation

These are useful troubleshooting tools, but the current names and presentation put implementation detail ahead of user tasks.

- Rename Signal Pipeline to **Event stream**. Keep actual events, backend round-trip time, last received time and **Pause list**.
- Remove the **Normalize** stage that explicitly says nothing is measured, and the implied processing chain. Seeing an event does not prove it traversed all displayed stages.
- Rewrite Model Inference from current service metadata. The page still hard-codes `deepseek-security-chat`, **DeepSeek → Mistral**, a serverless-provider explanation and a **GPU Cluster** area; these do not accurately describe every current inference path.
- Show detector versus heuristic versus language model, actual version/source, readiness and known limitations. Overall service health must not imply that every listed model loaded successfully.
- Remove **Deploy** from this desktop page. No deploy handler was found in the reviewed page script; ordinary security users should not be offered an unwired model-publishing control.
- Preserve explicit unavailable/degraded status. Do not restore fabricated accuracy, throughput or GPU utilization to fill empty space.

Evidence: [signal-pipeline.js](desktop/ui/scripts/pages/signal-pipeline.js), [model-inference.js](desktop/ui/scripts/pages/model-inference.js), [ML service guide](docs/ML-SERVICES.md).

### Reports

**Keep Reports and its primary placement.** Preserve signed evidence snapshots, explicit evidence IDs, time windows, model/source information, missing-evidence limits and export.

- Distinguish **Evidence report** from **AI-written summary** before generation and in the exported document. Do not stamp both with the same AI-analysis subtitle.
- Fix the report library before describing it as saved reports: its list is currently a page-local array, and selecting a row only redraws the selection. Store/reload report content, or label it **Generated this session** and explain saving.
- Remove the sidebar's fixed **12**. A count should come from actual saved reports, or be omitted.
- Remove or wire **Share** and **Ask Agent**. No handlers for those buttons were found in the reviewed report page script. Manual export is already useful.
- Make classification markings such as **Confidential / TLP:AMBER** an explicit report choice, rather than unexplained default decoration.
- Ensure exports describe checks actually performed, without generic claims about eight agents, universal scraping, automatic isolation or every browser URL being analyzed.

Evidence: [reports.js](desktop/ui/scripts/pages/reports.js), [reports.html](desktop/ui/pages/reports.html).

## 5. Edit the sidebar component itself

The shared source is [cf-sidebar.js](desktop/ui/scripts/cf-sidebar.js), with layout in [cyberforge.css](desktop/ui/styles/cyberforge.css).

### All six current group headings

| Current heading | Suggested treatment |
| --- | --- |
| INTELLIGENCE | Split into Workspace, Security and Explore; Devices, Agents and Protection are not all intelligence views |
| MODEL INFERENCE | Remove as a primary group; one diagnostic page does not need its own navigation section |
| AGENT SYSTEM | Replace with Agents plus its tabs; Analyze and saved context have different user purposes |
| HTTP HISTORY | Replace with Browser Activity; the current feature is browser observations/history, not full HTTP capture |
| SECURITY OPERATIONS | Simplify into Security; alerts, investigations and incidents become one connected workflow |
| REPORTS | Keep Reports as a link; remove the redundant single-link section heading |

### All badge types

| Existing badge | Current examples | Recommendation |
| --- | --- | --- |
| LIVE | Threat Globe, Security Functions | Remove unconditional status; show actual freshness/connectivity inside the page |
| ACTIVE | Agent Core | Remove; use verified runtime state in its proper detail view |
| NEW | Sandbox | Remove stale promotional badge |
| 0 | Browser Intelligence, Alerts & Evidence | Only show a fetched, scoped count. Loading/offline is not zero |
| 12 | Reports | Remove fixed count |
| AI / ML | AI Assistance, Threat Analyzer | Usually remove; the destination name/result provenance communicates this better |

If badges remain, use them mainly for actionable counts such as pending approvals or unread alerts. Show their meaning and scope; avoid decorative labels on most entries.

### Navigation behavior, icons and accessibility

- Replace forced hover-only expansion with an explicit **Expand/collapse** control and saved preference. The current component always adds `collapsed`, and CSS expands only on `:hover`.
- Support keyboard focus expansion or visible labels, accessible link names, `aria-current="page"`, and tooltips for an icon rail. Current labels are hidden with `display:none` when collapsed; the sidebar does not supply alternative labels.
- Use distinct icons: overview/dashboard, devices/monitor, agents/workflow, analyze/magnifier, alerts/bell, protection/shield, reports/document, assistant/chat, browser/window, intelligence/globe, settings/gear. Current globe and spark icons are reused across several different destinations.
- Keep the active-item accent and clear hover/focus styling. Preserve the existing amber/cyan visual identity.
- Make long navigation scroll predictably; keep Settings reachable. Expanded navigation should reserve space or act as an intentional drawer, rather than unexpectedly covering content on hover.
- Retain links to relocated pages during migration, restore the selected tab/record where appropriate, and update all header, floating-assistant and loading-screen shortcuts together.

## 6. Settings sidebar and nearby controls

Settings currently lives behind the header gear. Add a permanent sidebar entry that opens the same settings surface; do not create two independent settings stores.

| Current Settings section | Decision |
| --- | --- |
| Account | **Keep.** Preserve sign-in/account identity; show account/profile scope clearly |
| Appearance | **Keep.** Preserve theme and reduced-motion choices; add sidebar expansion preference here if needed |
| AI & Models | **Keep and edit.** Provider selection, token status, model source/capabilities and limitations; advanced model diagnostics can live here |
| Connection | **Keep and simplify.** Backend reachability and useful reconnect guidance; detailed endpoint/probe information in advanced settings |
| System | **Keep technical setup; relocate device management.** Keep version/PATH/install diagnostics; link to Devices for enrollment and coverage |
| Security | **Clarify overlap.** Credential-store/security status can remain; site blocking and policy management should link to Protection |
| Privacy | **Keep prominent.** Preserve separate collection, monitoring, cloud processing and sync controls, plus export/deletion |
| About | **Keep.** Version, support and accurate limitations; explain data sharing principally in Privacy |

The top-bar search currently resolves a typed website to an IP; its per-page placeholder can imply broader search. Either label it **Look up a domain**, or implement actual context-sensitive search. A **Quick Scan** shortcut should open Analyze consistently. Keep notifications, theme and account controls.

## 7. How V2 should affect navigation

The repository now has a real CLI foundation: version/status, authentication, profiles/configuration and broker commands. Do not describe the CLI as completely absent. It still does not justify advertising all planned AI/scan/MCP functionality as available.

- Add **Settings → Integrations → MCP** when the server's configuration, client grants, status and revocation are functional. A local broker alone is not an MCP server.
- Add **Settings → Integrations → CLI** for installed version/path, setup instructions, profile information and diagnostics. Keep this within Settings, not a permanent terminal-emulator page.
- Put future **Copy CLI command** actions on devices, findings, runs and reports only when the corresponding command exists. Never include credentials in the command.
- Show pending AI/MCP actions in the same approval workflow used by Agents. Avoid a separate “MCP approvals” system that disagrees with it.
- Expose future AI planning and investigation through AI Assistant and Agents, using real run steps and receipts. Do not revive Agent Core as a second competing agent manager.
- Keep model training/promotion in an authorized operator workflow; do not turn the ordinary desktop into the old ML training interface.

Evidence: [CLI entry point](crates/cyberforge-cli/src/main.rs), [current V2 implementation log](plan-update-v2.md#12-review-and-implementation-log).

## 8. What should remain as it is

Preserve these decisions and working foundations:

- The **CyberForge identity**, dark visual direction, amber actions, cyan telemetry and readable technical styling. No wholesale rebrand or framework rewrite is needed for this cleanup.
- **Devices**, **Agents**, and **Reports** as recognizable primary destinations.
- **Human approval and verified action outcomes**, including the distinction between queued, delivered and applied.
- **Separate privacy controls**, explicit unavailable/unknown states and the ability to inspect provider/source information.
- **Actual agent schedules and run history**, moved into Agents without changing their execution semantics.
- **Stored alert/finding workflows, incidents, evidence hashes and signed exports**.
- **Public-intelligence labelling and approximate-map disclaimers**.
- **Local history and saved context**, with clearer names, consent and scope.
- Existing theme, keyboard-focus and reduced-motion support. Improve the remaining sidebar issues without discarding those improvements.

## 9. Suggested order of changes

| Priority | Work | Why first / completion check |
| --- | --- | --- |
| **1 — Correct misleading behavior** | Sandbox FILE/HASH handling; fabricated HTTP labels; policy simulator wording/effects; static badges; stale model names | The interface should not promise a check, action or measurement that did not happen |
| **2 — Consolidate navigation** | Analyze; Alerts & Incidents; Browser Activity; Agents schedules; rename Protection and Assistant | A user can scan, review evidence and approve an action without navigating duplicate screens |
| **3 — Make sidebar usable** | Explicit collapse, keyboard/accessibility labels, unique icons, permanent Settings, scoped counts | Every destination is discoverable with mouse and keyboard at supported window sizes |
| **4 — Improve core screen content** | Coverage-first Overview; stable incident selection; real report library; useful saved-context view | Each visible control has a defined result; reload/empty/offline states are honest |
| **5 — Add V2 integrations when ready** | MCP/CLI settings and contextual actions | Every exposed integration or command works end to end with existing permissions and approval |

Before removing an old navigation entry, verify that its useful workflows remain reachable in the proposed destination. Check signed-out, privacy-disabled, empty, offline, partial and normal states. These suggestions do not authorize deleting stored data or removing backend capabilities.

**Repository note:** `/suggestion.md` is now allow-listed in `.gitignore`.


## 10. Implementation record — October 17, 2026

The desktop now has eight primary destinations, two Explore links and permanent Settings. Related views retain their existing routes and native commands, with parent navigation and tabs linking them together.

| Area | Implemented |
| --- | --- |
| Sidebar and shortcuts | Saved explicit collapse, accessible names and focus, distinct icons, no decorative counts, consistent Analyze shortcut and domain lookup label. The floating shortcut opens AI Assistant; its existing monitor opens from Settings → Diagnostics |
| Analyze | Consolidated manual URL/domain/IP/hash inspection; legacy Sandbox redirects here. Removed the automatic history queue and invented scores. Missing results stay unverified; phishing/evasion hints identify their observed basis |
| Alerts & Incidents | Alerts, Findings and Incidents linked as related views. Selected records survive refresh. Incident timelines use incident records. Removed invented case progress and response times; “seen here” is explicitly local to the visible alert list |
| Browser Activity | Current observations and history linked together. Removed fabricated HTTP method/status/size fields. Collection consent is visible; the graph is optional. Clearing the visible list does not imply deleting stored data |
| Protection | Site lists, Policies and Action outcomes tabs. Existing native actions retained. Advanced policy evaluation explicitly requires consent because it can perform real actions |
| Reports | Complete generated report snapshots restore on selection. AI summaries and signed evidence reports remain distinct. User-selected classification, PDF/CSV and exact evidence JSON export. The library is labelled **this page session**; export retains copies |
| Overview | Device inventory and pending approvals inform coverage. Separate service states and observed chart samples replace invented node counts and fixed history labels |
| Diagnostics | Local runtime and Event stream moved under Settings. Model capabilities show backend readiness, reasons, limitations and provenance; `ml_status` optionally retrieves the capability report |
| Saved context and intelligence | Human-readable context categories and local storage scope. Public intelligence opens as a feed, with an optional globe; saving public references to context is explicit and does not claim model training |
| Integrations | CLI setup and supported foundation commands documented inside Settings. Existing privacy controls, device enrollment, agents/runs/approvals, theme and evidence services retained |

### Deliberate scope choices

- Reports are session-scoped with export; this change does not introduce an account report repository.
- Conversations/context are identified as installation-local and not account-isolated. Existing Privacy export/deletion controls remain authoritative; no unsupported per-record deletion is advertised.
- Relocated screens remain reachable through related-view tabs and Settings, preserving existing workflows and old URLs.
- MCP management, future CLI AI/scan commands and contextual command-copy actions remain in [Plan V2](plan-update-v2.md). They are not advertised as functional before their services exist.
- No stored user data or backend capabilities were removed. The implementation does not claim file execution, network packet capture, model training or model deployment from these screens.

### Validation

The implementation was checked with JavaScript syntax validation, focused desktop contract/security tests, an offline Rust check, and Chromium interaction checks against mocked native commands. The browser harness covers all 19 former destinations, renamed navigation, the Sandbox migration, unknown scan results, report restoration, incident refresh, model failure, policy consent and explicit intelligence saves. It can be rerun with `npm --prefix desktop run test:navigation` using a locally installed Chrome or Edge.

Screenshots were reviewed for the navigation and key layouts. Native IPC with a live signed-in backend and a packaged desktop installer still require an end-to-end release test; mocked browser checks do not establish those results.
