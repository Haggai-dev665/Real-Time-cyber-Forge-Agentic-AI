/**
 * Agent runs (AGT-04): queueing, the worker, leases, budgets, cancellation,
 * schedules and the emergency pause.
 *
 * One scheduling authority: the worker in this web process. It claims a queued
 * run in one atomic update that gives it a lease with a random token, and every
 * later write to the run names that token, so a worker whose lease expired
 * cannot change a run another worker has taken over. A run whose lease expired
 * (the process stopped mid-run) is queued again once, then failed with that
 * reason.
 *
 * What a run does is fixed by the definition version it was queued for: its
 * tools, targets and devices come from the stored configuration only, never
 * from anything a tool returned. Before every step the worker checks that the
 * run was not cancelled and the agent is still active at that version, so
 * pausing an agent stops its work rather than its display. Budgets (steps,
 * seconds) end a run as `partial` with the reason, rather than hiding the gap.
 *
 * In assist mode a malicious URL verdict becomes a proposal (AgentAction) per
 * assigned device; nothing is done until a member approves it.
 */
const crypto = require('crypto');
const os = require('os');
const Agent = require('../models/Agent');
const AgentRun = require('../models/AgentRun');
const AgentAction = require('../models/AgentAction');
const Device = require('../models/Device');
const { workspaceRepository } = require('../repositories/workspaceRepository');
const { AgentError, owned } = require('./agentDefinitionService');
const definitions = require('./agentDefinitionService');
const { connectionOf, coverageOf } = require('./deviceService');
const audit = require('./auditLogService');
const { redactUrl } = require('../utils/redactUrl');
const logger = require('../utils/logger');

const runs = workspaceRepository(AgentRun);
const WORKER = `${os.hostname()}:${process.pid}`;
const MAX_ATTEMPTS = 2;
const LEASE_GRACE_MS = 30 * 1000;
const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;
const TICK_MS = 5000;
const RUNS_PER_TICK = 5;

// ── tools ────────────────────────────────────────────────────────────────────

const asUrl = target => (target.includes('://') ? target : `https://${target}`);
const hostOf = target => { try { return new URL(asUrl(target)).hostname.toLowerCase(); } catch (_) { return null; } };
const VERDICT_OF = { block: 'malicious', warn: 'suspicious', allow: 'clean' };

const TOOLS = {
  /** The URL models' verdict. No model answering is a failed step, never "clean". */
  async url_classify({ target }) {
    const { cyberforgeML } = require('./cyberforgeMLService');
    // sign-in codes and tokens are removed before the address leaves for analysis
    const report = await cyberforgeML.analyzeUrl(asUrl(redactUrl(target)));
    const aggregate = (report && report.aggregate) || {};
    if (!aggregate.models_answered) throw new Error('no URL model answered, so there is no verdict');
    const verdict = VERDICT_OF[aggregate.recommended_action] || 'unknown';
    const score = aggregate.blended_threat_score;
    return {
      summary: `${verdict} (score ${score}, ${aggregate.models_answered} model${aggregate.models_answered === 1 ? '' : 's'} answered)`,
      findings: [{ kind: 'url_verdict', target, verdict, score, modelsAnswered: aggregate.models_answered, engine: 'ml-service url models' }]
    };
  },

  /** Indicators found in the address itself (no page is fetched). */
  async ioc_extract({ target }) {
    const { sandboxAnalysisService } = require('./sandboxAnalysisService');
    const iocs = sandboxAnalysisService.extractIOCsFromUrl(asUrl(redactUrl(target))) || [];
    const indicators = iocs.slice(0, 20).map(i => ({ type: i.type, value: i.value }));
    return { summary: `${iocs.length} indicator${iocs.length === 1 ? '' : 's'}`, findings: indicators.length ? [{ kind: 'indicators', target, indicators }] : [] };
  },

  /** Devices that are not online with full coverage. */
  async device_status({ workspaceId, deviceIds }) {
    const filter = { workspaceId };
    const all = await Device.find(filter);
    const chosen = deviceIds.length ? all.filter(d => deviceIds.includes(d.deviceId)) : all;
    const now = Date.now();
    const findings = chosen
      .filter(d => d.kind !== 'inventory_only')
      .map(d => ({ d, connection: connectionOf(d, now), ...coverageOf(d) }))
      .filter(x => x.connection !== 'online' || x.coverage !== 'full')
      .map(x => ({ kind: 'device_health', deviceId: x.d.deviceId, displayName: x.d.displayName, connection: x.connection, coverage: x.coverage, degradedBy: x.degradedBy }));
    return { summary: `${chosen.length} device${chosen.length === 1 ? '' : 's'} checked, ${findings.length} need attention`, findings };
  }
};

