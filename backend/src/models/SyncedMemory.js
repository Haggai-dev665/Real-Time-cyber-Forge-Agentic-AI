/**
 * SyncedMemory: a memory a device copied to the account (SEC-07, F12).
 *
 * It belongs to the workspace and is read through the workspace repository; an
 * entry's `memoryId` is unique only within its workspace, so another account
 * using the same ID adds its own entry. Before this, synced memory lived in an
 * array in the web process and was lost at every restart. Entries expire
 * RETENTION_DAYS after they were last saved, and at most MAX_PER_WORKSPACE are
 * kept (the oldest go first).
 */
const mongoose = require('mongoose');

const RETENTION_DAYS = 365;
const MAX_PER_WORKSPACE = 5000;

const syncedMemorySchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  memoryId: { type: String, required: true, maxlength: 128 },
  text: { type: String, required: true, maxlength: 4000 },
  kind: { type: String, enum: ['episodic', 'semantic', 'procedural'], default: 'episodic' },
  url: { type: String, default: null, maxlength: 2048 },
  category: { type: String, default: null, maxlength: 64 },
  risk: { type: Number, default: null },
  ts: { type: Number, required: true },
  emb: { type: [Number], default: [] },
  createdBy: { type: String, required: true },
  savedAt: { type: Date, required: true, default: Date.now }
}, { versionKey: false, collection: 'synced_memories' });

syncedMemorySchema.index({ workspaceId: 1, memoryId: 1 }, { unique: true });
syncedMemorySchema.index({ workspaceId: 1, ts: -1 });
syncedMemorySchema.index({ savedAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model('SyncedMemory', syncedMemorySchema);
module.exports.RETENTION_DAYS = RETENTION_DAYS;
module.exports.MAX_PER_WORKSPACE = MAX_PER_WORKSPACE;
