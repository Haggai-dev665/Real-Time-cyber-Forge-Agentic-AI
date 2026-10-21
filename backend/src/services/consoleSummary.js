// Authenticated console counts. No browser-supplied scope or synthetic defaults.
const { workspaceRepository } = require('../repositories/workspaceRepository');
const { ownedThreatFilter } = require('./threatOwnership');
const { ONLINE_MS } = require('./deviceService');
const { OPEN } = require('./findingService');
const Device = require('../models/Device');
const Agent = require('../models/Agent');
const Run = require('../models/AgentRun');
const Action = require('../models/AgentAction');
const Threat = require('../models/Threat');

async function summary(principal) {
  const at = new Date();
  const count = (model, filter) => workspaceRepository(model).count(principal, filter);
  const owner = ownedThreatFilter(principal.userId);
  const queries = {
    devices: () => count(Device, {}),
    onlineDevices: () => count(Device, { state: 'active', lastSeenAt: { $gte: new Date(at.getTime() - ONLINE_MS) } }),
    activeAgents: () => count(Agent, { state: 'active' }),
    pendingApprovals: () => count(Action, { state: 'proposed', expiresAt: { $gt: at } }),
    activeRuns: () => count(Run, { state: { $in: ['queued', 'leased', 'running'] } }),
    openFindings: () => Threat.countDocuments({ ...owner, status: { $in: OPEN } }),
    urgentFindings: () => Threat.countDocuments({ ...owner, status: { $in: OPEN }, severity: { $in: ['critical', 'high'] } })
  };
  const entries = await Promise.all(Object.entries(queries).map(async ([key, query]) => {
    const scope = key.endsWith('Findings') ? 'account' : 'workspace';
    try { return [key, { value: await query(), state: 'ready', exact: true, scope, source: 'backend', observedAt: at.toISOString() }]; }
    catch (_) { return [key, { value: null, state: 'unavailable', exact: false, scope, source: 'backend', observedAt: null, reason: 'This count could not be read.' }]; }
  }));
  return { schema: 'cyberforge.console.summary.v1', generatedAt: at.toISOString(), scope: { accountId: String(principal.userId), workspaceId: String(principal.workspaceId) }, window: 'current stored state; runs subject to retention', metrics: Object.fromEntries(entries) };
}
module.exports = { summary };
