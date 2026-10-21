/**
 * AccountDeletion: the receipt for one account deletion (SEC-07).
 *
 * It outlives the account, so it holds no personal data: the account's ID, a
 * SHA-256 of its email (to answer "was this address's account deleted?" without
 * keeping the address), when it was asked for and finished, and for every store
 * how many records were removed or what failed. `state` is `completed` only
 * when every store reported success; otherwise `partial`, with the failures.
 */
const mongoose = require('mongoose');

const accountDeletionSchema = new mongoose.Schema({
  deletionId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  emailHash: { type: String, required: true },
  state: { type: String, enum: ['running', 'completed', 'partial'], required: true },
  results: { type: mongoose.Schema.Types.Mixed, default: {} },
  kept: { type: [String], default: [] },
  requestedAt: { type: Date, required: true },
  completedAt: { type: Date, default: null }
}, { versionKey: false, minimize: false, collection: 'account_deletions' });

module.exports = mongoose.model('AccountDeletion', accountDeletionSchema);
