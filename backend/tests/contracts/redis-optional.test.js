// Redis backs one cache. The backend must start, and say so, when Redis is
// missing, malformed, unreachable or refuses the credentials (finding F22).
jest.mock('redis', () => ({ createClient: jest.fn() }));

const redis = require('redis');

function fakeClient({ connect = async () => {}, ping = async () => 'PONG' } = {}) {
  const store = new Map();
  return {
    on: jest.fn(),
    connect: jest.fn(connect),
    ping: jest.fn(ping),
    disconnect: jest.fn(async () => {}),
    get: jest.fn(async key => store.get(key) ?? null),
    set: jest.fn(async (key, value) => { store.set(key, value); return 'OK'; })
  };
}

// A fresh copy of the service for each case; it is a module-level singleton.
function freshService() {
  let service;
  jest.isolateModules(() => { service = require('../../src/services/redis'); });
  return service;
}

let warn;
let log;
beforeEach(() => {
  redis.createClient.mockReset();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.REDIS_URL;
  warn.mockRestore();
  log.mockRestore();
});

test('a reachable, authorized Redis is used and reported', async () => {
  const client = fakeClient();
  redis.createClient.mockReturnValue(client);
  process.env.REDIS_URL = 'rediss://default:secret@cache.example.net:6380';
  const service = freshService();

  expect(service.status()).toEqual({ mode: 'not-started', reason: null });
  await expect(service.connectRedis()).resolves.toBeUndefined();

  expect(redis.createClient.mock.calls[0][0].url).toBe(process.env.REDIS_URL);
  expect(client.ping).toHaveBeenCalledTimes(1);
  expect(service.status()).toEqual({ mode: 'redis', reason: null });
  expect(warn).not.toHaveBeenCalled();
});

test.each([
  ['a value that is not a Redis URL', () => { throw new TypeError('Invalid protocol'); }, 'invalid REDIS_URL'],
  ['an unreachable host', () => fakeClient({ connect: async () => { throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:6379'), { code: 'ECONNREFUSED' }); } }), 'ECONNREFUSED'],
  ['credentials Redis refuses', () => fakeClient({ ping: async () => { throw Object.assign(new Error('NOAUTH Authentication required.'), { name: 'ErrorReply' }); } }), 'ErrorReply']
])('%s does not stop startup; the cache falls back to memory', async (label, create, reason) => {
  let client = null;
  redis.createClient.mockImplementation(() => { client = create(); return client; });
  process.env.REDIS_URL = 'cache.example.net:18585';
  const service = freshService();

  await expect(service.connectRedis()).resolves.toBeUndefined();
  expect(service.status()).toEqual({ mode: 'memory', reason });
  expect(service.isReady()).toBe(true);

  // The fallback is a working cache, and a half-open client is not left retrying.
  await service.set('mem:domain:example.com', '{"visits":1}', 60);
  expect(await service.get('mem:domain:example.com')).toBe('{"visits":1}');
  expect(await service.get('missing')).toBeNull();
  if (client) expect(client.disconnect).toHaveBeenCalledTimes(1);
});

test('nothing from the configured address or password is logged or reported', async () => {
  redis.createClient.mockImplementation(() => fakeClient({
    connect: async () => { throw new Error('getaddrinfo ENOTFOUND secret-host.example.net using password hunter2'); }
  }));
  process.env.REDIS_URL = 'redis://default:hunter2@secret-host.example.net:6379';
  const service = freshService();
  await service.connectRedis();

  const output = JSON.stringify([service.status(), warn.mock.calls, log.mock.calls]);
  expect(output).not.toContain('hunter2');
  expect(output).not.toContain('secret-host');
  expect(warn.mock.calls[0][0]).toContain('caching in process memory');
});

test('/health reports which cache is in use', () => {
  const server = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'server.js'), 'utf8');
  expect(server).toContain('cache: cacheStatus().mode');
  expect(server).toContain("const { connectRedis, status: cacheStatus } = require('./services/redis');");
});