/** The steps a run of this definition takes, from its stored configuration only. */
function planOf(agent) {
  const config = agent.config;
  if (agent.templateId === 'url_analyst') {
    return config.targets.flatMap(target => ['url_classify', 'ioc_extract'].filter(tool => config.tools.includes(tool)).map(tool => ({ tool, input: { target } })));
  }
  if (agent.templateId === 'device_health') {
    return [{ tool: 'device_status', input: { deviceIds: config.deviceIds } }];
  }
  return [];
}

// ── runs, by a member ────────────────────────────────────────────────────────

// Addresses in a run's record are shown with sign-in codes and tokens removed.
const URL_IN_TEXT = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi;
const cleanText = text => (typeof text === 'string' ? text.replace(URL_IN_TEXT, url => redactUrl(url)) : text);
function cleanRecord(value, depth = 0) {
  if (typeof value === 'string') return cleanText(value);
  if (!value || typeof value !== 'object' || depth > 4) return value;
  if (Array.isArray(value)) return value.map(item => cleanRecord(item, depth + 1));
  if (value instanceof Date) return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) out[key] = key === 'target' && typeof item === 'string' ? redactUrl(item) : cleanRecord(item, depth + 1);
  return out;
}

/** Failed or skipped steps that a retry may repeat. */
const retryable = run => (run.steps || []).filter(s => s.status === 'failed' || s.status === 'skipped');

function presentRun(run) {
  const plain = value => (value && typeof value.toObject === 'function' ? value.toObject() : value);
  return {
    runId: run.runId, agentId: run.agentId, agentVersion: run.agentVersion, trigger: run.trigger, state: run.state,
    retryOf: run.retryOf || null,
    cancelRequested: Boolean(run.cancelRequested), attempts: run.attempts || 0,
    steps: cleanRecord((run.steps || []).map(plain)), findings: cleanRecord((run.findings || []).map(plain)),
    actionIds: run.actionIds || [], outcome: cleanText(run.outcome || null),
    retryableSteps: ['partial', 'failed'].includes(run.state) ? retryable(run).length : 0,
    createdAt: run.createdAt, startedAt: run.startedAt || null, endedAt: run.endedAt || null
  };
}

async function enqueue(principal, agentId, body = {}, req = null) {
  const agent = await owned(principal, agentId);
  if (agent.state !== 'active') throw new AgentError(409, 'AGENT_NOT_ACTIVE', `The agent is ${agent.state}; only an active agent runs.`);
  const idempotencyKey = String(body.idempotencyKey || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(idempotencyKey)) throw new AgentError(400, 'IDEMPOTENCY_KEY_INVALID', 'idempotencyKey is 8 to 64 letters, digits, - or _.');
  const earlier = await runs.findOne(principal, { idempotencyKey: `manual:${idempotencyKey}` });
  if (earlier) return { run: presentRun(earlier), created: false };
  try {
    const run = await runs.create(principal, {
      runId: crypto.randomUUID(), agentId: agent.agentId, agentVersion: agent.version, trigger: 'manual',
      idempotencyKey: `manual:${idempotencyKey}`, state: 'queued', createdAt: new Date()
    });
    await audit.record({ principal, action: 'agent.run_request', resource: `agent:${agent.agentId}`, details: { runId: run.runId, version: agent.version }, req });
    return { run: presentRun(run), created: true };
  } catch (error) {
    if (error.code !== 11000) throw error;
    return { run: presentRun(await runs.findOne(principal, { idempotencyKey: `manual:${idempotencyKey}` })), created: false };
  }
}

