# Recovery and rollback

What survives a restart, what does not, and what to do when something goes wrong with devices, agents, the backend, or a release. It describes the code as it is: where a step is not built yet, it says so.

The backend runs on Heroku, which restarts every web process at least once a day and at every deploy. Plan for a restart at any moment.

## What survives a restart

### Kept in the database (survives restarts, deploys and rollbacks)

| What | Where |
| --- | --- |
| Accounts, workspaces, memberships, sign-in links | `users`, `workspaces`, `memberships`, `identitylinks` |
| Devices, enrollment codes, device events, device commands | `devices`, `device_enrollments`, `device_events` (30 days), `device_commands` |
| Agents, agent runs, agent proposals | `agents`, `agent_runs`, `agent_actions` |
| Policies, policy responses, sandbox scans | `policies`, `response_actions` (90 days), `sandbox_scans` (90 days) |
| Audit events | `audit_events` (90 days) |
| Synced memory | `synced_memories` (365 days after the last save, at most 5,000 per workspace) |
| Account deletion receipts | `account_deletions` |
| Threats and analyses | `threats`, `analyses` |

Appwrite holds alerts, browser intelligence, evidence metadata and network captures.

### Lost at every restart (kept in the web process only)

- the most recent network captures per account (`services/networkCaptureBuffer.js`). The durable copy is in Appwrite's `network_captures` when that collection is provisioned;
- orchestrator session memory (`services/memoryService.js`);
- distributed-intelligence node registrations (`services/distributedIntelligenceService.js`);
- the records kept by `routes/features.js` and `routes/child-pages.js`;
- open WebSocket and live-feed connections, and live-feed tickets. Clients reconnect and ask for a new ticket.

This list is finding F12 in `plan-update.md`. Treat anything on it as a cache.

### Kept on the desktop computer

