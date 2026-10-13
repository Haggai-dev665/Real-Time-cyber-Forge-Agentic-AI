// The live event stream (SEC-02, B04): who may receive which event, how a
// subscriber proves who it is, and what happens when its session ends.
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/services/websocket', () => ({ wsManager: { broadcastThreat: jest.fn() } }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../../src/models/User');
const logger = require('../../src/utils/logger');
const realtimeBus = require('../../src/services/realtimeBus');
const { wsManager } = require('../../src/services/websocket');
const { signSessionToken } = require('../../src/services/sessionTokens');
const streamRoutes = require('../../src/routes/stream');
const { redactUrl } = require('../../src/utils/redactUrl');
const { serve } = require('../helpers/http');

const account = id => ({ _id: id, email: `${id}@example.com`, role: 'user', isActive: true, isLocked: () => false, activity: {}, save: jest.fn() });
const userA = account('507f1f77bcf86cd799439011');
const userB = account('507f1f77bcf86cd799439012');
const bearer = user => ({ Authorization: `Bearer ${signSessionToken(user)}` });
let client;
let open = [];

beforeAll(async () => {
  // A public event type exists only so a guest's stream has something to wait for.
  realtimeBus.VISIBILITY['test:public'] = 'public_intelligence';
  const app = express();
  app.use(express.json());
  app.use('/stream', streamRoutes);
  client = await serve(app);
});
afterAll(() => client.close());
beforeEach(() => User.findById.mockImplementation(async id => [userA, userB].find(user => user._id === String(id)) || null));
afterEach(async () => {
  for (const stream of open) await stream.close();
  open = [];
});

async function subscribe(path = '/stream', headers = {}) {
  const abort = new AbortController();
  const response = await fetch(`${client.url}${path}`, { headers, signal: abort.signal });
  if (response.status !== 200) return { status: response.status, body: await response.json() };
  const reader = response.body.getReader();
  let text = '';
  const stream = {
    status: 200,
    async until(marker) {
      while (!text.includes(marker)) {
        const { value, done } = await reader.read();
        if (done) throw new Error(`Stream closed before "${marker}"; received: ${text}`);
        text += Buffer.from(value).toString('utf8');
      }
      return text;
    },
    async ended() {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return text;
        text += Buffer.from(value).toString('utf8');
      }
    },
    async close() {
      abort.abort();
      await reader.cancel().catch(() => {});
    }
  };
  open.push(stream);
  await stream.until('event: connected');
  return stream;
}

const marker = name => realtimeBus.emit('test:public', { marker: name });

describe('who receives what', () => {
  test.each([['a guest', null], ['account A', userA], ['account B', userB]])('%s sees only what it may', async (label, user) => {
    const stream = await subscribe('/stream', user ? bearer(user) : {});
    realtimeBus.emit('alert:new', { userId: userA._id, secret: 'private-A' });
    realtimeBus.emit('scan:update', { userId: { toString: () => userB._id }, secret: 'private-B' });
    realtimeBus.emit('metrics:update', { secret: 'service-heartbeat' });
    marker('batch-done');
    const received = await stream.until('batch-done');

    expect(received.includes('private-A')).toBe(user === userA);
    expect(received.includes('private-B')).toBe(user === userB);
    expect(received.includes('service-heartbeat')).toBe(user !== null);
  });

  test('a private event with no owner is delivered to nobody, signed in or not', async () => {
    const guest = await subscribe('/stream');
    const member = await subscribe('/stream', bearer(userA));
    expect(realtimeBus.emit('threat:new', { indicator: 'https://leaked.example/', secret: 'ownerless' })).toBeNull();
    expect(realtimeBus.emit('never:classified', { secret: 'ownerless' })).toBeNull();
    marker('ownerless-done');

    expect(await guest.until('ownerless-done')).not.toContain('ownerless"');
    expect(await member.until('ownerless-done')).not.toContain('ownerless"');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('has no owner'));
  });

  test('the same rule decides delivery for every transport', () => {
    const owned = realtimeBus.emit('alert:new', { userId: userA._id });
    const later = Date.now() + 1000;
    expect(owned).toMatchObject({ visibility: 'workspace', owner: userA._id });
    expect(realtimeBus.canReceive(owned, { userId: userA._id, expiresAt: later })).toBe(true);
    expect(realtimeBus.canReceive(owned, { userId: userB._id, expiresAt: later })).toBe(false);
    expect(realtimeBus.canReceive(owned, { userId: userA._id, expiresAt: Date.now() - 1 })).toBe(false);
    expect(realtimeBus.canReceive(owned, null)).toBe(false);
    expect(realtimeBus.canReceive({ type: 'x', data: {} }, { userId: userA._id, expiresAt: later })).toBe(false);
  });

  test('a threat that names an account is forwarded to the socket layer with that account', () => {
    realtimeBus.emit('threat:new', { userId: userA._id, indicator: 'https://a.example/' });
    expect(wsManager.broadcastThreat).toHaveBeenCalledWith(expect.objectContaining({ userId: userA._id }));
    wsManager.broadcastThreat.mockClear();
    realtimeBus.emit('threat:new', { indicator: 'https://nobody.example/' });
    expect(wsManager.broadcastThreat).not.toHaveBeenCalled();
  });
});

