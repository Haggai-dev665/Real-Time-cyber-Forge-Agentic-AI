/**
 * Device: one enrolled installation, or an inventory record (DEV-01).
 *
 * A device belongs to a workspace and is read through the workspace
 * repository. Its identity is `deviceId`, which never changes; the display
 * name can. An installation (the `installationId` the app generates once) has
 * at most one record per workspace, so re-enrolling after a restart or a
 * reinstall that kept its installation ID updates the same record with a new
 * key version instead of adding another.
 *
 * Kinds are kept apart: `endpoint` (a user's computer or phone running the
 * app), `backend_worker` (a server process, never shown as the user's laptop)
 * and `inventory_only` (an owner-entered record with no key, no telemetry and
 * no protection claims).
 *
 * States:
 *   pending_approval  claimed with a key; a member must approve before it can sign in
 *   active            may send signed heartbeats
 *   revoked           its key is refused; re-enrolling needs a new code and approval
 *   inventory         an inventory-only record
 *
 * Capabilities are kept as three separate lists: what the device advertised,
 * what policy enables, and what its own runtime checks confirmed.
 */
const mongoose = require('mongoose');

const KINDS = ['endpoint', 'backend_worker', 'inventory_only'];
const PLATFORMS = ['windows', 'macos', 'linux', 'android', 'ios', 'other'];
const STATES = ['pending_approval', 'active', 'revoked', 'inventory'];

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  kind: { type: String, enum: KINDS, required: true },
  platform: { type: String, enum: PLATFORMS, required: true },
  displayName: { type: String, required: true, maxlength: 80 },
  state: { type: String, enum: STATES, required: true },
  installationId: { type: String, default: null, maxlength: 64 },
  publicKey: { type: String, default: null },
  keyFingerprint: { type: String, default: null },
  keyVersion: { type: Number, default: 0 },
  lastSeq: { type: Number, default: 0 },
  clientVersion: { type: String, default: null, maxlength: 40 },
  capabilities: {
    advertised: { type: [String], default: [] },
    enabled: { type: [String], default: [] },
    confirmed: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  enrollmentId: { type: String, default: null },
  createdBy: { type: String, required: true },
  approvedBy: { type: String, default: null },
  approvedAt: { type: Date, default: null },
  revokedBy: { type: String, default: null },
  revokedAt: { type: Date, default: null },
  lastSeenAt: { type: Date, default: null },
  createdAt: { type: Date, required: true, default: Date.now, immutable: true },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false, minimize: false, collection: 'devices' });

deviceSchema.index({ workspaceId: 1, installationId: 1 }, { unique: true, partialFilterExpression: { installationId: { $type: 'string' } } });
deviceSchema.index({ workspaceId: 1, createdAt: -1 });

module.exports = mongoose.model('Device', deviceSchema);
module.exports.KINDS = KINDS;
module.exports.PLATFORMS = PLATFORMS;
module.exports.STATES = STATES;
