// The WebSocket transport (SEC-02, B04): a socket is bound to the account its
// session token proves, accepts nothing before that, and is sent nothing that
// belongs to another account. Real sockets on a loopback server.
jest.mock('../../src/services/otx', () => {
  const otx = new (require('events').EventEmitter)();
  otx.startPolling = jest.fn();
  otx.getRecentThreats = jest.fn(async () => [{ id: 'otx-1' }]);
  return otx;
});
jest.mock('../../src/services/analysisService', () => ({
  analyzePageData: jest.fn(async page => ({ riskLevel: 'high', hasThreats: true, url: page.url, threats: ['phishing'], severity: 'high' }))
}));
jest.mock('../../src/services/threatService', () => ({ detectThreats: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ logActivity: jest.fn() }));

const http = require('http');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const { analyzePageData } = require('../../src/services/analysisService');
const { setupWebSocketServer, wsManager } = require('../../src/services/websocket');
const { signSessionToken } = require('../../src/services/sessionTokens');

const userA = { _id: '507f1f77bcf86cd799439011', email: 'a@example.com', role: 'user' };
const userB = { _id: '507f1f77bcf86cd799439012', email: 'b@example.com', role: 'user' };

let server;
let wss;
let url;
let sockets = [];
let consoleSpies;

beforeAll(async () => {
  consoleSpies = ['log', 'error'].map(method => jest.spyOn(console, method).mockImplementation(() => {}));
  server = http.createServer();
  wss = new WebSocket.Server({ server, path: '/ws' });
  setupWebSocketServer(wss, new Map());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `ws://127.0.0.1:${server.address().port}/ws`;
});
afterAll(async () => {
  consoleSpies.forEach(spy => spy.mockRestore());
  await new Promise(resolve => wss.close(resolve));
  await new Promise(resolve => server.close(resolve));
});
afterEach(async () => {
  wsManager.authDeadlineMs = 10000;
  await Promise.all(sockets.map(socket => socket.shut()));
  sockets = [];
});

/** A client that records what it is sent. */
async function connect(headers) {
  const ws = new WebSocket(url, { headers });
  const received = [];
  const waiting = [];
  let closed = null;
  const closing = new Promise(resolve => ws.on('close', (code, reason) => { closed = { code, reason: reason.toString() }; resolve(closed); }));
  ws.on('message', data => {
    const message = JSON.parse(data.toString());
    received.push(message);
    for (const waiter of [...waiting]) {
      if (waiter.type === message.type) {
        waiting.splice(waiting.indexOf(waiter), 1);
        waiter.resolve(message);
      }
    }
  });
  ws.on('error', () => {});
  const socket = {
    received,
    send: message => ws.send(typeof message === 'string' ? message : JSON.stringify(message)),
    /** The next message of a type, including one that already arrived. */
    next(type) {
      const already = received.find(message => message.type === type && !message.taken);
      if (already) { already.taken = true; return Promise.resolve(already); }
      return new Promise(resolve => waiting.push({ type, resolve: message => { message.taken = true; resolve(message); } }));
    },
    closed: () => closing,
    isClosed: () => closed,
    /** Everything the server has sent so far, once it has answered a heartbeat. */
    async settled() {
      socket.send({ type: 'heartbeat' });
      await socket.next(socket.authenticated ? 'heartbeat_response' : 'error');
      return received;
    },
    shut() {
      if (closed) return Promise.resolve();
      ws.close();
      return closing;
    }
  };
  sockets.push(socket);
  await socket.next('connection_established');
  return socket;
}

async function signedIn(user, type) {
  const socket = await connect();
  socket.send({ type: 'authenticate', token: signSessionToken(user) });
  await socket.next('authentication_confirmed');
  socket.authenticated = true;
  if (type) {
    socket.send({ type: 'identify', client_type: type });
    await socket.next('identification_confirmed');
  }
  return socket;
}

const types = socket => socket.received.map(message => message.type);

