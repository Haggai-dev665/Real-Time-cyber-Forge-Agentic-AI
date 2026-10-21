/**
 * FindingException: "this target is expected for us" for one category of
 * finding, with an owner, a reason and an expiry (DET-02).
 *
 * It belongs to a workspace and applies to findings of that workspace's account
 * only: it never changes detection for anyone else. A detection it covers is
 * still recorded, as `excepted`, so nothing is lost. It covers detections up to
 * the severity it was made for (`maxSeverity`): a more severe one is new,
 * contradictory evidence, and opens as a normal finding that says the exception
 * did not apply. It ends at `expiresAt` (at most 90 days after it was made) or
 * when revoked; ended exceptions stay as the record of what was excepted.
 */
const mongoose = require('mongoose');

const MAX_DAYS = 90;
const SEVERITIES = ['low', 'medium', 'high', 'critical'];

const findingExceptionSchema = new mongoose.Schema({
  exceptionId: { type: String, required: true, unique: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  type: { type: String, required: true, maxlength: 64 },
  target: { type: String, required: true, maxlength: 512 },       // normalised (findingService.normalizeTarget)
  reason: { type: String, required: true, maxlength: 500 },
  maxSeverity: { type: String, enum: SEVERITIES, required: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  revokedBy: { type: String, default: null },
  matches: { type: Number, default: 0 },
  lastMatchedAt: { type: Date, default: null },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now, immutable: true }
}, { versionKey: false, collection: 'finding_exceptions' });

findingExceptionSchema.index({ workspaceId: 1, type: 1, target: 1, expiresAt: -1 });

module.exports = mongoose.model('FindingException', findingExceptionSchema);
module.exports.MAX_DAYS = MAX_DAYS;
module.exports.SEVERITIES = SEVERITIES;
