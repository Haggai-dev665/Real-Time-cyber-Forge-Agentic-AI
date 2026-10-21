/**
 * An account's data (SEC-07): export everything kept about it, delete chosen
 * kinds of it, or delete the account.
 *
 * Every store that holds an account's records is listed once, in STORES, with
 * how it is keyed: by the account's personal workspace (through the workspace
 * repository) or by the account itself. Export, data deletion and account
 * deletion all work from that list, so a store cannot be exported but left
 * behind at deletion. `tests/security/account-data.test.js` checks the list
 * against the models directory: a new model has to be placed in it or in
 * NOT_PERSONAL with the reason.
 *
 * Account deletion writes an AccountDeletion receipt that outlives the account:
 * every store's result, and what is kept and why. The account itself (sign-in,
 * memberships, workspace, user record) is removed only when every data store
 * reported success; otherwise the receipt is `partial`, the account still works,
 * and asking again finishes the job.
 */
const crypto = require('crypto');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Membership = require('../models/Membership');
const IdentityLink = require('../models/IdentityLink');
const AccountDeletion = require('../models/AccountDeletion');
const AuditEvent = require('../models/AuditEvent');
const Policy = require('../models/Policy');
const { workspaceRepository } = require('../repositories/workspaceRepository');
const { appwriteService } = require('./appwriteService');
const auditLog = require('./auditLogService');
const captureBuffer = require('./networkCaptureBuffer');
const logger = require('../utils/logger');

const EXPORT_MAX = 5000;

// Fields never exported: key material, code hashes, signatures, sequence counters.
const omit = (...fields) => doc => {
  const copy = { ...(doc && typeof doc.toObject === 'function' ? doc.toObject() : doc) };
  for (const field of fields) delete copy[field];
  return copy;
};

/**
 * The stores holding an account's records.
 *   key:   'workspace' — every record of the account's personal workspace;
 *          'user'      — records whose `field` is the account's ID.
 *   scope: which `DELETE /me/data?scope=` removes it (all of them go with `all`
 *          and with the account).
 */
const STORES = [
  { name: 'synced_memories', model: 'SyncedMemory', key: 'workspace', scope: 'memory', present: omit('emb') },
  { name: 'threats', model: 'Threat', key: 'user', field: 'user', scope: 'scans' },
  { name: 'analyses', model: 'Analysis', key: 'user', field: 'user', scope: 'scans' },
  { name: 'sandbox_scans', model: 'SandboxScan', key: 'workspace', scope: 'scans' },
  { name: 'response_actions', model: 'ResponseAction', key: 'workspace', scope: 'scans' },
  { name: 'finding_exceptions', model: 'FindingException', key: 'workspace', scope: 'scans' },
  { name: 'alert_decisions', model: 'AlertDecision', key: 'workspace', scope: 'scans' },
  { name: 'agents', model: 'Agent', key: 'workspace', scope: 'agents' },
  { name: 'agent_runs', model: 'AgentRun', key: 'workspace', scope: 'agents', present: omit('lease') },
  { name: 'agent_actions', model: 'AgentAction', key: 'workspace', scope: 'agents' },
  { name: 'devices', model: 'Device', key: 'workspace', scope: 'devices', present: omit('publicKey', 'lastSeq') },
  { name: 'device_enrollments', model: 'DeviceEnrollment', key: 'workspace', scope: 'devices', present: omit('codeHash') },
  { name: 'device_events', model: 'DeviceEvent', key: 'workspace', scope: 'devices' },
  { name: 'device_commands', model: 'DeviceCommand', key: 'workspace', scope: 'devices', present: omit('signature') }
];

/** Models that hold no record of one account, or are handled separately below. */
const NOT_PERSONAL = {
  User: 'the account itself: exported as `account`, deleted last',
  Workspace: 'the personal workspace: deleted with the account',
  Membership: 'membership of the workspace: deleted with the account',
  IdentityLink: 'sign-in identities: exported without secrets, deleted with the account',
  AuditEvent: 'the security record: exported, kept until its retention ends',
  AuditCheckpoint: 'signed summaries of the audit trail (hashes and counts, no personal data): kept with the security record',
  AccountDeletion: 'the deletion receipt: holds no personal data and outlives the account',
  Policy: 'platform-wide rules, not the account\'s; its name is removed from those it created or changed',
  MigrationRecord: 'the migration ledger: no account data'
};

const SCOPES = ['memory', 'scans', 'agents', 'devices', 'all'];

// What account deletion leaves, and why. Shown on the receipt.
const KEPT = [
  `Audit events stay until their ${AuditEvent.RETENTION_DAYS || 90}-day retention ends: they are the security record of what happened, including this deletion.`,
  'This receipt: it holds the account ID and a SHA-256 of the email address, never the address.',
  'Platform policies the account created or changed stay, with its name replaced by "deleted-account".',
  'Copies a device keeps on its own disk are not reached from here; uninstalling the app or "Clear local memory" removes them.'
];

const models = {};
const modelOf = name => (models[name] = models[name] || require(`../models/${name}`));

class AccountDataError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function filterFor(store, principal) {
  return { [store.field]: principal.userId };
}