describe('before a socket has proved who it is', () => {
  test('identification, scans and data requests are refused', async () => {
    const socket = await connect();
    for (const message of [
      { type: 'identify', client_type: 'desktop' },
      { type: 'desktop_connected' },
      { type: 'mobile_connected', device_info: {} },
      { type: 'page_visit', data: { url: 'https://example.com' } },
      { type: 'request_initial_threats' },
      { type: 'request_data', data_type: 'dashboard' },
      { type: 'threat_scan' }
    ]) {
      socket.send(message);
      expect(await socket.next('error')).toMatchObject({ code: 'unauthenticated' });
    }
    expect(analyzePageData).not.toHaveBeenCalled();
    expect(wsManager.desktopClients.size).toBe(0);
    expect(types(socket).filter(type => type !== 'error')).toEqual(['connection_established']);
  });

  test('it receives no broadcast of any kind', async () => {
    const socket = await connect();
    wsManager.broadcastToDesktops({ type: 'session_update', data: { secret: 1 } }, userA._id);
    wsManager.broadcastToMobiles({ type: 'network_capture', data: { secret: 2 } }, userA._id);
    wsManager.broadcastThreat({ indicator: 'public-intel' });
    wsManager.broadcastThreat({ indicator: 'private', userId: userA._id });
    await socket.settled();
    expect(types(socket).filter(type => type !== 'error')).toEqual(['connection_established']);
  });

  test('a forged or expired token is refused and the socket is closed', async () => {
    const expired = jwt.sign({ userId: userA._id }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: -60 });
    for (const token of ['forged', expired, undefined, 42]) {
      const socket = await connect();
      socket.send({ type: 'authenticate', token, userId: userA._id });
      await socket.next('authentication_failed');
      expect(await socket.closed()).toMatchObject({ code: 4401 });
    }
  });

  test('a socket that never authenticates is closed after the deadline', async () => {
    wsManager.authDeadlineMs = 60;
    const socket = await connect();
    expect(await socket.closed()).toMatchObject({ code: 4401, reason: 'authentication required' });
  });

  test('a message that is not an object with a type is rejected', async () => {
    const socket = await connect();
    for (const raw of ['not json', '[]', 'null', '{"no":"type"}']) {
      socket.send(raw);
      expect(await socket.next('error')).toMatchObject({ message: 'Invalid message format' });
    }
  });
});

describe('a signed-in socket', () => {
  test('is the account its token proves, whatever userId the message claims', async () => {
    const socket = await connect();
    socket.send({ type: 'authenticate', token: signSessionToken(userA), userId: userB._id });
    expect(await socket.next('authentication_confirmed')).toMatchObject({ userId: userA._id });
    socket.authenticated = true;
    socket.send({ type: 'identify', client_type: 'desktop' });
    await socket.next('identification_confirmed');

    wsManager.broadcastToDesktops({ type: 'session_update', data: { for: 'B' } }, userB._id);
    wsManager.broadcastToDesktops({ type: 'risk_score_update', data: { for: 'A' } }, userA._id);
    expect(await socket.next('risk_score_update')).toMatchObject({ data: { for: 'A' } });
    expect(types(socket)).not.toContain('session_update');
  });

  test('can authenticate with the Authorization header when it connects', async () => {
    const socket = await connect({ Authorization: `Bearer ${signSessionToken(userA)}` });
    socket.authenticated = true;
    socket.send({ type: 'identify', client_type: 'mobile' });
    expect(await socket.next('identification_confirmed')).toMatchObject({ clientType: 'mobile' });

    // A session that does not verify is closed at once, with no greeting.
    const refused = new WebSocket(url, { headers: { Authorization: 'Bearer forged' } });
    const messages = [];
    refused.on('message', data => messages.push(data.toString()));
    refused.on('error', () => {});
    expect(await new Promise(resolve => refused.on('close', code => resolve(code)))).toBe(4401);
    expect(messages).toEqual([]);
  });

  test('does not keep the session token', async () => {
    await signedIn(userA, 'desktop');
    for (const client of wsManager.clients.values()) {
      expect(client.token).toBeUndefined();
      expect(JSON.stringify({ ...client, socket: undefined, authTimer: undefined })).not.toContain('eyJ');
    }
  });

  test('cannot register as anything but a desktop or mobile client', async () => {
    const socket = await signedIn(userA);
    socket.send({ type: 'identify', client_type: 'admin-console' });
    expect(await socket.next('identification_confirmed')).toMatchObject({ clientType: 'unknown' });
    expect(wsManager.desktopClients.size + wsManager.mobileClients.size).toBe(0);
  });
});

