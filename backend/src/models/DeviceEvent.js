/**
 * DeviceEvent: one event a device reported in a signed telemetry batch (DEV-04).
 *
 * It belongs to the device's workspace. (deviceId, batchId, index) is unique, so
 * a batch sent again after a lost acknowledgement stores nothing twice. Events
 * expire RETENTION_DAYS after they were received, by an index.
 */
const mongoose = require('mongoose');

const RETENTION_DAYS = 30;
const TYPES = ['enforcement', 'capability_change', 'app_event'];

const deviceEventSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  deviceId: { type: String, required: true },
  batchId: { type: String, required: true },
  index: { type: Number, required: true },
  type: { type: String, enum: TYPES, required: true },
  at: { type: Date, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  receivedAt: { type: Date, required: true, default: Date.now }
}, { versionKey: false, minimize: false, collection: 'device_events' });

deviceEventSchema.index({ deviceId: 1, batchId: 1, index: 1 }, { unique: true });
deviceEventSchema.index({ workspaceId: 1, deviceId: 1, at: -1 });
deviceEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model('DeviceEvent', deviceEventSchema);
module.exports.RETENTION_DAYS = RETENTION_DAYS;
module.exports.TYPES = TYPES;
