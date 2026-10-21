/**
 * Policy: a rule that turns a risk event into a response.
 *
 * Policies are platform-wide today: every workspace's events are evaluated
 * against the same set, managed by analysts and administrators. That is why a
 * policy has no workspace. Per-workspace policies would add one, and the
 * engine would read both.
 *
 * `policyId` is the stable public ID (a UUID). `defaultKey` marks one of the
 * built-in policies, so they are created once and never duplicated.
 */
const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  policyId: { type: String, required: true, unique: true },
  defaultKey: { type: String, unique: true, sparse: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 500 },
  trigger: {
    metric: { type: String, required: true },
    operator: { type: String, required: true },
    threshold: { type: Number, required: true }
  },
  action: {
    type: { type: String, required: true },
    params: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  enabled: { type: Boolean, default: true },
  scope: { type: String, default: 'global', maxlength: 40 },
  isDefault: { type: Boolean, default: false },
  createdBy: { type: String, default: 'system' },
  updatedBy: { type: String, default: null },
  triggerCount: { type: Number, default: 0 },
  lastTriggered: { type: Date, default: null }
}, { timestamps: true, collection: 'policies' });

module.exports = mongoose.model('Policy', policySchema);