const sameStep = (a, b) => a.tool === b.tool && JSON.stringify(a.input || {}) === JSON.stringify(b.input || {});

/**
 * "Retry failed checks": a new run that repeats only the failed or skipped steps
 * of a partial or failed run. Valid only while the agent is active at the same
 * version, because what a run does comes from its definition version; after a
 * change, run the agent again instead.
 */
async function retry(principal, runId, body = {}, req = null) {
  const original = await runs.findOne(principal, { runId: String(runId) });
  if (!original) throw new AgentError(404, 'RUN_NOT_FOUND', 'Run not found');
  if (!['partial', 'failed'].includes(original.state)) throw new AgentError(409, 'RUN_NOT_RETRYABLE', `The run is ${original.state}; only a partial or failed run has checks to retry.`);
  const agent = await owned(principal, original.agentId);
  if (agent.state !== 'active') throw new AgentError(409, 'AGENT_NOT_ACTIVE', `The agent is ${agent.state}; only an active agent runs.`);
  if (agent.version !== original.agentVersion) {
    throw new AgentError(409, 'AGENT_CHANGED', `The agent changed (version ${original.agentVersion} → ${agent.version}) since this run; run it again instead of retrying.`);
  }
  const plan = planOf(agent);
  const onlySteps = retryable(original).map(s => ({ tool: s.tool, input: s.input })).filter(s => plan.some(p => sameStep(p, s)));
  if (!onlySteps.length) throw new AgentError(409, 'RUN_NOT_RETRYABLE', 'The run has no failed or skipped check to retry.');
  const idempotencyKey = String(body.idempotencyKey || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(idempotencyKey)) throw new AgentError(400, 'IDEMPOTENCY_KEY_INVALID', 'idempotencyKey is 8 to 64 letters, digits, - or _.');
  const key = `retry:${idempotencyKey}`;
  const earlier = await runs.findOne(principal, { idempotencyKey: key });
  if (earlier) return { run: presentRun(earlier), created: false };
  try {
    const run = await runs.create(principal, {
      runId: crypto.randomUUID(), agentId: agent.agentId, agentVersion: agent.version, trigger: 'retry',
      retryOf: original.runId, onlySteps, idempotencyKey: key, state: 'queued', createdAt: new Date()
    });
    await audit.record({ principal, action: 'agent.run_retry', resource: `agent:${agent.agentId}`, details: { runId: run.runId, retryOf: original.runId, steps: onlySteps.length }, req });
    return { run: presentRun(run), created: true };
  } catch (error) {
    if (error.code !== 11000) throw error;
    return { run: presentRun(await runs.findOne(principal, { idempotencyKey: key })), created: false };
  }
}

const SEARCH_WINDOW = 200;
const RUN_STATES = ['queued', 'leased', 'running', 'completed', 'partial', 'failed', 'cancelled'];

/**
 * Search this workspace's runs: by run ID (or the run a retry repeats), by
 * device ID (a device a step checked or a finding names), or by text in the
 * outcome, a step's summary or a target. Covers the most recent SEARCH_WINDOW
 * runs that match the state and agent filters.
 */
