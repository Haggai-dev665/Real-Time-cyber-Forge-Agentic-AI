/**
 * Devices: enrollment, claim with key proof, approval, inventory, presence and
 * revocation (DEV-01, DEV-02, the first part of DEV-04 and DEV-05).
 *
 * Enrollment. A signed-in member asks for a one-time code: 12 characters of
 * Crockford base32 (60 random bits), shown as XXXX-XXXX-XXXX and usable as a
 * QR code or typed. Only its SHA-256 is stored, bound to the workspace; it
 * expires after ENROLLMENT_TTL_MS and carries no user credential.
 *
 * Claim. The installation generates its own Ed25519 key pair and sends the
 * code, its installation ID and its public key, signed with that key over
 * claimMessage(). The signature is checked before the code is touched, so a
 * malformed claim does not use it up. The code then changes from `pending` to
 * `claimed` in one atomic update: of two concurrent claims, one wins. The device
 * is `pending_approval` and cannot sign in until a member approves it, having
 * been shown its key fingerprint. Approval names that fingerprint, so a key
 * swapped in between is not approved by mistake.
 *
 * Signed requests. A device signs requestMessage() for each call: method,
 * path, device ID, a timestamp within CLOCK_SKEW_MS of server time, a sequence
 * number that must be higher than the last one accepted, and a SHA-256 of the
 * exact body bytes. The sequence is advanced in one atomic update that also
 * requires the device to be active and the key version to be the one that
 * signed, so a replayed or reordered request, a revoked device or an old key is
 * refused.
 *
 * Connection is worked out from server time: online within ONLINE_MS of the
 * last accepted heartbeat, stale within STALE_MS, offline after that.
 */
const crypto = require('crypto');
const Device = require('../models/Device');
const DeviceEnrollment = require('../models/DeviceEnrollment');
const DeviceEvent = require('../models/DeviceEvent');
const { workspaceRepository } = require('../repositories/workspaceRepository');
const audit = require('./auditLogService');
const { commandSigner } = require('./deviceCommandKey');

const devices = workspaceRepository(Device);
const enrollments = workspaceRepository(DeviceEnrollment);
const deviceEvents = workspaceRepository(DeviceEvent);

const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I, L, O, U
const CODE_LENGTH = 12;
const ENROLLMENT_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const ONLINE_MS = 3 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;
const CLAIM_KINDS = ['endpoint', 'backend_worker'];
const CAPABILITY_STATES = ['ok', 'denied', 'unavailable'];
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

class DeviceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ── codes ────────────────────────────────────────────────────────────────────

function newCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}

/** The code as typed (any case, with or without dashes; O read as 0, I and L as 1), or null. */
function normalizeCode(input) {
  const code = String(input || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return code.length === CODE_LENGTH && [...code].every(c => CODE_ALPHABET.includes(c)) ? code : null;
}

const formatCode = code => code.match(/.{4}/g).join('-');
const hashCode = code => crypto.createHash('sha256').update(`cyberforge-enrollment-v1:${code}`).digest('hex');

// ── keys and signatures ──────────────────────────────────────────────────────

/** A 32-byte Ed25519 public key in standard base64, or null. */
function publicKeyObject(base64) {
  if (typeof base64 !== 'string') return null;
  const raw = Buffer.from(base64, 'base64');
  if (raw.length !== 32 || raw.toString('base64') !== base64) return null;
  try {
    return crypto.createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, raw]), format: 'der', type: 'spki' });
  } catch (_) {
    return null;
  }
}

/** What a member compares on both screens before approving: 32 hex characters in groups of four. */
function keyFingerprint(base64) {
  const digest = crypto.createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex').slice(0, 32);
  return digest.match(/.{4}/g).join(' ');
}

