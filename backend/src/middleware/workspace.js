/**
 * Workspace scope for a request.
 *
 * `auth` puts the signed-in account's personal workspace on `req.user` when the
 * account has one. `requireWorkspace` is for routes whose records belong to a
 * workspace: it makes sure there is one (an account created before workspaces
 * existed gets its own here, on first use), and then checks the membership.
 *
 * The workspace is always the caller's own. Nothing in the request can name a
 * different one: a `workspaceId` in the query or body is overwritten, the same
 * way `bindVerifiedUser` overwrites `userId`.
 */
const User = require('../models/User');
const { ensurePersonalWorkspace, activeMembership } = require('../services/workspaceService');

async function requireWorkspace(req, res, next) {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Access denied. User not authenticated.' });
    }
    let workspaceId = req.user.workspaceId;
    if (!workspaceId) {
      const user = await User.findById(req.user.userId);
      if (!user) return res.status(401).json({ success: false, message: 'Access denied. User not found.' });
      workspaceId = String(await ensurePersonalWorkspace(user));
    }
    const membership = await activeMembership(workspaceId, req.user.userId);
    if (!membership) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'You are not an active member of this workspace.' });
    }
    req.user.workspaceId = String(workspaceId);
    req.user.workspaceRole = membership.role;
    req.query.workspaceId = req.user.workspaceId;
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) req.body.workspaceId = req.user.workspaceId;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requireWorkspace };
