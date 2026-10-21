/**
 * Workspaces, memberships and identity links: the one place that creates them
 * and the one place that answers "may this account act in this workspace?".
 *
 * Every function is safe to call twice. Uniqueness is enforced by the
 * database's indexes, and a write that loses a race reads what the winner wrote.
 */
const Workspace = require('../models/Workspace');
const Membership = require('../models/Membership');
const IdentityLink = require('../models/IdentityLink');
const User = require('../models/User');

const DUPLICATE_KEY = 11000;

/** A provider subject that already belongs to a different account. */
class IdentityConflictError extends Error {
  constructor(provider) {
    super(`This ${provider} identity is already linked to another account`);
    this.name = 'IdentityConflictError';
    this.code = 'IDENTITY_CONFLICT';
    this.provider = provider;
  }
}

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/**
 * Make sure the account has its personal workspace, its owner membership, and
 * the pointer to it on the account. Returns the workspace ID.
 */
async function ensurePersonalWorkspace(user) {
  const ownerUserId = user._id;
  let workspace = await Workspace.findOne({ ownerUserId, kind: 'personal' });
  if (!workspace) {
    try {
      workspace = await Workspace.create({ ownerUserId, kind: 'personal', name: 'Personal workspace' });
    } catch (error) {
      if (error.code !== DUPLICATE_KEY) throw error;
      workspace = await Workspace.findOne({ ownerUserId, kind: 'personal' });
    }
  }
  await Membership.updateOne(
    { workspaceId: workspace._id, userId: ownerUserId },
    { $setOnInsert: { workspaceId: workspace._id, userId: ownerUserId, role: 'owner', status: 'active' } },
    { upsert: true }
  );
  if (!sameId(user.defaultWorkspaceId, workspace._id)) {
    await User.updateOne({ _id: ownerUserId }, { $set: { defaultWorkspaceId: workspace._id } });
    user.defaultWorkspaceId = workspace._id;
  }
  return workspace._id;
}

/**
 * The principal's workspace. Normally on the request already (`req.user`); for
 * an account that has none yet it is looked up, or made, as `requireWorkspace`
 * would. Null when there is no such account.
 */
async function workspaceIdFor(principal) {
  if (!principal || !principal.userId) return null;
  if (principal.workspaceId) return String(principal.workspaceId);
  const user = await User.findById(principal.userId);
  if (!user) return null;
  return String(user.defaultWorkspaceId || await ensurePersonalWorkspace(user));
}

/** The account's active membership of a workspace, or null. */
async function activeMembership(workspaceId, userId) {
  if (!workspaceId || !userId) return null;
  return Membership.findOne({ workspaceId, userId, status: 'active' });
}

/** The account a provider's subject belongs to, or null. */
async function userIdForIdentity(provider, subject) {
  if (!subject) return null;
  const link = await IdentityLink.findOne({ provider, subject: String(subject) });
  return link ? link.userId : null;
}

/** Whether the account already has an identity at this provider. */
async function hasIdentity(userId, provider) {
  return Boolean(await IdentityLink.findOne({ userId, provider }));
}

/**
 * Record that a provider's subject belongs to an account. Linking the same
 * pair again changes nothing. A subject that belongs to another account is a
 * conflict and is never moved.
 */
async function linkIdentity(userId, provider, subject, source) {
  const key = { provider, subject: String(subject) };
  let link = await IdentityLink.findOne(key);
  if (!link) {
    try {
      link = await IdentityLink.create({ ...key, userId, source });
    } catch (error) {
      if (error.code !== DUPLICATE_KEY) throw error;
      link = await IdentityLink.findOne(key);
    }
  }
  if (!sameId(link.userId, userId)) throw new IdentityConflictError(provider);
  return link;
}

module.exports = {
  IdentityConflictError,
  ensurePersonalWorkspace,
  workspaceIdFor,
  activeMembership,
  userIdForIdentity,
  hasIdentity,
  linkIdentity
};