In `%APPDATA%\com.cyberforge.console\` on Windows, `~/Library/Application Support/com.cyberforge.console/` on macOS:

| File | What it is |
| --- | --- |
| `device.json` | this installation's device ID, key version, last sequence number, the server's command key, last known state. The private key is in the system credential store, not in this file |
| `device_outbox.json` | telemetry waiting to be sent: at most 500 events, sent 100 at a time |
| `privacy.json` | the privacy choices and their change log |
| `hosts.original`, `hosts.previous` | copies of the hosts file from before the first block and before the last change |

The sign-in session and the AI token are in the system credential store.

### Kept on the phone

The privacy choices (AsyncStorage `cf_privacy`) and the session (SecureStore). Captured traffic is kept in memory only, and is gone when the app closes.

## Devices

| Situation | What happens | What to do |
| --- | --- | --- |
| The backend restarts | Device records, keys and sequence numbers are in the database. The next signed request is checked against the stored last sequence. | Nothing. |
| A request is answered with `DEVICE_CLOCK_SKEW` | The computer's clock is more than 5 minutes from server time. | Correct the computer's clock. |
| A request is refused as a replay | The computer's sequence number went backwards, for example after `device.json` was restored from an old backup. | The app uses the larger of the clock in milliseconds and the last number plus one, so this clears on the next request. If it does not, enroll again (below). |
| Telemetry was sent but the acknowledgement was lost | The outbox sends the same batch again; the backend stores each `(device, batch, index)` once. | Nothing. |
| The computer was offline for a long time | At most 500 events are kept; the oldest go first. Events older than the backend accepts (7 days) are dropped before sending. All of these are counted as dropped on the Devices page. | Nothing; the gap shows in the device's history. |
| The backend refuses a batch as invalid | Sending it again would be refused the same way, so the batch is dropped and counted, and the reason is shown on the Devices page ("Last refused: …"). The rest of the queue is sent. A batch that got no answer is kept and sent again. | If refusals repeat, the app and the backend disagree about the event format: update the app. |
| A key rotation's answer was lost | The app keeps the next key and tries it once when the current key is refused. | Nothing. |
| The computer was lost, or its key may be exposed | — | Revoke the device in Devices. A revoked device cannot report, receive commands, or be the target of a proposal. |
| The app was reinstalled, or `device.json` was lost | The installation has no device ID. | Enroll again from Devices. The same installation keeps its device record with a new key; a new installation becomes a new device. Revoke the old record if it is not reused. |
| A device shows **degraded** | A check it reported (such as hosts-file access) was denied or is unavailable. | Fix the permission on the computer; the next heartbeat updates it. |

### Device commands

- A command is **queued** until the device pulls it, and expires after its time to live (1 hour by default, at most 24 hours). An expired command is never run.
- A command counts as done only when the device's receipt says so. A command that was delivered but whose receipt never came stays **delivered**. Check the computer: the hosts file and the app's Blocked list show what was applied.
- A delivered command cannot be cancelled, because it may already be running.
- **If `DEVICE_COMMAND_KEY` is changed**, every enrolled device refuses commands from then on: each keeps the key it was given at enrollment and reports "the server's command key is not the one given at enrollment". Enroll each device again after a change. Without the setting, commands are unavailable (HTTP 501). The value is set with `heroku config:set` and is never printed or committed.

## Agents

| Situation | What happens | What to do |
| --- | --- | --- |
| The backend restarts while a run is in progress | The run's lease lapses 30 seconds after its time budget (10 to 600 seconds; 120 by default). The worker then queues it again. A run abandoned a second time is failed with "The worker running it stopped; tried 2 times." | Nothing. A failed run can be requested again. |
| An old worker wakes up after its run was taken over | Its writes carry an old fencing token and are refused. | Nothing. |
| A scheduled agent during a restart | One run is made per schedule slot, however many workers check. A slot that passed while no worker was running gets no run. | Nothing. |
| An agent is doing something unwanted | — | **Pause all** in Agents (desktop) or on the phone stops every active agent in the workspace. Queued runs do not start, and a running one stops at its next step. |
| A proposal is waiting | Proposals expire after 24 hours, and are refused if the agent changed or the device was revoked since. | Approve or reject it, or let it expire. Nothing happens without approval. |

## Accounts

- **Account deletion that ends `partial`.** The receipt (`GET /api/v1/account-deletions/<id>`) lists the stores that failed. The account is kept and still works, so ask again: the second request finishes the job and writes its own receipt.
- **A store failed during "Delete synced data".** The answer lists which ones; ask again.

## Releases and rollback

The backend is deployed with `npm --prefix backend run heroku:deploy`. Each deploy is a Heroku release (`heroku releases -a cyberforge`).

**Before deploying:**

1. Run the gate, `npm run validate:updates`, and the desktop's `cargo test` in `desktop/src-tauri`.
2. Run `node backend/scripts/migrate.js --status` to see whether the release adds a data migration.

**Rolling back the backend:** `heroku rollback v<N> -a cyberforge` returns to an earlier release's code and settings. Then check `/health` and sign in.

Things to know about a rollback:

- **The database is not rolled back.** Records written by the newer release stay. An older release ignores collections it does not know: for example, rolling back past 16.80 leaves `synced_memories` and `account_deletions` in place, unused.
- **Data migrations are one-way.** There is no `down` step. Before applying one (`migrate.js --apply`), check that the release before it can still read the migrated data.
- **Configuration is part of the release.** Rolling back to a release from before `DEVICE_COMMAND_KEY` was set turns commands off.

## The audit trail's signing key

`AUDIT_SIGNING_KEY` signs the audit checkpoints and evidence manifests (`GET /api/audit/integrity`, `GET /api/sandbox/export`). It is a Heroku setting, never stored in the database.

- **If it is removed,** no new checkpoint or manifest is signed, and the integrity route answers 501 saying so. Events are still recorded.
- **If it is changed,** checkpoints and manifests signed with the old key read as `other_key`: they can no longer be checked here, though the old public key published with them still checks them elsewhere. Checkpoints made from then on use the new key. Change it only if the old one may be known to someone else.
- **A check that reports `altered`, `signature_invalid` or `chain_broken`** means the trail or its checkpoints changed after they were signed. Keep the response, check who has database write access, and compare with a database backup.

**Rolling back the ML service:** the Hugging Face Space `Che237/cyberforge` keeps its own history; revert it there. The backend reports the ML service as unavailable rather than inventing answers while it is down.

**Rolling back the desktop or phone app:** install the previous build. The desktop's files in `%APPDATA%\com.cyberforge.console\` are kept and read by older builds. A build from before 16.79 ignores `privacy.json`, so its collection is not gated by the privacy choices.

## Undoing blocking on the desktop

- **Unblock a site:** use Security Functions → Blocked Sites. The hosts file is rewritten without it.
- **If the hosts file was damaged:** `hosts.original` is the file from before CyberForge first changed it, and `hosts.previous` is the file from before the last change. Copy one back over `C:\Windows\System32\drivers\etc\hosts` (administrator rights needed), then run `ipconfig /flushdns`.