async function search(principal, { q, deviceId, state, agentId, limit } = {}) {
  const filter = {};
  if (typeof state === 'string' && RUN_STATES.includes(state)) filter.state = state;
  if (typeof agentId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(agentId)) filter.agentId = agentId;
  const recent = await runs.find(principal, filter, { limit: SEARCH_WINDOW, sort: { createdAt: -1 } });
  const text = typeof q === 'string' ? q.trim().toLowerCase().slice(0, 200) : '';
  const device = typeof deviceId === 'string' ? deviceId.trim() : '';
  const names = new Map((await workspaceRepository(Agent).find(principal, {}, { limit: 200 })).map(a => [a.agentId, a.name]));
  const matches = recent.filter(run => {
    if (device) {
      const inSteps = (run.steps || []).some(s => s.input && Array.isArray(s.input.deviceIds) && s.input.deviceIds.includes(device));
      const inFindings = (run.findings || []).some(f => f && f.deviceId === device);
      if (!inSteps && !inFindings) return false;
    }
    if (!text) return true;
    if (run.runId === text || run.retryOf === text) return true;
    const haystack = [run.outcome, ...(run.steps || []).flatMap(s => [s.summary, s.tool, s.input && s.input.target]), ...(run.findings || []).flatMap(f => [f && f.target, f && f.deviceId, f && f.displayName]), names.get(run.agentId)]
      .filter(Boolean).map(x => cleanText(String(x)).toLowerCase());
    return haystack.some(x => x.includes(text));
  });
  const size = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  return {
    runs: matches.slice(0, size).map(run => ({ ...presentRun(run), agentName: names.get(run.agentId) || null })),
    total: matches.length,
    searched: recent.length,
    window: SEARCH_WINDOW
  };
}

async function list(principal, agentId, { limit } = {}) {
  const agent = await owned(principal, agentId);
  const rows = await runs.find(principal, { agentId: agent.agentId }, { limit, sort: { createdAt: -1 } });
  return { runs: rows.map(presentRun) };
}

async function get(principal, runId) {
  const run = await runs.findOne(principal, { runId: String(runId) });
  if (!run) throw new AgentError(404, 'RUN_NOT_FOUND', 'Run not found');
  return presentRun(run);
}

/** A queued run is cancelled at once; a running one at its next step (the answer says which). */
async function cancel(principal, runId, req = null) {
  const run = await runs.findOne(principal, { runId: String(runId) });
  if (!run) throw new AgentError(404, 'RUN_NOT_FOUND', 'Run not found');
  const now = new Date();
  const stopped = await AgentRun.findOneAndUpdate({ _id: run._id, state: 'queued' }, { $set: { state: 'cancelled', outcome: 'cancelled before it started', endedAt: now } }, { new: true });
  let result = stopped;
  if (!stopped) {
    if (!['leased', 'running'].includes(run.state)) throw new AgentError(409, 'RUN_FINISHED', `The run is ${run.state}; there is nothing to cancel.`);
    result = await AgentRun.findOneAndUpdate({ _id: run._id }, { $set: { cancelRequested: true } }, { new: true });
  }
  await audit.record({ principal, action: 'agent.run_cancel', resource: `agent:${run.agentId}`, details: { runId: run.runId, stoppedAt: stopped ? 'before start' : 'next step' }, req });
  return presentRun(result);
}

/** Emergency stop for a workspace: every active agent is paused, so no new work starts. */
async function pauseAll(principal, req = null) {
  const active = await workspaceRepository(Agent).find(principal, { state: 'active' }, { limit: 200 });
  const paused = [];
  for (const agent of active) {
    try {
      await definitions.pause(principal, agent.agentId, req);
      paused.push(agent.agentId);
    } catch (_) { /* changed meanwhile */ }
  }
  const running = await runs.count(principal, { state: { $in: ['leased', 'running'] } });
  return { paused: paused.length, agentIds: paused, runningNow: running, note: running ? 'Runs already going stop at their next step.' : null };
}

// ── the worker ───────────────────────────────────────────────────────────────

