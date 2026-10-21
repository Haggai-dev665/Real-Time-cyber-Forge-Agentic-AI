/**
 * Agent definitions (AGT-01, AGT-02, AGT-03), mounted at /api/v1. Every route
 * is for a signed-in member of the workspace; another workspace's agent answers
 * as not found.
 */
const express = require('express');
const { verifiedUser } = require('../middleware/verifiedUser');
const { requireWorkspace } = require('../middleware/workspace');
const catalog = require('../services/agentCatalog');
const agentDefinitions = require('../services/agentDefinitionService');
const agentRuns = require('../services/agentRunService');
const agentActions = require('../services/agentActionService');
const { DeviceError } = require('../services/deviceService');

const router = express.Router();

const handle = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof agentDefinitions.AgentError || error instanceof DeviceError) {
      return res.status(error.status).json({ success: false, code: error.code, message: error.message, ...(error.details || {}) });
    }
    console.error('[agents]', error);
    return res.status(500).json({ success: false, message: 'Agent request failed' });
  }
};

const page = req => ({
  limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200),
  skip: Math.max(parseInt(req.query.offset, 10) || 0, 0)
});

router.get('/agent-templates', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: { templates: catalog.listTemplates() } });
}));

// emergency stop for the workspace: before /agents/:id so it is not read as an ID
router.post('/agents/pause-all', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await agentRuns.pauseAll(req.user, req) });
}));

router.post('/agents', verifiedUser, requireWorkspace, handle(async (req, res) => {
  const { agent, created } = await agentDefinitions.create(req.user, req.body || {}, req);
  res.status(created ? 201 : 200).json({ success: true, data: agent });
}));

router.get('/agents', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await agentDefinitions.list(req.user, page(req)) });
}));

router.get('/agents/:id', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await agentDefinitions.get(req.user, req.params.id) });
}));

router.patch('/agents/:id', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await agentDefinitions.update(req.user, req.params.id, req.body || {}, req) });
}));

router.post('/agents/:id/validate', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await agentDefinitions.validate(req.user, req.params.id) });
}));

router.post('/agents/:id/activate', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await agentDefinitions.activate(req.user, req.params.id, req) });
}));

router.post('/agents/:id/pause', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await agentDefinitions.pause(req.user, req.params.id, req) });
}));

router.post('/agents/:id/resume', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await agentDefinitions.resume(req.user, req.params.id, req) });
}));

router.post('/agents/:id/archive', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await agentDefinitions.archive(req.user, req.params.id, req) });
}));

router.post('/agents/:id/clone', verifiedUser, requireWorkspace, handle(async (req, res) => {
  const { agent, created } = await agentDefinitions.clone(req.user, req.params.id, req.body || {}, req);
  res.status(created ? 201 : 200).json({ success: true, data: agent });
}));

// ── runs (AGT-04) ───────────────────────────────────────────────────────────

router.post('/agents/:id/runs', verifiedUser, requireWorkspace, handle(async (req, res) => {
  const { run, created } = await agentRuns.enqueue(req.user, req.params.id, req.body || {}, req);
  res.status(created ? 201 : 200).json({ success: true, data: run });
}));

router.get('/agents/:id/runs', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await agentRuns.list(req.user, req.params.id, page(req)) });
}));

// search this workspace's runs by run ID, device ID or text (AGT-07)
router.get('/runs', verifiedUser, requireWorkspace, handle(async (req, res) => {
  const { q, deviceId, state, agentId, limit } = req.query;
  res.json({ success: true, data: await agentRuns.search(req.user, { q, deviceId, state, agentId, limit }) });
}));

router.get('/runs/:id', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await agentRuns.get(req.user, req.params.id) });
}));

router.post('/runs/:id/cancel', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await agentRuns.cancel(req.user, req.params.id, req) });
}));

// "Retry failed checks": a new run of only the failed or skipped steps (AGT-07)
router.post('/runs/:id/retry', verifiedUser, requireWorkspace, handle(async (req, res) => {
  const { run, created } = await agentRuns.retry(req.user, req.params.id, req.body || {}, req);
  res.status(created ? 201 : 200).json({ success: true, data: run });
}));

// ── proposals (AGT-05) ──────────────────────────────────────────────────────

router.get('/actions', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await agentActions.list(req.user, { state: req.query.state, ...page(req) }) });
}));

router.post('/actions/:id/approve', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await agentActions.approve(req.user, req.params.id, req) });
}));

router.post('/actions/:id/reject', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await agentActions.reject(req.user, req.params.id, req) });
}));

module.exports = router;
