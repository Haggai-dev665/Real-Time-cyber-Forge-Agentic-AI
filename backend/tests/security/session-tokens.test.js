const { spawnSync } = require('child_process');
const path = require('path');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../../src/config/auth.config');
const { signSessionToken, verifySessionToken } = require('../../src/services/sessionTokens');

const user = { _id: '507f1f77bcf86cd799439011', email: 'member@example.com', role: 'user' };

describe('signing configuration (B05)', () => {
  test.each([undefined, '', 'short', 'cyber-forge-secret-key',
    'your-super-secure-jwt-secret-key-here-make-it-long-and-random',
    'replace-me-with-a-secret-at-least-32-bytes', ' '.repeat(40)])('rejects missing/default key %#', secret => {
    expect(() => getJwtSecret({ JWT_SECRET: secret })).toThrow('JWT_SECRET');
  });

  test('accepts explicit generated signing material', () => {
    expect(getJwtSecret()).toBe(process.env.JWT_SECRET);
  });

  test('server exits before importing services when signing configuration is invalid', () => {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../../src/server.js')], {
      // Keep dotenv away from the developer's backend/.env.
      cwd: __dirname,
      env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: 'placeholder' },
      encoding: 'utf8', timeout: 5000
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('JWT_SECRET must be a generated secret');
    expect(result.stdout).not.toMatch(/Appwrite|Datadog|MongoDB|running on port/);
  });
});

describe('session contract', () => {
  const now = () => Math.floor(Date.now() / 1000);
  const signed = (claims, options = {}) => jwt.sign(claims, process.env.JWT_SECRET, options);

  test('round trips an issued session with a bounded expiration', () => {
    const decoded = verifySessionToken(signSessionToken(user));
    expect(decoded).toMatchObject({ userId: user._id, email: user.email, role: 'user' });
    expect(decoded.exp - decoded.iat).toBe(24 * 60 * 60);
  });

  test.each([
    { userId: user._id },
    { userId: 'not-a-mongo-user', exp: 9999999999 },
    { userId: { $ne: null }, exp: 9999999999 },
    { exp: 9999999999 },
    { userId: user._id, iat: 9999999998, exp: 9999999999 }
  ])('rejects malformed identity or lifetime claims %#', claims => {
    expect(() => verifySessionToken(signed(claims))).toThrow();
  });

  test('rejects a token without an issued-at claim even during refresh', () => {
    const token = signed({ userId: user._id, exp: now() + 60 }, { noTimestamp: true });
    expect(() => verifySessionToken(token, { forRefresh: true })).toThrow();
  });

  test('rejects unexpected signing algorithms and old fallback keys', () => {
    const claims = { userId: user._id, exp: now() + 60 };
    expect(() => verifySessionToken(signed(claims, { algorithm: 'HS384' }))).toThrow();
    expect(() => verifySessionToken(jwt.sign(claims, 'cyber-forge-secret-key'))).toThrow();
  });

  test('expired sessions only refresh inside the seven-day window', () => {
    const recent = signed({ userId: user._id, iat: now() - 3600, exp: now() - 60 });
    expect(() => verifySessionToken(recent)).toThrow('jwt expired');
    expect(verifySessionToken(recent, { forRefresh: true }).userId).toBe(user._id);
    const old = signed({ userId: user._id, iat: now() - 8 * 86400, exp: now() - 7 * 86400 });
    expect(() => verifySessionToken(old, { forRefresh: true })).toThrow();
  });
});
