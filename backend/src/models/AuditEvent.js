/**
 * AuditEvent: one security-relevant thing that happened, kept in the database.
 *
 * Each event belongs to a workspace, or to the platform (a change that affects
 * every workspace, such as a global policy, or the server starting). It names
 * who did it, what, to what, how it turned out, and whether the server saw it
 * happen (`origin: 'server'`) or a client reported it (`origin: 'client'`).
 *
 * The application can add events and read them. It cannot change or delete
 * one: every update and delete operation on this model is refused. Events
 * expire after RETENTION_DAYS, by a database index. This is not tamper-proof
 * storage: anyone with write access to the database itself can still alter it.
 * What makes such a change detectable is `contentHash` (a SHA-256 of the
 * event's fields, set when it is recorded) together with the signed
 * checkpoints of models/AuditCheckpoint.js (services/auditIntegrityService.js).
 */
const mongoose = require('mongoose');

const RETENTION_DAYS = 90;
const OUTCOMES = ['success', 'failure', 'warning'];

const auditEventSchema = new mongoose.Schema({
  scope: { type: String, enum: ['workspace', 'platform'], required: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
  actorType: { type: String, enum: ['user', 'system'], required: true },
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true, maxlength: 64, match: /^[a-z][a-z_]*(\.[a-z][a-z_]*)+$/ },
  resource: { type: String, required: true, maxlength: 200 },
  outcome: { type: String, enum: OUTCOMES, required: true },
  origin: { type: String, enum: ['server', 'client'], required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  correlationId: { type: String, maxlength: 100, default: null },
  ipAddress: { type: String, maxlength: 64, default: null },
  contentHash: { type: String, default: null, maxlength: 64 },
  createdAt: { type: Date, required: true, default: Date.now, immutable: true }
}, { versionKey: false, collection: 'audit_events' });

auditEventSchema.index({ workspaceId: 1, createdAt: -1 });
auditEventSchema.index({ scope: 1, createdAt: -1 });
auditEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

// Append-only, as far as the application is concerned.
function refuse() {
  throw new Error('Audit events cannot be changed or deleted through the application');
}
for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace',
  'deleteMany', 'findOneAndDelete']) {
  auditEventSchema.pre(operation, refuse);
}
auditEventSchema.pre('deleteOne', { document: true, query: true }, refuse);
auditEventSchema.pre('save', function onlyNew() {
  if (!this.isNew) refuse();
});

module.exports = mongoose.model('AuditEvent', auditEventSchema);
module.exports.RETENTION_DAYS = RETENTION_DAYS;
module.exports.OUTCOMES = OUTCOMES;
