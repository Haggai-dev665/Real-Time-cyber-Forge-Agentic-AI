/**
 * Every account gets its personal workspace and owner membership, and the
 * outside identities already stored on the account (its Appwrite user, its
 * Firebase user) are recorded as identity links.
 *
 * It adds two collections and one field (`defaultWorkspaceId`) on accounts. It
 * changes and removes nothing that exists, so there is nothing to back up or
 * roll back: undoing it is dropping the two collections and the field.
 *
 * Set aside, not guessed: if two accounts claim the same outside identity,
 * neither is linked to it. Both are listed in the summary for a person to
 * resolve. Their workspaces are still created; a workspace has one owner and
 * is never ambiguous.
 */
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Membership = require('../models/Membership');
const { ensurePersonalWorkspace, userIdForIdentity, linkIdentity } = require('../services/workspaceService');

const STORED_IDENTITIES = [['appwrite', 'appwriteUserId'], ['firebase', 'firebaseUid']];

module.exports = {
  id: '001-personal-workspaces',
  description: 'Give every account a personal workspace and record its outside identities',

  async up({ apply }) {
    const summary = {
      accounts: 0,
      workspaces: { created: 0, alreadyPresent: 0 },
      identityLinks: { created: 0, alreadyPresent: 0 },
      setAside: []
    };
    // First pass: which outside identities are claimed by more than one account?
    // Those are decided before anything is linked, so that neither claimant gets it.
    const claims = new Map(); // "provider:subject" -> number of accounts holding it
    for await (const user of User.find({}).select('_id appwriteUserId firebaseUid').cursor()) {
      for (const [provider, field] of STORED_IDENTITIES) {
        if (user[field]) claims.set(`${provider}:${user[field]}`, (claims.get(`${provider}:${user[field]}`) || 0) + 1);
      }
    }

    for await (const user of User.find({}).select('_id appwriteUserId firebaseUid defaultWorkspaceId').cursor()) {
      summary.accounts += 1;

      const existing = await Workspace.findOne({ ownerUserId: user._id, kind: 'personal' });
      summary.workspaces[existing ? 'alreadyPresent' : 'created'] += 1;
      // run even when the workspace exists: it also repairs a missing membership or pointer
      if (apply) await ensurePersonalWorkspace(user);

      for (const [provider, field] of STORED_IDENTITIES) {
        const subject = user[field];
        if (!subject) continue;
        const linkedTo = await userIdForIdentity(provider, subject);
        const shared = claims.get(`${provider}:${subject}`) > 1;
        const takenByAnother = linkedTo && String(linkedTo) !== String(user._id);
        if (shared || takenByAnother) {
          summary.setAside.push({
            userId: String(user._id),
            provider,
            reason: shared ? 'more than one account holds this identity' : 'the identity is already linked to another account'
          });
          continue;
        }
        if (linkedTo) {
          summary.identityLinks.alreadyPresent += 1;
        } else {
          summary.identityLinks.created += 1;
          if (apply) await linkIdentity(user._id, provider, subject, 'migration');
        }
      }
    }

    if (apply) {
      summary.check = {
        accounts: await User.countDocuments({}),
        personalWorkspaces: await Workspace.countDocuments({ kind: 'personal' }),
        ownerMemberships: await Membership.countDocuments({ role: 'owner', status: 'active' })
      };
      const { accounts, personalWorkspaces, ownerMemberships } = summary.check;
      if (accounts !== personalWorkspaces || accounts !== ownerMemberships) {
        throw new Error(`After the migration there are ${accounts} accounts, ${personalWorkspaces} personal workspaces and ${ownerMemberships} owner memberships; they must be equal`);
      }
    }
    return summary;
  }
};
