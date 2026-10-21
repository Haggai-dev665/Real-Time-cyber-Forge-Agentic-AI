/**
 * Agent definitions (AGT-01, AGT-02): create, edit with a version check,
 * validate, activate, pause, resume, archive and clone.
 *
 * The template sets the ceiling. When a definition is saved, a tool, mode or
 * proposal not in its template is refused (400), so a modified request cannot
 * enable it. Validation then checks the definition against the workspace as it
 * is now: the devices exist, are active and can do what a proposal would ask,
 * and the template's required inputs are there. A validation is for one
 * version; activation needs a passing validation of the current version.
 *
 * Edits name the version they change (409 if it moved on). Each one is kept in
 * the history with a permission diff. A change that widens what the agent may
 * do (a tool, a proposal, a device, a target, or observe → assist) takes an
 * active or paused agent back to ready: it must be activated again. A change
 * that does not widen keeps it running if it still validates.
 */
const crypto = require('crypto');
const Agent = require('../models/Agent');
const Device = require('../models/Device');
const { workspaceRepository } = require('../repositories/workspaceRepository');
const catalog = require('./agentCatalog');
const audit = require('./auditLogService');

const agents = workspaceRepository(Agent);
const devices = workspaceRepository(Device);
const HISTORY_SHOWN = 20;

class AgentError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ── configuration ────────────────────────────────────────────────────────────

const plainText = (value, max) => typeof value === 'string' && value.length <= max && !/[\u0000-\u0009\u000b-\u001f\u007f]/.test(value);
const intIn = (value, { min, max }) => Number.isInteger(value) && value >= min && value <= max;
const subsetOf = (list, allowed) => Array.isArray(list) && list.every(item => allowed.includes(item));

