/**
 * DeviceEnrollment: a one-time code that lets one installation join a
 * workspace (DEV-02).
 *
 * Only a SHA-256 of the code is kept. It is bound to the workspace and the
 * member who created it, expires after a few minutes, and is claimed at most
 * once: the claim changes `state` from `pending` to `claimed` in one atomic
 * update, so two concurrent claims cannot both succeed. The code carries no
 * user credential. Records expire from the database a day after their code
 * does, by an index.
 */
const mongoose = require('mongoose');

const STATES = ['pending', 'claimed', 'cancelled'];
const FLOWS = ['this_device', 'pair'];

const deviceEnrollmentSchema = new mongoose.Schema({
  enrollmentId: { type: String, required: true, unique: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  createdBy: { type: String, required: true },
  codeHash: { type: String, required: true, unique: true },
  flow: { type: String, enum: FLOWS, required: true },
  platform: { type: String, default: null },
  state: { type: String, enum: STATES, required: true, default: 'pending' },
  expiresAt: { type: Date, required: true },
  claimedAt: { type: Date, default: null },
  claimedDeviceId: { type: String, default: null },
  createdAt: { type: Date, required: true, default: Date.now, immutable: true }
}, { versionKey: false, collection: 'device_enrollments' });

deviceEnrollmentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.model('DeviceEnrollment', deviceEnrollmentSchema);
module.exports.STATES = STATES;
module.exports.FLOWS = FLOWS;