describe('broadcasts', () => {
  test('desktop and mobile broadcasts reach only the owning account\'s sockets of that kind', async () => {
    const desktopA = await signedIn(userA, 'desktop');
    const mobileA = await signedIn(userA, 'mobile');
    const desktopB = await signedIn(userB, 'desktop');
    const mobileB = await signedIn(userB, 'mobile');

    wsManager.broadcastToDesktops({ type: 'session_update', data: { sessions: ['a-private'] } }, userA._id);
    wsManager.broadcastToMobiles({ type: 'network_capture', data: { flows: ['a-private'] } }, { toString: () => userA._id });
    await Promise.all([desktopA.next('session_update'), mobileA.next('network_capture')]);
    for (const socket of [desktopA, mobileA, desktopB, mobileB]) await socket.settled();

    expect(types(desktopA)).toContain('session_update');
    expect(types(desktopA)).not.toContain('network_capture');
    expect(types(mobileA)).toContain('network_capture');
    expect(types(mobileA)).not.toContain('session_update');
    for (const other of [desktopB, mobileB]) {
      expect(types(other)).not.toContain('session_update');
      expect(types(other)).not.toContain('network_capture');
    }
  });

  test('a broadcast with no owner reaches nobody', async () => {
    const desktopA = await signedIn(userA, 'desktop');
    wsManager.broadcastToDesktops({ type: 'session_update', data: {} });
    wsManager.broadcastToDesktops({ type: 'session_update', data: {} }, null);
    await desktopA.settled();
    expect(types(desktopA)).not.toContain('session_update');
  });

  test('public threat intelligence reaches every signed-in socket; a threat that names an account reaches that account', async () => {
    const a = await signedIn(userA, 'desktop');
    const b = await signedIn(userB, 'desktop');

    wsManager.broadcastThreat({ indicator: 'public-intel' });
    expect((await a.next('otx_threat')).threat.indicator).toBe('public-intel');
    expect((await b.next('otx_threat')).threat.indicator).toBe('public-intel');

    wsManager.broadcastThreat({ indicator: 'a-private', userId: userA._id });
    expect((await a.next('otx_threat')).threat.indicator).toBe('a-private');
    await b.settled();
    expect(b.received.filter(message => message.type === 'otx_threat').map(message => message.threat.indicator)).toEqual(['public-intel']);
  });

  test('what one account\'s socket triggers is sent to that account only', async () => {
    const desktopA = await signedIn(userA, 'desktop');
    const mobileA = await signedIn(userA, 'mobile');
    const desktopB = await signedIn(userB, 'desktop');
    const mobileB = await signedIn(userB, 'mobile');

    desktopA.send({ type: 'page_visit', data: { url: 'https://a-visited.example/', timestamp: 't' } });
    expect((await mobileA.next('page_analyzed')).data.url).toBe('https://a-visited.example/');
    await mobileA.next('threat_alert');

    const phoneA = await connect();
    phoneA.send({ type: 'authenticate', token: signSessionToken(userA) });
    await phoneA.next('authentication_confirmed');
    phoneA.authenticated = true;
    phoneA.send({ type: 'mobile_connected', device_info: { model: 'a-phone' } });
    expect((await desktopA.next('mobile_connected')).data.deviceInfo).toEqual({ model: 'a-phone' });

    for (const other of [desktopB, mobileB]) {
      await other.settled();
      expect(types(other).filter(type => ['page_analyzed', 'threat_alert', 'mobile_connected', 'analysis_result'].includes(type))).toEqual([]);
    }
  });
});

describe('when the session runs out', () => {
  test('the socket stops receiving, its next message is refused, and it is closed', async () => {
    const socket = await signedIn(userA, 'desktop');
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 25 * 60 * 60 * 1000);
    try {
      wsManager.broadcastToDesktops({ type: 'session_update', data: {} }, userA._id);
      wsManager.broadcastThreat({ indicator: 'public-intel' });
      socket.send({ type: 'request_initial_threats' });
      expect(await socket.next('error')).toMatchObject({ code: 'unauthenticated' });
      expect(await socket.closed()).toMatchObject({ code: 4403 });
      expect(types(socket)).not.toContain('session_update');
      expect(types(socket)).not.toContain('otx_threat');
      expect(types(socket)).not.toContain('initial_threats');
    } finally {
      clock.mockRestore();
    }
  });
});
