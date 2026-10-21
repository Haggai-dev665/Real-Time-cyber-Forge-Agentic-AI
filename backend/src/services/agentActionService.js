/**
 * Approving what agents propose (AGT-05).
 *
 * A proposal is fixed when an agent makes it: one action, one device, one
 * domain, the agent version and the evidence. Only a signed-in member can
 * approve it (an agent has no session, so it cannot approve its own proposal).
 * Approval is checked against the present:
 *   - the proposal has not expired and is still proposed;
 *   - the agent is still active at the version that proposed it (an edit made
 *     since invalidates the proposal);
 *   - the device is still approved and offers the capability (checked again by
 *     the device command service).
 * Then it becomes a signed device command (DEV-05), keyed by the proposal so a
 * double approval makes one command, and its outcome is that command's
 * receipt: shown as applied only when the device says so.
 */
const AgentAction = require('../models/AgentAction');
const Agent = require('../models/Agent');
const DeviceCommand = require('../models/DeviceCommand');
const { workspaceRepository } = require('../repositories/workspaceRepository');
const { AgentError } = require('./agentDefinitionService');
const deviceCommands = require('./deviceCommandService');
const audit = require('./auditLogService');

const actions = workspaceRepository(AgentAction);

async function present(action) {
  const command = action.commandId ? await DeviceCommand.findOne({ commandId: action.commandId }) : null;
  const expired = action.state === 'proposed' && new Date(action.expiresAt).getTime() <= Date.now();
  return {
    actionId: action.actionId, agentId: action.agentId, agentVersion: action.agentVersion, runId: action.runId,
    type: action.type, deviceId: action.deviceId, domain: action.domain, reason: action.reason, evidence: action.evidence,
    state: expired ? 'expired' : action.state, expiresAt: action.expiresAt, decidedBy: action.decidedBy, decidedAt: action.decidedAt,
    // what actually happened, from the device's own receipt
    outcome: command ? { commandId: command.commandId, state: command.state, receipt: command.receipt && command.receipt.status ? command.receipt : null } : null,
    createdAt: action.createdAt
  };
}

async function list(principal, { state, limit } = {}) {
  const filter = state && AgentAction.STATES.includes(state) ? { state } : {};
  const rows = await actions.find(principal, filter, { limit, sort: { createdAt: -1 } });
  return { actions: await Promise.all(rows.map(present)) };
}

async function decide(principal, actionId) {
  const action = await actions.findOne(principal, { actionId: String(actionId) });
  if (!action) throw new AgentError(404, 'ACTION_NOT_FOUND', 'Proposal not found');
  if (action.state !== 'proposed') throw new AgentError(409, 'ACTION_DECIDED', `This proposal was already ${action.state}.`);
  if (new Date(action.expiresAt).getTime() <= Date.now()) {
    await AgentAction.updateOne({ _id: action._id, state: 'proposed' }, { $set: { state: 'expired' } });
    throw new AgentError(409, 'ACTION_EXPIRED', 'This proposal expired; nothing was approved.');
  }
  return action;
}

async function approve(principal, actionId, req = null) {
  const action = await decide(principal, actionId);
  const agent = await Agent.findOne({ agentId: action.agentId, workspaceId: action.workspaceId });
  if (!agent || agent.state !== 'active' || agent.version !== action.agentVersion) {
    throw new AgentError(409, 'ACTION_STALE', `The agent ${!agent ? 'is gone' : agent.state !== 'active' ? `is ${agent.state}` : `changed (version ${action.agentVersion} → ${agent.version})`} since it proposed this; nothing was approved.`);
  }
  // the device is checked again here (active, capability); the key makes a repeat the same command
  const { command } = await deviceCommands.create(principal, action.deviceId, { type: action.type, domain: action.domain, idempotencyKey: `action-${action.actionId}` }, req);
  const approved = await AgentAction.findOneAndUpdate(
    { _id: action._id, state: 'proposed' },
    { $set: { state: 'approved', decidedBy: String(principal.userId), decidedAt: new Date(), commandId: command.commandId } },
    { new: true }
  );
  await audit.record({ principal, action: 'agent.action_approve', resource: `agent:${action.agentId}`, details: { actionId: action.actionId, commandId: command.commandId, domain: action.domain, deviceId: action.deviceId }, req });
  return present(approved || await AgentAction.findOne({ _id: action._id }));
}

async function reject(principal, actionId, req = null) {
  const action = await decide(principal, actionId);
  const rejected = await AgentAction.findOneAndUpdate(
    { _id: action._id, state: 'proposed' },
    { $set: { state: 'rejected', decidedBy: String(principal.userId), decidedAt: new Date() } },
    { new: true }
  );
  if (!rejected) throw new AgentError(409, 'ACTION_DECIDED', 'This proposal was decided meanwhile.');
  await audit.record({ principal, action: 'agent.action_reject', resource: `agent:${action.agentId}`, details: { actionId: action.actionId }, req });
  return present(rejected);
}

module.exports = { list, approve, reject, present };
