/**
 * DeviceCommand: one exact action a member asked one device to carry out (DEV-05).
 *
 * The member's request is the approval, and it is for this action only: the
 * type, its parameters, the device and the expiry are fixed when the command
 * is created and signed by the server when it is delivered. A command reaches a
 * device only while the device is active and the command has not expired, and
 * it is shown as applied or failed only when that device's signed receipt says
 * so. `idempotencyKey` is unique per workspace, so a request sent twice creates
 * one command.
 *
 * States:
 *   queued     created; the device has not fetched it
 *   delivered  the device fetched it; no receipt yet
 *   applied    the device's receipt says it was carried out
 *   failed     the device's receipt says it was not
 *   expired    it was not delivered before its expiry
 *   cancelled  a member withdrew it before delivery
 */
const mongoose = require('mongoose');

const TYPES = ['block_domain', 'unblock_domain'];
const STATES = ['queued', 'delivered', 'applied', 'failed', 'expired', 'cancelled'];
const RETENTION_DAYS = 90;

const deviceCommandSchema = new mongoose.Schema({
  commandId: { type: String, required: true, unique: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  deviceId: { type: String, required: true },
  type: { type: String, enum: TYPES, required: true },
  domain: { type: String, required: true, maxlength: 253 },
  state: { type: String, enum: STATES, required: true, default: 'queued' },
  idempotencyKey: { type: String, required: true, maxlength: 64 },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, required: true, default: Date.now, immutable: true },
  expiresAt: { type: Date, required: true },
  deliveredAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  receipt: {
    status: { type: String, enum: ['applied', 'failed', null], default: null },
    executor: { type: String, default: null },
    detail: { type: String, default: null, maxlength: 500 },
    at: { type: Date, default: null }
  }
}, { versionKey: false, minimize: false, collection: 'device_commands' });

deviceCommandSchema.index({ workspaceId: 1, idempotencyKey: 1 }, { unique: true });
deviceCommandSchema.index({ deviceId: 1, state: 1, createdAt: 1 });
deviceCommandSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model('DeviceCommand', deviceCommandSchema);
module.exports.TYPES = TYPES;
module.exports.STATES = STATES;
module.exports.RETENTION_DAYS = RETENTION_DAYS;
