/**
 * Commands to devices (DEV-05): one exact action, approved by the member who
 * asks for it, delivered only to that device while it is active and before the
 * command expires, signed by the server, and counted as done only on the
 * device's own signed receipt.
 *
 *   member:  create (idempotent by key), list with status, cancel while queued
 *   device:  pull its queued commands (each signed), send a receipt
 *
 * A revoked device cannot pull (its requests are refused before this runs), so
 * work queued for it never starts. A command not delivered before its expiry is
 * marked expired and never delivered. The device also checks the signature and
 * the expiry itself before acting.
 */
const crypto = require('crypto');
const Device = require('../models/Device');
const DeviceCommand = require('../models/DeviceCommand');
const { workspaceRepository } = require('../repositories/workspaceRepository');
const { DeviceError } = require('./deviceService');
const { commandSigner } = require('./deviceCommandKey');
const audit = require('./auditLogService');

const devices = workspaceRepository(Device);
const commands = workspaceRepository(DeviceCommand);

const DEFAULT_TTL_SECONDS = 60 * 60;
const MAX_TTL_SECONDS = 24 * 60 * 60;
const MAX_PULL = 20;
const REQUIRED_CAPABILITY = { block_domain: 'hosts_blocking', unblock_domain: 'hosts_blocking' };
const DOMAIN = /^(?=.{3,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/** What the server signs and the device checks. */
const commandMessage = c => ['cyberforge-device-command-v1', c.commandId, c.deviceId, c.type, c.domain, String(new Date(c.expiresAt).getTime())].join('\n');

function signer() {
  const s = commandSigner();
  if (!s) throw new DeviceError(501, 'COMMANDS_NOT_CONFIGURED', 'Device commands are not available on this server: no command signing key is configured.');
  return s;
}

function present(command, now = Date.now()) {
  const expired = command.state === 'queued' && new Date(command.expiresAt).getTime() <= now;
  return {
    commandId: command.commandId,
    deviceId: command.deviceId,
    type: command.type,
    domain: command.domain,
    state: expired ? 'expired' : command.state,
    createdAt: command.createdAt,
    expiresAt: command.expiresAt,
    deliveredAt: command.deliveredAt || null,
    receipt: command.receipt && command.receipt.status ? command.receipt : null
  };
}

async function create(principal, deviceId, body = {}, req = null) {
  signer();
  const type = body.type;
  if (!DeviceCommand.TYPES.includes(type)) throw new DeviceError(400, 'COMMAND_TYPE_INVALID', `type must be one of ${DeviceCommand.TYPES.join(', ')}`);
  const domain = String(body.domain || '').trim().toLowerCase();
  if (!DOMAIN.test(domain)) throw new DeviceError(400, 'COMMAND_DOMAIN_INVALID', 'domain is a host name such as example.com.');
  const idempotencyKey = String(body.idempotencyKey || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(idempotencyKey)) throw new DeviceError(400, 'IDEMPOTENCY_KEY_INVALID', 'idempotencyKey is 8 to 64 letters, digits, - or _.');
  const ttl = body.ttlSeconds === undefined ? DEFAULT_TTL_SECONDS : Number(body.ttlSeconds);
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > MAX_TTL_SECONDS) throw new DeviceError(400, 'COMMAND_TTL_INVALID', `ttlSeconds is 60 to ${MAX_TTL_SECONDS}.`);

  const device = await devices.findOne(principal, { deviceId: String(deviceId) });
  if (!device) throw new DeviceError(404, 'DEVICE_NOT_FOUND', 'Device not found');
  if (device.state !== 'active') throw new DeviceError(409, 'DEVICE_NOT_ACTIVE', `The device is ${device.state}; commands go only to approved devices.`);
  const needed = REQUIRED_CAPABILITY[type];
  if (!((device.capabilities && device.capabilities.advertised) || []).includes(needed)) {
    throw new DeviceError(409, 'DEVICE_CAPABILITY_MISSING', `The device does not offer ${needed}.`);
  }

  const same = existing => existing.deviceId === device.deviceId && existing.type === type && existing.domain === domain;
  const earlier = await commands.findOne(principal, { idempotencyKey });
  if (earlier) {
    if (!same(earlier)) throw new DeviceError(409, 'IDEMPOTENCY_KEY_REUSED', 'That idempotency key was used for a different command.');
    return { command: present(earlier), created: false };
  }
  let command;
  try {
    command = await commands.create(principal, {
      commandId: crypto.randomUUID(), deviceId: device.deviceId, type, domain, idempotencyKey,
      state: 'queued', createdAt: new Date(), expiresAt: new Date(Date.now() + ttl * 1000), receipt: { status: null }
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const winner = await commands.findOne(principal, { idempotencyKey });
    if (!winner || !same(winner)) throw new DeviceError(409, 'IDEMPOTENCY_KEY_REUSED', 'That idempotency key was used for a different command.');
    return { command: present(winner), created: false };
  }
  await audit.record({ principal, action: 'device.command_create', resource: `device:${device.deviceId}`, details: { commandId: command.commandId, type, domain, expiresAt: command.expiresAt }, req });
  return { command: present(command), created: true };
}

async function list(principal, deviceId, { limit } = {}) {
  const device = await devices.findOne(principal, { deviceId: String(deviceId) });
  if (!device) throw new DeviceError(404, 'DEVICE_NOT_FOUND', 'Device not found');
  const rows = await commands.find(principal, { deviceId: device.deviceId }, { limit, sort: { createdAt: -1 } });
  const now = Date.now();
  return { commands: rows.map(c => present(c, now)) };
}

async function cancel(principal, deviceId, commandId, req = null) {
  const command = await commands.findOne(principal, { deviceId: String(deviceId), commandId: String(commandId) });
  if (!command) throw new DeviceError(404, 'COMMAND_NOT_FOUND', 'Command not found');
  const cancelled = await DeviceCommand.findOneAndUpdate(
    { _id: command._id, state: 'queued' },
    { $set: { state: 'cancelled', cancelledAt: new Date() } },
    { new: true }
  );
  if (!cancelled) throw new DeviceError(409, 'COMMAND_NOT_QUEUED', `The command is ${present(command).state}; only a queued command can be cancelled.`);
  await audit.record({ principal, action: 'device.command_cancel', resource: `device:${command.deviceId}`, details: { commandId: command.commandId }, req });
  return present(cancelled);
}

/** The device's queued, unexpired commands, each marked delivered and signed. */
async function pull(device) {
  const s = signer();
  const now = Date.now();
  const queued = await DeviceCommand.find({ deviceId: device.deviceId, state: 'queued' }).sort({ createdAt: 1 }).limit(MAX_PULL);
  const delivered = [];
  for (const command of queued) {
    if (new Date(command.expiresAt).getTime() <= now) {
      await DeviceCommand.updateOne({ _id: command._id, state: 'queued' }, { $set: { state: 'expired' } });
      continue;
    }
    const taken = await DeviceCommand.findOneAndUpdate(
      { _id: command._id, state: 'queued' },
      { $set: { state: 'delivered', deliveredAt: new Date(now) } },
      { new: true }
    );
    if (!taken) continue; // delivered by a concurrent pull
    delivered.push({
      commandId: taken.commandId, type: taken.type, domain: taken.domain,
      expiresAt: new Date(taken.expiresAt).getTime(),
      signature: s.sign(commandMessage(taken))
    });
  }
  return { commands: delivered, serverKey: s.publicKey };
}

/** The device's account of a delivered command. Sending the same receipt again is accepted. */
async function receipt(device, commandId, body = {}, req = null) {
  const status = body.status;
  if (!['applied', 'failed'].includes(status)) throw new DeviceError(400, 'RECEIPT_INVALID', 'status is applied or failed.');
  const executor = body.executor == null ? null : String(body.executor);
  if (executor !== null && !/^[a-z0-9_.-]{1,64}$/.test(executor)) throw new DeviceError(400, 'RECEIPT_INVALID', 'executor is a short lowercase name.');
  const detail = body.detail == null ? null : String(body.detail).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500);
  const now = new Date();
  const updated = await DeviceCommand.findOneAndUpdate(
    { commandId: String(commandId), deviceId: device.deviceId, state: 'delivered' },
    { $set: { state: status, receipt: { status, executor, detail, at: now } } },
    { new: true }
  );
  if (!updated) {
    const existing = await DeviceCommand.findOne({ commandId: String(commandId), deviceId: device.deviceId });
    if (!existing) throw new DeviceError(404, 'COMMAND_NOT_FOUND', 'Command not found');
    if (existing.state === status) return present(existing);
    throw new DeviceError(409, 'COMMAND_NOT_DELIVERED', `The command is ${present(existing).state}; a receipt is only taken for a delivered command.`);
  }
  await audit.record({
    principal: { userId: updated.createdBy, workspaceId: String(updated.workspaceId) },
    action: 'device.command_receipt', resource: `device:${device.deviceId}`,
    details: { by: 'device', commandId: updated.commandId, status, executor }, req
  });
  return present(updated);
}

module.exports = { create, list, cancel, pull, receipt, commandMessage, DEFAULT_TTL_SECONDS, MAX_TTL_SECONDS };
