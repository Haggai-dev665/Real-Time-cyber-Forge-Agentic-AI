/**
 * ResponseAction: what a policy asked for when it fired, and what happened.
 *
 * It belongs to the workspace of the account whose risk event fired the
 * policy, and is read through the workspace repository. Its status is one of
 * proposed (recorded, not yet carried out), applied (with a receipt), failed
 * (with the reason) or unsupported (nothing in this deployment carries it out).
 * Records expire after RETENTION_DAYS, by a database index.
 */
const mongoose = require('mongoose');

const RETENTION_DAYS = 90;
const STATUSES = ['proposed', 'applied', 'failed', 'unsupported'];

const responseActionSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  actionId: { type: String, required: true, unique: true },
  policyId: { type: String, required: true },
  policyName: { type: String, required: true },
  actionType: { type: String, required: true },
  actionParams: { type: mongoose.Schema.Types.Mixed, default: {} },
  trigger: { type: mongoose.Schema.Types.Mixed, required: true },
  nodeId: { type: String, required: true, maxlength: 200 },
  userId: { type: String, default: null },
  status: { type: String, enum: STATUSES, required: true },
  reason: { type: String, default: null, maxlength: 300 },
  executor: { type: String, default: null },
  receipt: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, required: true, default: Date.now, immutable: true }
}, { versionKey: false, collection: 'response_actions' });

responseActionSchema.index({ workspaceId: 1, createdAt: -1 });
responseActionSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model('ResponseAction', responseActionSchema);
module.exports.RETENTION_DAYS = RETENTION_DAYS;
module.exports.STATUSES = STATUSES;