async function claimNext(now = Date.now()) {
  return AgentRun.findOneAndUpdate(
    { state: 'queued' },
    { $set: { state: 'leased', lease: { owner: WORKER, token: crypto.randomBytes(16).toString('hex'), expiresAt: new Date(now + 10 * 60 * 1000) }, startedAt: new Date(now) }, $inc: { attempts: 1 } },
    { new: true, sort: { createdAt: 1 } }
  );
}

async function execute(run) {
  const token = run.lease.token;
  // every write names the lease token: a worker that lost its lease writes nothing
  const write = set => AgentRun.findOneAndUpdate({ _id: run._id, 'lease.token': token }, { $set: set }, { new: true });
  const finish = (state, outcome, extra = {}) => write({ state, outcome, endedAt: new Date(), lease: { owner: null, token: null, expiresAt: null }, ...extra });

  const agent = await Agent.findOne({ agentId: run.agentId, workspaceId: run.workspaceId });
  if (!agent || agent.state !== 'active') return finish('cancelled', `The agent is ${agent ? agent.state : 'gone'}; nothing was run.`);
  if (agent.version !== run.agentVersion) return finish('cancelled', `The agent changed (version ${run.agentVersion} → ${agent.version}) after this run was queued; nothing was run.`);

  const { maxSteps, timeoutSeconds } = agent.config.budget;
  const startedAt = Date.now();
  const deadline = startedAt + timeoutSeconds * 1000;
  if (!await write({ state: 'running', lease: { owner: WORKER, token, expiresAt: new Date(deadline + LEASE_GRACE_MS) } })) return null;

  const full = planOf(agent);
  // a retry repeats only its own steps, and only those still in this version's plan
  const plan = run.trigger === 'retry' && Array.isArray(run.onlySteps)
    ? run.onlySteps.filter(s => full.some(p => sameStep(p, s)))
    : full;
  const steps = [];
  const findings = [];
  let stopReason = null;
  for (const [index, step] of plan.entries()) {
    const current = await AgentRun.findOne({ _id: run._id });
    const agentNow = await Agent.findOne({ agentId: run.agentId, workspaceId: run.workspaceId });
    if (current && current.cancelRequested) stopReason = 'cancelled by a member';
    else if (!agentNow || agentNow.state !== 'active' || agentNow.version !== run.agentVersion) stopReason = `the agent was ${agentNow ? (agentNow.state !== 'active' ? agentNow.state : 'changed') : 'removed'} during the run`;
    else if (index >= maxSteps) stopReason = `the step budget (${maxSteps}) was reached`;
    else if (Date.now() > deadline) stopReason = `the time budget (${timeoutSeconds} s) was reached`;
    if (stopReason) {
      for (const skipped of plan.slice(index)) steps.push({ index: steps.length, tool: skipped.tool, input: skipped.input, status: 'skipped', summary: stopReason });
      break;
    }
    const began = new Date();
    try {
      const result = await TOOLS[step.tool]({ ...step.input, workspaceId: run.workspaceId });
      steps.push({ index, tool: step.tool, input: step.input, status: 'completed', summary: result.summary, startedAt: began, endedAt: new Date() });
      findings.push(...result.findings);
    } catch (error) {
      steps.push({ index, tool: step.tool, input: step.input, status: 'failed', summary: String(error.message || error).slice(0, 300), startedAt: began, endedAt: new Date() });
    }
    if (!await write({ steps, findings })) return null; // lease lost: another worker owns the run now
  }

  // proposals, in assist mode only, from malicious verdicts only
  const actionIds = [];
  if (!stopReason && agent.config.mode === 'assist' && agent.config.proposals.includes('block_domain')) {
    for (const finding of findings.filter(f => f.kind === 'url_verdict' && f.verdict === 'malicious')) {
      const domain = hostOf(finding.target);
      if (!domain) continue;
      for (const deviceId of agent.config.deviceIds) {
        const action = await AgentAction.create({
          actionId: crypto.randomUUID(), workspaceId: run.workspaceId, agentId: agent.agentId, agentVersion: agent.version, runId: run.runId,
          type: 'block_domain', deviceId, domain, reason: `The URL models rated ${finding.target} malicious (score ${finding.score}).`,
          evidence: { finding }, state: 'proposed', expiresAt: new Date(Date.now() + PROPOSAL_TTL_MS), createdAt: new Date()
        });
        actionIds.push(action.actionId);
      }
    }
  }

  const failed = steps.filter(s => s.status === 'failed').length;
  const completed = steps.filter(s => s.status === 'completed').length;
  const state = stopReason && stopReason.startsWith('cancelled') ? 'cancelled'
    : stopReason || failed ? (completed ? 'partial' : 'failed') : 'completed';
  const outcome = [
    `${completed} of ${plan.length} step${plan.length === 1 ? '' : 's'} completed`,
    failed ? `${failed} failed` : null,
    stopReason ? `stopped: ${stopReason}` : null,
    `${findings.length} finding${findings.length === 1 ? '' : 's'}`,
    actionIds.length ? `${actionIds.length} proposal${actionIds.length === 1 ? '' : 's'} awaiting approval` : null
  ].filter(Boolean).join('; ');
  return finish(state, outcome, { steps, findings, actionIds });
}

