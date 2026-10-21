/**
 * A repository for records that belong to a workspace.
 *
 * Every method takes the verified principal first (`req.user` after
 * `requireWorkspace`) and adds its workspace to the query itself. A handler
 * cannot read, change or delete another workspace's record by passing its ID:
 * the record is simply not found. And it cannot widen the query, because the
 * workspace is never taken from the fields or the filter it supplies.
 *
 *   const devices = workspaceRepository(Device);
 *   await devices.create(req.user, { name: 'Laptop' });
 *   await devices.findById(req.user, req.params.id);   // null if it is not this workspace's
 *
 * The model must have a `workspaceId` field. Stores for new device, agent, run,
 * policy, evidence and audit records are built on this instead of on a
 * process-wide Map (plan section 4.2, item 3).
 */

const MAX_PAGE = 200;
const DEFAULT_PAGE = 50;

/** A request reached a workspace-scoped store without a workspace. */
class WorkspaceRequiredError extends Error {
  constructor() {
    super('This operation needs a workspace; apply requireWorkspace to the route');
    this.name = 'WorkspaceRequiredError';
    this.code = 'WORKSPACE_REQUIRED';
  }
}

function scopeOf(principal) {
  if (!principal || !principal.workspaceId) throw new WorkspaceRequiredError();
  return { workspaceId: String(principal.workspaceId) };
}

/** Fields a caller may set: never the workspace, the ID, or who created it. */
function ownFields(fields) {
  const { workspaceId, _id, id, createdBy, ...rest } = fields || {};
  return rest;
}

/**
 * A filter a caller may add: plain field conditions only. The workspace is
 * removed, and so is every top-level operator (`$or`, `$where`, …), which is
 * how a filter would otherwise reach outside its scope.
 */
function ownFilter(filter) {
  return Object.fromEntries(Object.entries(filter || {}).filter(([key]) => key !== 'workspaceId' && !key.startsWith('$')));
}

function pageOf({ limit, skip } = {}) {
  const size = Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_PAGE) : DEFAULT_PAGE;
  const offset = Number.isInteger(skip) && skip > 0 ? skip : 0;
  return { size, offset };
}

function workspaceRepository(Model) {
  return {
    async create(principal, fields) {
      const scope = scopeOf(principal);
      return Model.create({ ...ownFields(fields), ...scope, createdBy: String(principal.userId) });
    },

    /** The record, or null when it does not exist in this workspace. */
    async findById(principal, id) {
      return Model.findOne({ _id: id, ...scopeOf(principal) });
    },

    /** The first record of this workspace matching a plain filter (for a record with its own public ID), or null. */
    async findOne(principal, filter) {
      return Model.findOne({ ...ownFilter(filter), ...scopeOf(principal) });
    },

    /** A page of this workspace's records. At most 200 at a time. */
    async find(principal, filter, options = {}) {
      const { size, offset } = pageOf(options);
      return Model.find({ ...ownFilter(filter), ...scopeOf(principal) })
        .sort(options.sort || { _id: -1 })
        .skip(offset)
        .limit(size);
    },

    async count(principal, filter) {
      return Model.countDocuments({ ...ownFilter(filter), ...scopeOf(principal) });
    },

    /** True when a record of this workspace was changed. */
    async updateById(principal, id, changes) {
      const result = await Model.updateOne({ _id: id, ...scopeOf(principal) }, { $set: ownFields(changes) });
      return result.matchedCount === 1;
    },

    /** True when a record of this workspace was removed. */
    async deleteById(principal, id) {
      const result = await Model.deleteOne({ _id: id, ...scopeOf(principal) });
      return result.deletedCount === 1;
    },

    /** True when a record of this workspace matching a plain filter was removed. */
    async deleteOne(principal, filter) {
      const result = await Model.deleteOne({ ...ownFilter(filter), ...scopeOf(principal) });
      return result.deletedCount === 1;
    },

    /** How many of this workspace's records matching a plain filter were removed (all of them for `{}`). */
    async deleteMany(principal, filter) {
      const result = await Model.deleteMany({ ...ownFilter(filter), ...scopeOf(principal) });
      return result.deletedCount || 0;
    }
  };
}

module.exports = { workspaceRepository, WorkspaceRequiredError, MAX_PAGE, DEFAULT_PAGE };
