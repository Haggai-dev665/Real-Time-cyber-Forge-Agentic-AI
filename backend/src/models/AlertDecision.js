/**
 * AlertDecision: what a person decided about one agent alert (DET-02).
 *
 * Agent alerts are kept in Appwrite and have no workflow fields there. A
 * decision is kept here instead, one per workspace and alert: the alert's
 * current state and the history of how it got there (who, when, from what, to
 * what, with what note). Listing alerts applies the decisions to them.
 */
const mongoose = require('mongoose');

const STATES = ['new', 'acknowledged', 'escalated', 'resolved', 'false_positive'];

const alertDecisionSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  alertId: { type: String, required: true, maxlength: 128 },
  status: { type: String, enum: STATES, required: true },
  history: { type: [mongoose.Schema.Types.Mixed], default: [] },
  createdBy: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false, collection: 'alert_decisions' });

alertDecisionSchema.index({ workspaceId: 1, alertId: 1 }, { unique: true });

module.exports = mongoose.model('AlertDecision', alertDecisionSchema);
module.exports.STATES = STATES;