/** Runs whose worker stopped: queued again once, then failed with the reason. */
async function recoverExpiredLeases(now = Date.now()) {
  const stale = await AgentRun.find({ state: { $in: ['leased', 'running'] }, 'lease.expiresAt': { $lt: new Date(now) } });
  for (const run of stale) {
    const retry = (run.attempts || 0) < MAX_ATTEMPTS;
    await AgentRun.updateOne(
      { _id: run._id, 'lease.token': run.lease.token },
      { $set: retry
        ? { state: 'queued', lease: { owner: null, token: null, expiresAt: null } }
        : { state: 'failed', outcome: `The worker running it stopped; tried ${run.attempts} times.`, endedAt: new Date(now), lease: { owner: null, token: null, expiresAt: null } } }
    );
  }
  return stale.length;
}

/** Interval agents: one run per schedule slot, whatever the number of ticks or workers. */
async function scheduleDue(now = Date.now()) {
  const due = await Agent.find({ state: 'active' });
  let made = 0;
  for (const agent of due.filter(a => a.config && a.config.schedule && a.config.schedule.kind === 'interval' && a.config.schedule.everyMinutes)) {
    const slot = Math.floor(now / (agent.config.schedule.everyMinutes * 60 * 1000));
    try {
      await AgentRun.create({
        runId: crypto.randomUUID(), workspaceId: agent.workspaceId, agentId: agent.agentId, agentVersion: agent.version, trigger: 'schedule',
        idempotencyKey: `schedule:${agent.agentId}:${agent.version}:${slot}`, state: 'queued', createdBy: agent.createdBy, createdAt: new Date(now)
      });
      made += 1;
    } catch (error) {
      if (error.code !== 11000) throw error; // this slot already has its run
    }
  }
  return made;
}

let ticking = false;
async function tick(now = Date.now()) {
  if (ticking) return { skipped: true };
  ticking = true;
  try {
    const recovered = await recoverExpiredLeases(now);
    const scheduled = await scheduleDue(now);
    let executed = 0;
    for (let i = 0; i < RUNS_PER_TICK; i += 1) {
      const run = await claimNext(Date.now());
      if (!run) break;
      await execute(run);
      executed += 1;
    }
    return { recovered, scheduled, executed };
  } catch (error) {
    logger.warn(`[agents] worker tick failed: ${error.message}`);
    return { error: error.message };
  } finally {
    ticking = false;
  }
}

let timer = null;
function start() {
  if (timer) return;
  timer = setInterval(() => { tick(); }, TICK_MS);
  if (timer.unref) timer.unref();
}
function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { enqueue, retry, search, list, get, cancel, pauseAll, claimNext, execute, recoverExpiredLeases, scheduleDue, tick, start, stop, planOf, TOOLS, presentRun };
