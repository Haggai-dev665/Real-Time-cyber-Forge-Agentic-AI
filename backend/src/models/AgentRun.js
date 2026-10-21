/**
 * AgentRun: one traceable execution of an agent definition (AGT-01, AGT-04).
 *
 * It records the definition version it ran, each step (tool, redacted input,
 * status, a short output summary, timing), the findings, the proposals it made,
 * and how it ended. A worker holds a run through a lease: `lease.token` is
 * checked on every write, so a worker whose lease expired cannot write to the
 * run after another one took it over (fencing). `idempotencyKey` is unique per
 * workspace, so a repeated request or a schedule slot makes one run.
 *
 * A retry (`trigger: 'retry'`) repeats only the failed or skipped steps of an
 * earlier run of the same definition version: `retryOf` names that run and
 * `onlySteps` holds the steps, each of which must still be in the version's plan.
 *
 * States: queued → leased → running → completed | partial | failed | cancelled.
 * `waiting_approval` is not a run state here: proposals are separate records
 * (AgentAction) that outlive the run.
 */
const mongoose = require('mongoose');

const STATES = ['queued', 'leased', 'running', 'completed', 'partial', 'failed', 'cancelled'];
const RETENTION_DAYS = 90;

const agentRunSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  agentId: { type: String, required: true },
  agentVersion: { type: Number, required: true },
  trigger: { type: String, enum: ['manual', 'schedule', 'retry'], required: true },
  retryOf: { type: String, default: null },
  onlySteps: { type: [mongoose.Schema.Types.Mixed], default: null },
  idempotencyKey: { type: String, required: true, maxlength: 128 },
  state: { type: String, enum: STATES, required: true, default: 'queued' },
  lease: {
    owner: { type: String, default: null },
    token: { type: String, default: null },
    expiresAt: { type: Date, default: null }
  },
  attempts: { type: Number, default: 0 },
  cancelRequested: { type: Boolean, default: false },
  steps: { type: [mongoose.Schema.Types.Mixed], default: [] },
  findings: { type: [mongoose.Schema.Types.Mixed], default: [] },
  actionIds: { type: [String], default: [] },
  outcome: { type: String, default: null, maxlength: 500 },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now, immutable: true },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null }
}, { versionKey: false, minimize: false, collection: 'agent_runs' });

agentRunSchema.index({ workspaceId: 1, idempotencyKey: 1 }, { unique: true });
agentRunSchema.index({ state: 1, createdAt: 1 });
agentRunSchema.index({ workspaceId: 1, agentId: 1, createdAt: -1 });
agentRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model('AgentRun', agentRunSchema);
module.exports.STATES = STATES;
module.exports.RETENTION_DAYS = RETENTION_DAYS;