describe('proving who is subscribing', () => {
  test('credentials that do not verify are refused, not downgraded to a guest', async () => {
    const expired = jwt.sign({ userId: userA._id }, process.env.JWT_SECRET, { expiresIn: -60 });
    for (const headers of [{ Authorization: 'Bearer forged' }, { Authorization: `Bearer ${expired}` }, { Authorization: 'Basic abc' }]) {
      expect((await subscribe('/stream', headers)).status).toBe(401);
    }
    expect((await subscribe('/stream?ticket=not-a-ticket')).status).toBe(401);
  });

  test('a session token in the URL is not accepted, even a valid one', async () => {
    const refused = await subscribe(`/stream?token=${signSessionToken(userA)}`);
    expect(refused.status).toBe(401);
    expect(refused.body.message).toMatch(/Authorization header/);
  });

  test('a ticket needs a session, opens one stream for that account, and works once', async () => {
    expect((await client.request('/stream/ticket', { method: 'POST' })).status).toBe(401);

    const issued = await client.request('/stream/ticket', { method: 'POST', headers: bearer(userA) });
    expect(issued.status).toBe(200);
    expect(issued.body.ticket).toMatch(/^[\w-]{40,}$/);
    expect(issued.body.ticket).not.toContain(signSessionToken(userA).split('.')[2]);

    const stream = await subscribe(`/stream?ticket=${issued.body.ticket}`);
    realtimeBus.emit('alert:new', { userId: userA._id, secret: 'via-ticket' });
    realtimeBus.emit('alert:new', { userId: userB._id, secret: 'not-mine' });
    marker('ticket-done');
    const received = await stream.until('ticket-done');
    expect(received).toContain('via-ticket');
    expect(received).not.toContain('not-mine');

    expect((await subscribe(`/stream?ticket=${issued.body.ticket}`)).status).toBe(401);
  });

  test('a ticket stops working after a minute', async () => {
    const issued = await client.request('/stream/ticket', { method: 'POST', headers: bearer(userA) });
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61 * 1000);
    try {
      expect((await subscribe(`/stream?ticket=${issued.body.ticket}`)).status).toBe(401);
    } finally {
      clock.mockRestore();
    }
  });
});

