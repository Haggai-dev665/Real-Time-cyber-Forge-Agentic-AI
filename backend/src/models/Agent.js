/**
 * Agent: a member's saved agent definition (AGT-01, AGT-02).
 *
 * It belongs to a workspace and has a server-made `agentId`; its name is a
 * label, so two accounts (or one) can each have an agent called "Default"
 * without sharing anything. The configuration is versioned: every change makes
 * a new version, kept in `history` with the permission diff from the previous
 * one. `idempotencyKey` is unique per workspace, so submitting a create twice
 * makes one definition.
 *
 * Lifecycle: draft → ready (validated for the current version) → active ⇄
 * paused → archived. A validation applies to one version only: a change that
 * widens what the agent may do takes an active agent back to ready, so it must
 * be activated again.
 */
const mongoose = require('mongoose');

const STATES = ['draft', 'ready', 'active', 'paused', 'archived'];

const configSchema = {
  objective: { type: String, default: '', maxlength: 500 },
  mode: { type: String, enum: ['observe', 'assist'], default: 'observe' },
  tools: { type: [String], default: [] },
  proposals: { type: [String], default: [] },
  deviceIds: { type: [String], default: [] },
  targets: { type: [String], default: [] },
  schedule: {
    kind: { type: String, enum: ['on_demand', 'interval'], default: 'on_demand' },
    everyMinutes: { type: Number, default: null }
  },
  budget: {
    maxSteps: { type: Number, default: 50 },
    timeoutSeconds: { type: Number, default: 120 }
  }
};

const agentSchema = new mongoose.Schema({
  agentId: { type: String, required: true, unique: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  templateId: { type: String, required: true },
  name: { type: String, required: true, maxlength: 80 },
  state: { type: String, enum: STATES, required: true, default: 'draft' },
  version: { type: Number, required: true, default: 1 },
  config: configSchema,
  validation: {
    ok: { type: Boolean, default: false },
    version: { type: Number, default: null },
    errors: { type: [String], default: [] },
    at: { type: Date, default: null }
  },
  history: { type: [mongoose.Schema.Types.Mixed], default: [] },
  idempotencyKey: { type: String, required: true, maxlength: 64 },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now, immutable: true },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false, minimize: false, collection: 'agents' });

agentSchema.index({ workspaceId: 1, idempotencyKey: 1 }, { unique: true });
agentSchema.index({ workspaceId: 1, createdAt: -1 });

module.exports = mongoose.model('Agent', agentSchema);
module.exports.STATES = STATES;
