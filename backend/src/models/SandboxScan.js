/**
 * SandboxScan: the evidence from one URL or file analysis.
 *
 * It belongs to the workspace of the account that ran it and is read through
 * the workspace repository. `evidenceHash` is a SHA-256 of the evidence taken
 * when it was stored (services/sandboxAnalysisService.js computes it), so a
 * later read can say whether the record still holds what was collected.
 * Records expire after RETENTION_DAYS, by a database index; deleting one by
 * hand leaves a minimal audit event.
 */
const mongoose = require('mongoose');

const RETENTION_DAYS = 90;
const VERDICTS = ['clean', 'suspicious', 'malicious', 'unknown'];

const sandboxScanSchema = new mongoose.Schema({
  scanId: { type: String, required: true, unique: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  ownerId: { type: String, required: true },
  type: { type: String, enum: ['url', 'file'], required: true },
  target: { type: String, required: true, maxlength: 2048 },
  verdict: { type: String, enum: VERDICTS, required: true },
  mlReport: { type: mongoose.Schema.Types.Mixed, default: {} },
  iocs: { type: [mongoose.Schema.Types.Mixed], default: [] },
  mitre: { type: mongoose.Schema.Types.Mixed, default: {} },
  findings: { type: [mongoose.Schema.Types.Mixed], default: [] },
  timeline: { type: [mongoose.Schema.Types.Mixed], default: [] },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  fileSize: { type: Number, default: null },
  mimeType: { type: String, default: null },
  durationMs: { type: Number, default: 0 },
  evidenceHash: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now, immutable: true }
}, { versionKey: false, minimize: false, collection: 'sandbox_scans' });

sandboxScanSchema.index({ workspaceId: 1, createdAt: -1 });
sandboxScanSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model('SandboxScan', sandboxScanSchema);
module.exports.RETENTION_DAYS = RETENTION_DAYS;
module.exports.VERDICTS = VERDICTS;
