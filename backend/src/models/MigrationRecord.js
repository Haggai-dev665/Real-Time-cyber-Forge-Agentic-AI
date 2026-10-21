/**
 * MigrationRecord: the ledger of data migrations that have been applied.
 *
 * One entry per migration, written after it finishes, with what it did. A
 * migration that is in the ledger is not run again.
 */
const mongoose = require('mongoose');

const migrationRecordSchema = new mongoose.Schema({
  migrationId: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  appliedAt: { type: Date, required: true },
  durationMs: { type: Number, required: true },
  // counts and the IDs of any records set aside for review; never credentials
  summary: { type: mongoose.Schema.Types.Mixed, required: true }
}, { collection: 'migration_ledger' });

module.exports = mongoose.model('MigrationRecord', migrationRecordSchema);
