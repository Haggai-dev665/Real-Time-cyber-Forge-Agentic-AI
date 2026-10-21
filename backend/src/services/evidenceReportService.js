/**
 * Evidence reports (DET-04): what happened for an account in a time range,
 * built from a fixed snapshot of its records and signed.
 *
 * A report states its window and timezone, the findings and incidents in it
 * (each with the IDs of the evidence behind it), the stored evidence with its
 * fingerprints, and, alongside, what limits it: evidence deleted in the window,
 * scans that produced no verdict, agent checks that failed because no model
 * answered, devices that were not online with full coverage, and the data
 * sources and model versions involved. Its summary is computed from these
 * counts; no language model writes it. The whole snapshot is hashed, and the
 * hash signed with AUDIT_SIGNING_KEY, so a copy can be checked later.
 */
const Threat = require('../models/Threat');
const SandboxScan = require('../models/SandboxScan');
const AgentRun = require('../models/AgentRun');
const AuditEvent = require('../models/AuditEvent');
const incidents = require('./incidentService');
const { normalizeTarget } = require('./findingService');
const { ownedThreatFilter } = require('./threatOwnership');
const { workspaceRepository } = require('../repositories/workspaceRepository');
const { integritySigner } = require('./integrityKey');
const { hashOf } = require('../utils/canonical');
const audit = require('./auditLogService');

const MAX_DAYS = 90;
const REPORT_FORMAT = 'cyberforge-evidence-report-v1';

class ReportError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function windowOf({ from, to, tz }) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 7 * 86400000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) throw new ReportError(400, 'RANGE_INVALID', 'from and to are dates, from before to.');
  if (end - start > MAX_DAYS * 86400000) throw new ReportError(400, 'RANGE_INVALID', `A report covers at most ${MAX_DAYS} days.`);
  let zone = 'UTC';
  if (typeof tz === 'string' && tz) {
    try { new Intl.DateTimeFormat('en', { timeZone: tz }); zone = tz; } catch (_) { throw new ReportError(400, 'TIMEZONE_INVALID', 'tz is an IANA time zone, such as Europe/London.'); }
  }
  return { from: start, to: end, tz: zone };
}

const inWindow = (t, w) => { const ms = new Date(t).getTime(); return ms >= w.from.getTime() && ms <= w.to.getTime(); };
const local = (t, zone) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(t));

