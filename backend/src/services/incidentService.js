/**
 * Incidents (DET-02): related findings shown together, with one timeline.
 *
 * An incident is computed from the account's findings each time it is read,
 * not stored: findings on the same host belong together, and a gap of more than
 * GAP_MS between one finding and the next starts a new incident. So an incident
 * cannot drift from the findings it shows, and resolving one is resolving each
 * of its open findings through the same audited workflow (findingService).
 *
 * Each incident gives its findings, the highest severity among them, one
 * timeline merged from theirs, the last-known connection and coverage of the
 * workspace's devices, as context for what could have seen it, and the stored
 * evidence (sandbox scans) about the same host, each with its fingerprint and
 * whether it still reads as intact. `evidence()` exports that evidence with a
 * signed manifest (SEC-08).
 */
const crypto = require('crypto');
const Threat = require('../models/Threat');
const Device = require('../models/Device');
const findings = require('./findingService');
const { ownedThreatFilter } = require('./threatOwnership');
const { connectionOf, coverageOf } = require('./deviceService');
const SandboxScan = require('../models/SandboxScan');
const { workspaceRepository } = require('../repositories/workspaceRepository');
const EVIDENCE_SHOWN = 20;

const GAP_MS = 72 * 60 * 60 * 1000;
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FINDINGS = 500;
const TIMELINE_SHOWN = 100;
const SEVERITY = ['low', 'medium', 'high', 'critical'];

/** The host a finding is about: its normalised target up to the first "/". */
function hostOf(threat) {
  const target = (threat.source && (threat.source.url || threat.source.domain)) || threat.indicator || threat.threatId;
  return findings.normalizeTarget(target).split('/')[0] || 'unknown';
}

const timeOf = t => new Date(t.lastSeenAt || (t.detection && t.detection.timestamp) || t.createdAt || 0).getTime();
const firstOf = t => new Date(t.firstSeenAt || (t.detection && t.detection.timestamp) || t.createdAt || 0).getTime();

async function deviceContext(workspaceId) {
  if (!workspaceId) return [];
  const now = Date.now();
  return (await Device.find({ workspaceId }).lean())
    .filter(d => d.kind !== 'inventory_only')
    .map(d => ({ deviceId: d.deviceId, displayName: d.displayName, connection: connectionOf(d, now), ...coverageOf(d), lastSeenAt: d.lastSeenAt || null }));
}

/** The account's incidents, newest first. */
async function list(principal, now = Date.now()) {
  const owner = ownedThreatFilter(principal.userId);
  const recent = (await Threat.find(owner).lean())
    .filter(t => timeOf(t) >= now - LOOKBACK_MS)
    .sort((a, b) => firstOf(a) - firstOf(b))
    .slice(-MAX_FINDINGS);

  const byHost = new Map();
  for (const t of recent) {
    const host = hostOf(t);
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(t);
  }
  const devices = await deviceContext(principal.workspaceId);
  // stored evidence by host (the workspace's latest 200 scans)
  const { sandboxAnalysisService } = require('./sandboxAnalysisService');
  const scans = principal.workspaceId ? await workspaceRepository(SandboxScan).find(principal, {}, { limit: 200, sort: { createdAt: -1 } }) : [];
  const evidenceByHost = new Map();
  for (const doc of scans) {
    const host = findings.normalizeTarget(doc.target).split('/')[0];
    const item = sandboxAnalysisService._present(doc);
    if (!evidenceByHost.has(host)) evidenceByHost.set(host, []);
    evidenceByHost.get(host).push({ id: item.id, kind: 'sandbox_scan', verdict: item.verdict, collectedAt: item.createdAt, evidenceHash: item.integrity.evidenceHash, intact: item.integrity.intact });
  }
  const incidents = [];
  for (const [host, group] of byHost) {
    let current = [];
    const flush = () => {
      if (!current.length) return;
      const first = Math.min(...current.map(firstOf));
      const last = Math.max(...current.map(timeOf));
      const open = current.filter(t => findings.OPEN.includes(t.status));
      const timeline = current
        .flatMap(t => (t.timeline || []).map(e => ({ at: e.timestamp, threatId: t.threatId, event: e.event, details: e.details || '' })))
        .sort((a, b) => new Date(a.at) - new Date(b.at))
        .slice(-TIMELINE_SHOWN);
      incidents.push({
        incidentId: `inc_${crypto.createHash('sha256').update(`${owner.user}|${host}|${first}`).digest('hex').slice(0, 20)}`,
        host,
        state: open.length ? 'open' : 'closed',
        severity: current.reduce((worst, t) => (SEVERITY.indexOf(t.severity) > SEVERITY.indexOf(worst) ? t.severity : worst), 'low'),
        firstSeenAt: new Date(first).toISOString(),
        lastSeenAt: new Date(last).toISOString(),
        findings: current.map(t => ({ threatId: t.threatId, type: t.type, status: t.status, severity: t.severity, occurrences: t.occurrences || 1, lastSeenAt: new Date(timeOf(t)).toISOString() })),
        openFindings: open.length,
        occurrences: current.reduce((n, t) => n + (t.occurrences || 1), 0),
        timeline,
        devices,
        evidence: (evidenceByHost.get(host) || []).slice(0, EVIDENCE_SHOWN)
      });
      current = [];
    };
    for (const t of group) {
      if (current.length && firstOf(t) - Math.max(...current.map(timeOf)) > GAP_MS) flush();
      current.push(t);
    }
    flush();
  }
  incidents.sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
  return { incidents, window: { lookbackDays: LOOKBACK_MS / 86400000, gapHours: GAP_MS / 3600000 } };
}

/** Resolve an incident: each of its open findings, through the audited workflow. */
async function resolve(principal, incidentId, note, req = null) {
  const { incidents } = await list(principal);
  const incident = incidents.find(i => i.incidentId === String(incidentId));
  if (!incident) throw new findings.FindingError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  const text = `resolved with incident ${incident.incidentId}${note ? `: ${String(note).slice(0, 900)}` : ''}`;
  const resolved = [];
  for (const f of incident.findings.filter(x => findings.OPEN.includes(x.status))) {
    try {
      await findings.transition(principal, f.threatId, 'resolve', text, req);
      resolved.push(f.threatId);
    } catch (error) {
      if (!(error instanceof findings.FindingError)) throw error; // changed meanwhile
    }
  }
  return { incidentId: incident.incidentId, resolved, kept: incident.findings.length - resolved.length };
}

/** The incident's stored evidence, exported with a signed manifest (SEC-08). */
async function evidence(principal, incidentId) {
  const { incidents } = await list(principal);
  const incident = incidents.find(i => i.incidentId === String(incidentId));
  if (!incident) throw new findings.FindingError(404, 'INCIDENT_NOT_FOUND', 'Incident not found');
  const ids = incident.evidence.map(e => e.id);
  if (!ids.length) return { incidentId: incident.incidentId, host: incident.host, items: [], manifest: null, note: 'No stored evidence about this host.' };
  const { sandboxAnalysisService } = require('./sandboxAnalysisService');
  return { incidentId: incident.incidentId, host: incident.host, ...(await sandboxAnalysisService.exportEvidence(principal, ids)) };
}

module.exports = { list, resolve, evidence, hostOf, GAP_MS };