function verifySignature(publicKeyBase64, message, signatureBase64) {
  const key = publicKeyObject(publicKeyBase64);
  if (!key || typeof signatureBase64 !== 'string') return false;
  const signature = Buffer.from(signatureBase64, 'base64');
  if (signature.length !== 64) return false;
  try {
    return crypto.verify(null, Buffer.from(message, 'utf8'), key, signature);
  } catch (_) {
    return false;
  }
}

const claimMessage = ({ code, installationId, publicKey }) =>
  ['cyberforge-device-claim-v1', code, installationId, publicKey].join('\n');

const requestMessage = ({ method, path, deviceId, timestamp, seq, bodyDigest }) =>
  ['cyberforge-device-request-v1', String(method).toUpperCase(), path, deviceId, String(timestamp), String(seq), bodyDigest].join('\n');

const bodyDigest = raw => crypto.createHash('sha256').update(raw || Buffer.alloc(0)).digest('hex');

// ── input ────────────────────────────────────────────────────────────────────

function displayNameOf(value) {
  const name = String(value || '').trim();
  if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new DeviceError(400, 'DEVICE_NAME_INVALID', 'A device name is 1 to 80 characters, with no control characters.');
  }
  return name;
}

function platformOf(value) {
  if (!Device.PLATFORMS.includes(value)) throw new DeviceError(400, 'DEVICE_PLATFORM_INVALID', `platform must be one of ${Device.PLATFORMS.join(', ')}`);
  return value;
}

function capabilityNames(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 30 || !value.every(c => typeof c === 'string' && /^[a-z0-9_.-]{1,40}$/.test(c))) {
    throw new DeviceError(400, 'DEVICE_CAPABILITIES_INVALID', 'capabilities is a list of at most 30 short lowercase names');
  }
  return [...new Set(value)];
}

function clientVersionOf(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^[0-9A-Za-z.+_-]{1,40}$/.test(value)) {
    throw new DeviceError(400, 'DEVICE_VERSION_INVALID', 'clientVersion is at most 40 characters of a version string');
  }
  return value;
}

// ── presentation ─────────────────────────────────────────────────────────────

function connectionOf(device, now = Date.now()) {
  if (device.state === 'inventory') return 'not_applicable';
  if (device.state === 'revoked') return 'revoked';
  if (device.state === 'pending_approval') return 'awaiting_approval';
  if (!device.lastSeenAt) return 'never_connected';
  const age = now - new Date(device.lastSeenAt).getTime();
  if (age <= ONLINE_MS) return 'online';
  return age <= STALE_MS ? 'stale' : 'offline';
}

/**
 * Protection coverage, apart from connection (DEV-03): `full` when every
 * capability the device advertised is confirmed `ok` by its own checks,
 * `degraded` when any is denied, unavailable or unreported, `unknown` before it
 * has reported any, `not_applicable` for a device that is not active.
 */
function coverageOf(device) {
  if (device.state !== 'active') return { coverage: 'not_applicable', degradedBy: [] };
  const advertised = (device.capabilities && device.capabilities.advertised) || [];
  const confirmed = (device.capabilities && device.capabilities.confirmed) || {};
  if (!Object.keys(confirmed).length) return { coverage: 'unknown', degradedBy: [] };
  const degradedBy = advertised.filter(name => confirmed[name] !== 'ok');
  return { coverage: degradedBy.length ? 'degraded' : 'full', degradedBy };
}

function present(device, now = Date.now()) {
  return {
    deviceId: device.deviceId,
    kind: device.kind,
    platform: device.platform,
    displayName: device.displayName,
    state: device.state,
    connection: connectionOf(device, now),
    ...coverageOf(device),
    lastSeenAt: device.lastSeenAt || null,
    keyFingerprint: device.keyFingerprint || null,
    keyVersion: device.keyVersion || 0,
    clientVersion: device.clientVersion || null,
    capabilities: {
      advertised: (device.capabilities && device.capabilities.advertised) || [],
      enabled: (device.capabilities && device.capabilities.enabled) || [],
      confirmed: (device.capabilities && device.capabilities.confirmed) || {}
    },
    createdAt: device.createdAt,
    approvedAt: device.approvedAt || null,
    revokedAt: device.revokedAt || null
  };
}

