/**
 * Exceptions to findings (DET-02), mounted at /api/v1.
 *
 *   GET    /finding-exceptions        this workspace's exceptions, active and ended
 *   POST   /finding-exceptions        { type, target, reason, expiresInDays, maxSeverity? }
 *   DELETE /finding-exceptions/:id    revoke one now; it stays as the record
 *
 *   GET    /incidents                 related findings grouped, with one timeline
 *   GET    /incidents/:id/evidence    its stored evidence with a signed manifest
 *   POST   /incidents/:id/resolve     resolve each of its open findings
 *
 * An exception applies to this workspace's findings only, has an owner, a
 * reason and an expiry of at most 90 days, and is audited when made or revoked.
 */
const express = require('express');
const { verifiedUser } = require('../middleware/verifiedUser');
const { requireWorkspace } = require('../middleware/workspace');
const findings = require('../services/findingService');

const router = express.Router();

const handle = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof findings.FindingError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    console.error('[finding-exceptions]', error);
    return res.status(500).json({ success: false, message: 'Exception request failed' });
  }
};

router.get('/finding-exceptions', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await findings.listExceptions(req.user) });
}));

router.post('/finding-exceptions', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.status(201).json({ success: true, data: await findings.createException(req.user, req.body || {}, req) });
}));

router.delete('/finding-exceptions/:id', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await findings.revokeException(req.user, req.params.id, req) });
}));

// ── incidents: related findings together (DET-02) ───────────────────────────
const incidents = require('../services/incidentService');

router.get('/incidents', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await incidents.list(req.user) });
}));

router.get('/incidents/:id/evidence', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data: await incidents.evidence(req.user, req.params.id) });
}));

router.post('/incidents/:id/resolve', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await incidents.resolve(req.user, req.params.id, (req.body || {}).note, req) });
}));

module.exports = router;