describe('when a session ends', () => {
  test('the stream is closed at the moment the session expires', async () => {
    const shortLived = jwt.sign({ userId: userA._id }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: 1 });
    const stream = await subscribe('/stream', { Authorization: `Bearer ${shortLived}` });
    const received = await stream.ended();
    expect(received).toContain('event: closed');
    expect(received).toContain('"reason":"expired"');
  });

  test('signing out closes that account\'s streams and leaves the others open', async () => {
    const mine = await subscribe('/stream', bearer(userA));
    const theirs = await subscribe('/stream', bearer(userB));
    streamRoutes.closeStreamsFor(userA._id, 'signed_out');
    expect(await mine.ended()).toContain('"reason":"signed_out"');

    realtimeBus.emit('alert:new', { userId: userB._id, secret: 'still-open' });
    expect(await theirs.until('still-open')).toContain('still-open');
  });

  test('a deactivated, locked or deleted account loses its open streams on the next check', async () => {
    const userC = account('507f1f77bcf86cd799439013');
    const userD = account('507f1f77bcf86cd799439014');
    const records = { [userA._id]: { ...userA, isActive: false }, [userB._id]: userB, [userC._id]: { ...userC, isLocked: () => true } };
    const streams = {};
    for (const user of [userA, userB, userC, userD]) streams[user._id] = await subscribe('/stream', bearer(user));

    User.findById.mockImplementation(async id => records[String(id)] || null);
    await streamRoutes.revalidateStreams();

    for (const user of [userA, userC, userD]) expect(await streams[user._id].ended()).toContain('"reason":"revoked"');
    realtimeBus.emit('alert:new', { userId: userB._id, secret: 'kept' });
    expect(await streams[userB._id].until('kept')).toContain('kept');
  });

  test('a database error during the check does not close anyone\'s stream', async () => {
    const stream = await subscribe('/stream', bearer(userA));
    User.findById.mockRejectedValue(new Error('database unavailable'));
    await streamRoutes.revalidateStreams();
    realtimeBus.emit('alert:new', { userId: userA._id, secret: 'survived' });
    expect(await stream.until('survived')).toContain('survived');
  });
});

describe('reconnecting', () => {
  test('frames carry an event ID and the client is told how long to wait before retrying', async () => {
    const stream = await subscribe('/stream', bearer(userA));
    const sent = realtimeBus.emit('alert:new', { userId: userA._id, secret: 'with-id' });
    const received = await stream.until('with-id');
    expect(received).toMatch(/^retry: \d+$/m);
    expect(received).toContain(`id: ${sent.id}\nevent: alert:new\n`);
  });

  test('a client that reconnects is sent what it missed once, and nothing of another account', async () => {
    const first = await subscribe('/stream', bearer(userA));
    const seen = realtimeBus.emit('alert:new', { userId: userA._id, secret: 'seen-before-drop' });
    await first.until('seen-before-drop');
    await first.close();

    realtimeBus.emit('alert:new', { userId: userA._id, secret: 'missed-while-away' });
    realtimeBus.emit('alert:new', { userId: userB._id, secret: 'other-account' });

    const again = await subscribe('/stream', { ...bearer(userA), 'Last-Event-ID': seen.id });
    marker('replay-done');
    const replayed = await again.until('replay-done');
    expect(replayed.split('missed-while-away').length - 1).toBe(1);
    expect(replayed).not.toContain('seen-before-drop');
    expect(replayed).not.toContain('other-account');

    // Another account reconnecting with that ID gets its own event and no more.
    const other = await subscribe(`/stream?lastEventId=${seen.id}`, bearer(userB));
    marker('other-done');
    const theirs = await other.until('other-done');
    expect(theirs).toContain('other-account');
    expect(theirs).not.toContain('missed-while-away');
  });

  test('an ID from another run, or events older than the replay window, replay nothing', () => {
    const sent = realtimeBus.emit('alert:new', { userId: userA._id });
    expect(realtimeBus.eventsAfter('ffffffff-1')).toEqual([]);
    expect(realtimeBus.eventsAfter('garbage')).toEqual([]);
    expect(realtimeBus.eventsAfter(undefined)).toEqual([]);
    const before = `${sent.id.split('-')[0]}-0`;
    expect(realtimeBus.eventsAfter(before).length).toBeGreaterThan(0);
    expect(realtimeBus.eventsAfter(before, Date.now() + realtimeBus.REPLAY_WINDOW_MS + 1000)).toEqual([]);
  });
});

test('credentials in a query string are removed before a URL is logged', () => {
  expect(redactUrl('/api/stream?ticket=abc123&lastEventId=9')).toBe('/api/stream?ticket=[redacted]&lastEventId=9');
  expect(redactUrl('/api/stream?token=eyJhbGciOi.payload.sig')).toBe('/api/stream?token=[redacted]');
  expect(redactUrl('/x?a=1&api_key=k&b=2#frag')).toBe('/x?a=1&api_key=[redacted]&b=2#frag');
  expect(redactUrl('/api/threats?limit=5')).toBe('/api/threats?limit=5');
  expect(redactUrl(undefined)).toBe('');
});
