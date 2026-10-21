/**
 * AgentAction: something an agent in assist mode proposes, which a member
 * approves or rejects (AGT-05).
 *
 * It is immutable once made: the type, the target device, the domain, the agent
 * version that proposed it and the evidence are fixed, so an approval is for
 * exactly that. It expires. Approval is checked again against the present (the
 * agent still active at the same version, the device still approved and able),
 * and turns the proposal into a signed device command (DEV-05); from then on its
 * outcome is that command's receipt.
 *
 * States: proposed → approved (a command was queued) | rejected | expired.
 * The applied/failed outcome is read from the device command, not stored here.
 */
const mongoose = require('mongoose');

const STATES = ['proposed', 'approved', 'rejected', 'expired'];

const agentActionSchema = new mongoose.Schema({
  actionId: { type: String, required: true, unique: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  agentId: { type: String, required: true },
  agentVersion: { type: Number, required: true },
  runId: { type: String, required: true },
  type: { type: String, enum: ['block_domain'], required: true },
  deviceId: { type: String, required: true },
  domain: { type: String, required: true, maxlength: 253 },
  reason: { type: String, required: true, maxlength: 500 },
  evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
  state: { type: String, enum: STATES, required: true, default: 'proposed' },
  expiresAt: { type: Date, required: true },
  decidedBy: { type: String, default: null },
  decidedAt: { type: Date, default: null },
  commandId: { type: String, default: null },
  createdAt: { type: Date, required: true, default: Date.now, immutable: true }
}, { versionKey: false, minimize: false, collection: 'agent_actions' });

agentActionSchema.index({ workspaceId: 1, state: 1, createdAt: -1 });
agentActionSchema.index({ runId: 1 });

module.exports = mongoose.model('AgentAction', agentActionSchema);
module.exports.STATES = STATES;
