/**
 * The workflow for agent alerts (DET-02): acknowledge, escalate, resolve, mark
 * a false positive, reopen. The alert stays in Appwrite as it was recorded; the
 * decision is kept per workspace in AlertDecision, applied when alerts are
 * listed, and each step is audited (`alert.state_change`).
 *
 * Only an alert of the signed-in account can be decided on: it is looked up in
 * Appwrite by its ID and the account's user ID together.
 */
const AlertDecision = require('../models/AlertDecision');
const { appwriteService } = require('./appwriteService');
const audit = require('./auditLogService');

const HISTORY_KEPT = 50;
const OPEN = ['new', 'acknowledged', 'escalated'];
const CLOSED = ['resolved', 'false_positive'];
const TRANSITIONS = {
  acknowledge: { to: 'acknowledged', from: ['new'] },
  escalate: { to: 'escalated', from: ['new', 'acknowledged'] },
  resolve: { to: 'resolved', from: OPEN },
  false_positive: { to: 'false_positive', from: OPEN },
  reopen: { to: 'acknowledged', from: CLOSED }
};

class AlertDecisionError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

const idOf = alert => String(alert.alert_id || alert.$id || alert.id || '');

/** The alerts with their decided state and last decision applied. */
async function applyDecisions(principal, alerts) {
  if (!principal.workspaceId || !alerts.length) return alerts.map(a => ({ ...a, workflowState: 'new' }));
  const ids = alerts.map(idOf).filter(Boolean);
  const decisions = await AlertDecision.find({ workspaceId: principal.workspaceId, alertId: { $in: ids } }).lean();
  const byId = new Map(decisions.map(d => [d.alertId, d]));
  return alerts.map(a => {
    const d = byId.get(idOf(a));
    return { ...a, workflowState: d ? d.status : 'new', lastDecision: d && d.history.length ? d.history[d.history.length - 1] : null };
  });
}

async function transition(principal, alertId, action, note, req = null) {
  const rule = TRANSITIONS[action];
  if (!rule) throw new AlertDecisionError(400, 'ACTION_INVALID', `action must be one of: ${Object.keys(TRANSITIONS).join(', ')}`);
  const id = String(alertId || '');
  if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(id)) throw new AlertDecisionError(400, 'ALERT_ID_INVALID', 'Not an alert ID');
  const alert = await appwriteService.getAlertForUser(String(principal.userId), id);
  if (!alert) throw new AlertDecisionError(404, 'ALERT_NOT_FOUND', 'Alert not found');
  const text = typeof note === 'string' ? note.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 1000) : '';
  const now = new Date();
  const current = await AlertDecision.findOne({ workspaceId: principal.workspaceId, alertId: id });
  const from = current ? current.status : 'new';
  if (!rule.from.includes(from)) throw new AlertDecisionError(409, 'TRANSITION_NOT_ALLOWED', `An alert that is ${from} cannot be moved by "${action}".`);
  const entry = { at: now, from, to: rule.to, by: String(principal.userId), note: text };
  if (current) {
    // the state is checked and changed in one step: two people cannot both move it from the same state
    const updated = await AlertDecision.findOneAndUpdate(
      { _id: current._id, status: from },
      { $set: { status: rule.to, updatedAt: now }, $push: { history: { $each: [entry], $slice: -HISTORY_KEPT } } },
      { new: true }
    );
    if (!updated) throw new AlertDecisionError(409, 'TRANSITION_NOT_ALLOWED', 'The alert changed meanwhile; reload it.');
  } else {
    try {
      await AlertDecision.create({ workspaceId: principal.workspaceId, alertId: id, status: rule.to, history: [entry], createdBy: String(principal.userId), updatedAt: now });
    } catch (error) {
      if (error.code === 11000) throw new AlertDecisionError(409, 'TRANSITION_NOT_ALLOWED', 'The alert changed meanwhile; reload it.');
      throw error;
    }
  }
  await audit.record({ principal, action: 'alert.state_change', resource: `alert:${id}`, details: { from, to: rule.to, action, severity: alert.severity || null, note: text || null }, req });
  return { alertId: id, workflowState: rule.to, from, decidedAt: now.toISOString() };
}

module.exports = { applyDecisions, transition, AlertDecisionError, TRANSITIONS, OPEN, CLOSED };
