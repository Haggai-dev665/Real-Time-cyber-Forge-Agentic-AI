/**
 * Membership: which account may act in which workspace, and as what.
 *
 * This is the authority for access to a workspace. An account's global `role`
 * (user, analyst, admin) says what it may do on the platform; a membership role
 * says what it may do inside one workspace. The two are not interchangeable.
 */
const mongoose = require('mongoose');

const ROLES = ['owner', 'admin', 'analyst', 'member'];

const membershipSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ROLES, required: true, default: 'member' },
  status: { type: String, enum: ['active', 'suspended'], required: true, default: 'active' }
}, { timestamps: true });

// An account is a member of a workspace at most once.
membershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Membership', membershipSchema);
module.exports.ROLES = ROLES;