async function build(principal, query = {}, req = null) {
  const w = windowOf(query);
  const deviceFilter = typeof query.deviceIds === 'string' && query.deviceIds ? query.deviceIds.split(',').map(s => s.trim()).filter(Boolean) : null;

  // findings and incidents in the window
  const allFindings = await Threat.find(ownedThreatFilter(principal.userId)).lean();
  const seen = t => t.lastSeenAt || (t.detection && t.detection.timestamp) || t.createdAt;
  const findings = allFindings.filter(t => inWindow(seen(t), w));
  const { incidents: allIncidents } = await incidents.list(principal, w.to.getTime());
  const reportIncidents = allIncidents.filter(i => new Date(i.lastSeenAt) >= w.from && new Date(i.firstSeenAt) <= w.to);

  // stored evidence in the window, or behind an incident in it
  const { sandboxAnalysisService } = require('./sandboxAnalysisService');
  const scans = (await workspaceRepository(SandboxScan).find(principal, {}, { limit: 200, sort: { createdAt: -1 } })).map(d => sandboxAnalysisService._present(d));
  const incidentEvidence = new Set(reportIncidents.flatMap(i => (i.evidence || []).map(e => e.id)));
  const evidence = scans.filter(s => inWindow(s.createdAt, w) || incidentEvidence.has(s.id));

  // what limits the report
  const deletions = (await AuditEvent.find({ workspaceId: principal.workspaceId, action: 'evidence.delete' }).lean()).filter(e => inWindow(e.createdAt, w));
  const runs = (await workspaceRepository(AgentRun).find(principal, {}, { limit: 200, sort: { createdAt: -1 } })).filter(r => inWindow(r.createdAt, w));
  const failedSteps = runs.flatMap(r => (r.steps || []).filter(s => s.status === 'failed').map(s => ({ runId: r.runId, tool: s.tool, summary: s.summary })));
  const outages = failedSteps.filter(s => /no (url )?model answered|could not be reached|unavailable|timed out/i.test(s.summary || ''));
  // the workspace's devices at report time: what could have seen things
  const Device = require('../models/Device');
  const { connectionOf, coverageOf } = require('./deviceService');
  let devices = (await Device.find({ workspaceId: principal.workspaceId }).lean()).filter(d => d.kind !== 'inventory_only')
    .map(d => ({ deviceId: d.deviceId, displayName: d.displayName, connection: connectionOf(d), ...coverageOf(d), lastSeenAt: d.lastSeenAt || null }));
  if (deviceFilter) devices = devices.filter(d => deviceFilter.includes(d.deviceId));
  const staleDevices = devices.filter(d => d.connection !== 'online' || d.coverage !== 'full');

  const sources = {};
  for (const t of findings) { const k = `finding · ${(t.detection && t.detection.method) || 'unknown'}`; sources[k] = (sources[k] || 0) + 1; }
  if (evidence.length) sources['sandbox scan'] = evidence.length;
  if (runs.length) sources['agent run'] = runs.length;
  const modelVersions = [...new Set(findings.map(t => t.detection && t.detection.model_version).filter(Boolean))];
  const engines = [...new Set(runs.flatMap(r => (r.findings || []).map(f => f.engine)).filter(Boolean))];

  const open = findings.filter(t => ['detected', 'acknowledged', 'investigating', 'confirmed'].includes(t.status));
  const summary = [
    `${findings.length} finding${findings.length === 1 ? '' : 's'} in this period (${open.length} still open), in ${reportIncidents.length} incident${reportIncidents.length === 1 ? '' : 's'}.`,
    `${evidence.length} stored evidence item${evidence.length === 1 ? '' : 's'}${evidence.some(e => !e.integrity.intact) ? `, of which ${evidence.filter(e => !e.integrity.intact).length} no longer read as intact` : ''}${deletions.length ? `; ${deletions.length} deleted in the period` : ''}.`,
    outages.length ? `${outages.length} check${outages.length === 1 ? '' : 's'} could not run because a model or service did not answer.` : 'No check failed for want of a model or service.',
    devices.length ? `${staleDevices.length} of ${devices.length} device${devices.length === 1 ? '' : 's'} not online with full coverage at report time.` : 'No enrolled device: nothing was watched on a device.'
  ];

  const content = {
    format: REPORT_FORMAT,
    window: { from: w.from.toISOString(), to: w.to.toISOString(), tz: w.tz, fromLocal: local(w.from, w.tz), toLocal: local(w.to, w.tz) },
    generatedAt: new Date().toISOString(),
    summary,
    findings: findings.map(t => ({
      threatId: t.threatId, type: t.type, severity: t.severity, status: t.status, occurrences: t.occurrences || 1,
      lastSeen: new Date(seen(t)).toISOString(), lastSeenLocal: local(seen(t), w.tz),
      evidenceIds: evidence.filter(e => incidents.hostOf(t) === normalizeTarget(e.target).split('/')[0]).map(e => e.id)
    })),
    incidents: reportIncidents.map(i => ({ incidentId: i.incidentId, host: i.host, state: i.state, severity: i.severity, findings: i.findings.length, evidenceIds: (i.evidence || []).map(e => e.id) })),
    evidence: evidence.map(e => ({ id: e.id, kind: 'sandbox_scan', target: e.target, verdict: e.verdict, collectedAt: e.createdAt, evidenceHash: e.integrity.evidenceHash, intact: e.integrity.intact })),
    limits: {
      deletedEvidence: deletions.map(e => ({ resource: e.resource, deletedAt: new Date(e.createdAt).toISOString(), evidenceHash: e.details && e.details.evidenceHash })),
      scansWithoutVerdict: evidence.filter(e => e.verdict === 'unknown').map(e => e.id),
      providerFailures: outages,
      devicesNotFullyCovered: staleDevices,
      devicesSelected: deviceFilter
    },
    dataSources: sources,
    modelVersions: { findings: modelVersions, agentEngines: engines }
  };
  const snapshotHash = hashOf(content);
  const signer = integritySigner();
  const signature = signer ? { keyId: signer.keyId, publicKey: signer.publicKey, value: signer.sign(`${REPORT_FORMAT}\n${snapshotHash}`) } : null;
  await audit.record({ principal, action: 'report.generate', resource: `report ${w.from.toISOString()}..${w.to.toISOString()}`, details: { snapshotHash, findings: findings.length, evidence: evidence.length, signed: Boolean(signature) }, req });
  return { report: content, snapshotHash, signature };
}

module.exports = { build, ReportError, REPORT_FORMAT, MAX_DAYS };
