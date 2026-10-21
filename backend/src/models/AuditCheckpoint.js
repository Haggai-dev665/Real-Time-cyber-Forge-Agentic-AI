/**
 * AuditCheckpoint: a signed summary of a run of audit events (SEC-08).
 *
 * For one workspace (or the platform), a checkpoint covers every event recorded
 * after the previous checkpoint's `to` and up to its own `to`: how many there
 * were and a root hash over their IDs and content hashes, in order. It names the
 * previous checkpoint and its root hash, so the checkpoints form a chain, and it
 * is signed with the server's AUDIT_SIGNING_KEY, which is not in the database.
 *
 * Checking the events against the checkpoints shows an event changed, removed
 * or added after it was covered, by anyone without the server's key. It does not
 * stop the change, and it says nothing about events not yet covered.
 *
 * Like audit events, checkpoints cannot be changed or deleted through the
 * application. They expire a day after the events they cover.
 */
const mongoose = require('mongoose');

const RETENTION_DAYS = 91;

const auditCheckpointSchema = new mongoose.Schema({
  checkpointId: { type: String, required: true, unique: true },
  scope: { type: String, enum: ['workspace', 'platform'], required: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
  from: { type: Date, default: null },          // exclusive; null for the first checkpoint
  to: { type: Date, required: true },           // inclusive
  firstAt: { type: Date, required: true },      // the first covered event's time (for retention)
  count: { type: Number, required: true },
  rootHash: { type: String, required: true },
  previousCheckpointId: { type: String, default: null },
  previousRootHash: { type: String, default: null },
  keyId: { type: String, required: true },
  signature: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now, immutable: true }
}, { versionKey: false, collection: 'audit_checkpoints' });

auditCheckpointSchema.index({ scope: 1, workspaceId: 1, to: -1 });
auditCheckpointSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

function refuse() {
  throw new Error('Audit checkpoints cannot be changed or deleted through the application');
}
for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteMany', 'findOneAndDelete']) {
  auditCheckpointSchema.pre(operation, refuse);
}
auditCheckpointSchema.pre('deleteOne', { document: true, query: true }, refuse);
auditCheckpointSchema.pre('save', function onlyNew() {
  if (!this.isNew) refuse();
});

module.exports = mongoose.model('AuditCheckpoint', auditCheckpointSchema);
module.exports.RETENTION_DAYS = RETENTION_DAYS;
