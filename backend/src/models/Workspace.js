/**
 * Workspace: the unit every private record belongs to.
 *
 * Each account has exactly one personal workspace, created with the account.
 * Team workspaces are not offered yet; the `kind` field and the separate
 * Membership collection exist so that adding them changes no existing record.
 *
 * A workspace's name is a label. It is never used to decide who may read
 * something: only the workspace ID and an active membership are.
 */
const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema({
  kind: { type: String, enum: ['personal', 'team'], required: true, default: 'personal' },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// One personal workspace per account, enforced by the database.
workspaceSchema.index({ ownerUserId: 1 }, { unique: true, partialFilterExpression: { kind: 'personal' } });

module.exports = mongoose.model('Workspace', workspaceSchema);
