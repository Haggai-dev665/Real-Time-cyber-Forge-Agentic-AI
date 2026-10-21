/**
 * Evidence reports (DET-04), mounted at /api/v1.
 *
 *   GET /reports/evidence?from=&to=&tz=&deviceIds=
 *
 * A report of the account's findings, incidents and stored evidence in the
 * window, with what limits it, from a fixed snapshot that is hashed and signed.
 * At most 90 days; the timezone is an IANA name (UTC when not given).
 */
const express = require('express');
const { verifiedUser } = require('../middleware/verifiedUser');
const { requireWorkspace } = require('../middleware/workspace');
const reports = require('../services/evidenceReportService');

const router = express.Router();

router.get('/reports/evidence', verifiedUser, requireWorkspace, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: await reports.build(req.user, req.query, req) });
  } catch (error) {
    if (error instanceof reports.ReportError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    console.error('[reports]', error);
    res.status(500).json({ success: false, message: 'The report could not be built' });
  }
});

module.exports = router;