// ── enrollment ───────────────────────────────────────────────────────────────

async function createEnrollment(principal, { flow = 'this_device', platform = null } = {}, req = null) {
  if (!DeviceEnrollment.FLOWS.includes(flow)) throw new DeviceError(400, 'ENROLLMENT_FLOW_INVALID', `flow must be one of ${DeviceEnrollment.FLOWS.join(', ')}`);
  if (platform != null) platformOf(platform);
  const code = newCode();
  const expiresAt = new Date(Date.now() + ENROLLMENT_TTL_MS);
  const enrollment = await enrollments.create(principal, {
    enrollmentId: crypto.randomUUID(), codeHash: hashCode(code), flow, platform, state: 'pending', expiresAt
  });
  await audit.record({ principal, action: 'device.enrollment_create', resource: `enrollment:${enrollment.enrollmentId}`, details: { flow, platform, expiresAt }, req });
  return {
    enrollmentId: enrollment.enrollmentId,
    code: formatCode(code),
    link: `cyberforge://enroll?code=${code}`,
    flow,
    expiresAt
  };
}

async function cancelEnrollment(principal, enrollmentId, req = null) {
  const enrollment = await enrollments.findOne(principal, { enrollmentId: String(enrollmentId), state: 'pending' });
  if (!enrollment) return false;
  await DeviceEnrollment.updateOne({ _id: enrollment._id, state: 'pending' }, { $set: { state: 'cancelled' } });
  await audit.record({ principal, action: 'device.enrollment_cancel', resource: `enrollment:${enrollment.enrollmentId}`, req });
  return true;
}

/** Why a code could not be claimed, once the atomic claim has failed. */
async function claimFailure(codeHash, now) {
  const existing = await DeviceEnrollment.findOne({ codeHash });
  if (!existing) return new DeviceError(404, 'ENROLLMENT_INVALID', 'That code is not valid.');
  if (existing.state === 'claimed') return new DeviceError(409, 'ENROLLMENT_ALREADY_CLAIMED', 'That code has already been used.');
  if (existing.state === 'cancelled') return new DeviceError(410, 'ENROLLMENT_CANCELLED', 'That code was cancelled.');
  if (new Date(existing.expiresAt).getTime() <= now) return new DeviceError(410, 'ENROLLMENT_EXPIRED', 'That code has expired. Create a new one.');
  return new DeviceError(409, 'ENROLLMENT_ALREADY_CLAIMED', 'That code has already been used.');
}

