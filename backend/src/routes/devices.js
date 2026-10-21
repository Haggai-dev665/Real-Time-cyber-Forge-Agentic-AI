/**
 * Devices (DEV-01, DEV-02): enrollment codes, claims, approval, inventory,
 * rename, revoke, and signed heartbeats. Mounted at /api/v1.
 *
 * Who may call what:
 *   - a signed-in member of the workspace: create or cancel a code, list and
 *     read devices, add an inventory record, rename, approve, revoke;
 *   - an installation holding a code and its own key: claim (no user session;
 *     limited per address, and a code is 60 random bits used once);
 *   - an approved device, by signature: its own heartbeat.
 * Another workspace's device or code answers as not found.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifiedUser } = require('../middleware/verifiedUser');
const { requireWorkspace } = require('../middleware/workspace');
const deviceService = require('../services/deviceService');
const deviceCommands = require('../services/deviceCommandService');

const router = express.Router();

const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'ENROLLMENT_RATE_LIMITED', message: 'Too many enrollment attempts from this address; try again later.' }
});

const handle = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof deviceService.DeviceError) {
      return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    }
    console.error('[devices]', error);
    return res.status(500).json({ success: false, message: 'Device request failed' });
  }
};

const page = req => ({
  limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200),
  skip: Math.max(parseInt(req.query.offset, 10) || 0, 0)
});

// ── enrollment ───────────────────────────────────────────────────────────────

router.post('/device-enrollments/claim', claimLimiter, handle(async (req, res) => {
  res.status(201).json({ success: true, data: await deviceService.claim(req.body, req) });
}));

router.post('/device-enrollments', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.status(201).json({ success: true, data: await deviceService.createEnrollment(req.user, req.body || {}, req) });
}));

router.delete('/device-enrollments/:enrollmentId', verifiedUser, requireWorkspace, handle(async (req, res) => {
  const cancelled = await deviceService.cancelEnrollment(req.user, req.params.enrollmentId, req);
  if (!cancelled) return res.status(404).json({ success: false, code: 'ENROLLMENT_NOT_FOUND', message: 'No pending code with that ID' });
  res.json({ success: true });
}));

// ── devices ──────────────────────────────────────────────────────────────────

router.get('/devices', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await deviceService.list(req.user, page(req)) });
}));

router.post('/devices', verifiedUser, requireWorkspace, handle(async (req, res) => {
  // Only inventory records are added this way; real devices enroll with a code.
  res.status(201).json({ success: true, data: await deviceService.createInventory(req.user, req.body || {}, req) });
}));

router.get('/devices/:id', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await deviceService.get(req.user, req.params.id) });
}));

router.patch('/devices/:id', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await deviceService.rename(req.user, req.params.id, (req.body || {}).displayName, req) });
}));

router.post('/devices/:id/approve', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await deviceService.approve(req.user, req.params.id, req.body || {}, req) });
}));

router.post('/devices/:id/revoke', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await deviceService.revoke(req.user, req.params.id, req) });
}));

// ── signed by the device ─────────────────────────────────────────────────────

router.post('/devices/:id/heartbeat', handle(async (req, res) => {
  const device = await deviceService.verifyDeviceRequest({
    method: req.method, path: req.originalUrl, headers: req.headers, rawBody: req.rawBody, deviceIdInPath: req.params.id
  });
  const presented = await deviceService.heartbeat(device, req.body || {});
  res.json({ success: true, data: { accepted: true, serverTime: new Date().toISOString(), device: presented } });
}));

const signedBy = req => deviceService.verifyDeviceRequest({
  method: req.method, path: req.originalUrl, headers: req.headers, rawBody: req.rawBody, deviceIdInPath: req.params.id
});

router.post('/devices/:id/telemetry', handle(async (req, res) => {
  if (req.rawBody && req.rawBody.length > deviceService.MAX_TELEMETRY_BYTES) {
    return res.status(413).json({ success: false, code: 'TELEMETRY_TOO_LARGE', message: `A batch is at most ${deviceService.MAX_TELEMETRY_BYTES / 1024} KB.` });
  }
  const device = await signedBy(req);
  res.json({ success: true, data: await deviceService.ingestTelemetry(device, req.body || {}) });
}));

router.post('/devices/:id/rotate-key', handle(async (req, res) => {
  const device = await signedBy(req);
  res.json({ success: true, data: await deviceService.rotateKey(device, req.body || {}, req) });
}));

router.post('/devices/:id/commands/pull', handle(async (req, res) => {
  const device = await signedBy(req);
  res.json({ success: true, data: await deviceCommands.pull(device) });
}));

router.post('/devices/:id/commands/:commandId/receipt', handle(async (req, res) => {
  const device = await signedBy(req);
  res.json({ success: true, data: await deviceCommands.receipt(device, req.params.commandId, req.body || {}, req) });
}));

// ── commands, by a member (DEV-05) ──────────────────────────────────────────

router.post('/devices/:id/commands', verifiedUser, requireWorkspace, handle(async (req, res) => {
  const { command, created } = await deviceCommands.create(req.user, req.params.id, req.body || {}, req);
  res.status(created ? 201 : 200).json({ success: true, data: command });
}));

router.get('/devices/:id/commands', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await deviceCommands.list(req.user, req.params.id, page(req)) });
}));

router.delete('/devices/:id/commands/:commandId', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await deviceCommands.cancel(req.user, req.params.id, req.params.commandId, req) });
}));

// ── read by a member ─────────────────────────────────────────────────────────

router.get('/devices/:id/events', verifiedUser, requireWorkspace, handle(async (req, res) => {
  res.json({ success: true, data: await deviceService.listEvents(req.user, req.params.id, page(req)) });
}));

module.exports = router;
module.exports.claimLimiter = claimLimiter; // tests reset it between cases