async function readStore(store, principal) {
  const Model = modelOf(store.model);
  const present = store.present || omit();
  if (store.key === 'workspace') {
    // the repository pages at 200 records
    const repo = workspaceRepository(Model);
    const records = [];
    while (records.length < EXPORT_MAX) {
      const page = await repo.find(principal, {}, { limit: 200, skip: records.length, sort: { _id: 1 } });
      records.push(...page);
      if (page.length < 200) break;
    }
    return { records: records.slice(0, EXPORT_MAX).map(present), truncated: records.length >= EXPORT_MAX };
  }
  const records = await Model.find(filterFor(store, principal)).sort({ _id: -1 }).limit(EXPORT_MAX + 1).lean();
  return { records: records.slice(0, EXPORT_MAX).map(present), truncated: records.length > EXPORT_MAX };
}

async function deleteStore(store, principal) {
  const Model = modelOf(store.model);
  try {
    const removed = store.key === 'workspace'
      ? await workspaceRepository(Model).deleteMany(principal, {})
      : (await Model.deleteMany(filterFor(store, principal))).deletedCount || 0;
    return { removed };
  } catch (error) {
    logger.error(`[account-data] deleting ${store.name} failed: ${error.message}`);
    return { removed: 0, error: 'delete failed' };
  }
}

function accountView(user) {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName || null,
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    role: user.role,
    provider: user.provider || null,
    emailVerified: Boolean(user.emailVerified),
    photoURL: user.photoURL || null,
    profile: user.profile || {},
    security: user.security ? {
      lastPasswordChange: user.security.lastPasswordChange || null,
      twoFactorEnabled: Boolean(user.security.twoFactorEnabled)
    } : {},
    activity: user.activity || {},
    permissions: user.permissions || {},
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null
  };
}

/** Everything kept about the signed-in account, as one JSON document. */
async function exportAccount(principal, req) {
  const user = await User.findById(principal.userId);
  if (!user) throw new AccountDataError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
  const stores = {};
  for (const store of STORES) {
    try {
      stores[store.name] = await readStore(store, principal);
    } catch (error) {
      logger.error(`[account-data] export of ${store.name} failed: ${error.message}`);
      stores[store.name] = { error: 'export failed' };
    }
  }
  const [memberships, identities, workspace, audit] = await Promise.all([
    Membership.find({ userId: principal.userId }).lean(),
    IdentityLink.find({ userId: principal.userId }).lean(),
    Workspace.findById(principal.workspaceId).lean(),
    readStore({ model: 'AuditEvent', key: 'workspace' }, principal)
  ]);
  let appwrite;
  try {
    appwrite = await appwriteService.listAccountDocuments(String(principal.userId), user.appwriteUserId || null, { max: EXPORT_MAX });
  } catch (error) {
    appwrite = { error: 'Appwrite was not reachable; its documents are not in this export' };
  }
  await auditLog.record({ principal, action: 'account.export', resource: `user:${principal.userId}`, req });
  return {
    format: 'cyberforge-account-export-v1',
    exportedAt: new Date().toISOString(),
    limits: { recordsPerStore: EXPORT_MAX },
    account: accountView(user),
    workspace: workspace ? { id: String(workspace._id), kind: workspace.kind, name: workspace.name, createdAt: workspace.createdAt || null } : null,
    memberships: memberships.map(m => ({ workspaceId: String(m.workspaceId), role: m.role, status: m.status })),
    identities: identities.map(link => ({ provider: link.provider, subject: link.subject, createdAt: link.createdAt || null })),
    stores,
    // the latest captures the web process holds for the account (the durable copy is under appwrite.network_captures)
    network_capture_buffer: captureBuffer.get(String(principal.userId)),
    audit_events: audit,
    appwrite
  };
}

/** Deletes one kind of the account's data (or all of it), keeping the account. */
async function deleteData(principal, scope, req) {
  if (!SCOPES.includes(scope)) {
    throw new AccountDataError(400, 'INVALID_SCOPE', `scope must be one of: ${SCOPES.join(', ')}`);
  }
  if (principal.workspaceRole && principal.workspaceRole !== 'owner') {
    throw new AccountDataError(403, 'FORBIDDEN', 'Only the workspace owner can delete its data');
  }
  const results = {};
  for (const store of STORES) {
    if (scope === 'all' || store.scope === scope) results[store.name] = await deleteStore(store, principal);
  }
  if (scope === 'all') {
    // the account's Appwrite documents; its sign-in record (`users`) stays with the account
    try {
      Object.assign(results, prefixed(await appwriteService.deleteAccountDocuments(String(principal.userId), null)));
    } catch (error) {
      results.appwrite = { removed: 0, error: 'Appwrite was not reachable' };
    }
    results.network_capture_buffer = { removed: captureBuffer.forget(principal.userId) };
  }
  const failed = Object.entries(results).filter(([, result]) => result.error).map(([name]) => name);
  await auditLog.record({
    principal, action: 'account.data_delete', resource: `user:${principal.userId}`,
    outcome: failed.length ? 'warning' : 'success', details: { scope, results }, req
  });
  return { scope, results, complete: failed.length === 0, failed };
}