async function claim(body = {}, req = null) {
  const code = normalizeCode(body.code);
  if (!code) throw new DeviceError(400, 'ENROLLMENT_CODE_INVALID', 'The code is 12 letters and digits, as shown: XXXX-XXXX-XXXX.');
  const installationId = String(body.installationId || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(installationId)) throw new DeviceError(400, 'INSTALLATION_ID_INVALID', 'installationId is 8 to 64 letters, digits, - or _.');
  const publicKey = body.publicKey;
  if (!publicKeyObject(publicKey)) throw new DeviceError(400, 'DEVICE_KEY_INVALID', 'publicKey is a 32-byte Ed25519 public key in base64.');
  const kind = body.kind || 'endpoint';
  if (!CLAIM_KINDS.includes(kind)) throw new DeviceError(400, 'DEVICE_KIND_INVALID', `kind must be one of ${CLAIM_KINDS.join(', ')}`);
  const platform = platformOf(body.platform);
  const displayName = displayNameOf(body.displayName);
  const advertised = capabilityNames(body.capabilities);
  const clientVersion = clientVersionOf(body.clientVersion);
  // proof of the key, before the code is used
  if (!verifySignature(publicKey, claimMessage({ code, installationId, publicKey }), body.signature)) {
    throw new DeviceError(401, 'DEVICE_KEY_PROOF_INVALID', 'The signature does not match the key for this code and installation.');
  }

  const now = Date.now();
  const codeHash = hashCode(code);
  const enrollment = await DeviceEnrollment.findOneAndUpdate(
    { codeHash, state: 'pending', expiresAt: { $gt: new Date(now) } },
    { $set: { state: 'claimed', claimedAt: new Date(now) } },
    { new: true }
  );
  if (!enrollment) throw await claimFailure(codeHash, now);

  const workspaceId = enrollment.workspaceId;
  const fingerprint = keyFingerprint(publicKey);
  const keyFields = {
    publicKey, keyFingerprint: fingerprint, lastSeq: 0, state: 'pending_approval', platform, clientVersion,
    enrollmentId: enrollment.enrollmentId, approvedBy: null, approvedAt: null, updatedAt: new Date(now)
  };

  let device = await Device.findOne({ workspaceId, installationId });
  if (device) {
    // the same installation enrolling again: same device, new key
    device = await Device.findOneAndUpdate(
      { _id: device._id },
      { $set: { ...keyFields, capabilities: { ...(device.capabilities || {}), advertised } }, $inc: { keyVersion: 1 } },
      { new: true }
    );
  } else {
    try {
      device = await Device.create({
        deviceId: crypto.randomUUID(), workspaceId, kind, displayName, installationId, keyVersion: 1,
        capabilities: { advertised, enabled: [], confirmed: {} }, createdBy: enrollment.createdBy, createdAt: new Date(now), ...keyFields
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      // another code for the same installation won the race: update that record instead
      const winner = await Device.findOne({ workspaceId, installationId });
      device = await Device.findOneAndUpdate(
        { _id: winner._id },
        { $set: { ...keyFields, capabilities: { ...(winner.capabilities || {}), advertised } }, $inc: { keyVersion: 1 } },
        { new: true }
      );
    }
  }
  await DeviceEnrollment.updateOne({ _id: enrollment._id }, { $set: { claimedDeviceId: device.deviceId } });
  await audit.record({
    principal: { userId: enrollment.createdBy, workspaceId: String(workspaceId) },
    action: 'device.claim', resource: `device:${device.deviceId}`,
    details: { by: 'device', platform, kind: device.kind, keyVersion: device.keyVersion, keyFingerprint: fingerprint }, req
  });
  // the key the device checks every command against (null when commands are not configured)
  const signer = commandSigner();
  return { deviceId: device.deviceId, state: device.state, keyFingerprint: fingerprint, keyVersion: device.keyVersion, serverCommandKey: signer ? signer.publicKey : null };
}

// ── devices (member) ─────────────────────────────────────────────────────────

async function owned(principal, deviceId) {
  const device = await devices.findOne(principal, { deviceId: String(deviceId) });
  if (!device) throw new DeviceError(404, 'DEVICE_NOT_FOUND', 'Device not found');
  return device;
}

async function list(principal, { limit, skip } = {}) {
  const [rows, total] = await Promise.all([
    devices.find(principal, {}, { limit, skip, sort: { createdAt: -1 } }),
    devices.count(principal, {})
  ]);
  const now = Date.now();
  return { devices: rows.map(d => present(d, now)), total };
}

async function get(principal, deviceId) {
  return present(await owned(principal, deviceId));
}

async function createInventory(principal, { displayName, platform } = {}, req = null) {
  const device = await devices.create(principal, {
    deviceId: crypto.randomUUID(), kind: 'inventory_only', state: 'inventory',
    displayName: displayNameOf(displayName), platform: platformOf(platform || 'other'),
    capabilities: { advertised: [], enabled: [], confirmed: {} }, createdAt: new Date()
  });
  await audit.record({ principal, action: 'device.inventory_create', resource: `device:${device.deviceId}`, req });
  return present(device);
}

async function rename(principal, deviceId, displayName, req = null) {
  const device = await owned(principal, deviceId);
  const name = displayNameOf(displayName);
  await Device.updateOne({ _id: device._id }, { $set: { displayName: name, updatedAt: new Date() } });
  await audit.record({ principal, action: 'device.rename', resource: `device:${device.deviceId}`, details: { from: device.displayName, to: name }, req });
  return present({ ...(device.toObject ? device.toObject() : device), displayName: name });
}

async function approve(principal, deviceId, { keyFingerprint: shown } = {}, req = null) {
  const device = await owned(principal, deviceId);
  if (device.state !== 'pending_approval') throw new DeviceError(409, 'DEVICE_NOT_AWAITING_APPROVAL', `The device is ${device.state}, not awaiting approval.`);
  if (typeof shown !== 'string' || shown.replace(/\s/g, '').toLowerCase() !== String(device.keyFingerprint).replace(/\s/g, '')) {
    throw new DeviceError(409, 'DEVICE_KEY_CHANGED', 'The key fingerprint does not match the device: compare it on both screens and try again.');
  }
  const approved = await Device.findOneAndUpdate(
    { _id: device._id, state: 'pending_approval', keyFingerprint: device.keyFingerprint },
    { $set: { state: 'active', approvedBy: String(principal.userId), approvedAt: new Date(), updatedAt: new Date() } },
    { new: true }
  );
  if (!approved) throw new DeviceError(409, 'DEVICE_KEY_CHANGED', 'The device changed while it was being approved; check it again.');
  await audit.record({ principal, action: 'device.approve', resource: `device:${device.deviceId}`, details: { keyFingerprint: device.keyFingerprint, keyVersion: device.keyVersion }, req });
  return present(approved);
}

async function revoke(principal, deviceId, req = null) {
  const device = await owned(principal, deviceId);
  if (device.kind === 'inventory_only') throw new DeviceError(409, 'DEVICE_HAS_NO_CREDENTIAL', 'An inventory record has no credential to revoke.');
  if (device.state === 'revoked') return present(device);
  const revoked = await Device.findOneAndUpdate(
    { _id: device._id },
    { $set: { state: 'revoked', revokedBy: String(principal.userId), revokedAt: new Date(), updatedAt: new Date() } },
    { new: true }
  );
  await audit.record({ principal, action: 'device.revoke', resource: `device:${device.deviceId}`, details: { previousState: device.state }, req });
  return present(revoked);
}

// ── signed device requests ──────────────────────────────────────────────────

/**
 * Check a device-signed request. Returns the device with its sequence advanced,
 * or throws a DeviceError. Headers: X-CF-Device, X-CF-Timestamp (ms),
 * X-CF-Seq, X-CF-Signature (base64).
 */
async function verifyDeviceRequest({ method, path, headers, rawBody, deviceIdInPath }) {
  const deviceId = String(headers['x-cf-device'] || '');
  const timestamp = Number(headers['x-cf-timestamp']);
  const seq = Number(headers['x-cf-seq']);
  const signature = headers['x-cf-signature'];
  if (!deviceId || !Number.isSafeInteger(timestamp) || !Number.isSafeInteger(seq) || seq < 1 || typeof signature !== 'string') {
    throw new DeviceError(401, 'DEVICE_SIGNATURE_MISSING', 'A device request needs X-CF-Device, X-CF-Timestamp, X-CF-Seq and X-CF-Signature.');
  }
  if (deviceIdInPath && deviceIdInPath !== deviceId) throw new DeviceError(403, 'DEVICE_MISMATCH', 'A device can only report for itself.');
  const now = Date.now();
  if (Math.abs(now - timestamp) > CLOCK_SKEW_MS) {
    throw new DeviceError(401, 'DEVICE_CLOCK_SKEW', `The request time is more than ${CLOCK_SKEW_MS / 60000} minutes from server time.`);
  }
  const device = await Device.findOne({ deviceId });
  if (!device || !device.publicKey) throw new DeviceError(401, 'DEVICE_UNKNOWN', 'Unknown device.');
  if (device.state === 'revoked') throw new DeviceError(401, 'DEVICE_REVOKED', 'This device was revoked. Enroll it again with a new code.');
  if (device.state !== 'active') throw new DeviceError(403, 'DEVICE_NOT_ACTIVE', 'This device is awaiting approval.');
  const message = requestMessage({ method, path, deviceId, timestamp, seq, bodyDigest: bodyDigest(rawBody) });
  if (!verifySignature(device.publicKey, message, signature)) throw new DeviceError(401, 'DEVICE_SIGNATURE_INVALID', 'The request signature does not match the device key.');
  const advanced = await Device.findOneAndUpdate(
    { _id: device._id, state: 'active', keyVersion: device.keyVersion, lastSeq: { $lt: seq } },
    { $set: { lastSeq: seq, lastSeenAt: new Date(now) } },
    { new: true }
  );
  if (!advanced) throw new DeviceError(409, 'DEVICE_REPLAY', 'That sequence number was already used, or the device changed: use a higher one.');
  return advanced;
}

async function heartbeat(device, body = {}) {
  const set = { updatedAt: new Date() };
  if (body.clientVersion !== undefined) set.clientVersion = clientVersionOf(body.clientVersion);
  if (body.capabilities !== undefined) {
    const reported = body.capabilities;
    if (!reported || typeof reported !== 'object' || Array.isArray(reported) || Object.keys(reported).length > 30 ||
      !Object.entries(reported).every(([name, state]) => /^[a-z0-9_.-]{1,40}$/.test(name) && CAPABILITY_STATES.includes(state))) {
      throw new DeviceError(400, 'DEVICE_CAPABILITIES_INVALID', `capabilities maps up to 30 names to one of ${CAPABILITY_STATES.join(', ')}`);
    }
    set.capabilities = { ...(device.capabilities || {}), confirmed: reported };
  }
  const updated = await Device.findOneAndUpdate({ _id: device._id }, { $set: set }, { new: true });
  return present(updated);
}

// ── telemetry and key rotation (DEV-04) ─────────────────────────────────────

const MAX_BATCH_EVENTS = 100;
const MAX_TELEMETRY_BYTES = 256 * 1024;
const MAX_EVENT_DATA_BYTES = 2048;
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Store a signed batch of events. Idempotent: a batch sent again (after a lost
 * acknowledgement, with a new sequence number) stores nothing twice, because
 * (deviceId, batchId, index) is unique. The answer acknowledges the batch ID,
 * and says how many events were new and how many were already stored.
 */
async function ingestTelemetry(device, body = {}) {
  const batchId = String(body.batchId || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(batchId)) throw new DeviceError(400, 'TELEMETRY_BATCH_INVALID', 'batchId is 8 to 64 letters, digits, - or _.');
  const events = body.events;
  if (!Array.isArray(events) || events.length < 1 || events.length > MAX_BATCH_EVENTS) {
    throw new DeviceError(400, 'TELEMETRY_BATCH_INVALID', `A batch holds 1 to ${MAX_BATCH_EVENTS} events.`);
  }
  const now = Date.now();
  const checked = events.map((event, index) => {
    const at = new Date(event && event.at);
    const data = event && event.data !== undefined ? event.data : {};
    const problem =
      !event || typeof event !== 'object' ? 'is not an object'
        : !DeviceEvent.TYPES.includes(event.type) ? `has a type other than ${DeviceEvent.TYPES.join(', ')}`
          : Number.isNaN(at.getTime()) || at.getTime() < now - MAX_EVENT_AGE_MS || at.getTime() > now + CLOCK_SKEW_MS ? 'has a time outside the last 7 days'
            : !data || typeof data !== 'object' || Array.isArray(data) || JSON.stringify(data).length > MAX_EVENT_DATA_BYTES ? `has data that is not an object of at most ${MAX_EVENT_DATA_BYTES} bytes`
              : null;
    if (problem) throw new DeviceError(400, 'TELEMETRY_EVENT_INVALID', `Event ${index} ${problem}.`);
    return { index, type: event.type, at, data };
  });
  let stored = 0;
  let duplicates = 0;
  for (const event of checked) {
    try {
      await DeviceEvent.create({ ...event, workspaceId: device.workspaceId, deviceId: device.deviceId, batchId, receivedAt: new Date(now) });
      stored += 1;
    } catch (error) {
      if (error.code !== 11000) throw error;
      duplicates += 1;
    }
  }
  return { batchId, accepted: checked.length, stored, duplicates };
}

const rotateMessage = ({ deviceId, keyVersion, publicKey }) =>
  ['cyberforge-device-rotate-v1', deviceId, String(keyVersion), publicKey].join('\n');

/**
 * Replace the device's key. The request is signed with the current key (checked
 * by verifyDeviceRequest), and `proof` is the new key's signature over
 * rotateMessage() for the next key version, so the device holds both. The switch
 * is one atomic update on the key version: a second rotation racing the first
 * fails instead of applying twice.
 */
async function rotateKey(device, body = {}, req = null) {
  const publicKey = body.publicKey;
  if (!publicKeyObject(publicKey)) throw new DeviceError(400, 'DEVICE_KEY_INVALID', 'publicKey is a 32-byte Ed25519 public key in base64.');
  if (publicKey === device.publicKey) throw new DeviceError(400, 'DEVICE_KEY_UNCHANGED', 'The new key is the current key.');
  const nextVersion = (device.keyVersion || 0) + 1;
  if (!verifySignature(publicKey, rotateMessage({ deviceId: device.deviceId, keyVersion: nextVersion, publicKey }), body.proof)) {
    throw new DeviceError(401, 'DEVICE_KEY_PROOF_INVALID', 'The proof is not the new key\'s signature for this device and key version.');
  }
  const fingerprint = keyFingerprint(publicKey);
  const rotated = await Device.findOneAndUpdate(
    { _id: device._id, state: 'active', keyVersion: device.keyVersion },
    { $set: { publicKey, keyFingerprint: fingerprint, updatedAt: new Date() }, $inc: { keyVersion: 1 } },
    { new: true }
  );
  if (!rotated) throw new DeviceError(409, 'DEVICE_KEY_CHANGED', 'The device key changed meanwhile; check the device and try again.');
  await audit.record({
    principal: { userId: device.createdBy, workspaceId: String(device.workspaceId) },
    action: 'device.key_rotate', resource: `device:${device.deviceId}`,
    details: { by: 'device', keyVersion: rotated.keyVersion, keyFingerprint: fingerprint }, req
  });
  return { deviceId: rotated.deviceId, keyVersion: rotated.keyVersion, keyFingerprint: fingerprint };
}

/** A device's recent events, for a member of its workspace. */
async function listEvents(principal, deviceId, { limit } = {}) {
  const device = await owned(principal, deviceId);
  const rows = await deviceEvents.find(principal, { deviceId: device.deviceId }, { limit, sort: { at: -1 } });
  return { events: rows.map(e => ({ type: e.type, at: e.at, data: e.data, batchId: e.batchId, receivedAt: e.receivedAt })) };
}

module.exports = {
  DeviceError,
  createEnrollment, cancelEnrollment, claim,
  list, get, createInventory, rename, approve, revoke,
  verifyDeviceRequest, heartbeat, ingestTelemetry, rotateKey, listEvents,
  // shared with clients and tests
  normalizeCode, claimMessage, requestMessage, rotateMessage, bodyDigest, keyFingerprint, connectionOf, coverageOf,
  ENROLLMENT_TTL_MS, CLOCK_SKEW_MS, ONLINE_MS, STALE_MS, MAX_BATCH_EVENTS, MAX_TELEMETRY_BYTES
};
