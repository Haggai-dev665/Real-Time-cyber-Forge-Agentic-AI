jest.mock('../../src/services/realtimeBus', () => ({ bus: new (require('events').EventEmitter)() }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn() }));

const express = require('express');
const jwt = require('jsonwebtoken');
const { bus } = require('../../src/services/realtimeBus');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { serve } = require('../helpers/http');
const userA = { _id: '507f1f77bcf86cd799439011', role: 'user' };
const userB = { _id: '507f1f77bcf86cd799439012', role: 'user' };
let client;

beforeAll(async () => {
  const app = express();
  app.use('/stream', require('../../src/routes/stream'));
  client = await serve(app);
});
afterAll(() => client.close());

async function framesUntil(reader, marker) {
  let text = '';
  while (!text.includes(marker)) {
    const { value, done } = await reader.read();
    if (done) throw new Error('Stream closed before marker');
    text += Buffer.from(value).toString('utf8');
  }
  return text;
}

test.each(['guest', 'forged', 'expired', 'userA', 'userB'])('private events are isolated for %s (B04 partial)', async identity => {
  const token = {
    guest: '', forged: 'forged',
    expired: jwt.sign({ userId: userA._id }, process.env.JWT_SECRET, { expiresIn: -60 }),
    userA: signSessionToken(userA), userB: signSessionToken(userB)
  }[identity];
  const abort = new AbortController();
  const response = await fetch(`${client.url}/stream?token=${token}`, { signal: abort.signal });
  const reader = response.body.getReader();
  try {
    expect(response.status).toBe(200);
    await framesUntil(reader, 'connected');
    bus.emit('event', { type: 'alert:new', data: { userId: userA._id, secret: 'private-A' } });
    bus.emit('event', { type: 'alert:new', data: { userId: { toString: () => userB._id }, secret: 'private-B' } });
    bus.emit('event', { type: 'public:test', data: { marker: 'finished-batch' } });
    const received = await framesUntil(reader, 'finished-batch');
    expect(received.includes('private-A')).toBe(identity === 'userA');
    expect(received.includes('private-B')).toBe(identity === 'userB');
  } finally {
    abort.abort();
    await reader.cancel().catch(() => {});
  }
});

test('an open stream stops receiving private events after token expiry', async () => {
  const abort = new AbortController();
  const token = signSessionToken(userA);
  const response = await fetch(`${client.url}/stream?token=${token}`, { signal: abort.signal });
  const reader = response.body.getReader();
  let clock;
  try {
    await framesUntil(reader, 'connected');
    const expiredTime = Date.now() + 25 * 60 * 60 * 1000;
    clock = jest.spyOn(Date, 'now').mockReturnValue(expiredTime);
    bus.emit('event', { type: 'alert:new', data: { userId: userA._id, secret: 'late-private' } });
    bus.emit('event', { type: 'public:test', data: { marker: 'expired-batch' } });
    const received = await framesUntil(reader, 'expired-batch');
    expect(received).not.toContain('late-private');
  } finally {
    clock?.mockRestore();
    abort.abort();
    await reader.cancel().catch(() => {});
  }
});