function targetOk(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  if (/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch (_) {
    return false;
  }
}

/** The definition's configuration from a request, over `previous`; refuses anything outside the template. */
function configOf(template, input = {}, previous = null) {
  const base = previous || { objective: '', mode: 'observe', tools: template.tools, proposals: [], deviceIds: [], targets: [], schedule: { kind: 'on_demand', everyMinutes: null }, budget: { maxSteps: catalog.LIMITS.maxSteps.default, timeoutSeconds: catalog.LIMITS.timeoutSeconds.default } };
  const merged = {
    objective: input.objective !== undefined ? input.objective : base.objective,
    mode: input.mode !== undefined ? input.mode : base.mode,
    tools: input.tools !== undefined ? input.tools : base.tools,
    proposals: input.proposals !== undefined ? input.proposals : base.proposals,
    deviceIds: input.deviceIds !== undefined ? input.deviceIds : base.deviceIds,
    targets: input.targets !== undefined ? input.targets : base.targets,
    schedule: { ...base.schedule, ...(input.schedule || {}) },
    budget: { ...base.budget, ...(input.budget || {}) }
  };
  const refuse = (code, message) => { throw new AgentError(400, code, message); };
  if (!plainText(merged.objective, 500)) refuse('AGENT_OBJECTIVE_INVALID', 'objective is at most 500 characters of text.');
  if (!template.modes.includes(merged.mode)) refuse('AGENT_MODE_NOT_ALLOWED', `${template.name} runs in ${template.modes.join(' or ')} mode only.`);
  if (!subsetOf(merged.tools, template.tools) || !merged.tools.length) refuse('AGENT_TOOL_NOT_ALLOWED', `Tools are chosen from this template's: ${template.tools.join(', ')}.`);
  if (!subsetOf(merged.proposals, template.proposals)) refuse('AGENT_PROPOSAL_NOT_ALLOWED', template.proposals.length ? `Proposals are chosen from: ${template.proposals.join(', ')}.` : `${template.name} proposes nothing.`);
  if (merged.mode === 'observe' && merged.proposals.length) refuse('AGENT_PROPOSAL_NOT_ALLOWED', 'An agent in observe mode proposes nothing; use assist mode.');
  if (!Array.isArray(merged.deviceIds) || merged.deviceIds.length > catalog.LIMITS.maxDevices || !merged.deviceIds.every(id => /^[A-Za-z0-9-]{1,64}$/.test(id))) refuse('AGENT_DEVICES_INVALID', `deviceIds is a list of at most ${catalog.LIMITS.maxDevices} device IDs.`);
  if (!Array.isArray(merged.targets) || merged.targets.length > catalog.LIMITS.maxTargets || !merged.targets.every(targetOk)) refuse('AGENT_TARGETS_INVALID', `targets is a list of at most ${catalog.LIMITS.maxTargets} http(s) addresses or domains.`);
  if (!['on_demand', 'interval'].includes(merged.schedule.kind)) refuse('AGENT_SCHEDULE_INVALID', 'schedule.kind is on_demand or interval.');
  if (merged.schedule.kind === 'interval' && !intIn(merged.schedule.everyMinutes, catalog.LIMITS.everyMinutes)) refuse('AGENT_SCHEDULE_INVALID', `schedule.everyMinutes is ${catalog.LIMITS.everyMinutes.min} to ${catalog.LIMITS.everyMinutes.max}.`);
  if (merged.schedule.kind === 'on_demand') merged.schedule.everyMinutes = null;
  if (!intIn(merged.budget.maxSteps, catalog.LIMITS.maxSteps)) refuse('AGENT_BUDGET_INVALID', `budget.maxSteps is ${catalog.LIMITS.maxSteps.min} to ${catalog.LIMITS.maxSteps.max}.`);
  if (!intIn(merged.budget.timeoutSeconds, catalog.LIMITS.timeoutSeconds)) refuse('AGENT_BUDGET_INVALID', `budget.timeoutSeconds is ${catalog.LIMITS.timeoutSeconds.min} to ${catalog.LIMITS.timeoutSeconds.max}.`);
  return {
    objective: merged.objective, mode: merged.mode, tools: [...new Set(merged.tools)], proposals: [...new Set(merged.proposals)],
    deviceIds: [...new Set(merged.deviceIds)], targets: [...new Set(merged.targets)], schedule: merged.schedule, budget: merged.budget
  };
}

/** What a new version adds or removes in what the agent may do, and whether it widens it. */
function permissionDiff(before, after) {
  const diff = {};
  for (const key of ['tools', 'proposals', 'deviceIds', 'targets']) {
    const added = after[key].filter(x => !before[key].includes(x));
    const removed = before[key].filter(x => !after[key].includes(x));
    if (added.length || removed.length) diff[key] = { added, removed };
  }
  if (before.mode !== after.mode) diff.mode = { from: before.mode, to: after.mode };
  const widened = Object.entries(diff).some(([key, change]) => (key === 'mode' ? change.to === 'assist' : change.added.length > 0));
  return { diff, widened };
}

const plain = config => JSON.parse(JSON.stringify(config));

// ── presentation ─────────────────────────────────────────────────────────────

function present(agent, { withHistory = false } = {}) {
  const template = catalog.template(agent.templateId);
  return {
    agentId: agent.agentId,
    templateId: agent.templateId,
    templateName: template ? template.name : agent.templateId,
    name: agent.name,
    state: agent.state,
    version: agent.version,
    config: plain(agent.config),
    validation: { ok: Boolean(agent.validation && agent.validation.ok && agent.validation.version === agent.version), version: agent.validation ? agent.validation.version : null, errors: (agent.validation && agent.validation.errors) || [], at: (agent.validation && agent.validation.at) || null },
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    ...(withHistory ? { history: (agent.history || []).slice(-HISTORY_SHOWN).reverse() } : {})
  };
}

// ── validation against the workspace ────────────────────────────────────────

async function problemsOf(principal, agent) {
  const template = catalog.template(agent.templateId);
  if (!template || !template.available) return [`The ${agent.templateId} template is not available${template && template.reason ? `: ${template.reason}` : ''}.`];
  const config = agent.config;
  const problems = [];
  if (template.needsTargets && !config.targets.length) problems.push('Add at least one address or domain to analyse.');
  for (const deviceId of config.deviceIds) {
    const device = await devices.findOne(principal, { deviceId });
    if (!device) problems.push(`Device ${deviceId} is not one of this workspace's devices.`);
    else if (device.state !== 'active') problems.push(`${device.displayName} is ${device.state.replace(/_/g, ' ')}; only approved devices can be assigned.`);
    else if (config.proposals.length && template.deviceCapability && !((device.capabilities && device.capabilities.advertised) || []).includes(template.deviceCapability)) {
      problems.push(`${device.displayName} does not offer ${template.deviceCapability}, which its proposals would need.`);
    }
  }
  if (config.proposals.length && !config.deviceIds.length) problems.push('Proposals need at least one device they could be carried out on.');
  return problems;
}

async function recordValidation(agent, problems) {
  const validation = { ok: problems.length === 0, version: agent.version, errors: problems, at: new Date() };
  const state = agent.state === 'draft' && validation.ok ? 'ready' : agent.state === 'ready' && !validation.ok ? 'draft' : agent.state;
  return Agent.findOneAndUpdate({ _id: agent._id, version: agent.version }, { $set: { validation, state, updatedAt: new Date() } }, { new: true });
}

// ── operations ───────────────────────────────────────────────────────────────

async function owned(principal, agentId) {
  const agent = await agents.findOne(principal, { agentId: String(agentId) });
  if (!agent) throw new AgentError(404, 'AGENT_NOT_FOUND', 'Agent not found');
  return agent;
}

function nameOf(value) {
  if (!plainText(value, 80) || !String(value).trim()) throw new AgentError(400, 'AGENT_NAME_INVALID', 'A name is 1 to 80 characters of text.');
  return String(value).trim();
}

async function create(principal, body = {}, req = null) {
  const template = catalog.template(body.templateId);
  if (!template) throw new AgentError(400, 'TEMPLATE_UNKNOWN', 'Choose a template from GET /api/v1/agent-templates.');
  if (!template.available) throw new AgentError(400, 'TEMPLATE_UNAVAILABLE', `${template.name} is not available: ${template.reason}`);
  const idempotencyKey = String(body.idempotencyKey || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(idempotencyKey)) throw new AgentError(400, 'IDEMPOTENCY_KEY_INVALID', 'idempotencyKey is 8 to 64 letters, digits, - or _.');
  const name = nameOf(body.name);
  const config = configOf(template, body.config || {});
  const earlier = await agents.findOne(principal, { idempotencyKey });
  if (earlier) return { agent: present(earlier), created: false };
  const now = new Date();
  let agent;
  try {
    agent = await agents.create(principal, {
      agentId: crypto.randomUUID(), templateId: template.id, name, state: 'draft', version: 1, config, idempotencyKey,
      validation: { ok: false, version: null, errors: [], at: null },
      history: [{ version: 1, config: plain(config), changedBy: String(principal.userId), at: now, diff: null }],
      createdAt: now, updatedAt: now
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return { agent: present(await agents.findOne(principal, { idempotencyKey })), created: false };
  }
  await audit.record({ principal, action: 'agent.create', resource: `agent:${agent.agentId}`, details: { templateId: template.id, name }, req });
  return { agent: present(agent), created: true };
}

async function list(principal, { limit, skip } = {}) {
  const rows = await agents.find(principal, { state: { $ne: 'archived' } }, { limit, skip, sort: { createdAt: -1 } });
  return { agents: rows.map(a => present(a)) };
}

async function get(principal, agentId) {
  return present(await owned(principal, agentId), { withHistory: true });
}

async function update(principal, agentId, body = {}, req = null) {
  const agent = await owned(principal, agentId);
  if (agent.state === 'archived') throw new AgentError(409, 'AGENT_ARCHIVED', 'An archived agent cannot be changed; clone it instead.');
  if (body.expectedVersion !== agent.version) {
    throw new AgentError(409, 'AGENT_VERSION_CONFLICT', `The agent is at version ${agent.version}; reload it and make the change again.`);
  }
  const template = catalog.template(agent.templateId);
  const name = body.name !== undefined ? nameOf(body.name) : agent.name;
  const config = body.config !== undefined ? configOf(template, body.config, plain(agent.config)) : plain(agent.config);
  const { diff, widened } = permissionDiff(plain(agent.config), config);
  const version = agent.version + 1;
  const now = new Date();
  const changed = await Agent.findOneAndUpdate(
    { _id: agent._id, version: agent.version },
    { $set: {
      name, config, version, updatedAt: now,
      validation: { ok: false, version: null, errors: [], at: null },
      history: [...(agent.history || []), { version, config: plain(config), changedBy: String(principal.userId), at: now, diff }]
    } },
    { new: true }
  );
  if (!changed) throw new AgentError(409, 'AGENT_VERSION_CONFLICT', 'The agent changed meanwhile; reload it and make the change again.');
  // validate the new version; a running agent keeps running only if the change did not widen it and it still validates
  const problems = await problemsOf(principal, changed);
  let validated = await recordValidation(changed, problems);
  const running = agent.state === 'active' || agent.state === 'paused';
  if (running && (widened || problems.length)) {
    validated = await Agent.findOneAndUpdate({ _id: agent._id, version }, { $set: { state: problems.length ? 'draft' : 'ready' } }, { new: true });
  }
  await audit.record({ principal, action: 'agent.update', resource: `agent:${agent.agentId}`, details: { version, widened, diff }, req });
  return { ...present(validated, { withHistory: true }), widened, diff };
}

async function validate(principal, agentId) {
  const agent = await owned(principal, agentId);
  if (agent.state === 'archived') throw new AgentError(409, 'AGENT_ARCHIVED', 'An archived agent is not validated.');
  return present(await recordValidation(agent, await problemsOf(principal, agent)));
}

async function transition(principal, agentId, { from, to, action, needsValidation }, req) {
  const agent = await owned(principal, agentId);
  if (!from.includes(agent.state)) throw new AgentError(409, 'AGENT_STATE_INVALID', `The agent is ${agent.state}; it can be ${action}d only when ${from.join(' or ')}.`);
  if (needsValidation) {
    const problems = await problemsOf(principal, agent);
    const checked = await recordValidation(agent, problems);
    if (problems.length) throw new AgentError(409, 'AGENT_NOT_VALID', 'The agent does not validate now.', { errors: problems, agent: present(checked) });
  }
  const moved = await Agent.findOneAndUpdate(
    { _id: agent._id, version: agent.version, state: agent.state },
    { $set: { state: to, updatedAt: new Date() } },
    { new: true }
  );
  if (!moved) throw new AgentError(409, 'AGENT_VERSION_CONFLICT', 'The agent changed meanwhile; reload it.');
  await audit.record({ principal, action: `agent.${action}`, resource: `agent:${agent.agentId}`, details: { version: agent.version }, req });
  return present(moved);
}

const activate = (principal, agentId, req) => transition(principal, agentId, { from: ['ready'], to: 'active', action: 'activate', needsValidation: true }, req);
const pause = (principal, agentId, req) => transition(principal, agentId, { from: ['active'], to: 'paused', action: 'pause', needsValidation: false }, req);
const resume = (principal, agentId, req) => transition(principal, agentId, { from: ['paused'], to: 'active', action: 'resume', needsValidation: true }, req);
const archive = (principal, agentId, req) => transition(principal, agentId, { from: ['draft', 'ready', 'active', 'paused'], to: 'archived', action: 'archive', needsValidation: false }, req);

async function clone(principal, agentId, body = {}, req = null) {
  const source = await owned(principal, agentId);
  return create(principal, {
    templateId: source.templateId,
    name: body.name !== undefined ? body.name : `${source.name} (copy)`.slice(0, 80),
    config: plain(source.config),
    idempotencyKey: body.idempotencyKey
  }, req);
}

module.exports = {
  AgentError, create, list, get, update, validate, activate, pause, resume, archive, clone,
  configOf, permissionDiff, problemsOf, owned, present
};