const prefixed = results => Object.fromEntries(Object.entries(results).map(([name, result]) => [`appwrite.${name}`, result]));
const emailHash = email => crypto.createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex');
const newDeletionId = () => `del_${crypto.randomBytes(18).toString('base64url')}`;

/**
 * Deletes the account and everything it owns. `confirm` must be the account's
 * email address. Returns the receipt.
 */
async function deleteAccount(principal, { confirm } = {}, req) {
  const user = await User.findById(principal.userId);
  if (!user) throw new AccountDataError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
  if (typeof confirm !== 'string' || confirm.trim().toLowerCase() !== String(user.email).toLowerCase()) {
    throw new AccountDataError(400, 'CONFIRMATION_REQUIRED', 'Type the account\'s email address in `confirm` to delete the account');
  }
  if (principal.workspaceRole && principal.workspaceRole !== 'owner') {
    throw new AccountDataError(403, 'FORBIDDEN', 'Only the owner of the personal workspace can delete the account');
  }

  const accountId = String(user._id);
  const receipt = await AccountDeletion.create({
    deletionId: newDeletionId(),
    userId: accountId,
    emailHash: emailHash(user.email),
    state: 'running',
    results: {},
    kept: KEPT,
    requestedAt: new Date()
  });

  // 1. the data stores
  const results = {};
  for (const store of STORES) results[store.name] = await deleteStore(store, principal);

  // 2. Appwrite: the account's documents, then its sign-in user
  try {
    Object.assign(results, prefixed(await appwriteService.deleteAccountDocuments(accountId, user.appwriteUserId || null)));
    if (user.appwriteUserId) results['appwrite.auth_user'] = await appwriteService.deleteAuthUser(user.appwriteUserId);
  } catch (error) {
    results.appwrite = { removed: 0, error: 'Appwrite was not reachable' };
  }

  results.network_capture_buffer = { removed: captureBuffer.forget(accountId) };

  // 3. platform policies keep their history without the account's name
  try {
    const created = await Policy.updateMany({ createdBy: accountId }, { $set: { createdBy: 'deleted-account' } });
    const updated = await Policy.updateMany({ updatedBy: accountId }, { $set: { updatedBy: 'deleted-account' } });
    results['policies.attribution'] = { removed: (created.modifiedCount || 0) + (updated.modifiedCount || 0) };
  } catch (error) {
    results['policies.attribution'] = { removed: 0, error: 'update failed' };
  }

  // 4. the account itself, only once all of its data is gone
  const dataFailed = Object.values(results).some(result => result.error);
  if (!dataFailed) {
    const steps = [
      ['memberships', () => Membership.deleteMany({ userId: user._id })],
      ['identity_links', () => IdentityLink.deleteMany({ userId: user._id })],
      ['workspace', () => Workspace.deleteMany({ _id: principal.workspaceId, ownerUserId: user._id, kind: 'personal' })],
      ['account', () => User.deleteOne({ _id: user._id })]
    ];
    for (const [name, run] of steps) {
      try {
        results[name] = { removed: (await run()).deletedCount || 0 };
      } catch (error) {
        logger.error(`[account-data] deleting ${name} failed: ${error.message}`);
        results[name] = { removed: 0, error: 'delete failed' };
        break;
      }
    }
  } else {
    results.account = { removed: 0, error: 'kept: some data could not be deleted; ask again to finish' };
  }

  const failed = Object.entries(results).filter(([, result]) => result.error).map(([name]) => name);
  receipt.state = failed.length ? 'partial' : 'completed';
  receipt.results = results;
  receipt.completedAt = new Date();
  await AccountDeletion.updateOne({ deletionId: receipt.deletionId }, {
    $set: { state: receipt.state, results, completedAt: receipt.completedAt }
  });

  // a platform event: the workspace it would belong to is gone
  await auditLog.record({
    principal, platform: true, action: 'account.delete', resource: `user:${accountId}`,
    outcome: failed.length ? 'warning' : 'success', details: { deletionId: receipt.deletionId, state: receipt.state, failed }, req
  });
  return presentReceipt(receipt);
}

function presentReceipt(receipt) {
  return {
    deletionId: receipt.deletionId,
    state: receipt.state,
    requestedAt: receipt.requestedAt,
    completedAt: receipt.completedAt || null,
    results: receipt.results || {},
    kept: receipt.kept || [],
    failed: Object.entries(receipt.results || {}).filter(([, result]) => result && result.error).map(([name]) => name)
  };
}

/** A receipt by its ID (the ID is 144 random bits; the receipt holds no personal data). */
async function getReceipt(deletionId) {
  if (typeof deletionId !== 'string' || !/^del_[A-Za-z0-9_-]{24}$/.test(deletionId)) return null;
  const receipt = await AccountDeletion.findOne({ deletionId });
  return receipt ? presentReceipt(receipt) : null;
}

module.exports = {
  STORES,
  NOT_PERSONAL,
  SCOPES,
  KEPT,
  AccountDataError,
  exportAccount,
  deleteData,
  deleteAccount,
  getReceipt,
  emailHash
};
