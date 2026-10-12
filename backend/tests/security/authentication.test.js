jest.mock('../../src/models/User', () => {
  const User = jest.fn();
  User.findOne = jest.fn();
  User.findById = jest.fn();
  return User;
});
jest.mock('../../src/services/appwriteService', () => ({
  appwriteService: { isInitialized: true, registerAppwriteUser: jest.fn() }
}));
jest.mock('bcryptjs', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('firebase-admin', () => ({ apps: [{}], auth: jest.fn() }));
jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
// These tests target authentication; rate-limit counters are outside this suite.
jest.mock('express-rate-limit', () => () => (_req, _res, next) => next());

const express = require('express');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const { appwriteService } = require('../../src/services/appwriteService');
const controller = require('../../src/controllers/authController');
const { signSessionToken } = require('../../src/services/sessionTokens');
const { auth, authorize, optionalAuth } = require('../../src/middleware/auth');
const { optionalFirebaseAuth } = require('../../src/middleware/firebaseAuth');
const routes = require('../../src/routes/auth');
const { serve } = require('../helpers/http');

const USER_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439012';
const registration = {
  email: 'member@example.com', password: 'SecurePassword1!', firstName: 'Test', lastName: 'Member'
};
let user;
let client;
let verifyIdToken;
let errorLog;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', routes);
  app.get('/private', auth, (req, res) => res.json(req.user));
  app.get('/admin', auth, authorize('admin'), (req, res) => res.json(req.user));
  app.get('/optional', optionalAuth, (req, res) => res.json({ user: req.user || null }));
  app.get('/optional-firebase', optionalFirebaseAuth, (req, res) => res.json({ user: req.user || null }));
  client = await serve(app);
  errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(async () => { await client.close(); errorLog.mockRestore(); });

beforeEach(() => {
  User.mockReset();
  User.findOne.mockReset();
  User.findById.mockReset();
  user = {
    _id: USER_ID, email: registration.email, firstName: 'Test', lastName: 'Member',
    role: 'user', isActive: true, firebaseUid: 'firebase-member', provider: 'google.com',
    activity: {}, passwordHash: 'hash', isLocked: jest.fn(() => false), save: jest.fn()
  };
  User.mockImplementation(data => ({ ...user, ...data }));
  User.findOne.mockResolvedValue(null);
  User.findById.mockResolvedValue(user);
  appwriteService.registerAppwriteUser.mockResolvedValue({ $id: 'appwrite-member' });
  bcrypt.hash.mockResolvedValue('hash');
  bcrypt.compare.mockResolvedValue(true);
  admin.apps.splice(0, admin.apps.length, {});
  verifyIdToken = jest.fn().mockResolvedValue({
    uid: 'firebase-member', email: registration.email, email_verified: true,
    name: 'Test Member', firebase: { sign_in_provider: 'google.com' }
  });
  admin.auth.mockReturnValue({ verifyIdToken });
});

describe('ordinary-member registration (B01)', () => {
  test.each(['admin', 'analyst', 'expert', ['user', 'admin'], { role: 'admin' }])('rejects privileged/malformed role %#', async role => {
    const response = await client.request('/api/auth/register', { method: 'POST', body: { ...registration, role } });
    expect(response.status).toBe(400);
    expect(User).not.toHaveBeenCalled();
    expect(appwriteService.registerAppwriteUser).not.toHaveBeenCalled();
  });

  test.each([undefined, 'user'])('creates only a member with role %s', async role => {
    const response = await client.request('/api/auth/register', { method: 'POST', body: { ...registration, role } });
    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('user');
    expect(appwriteService.registerAppwriteUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'user' }));
    expect(User).toHaveBeenCalledWith(expect.objectContaining({ role: 'user' }));
    expect(jwt.verify(response.body.data.token, process.env.JWT_SECRET).role).toBe('user');
  });

  test('controller cannot persist a privileged role even when invoked without route validation', async () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.register({ body: { ...registration, role: 'admin' } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(User).toHaveBeenCalledWith(expect.objectContaining({ role: 'user' }));
    expect(appwriteService.registerAppwriteUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'user' }));
  });
});

describe('verified JWT sessions', () => {
  test.each([undefined, 'Basic bad', 'Bearer ', 'Bearer forged'])('rejects invalid credentials %# before a database query', async authorization => {
    const response = await client.request('/private', { headers: authorization ? { Authorization: authorization } : {} });
    expect(response.status).toBe(401);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('rejects expired tokens', async () => {
    const token = jwt.sign({ userId: USER_ID }, process.env.JWT_SECRET, { expiresIn: -60 });
    expect((await client.request('/private', { headers: { Authorization: `Bearer ${token}` } })).status).toBe(401);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test.each(['missing', 'disabled', 'locked'])('rejects %s accounts', async state => {
    if (state === 'missing') User.findById.mockResolvedValue(null);
    if (state === 'disabled') user.isActive = false;
    if (state === 'locked') user.isLocked.mockReturnValue(true);
    const response = await client.request('/private', { headers: { Authorization: `Bearer ${signSessionToken(user)}` } });
    expect(response.status).toBe(state === 'locked' ? 423 : 401);
  });

  test('uses the current database role instead of stale JWT roles or body/query identity', async () => {
    const token = signSessionToken({ ...user, role: 'admin' });
    const headers = { Authorization: `Bearer ${token}` };
    const response = await client.request(`/private?userId=${OTHER_ID}`, { headers });
    expect(response.body).toMatchObject({ userId: USER_ID, role: 'user' });
    expect((await client.request('/admin', { headers })).status).toBe(403);
    expect(User.findById).toHaveBeenCalledWith(USER_ID);
  });

  test('optional authentication does not grant an identity to a forged token', async () => {
    const response = await client.request('/optional', { headers: { Authorization: 'Bearer forged' } });
    expect(response.body.user).toBeNull();
  });

  test('password login still issues a valid member session', async () => {
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    const response = await client.request('/api/auth/login', { method: 'POST', body: registration });
    expect(response.status).toBe(200);
    expect(jwt.verify(response.body.data.token, process.env.JWT_SECRET).userId).toBe(USER_ID);
  });

  test.each(['disabled', 'locked'])('%s accounts cannot log in or refresh', async state => {
    if (state === 'disabled') user.isActive = false;
    else user.isLocked.mockReturnValue(true);
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    expect((await client.request('/api/auth/login', { method: 'POST', body: registration })).status).toBe(401);
    expect((await client.request('/api/auth/refresh', {
      method: 'POST', body: { refreshToken: signSessionToken(user) }
    })).status).toBe(401);
  });

  test('refresh issues a session with the current account role', async () => {
    const response = await client.request('/api/auth/refresh', {
      method: 'POST', body: { refreshToken: signSessionToken({ ...user, role: 'admin' }) }
    });
    expect(response.status).toBe(200);
    expect(jwt.verify(response.body.data.token, process.env.JWT_SECRET).role).toBe('user');
  });
});

describe('provider identity cannot come from the request body', () => {
  const headers = { Authorization: 'Bearer firebase-test-token' };

  test('Google login cannot issue a token from an email address alone', async () => {
    const response = await client.request('/api/auth/google', { method: 'POST', body: { email: 'admin@example.com' } });
    expect(response.status).toBe(401);
    expect(User.findOne).not.toHaveBeenCalled();
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('Firebase authentication fails closed when unconfigured', async () => {
    admin.apps.splice(0);
    const response = await client.request('/api/auth/google', { method: 'POST', headers, body: registration });
    expect(response.status).toBe(503);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test.each(['auth/id-token-expired', 'auth/id-token-revoked', 'auth/argument-error'])('rejects Firebase error %s', async code => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error('Rejected'), { code }));
    const response = await client.request('/api/auth/google', { method: 'POST', headers, body: registration });
    expect(response.status).toBe(401);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test('Google login selects the verified subject despite a forged email, uid and role', async () => {
    User.findOne.mockResolvedValue(user);
    const response = await client.request('/api/auth/google', {
      method: 'POST', headers, body: { uid: 'another-user', email: 'admin@example.com', role: 'admin' }
    });
    expect(response.status).toBe(200);
    expect(verifyIdToken).toHaveBeenCalledWith('firebase-test-token', true);
    expect(User.findOne).toHaveBeenCalledWith({ firebaseUid: 'firebase-member' });
    expect(User.findById).toHaveBeenCalledWith(USER_ID);
    expect(jwt.verify(response.body.data.token, process.env.JWT_SECRET)).toMatchObject({ userId: USER_ID, role: 'user' });
  });

  test('sync ignores a different body identity and only returns the verified account', async () => {
    User.findOne.mockResolvedValue(user);
    const response = await client.request('/api/auth/firebase-sync', {
      method: 'POST', headers, body: { uid: 'victim', email: 'victim@example.com', role: 'admin' }
    });
    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(USER_ID);
    expect(User.findOne).toHaveBeenCalledTimes(1);
    expect(User.findOne).toHaveBeenCalledWith({ firebaseUid: 'firebase-member' });
    expect(user.email).toBe(registration.email);
  });

  test.each(['disabled', 'locked'])('Firebase cannot reactivate a %s account', async state => {
    User.findOne.mockResolvedValue(user);
    if (state === 'disabled') user.isActive = false;
    else user.isLocked.mockReturnValue(true);
    const response = await client.request('/api/auth/google', { method: 'POST', headers, body: {} });
    expect(response.status).toBe(401);
    expect(user.save).not.toHaveBeenCalled();
    if (state === 'disabled') expect(user.isActive).toBe(false);
    expect((await client.request('/optional-firebase', { headers })).body.user).toBeNull();
  });

  test('does not silently link a new Firebase subject to an existing email account', async () => {
    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(user);
    const response = await client.request('/api/auth/google', { method: 'POST', headers, body: {} });
    expect(response.status).toBe(401);
    expect(User).not.toHaveBeenCalled();
    expect(user.save).not.toHaveBeenCalled();
  });

  test('rejects unverified provider email before looking up an account', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'someone', email: registration.email, email_verified: false });
    expect((await client.request('/api/auth/google', { method: 'POST', headers, body: {} })).status).toBe(401);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test('a new verified Firebase identity creates an ordinary account from provider claims', async () => {
    const response = await client.request('/api/auth/google', {
      method: 'POST', headers, body: { email: 'victim@example.com', uid: 'victim', role: 'admin' }
    });
    expect(response.status).toBe(200);
    expect(User).toHaveBeenCalledWith(expect.objectContaining({
      firebaseUid: 'firebase-member', email: registration.email, role: 'user', provider: 'google.com'
    }));
  });

  test('verified non-Google Firebase providers sync without issuing a Google session', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'firebase-member', email: registration.email, email_verified: true,
      name: 'Test Member', firebase: { sign_in_provider: 'password' }
    });
    const response = await client.request('/api/auth/google', { method: 'POST', headers, body: {} });
    expect(response.status).toBe(401);
    expect(User).toHaveBeenCalledWith(expect.objectContaining({ role: 'user', provider: 'firebase' }));
    expect(response.body.data?.token).toBeUndefined();
  });

  test('a changed email on an existing Firebase subject requires explicit linking', async () => {
    User.findOne.mockResolvedValue(user);
    verifyIdToken.mockResolvedValue({
      uid: 'firebase-member', email: 'different@example.com', email_verified: true,
      firebase: { sign_in_provider: 'google.com' }
    });
    const response = await client.request('/api/auth/google', { method: 'POST', headers, body: {} });
    expect(response.status).toBe(401);
    expect(user.save).not.toHaveBeenCalled();
  });

  test('Google code exchange requires verified email and preserves member sessions', async () => {
    axios.post.mockResolvedValue({ data: { access_token: 'provider-access-token' } });
    axios.get.mockResolvedValue({ data: { id: 'google-member', email: user.email, verified_email: false } });
    const options = { method: 'POST', body: { code: 'one-time-code', redirect_uri: 'http://127.0.0.1:12345' } };
    expect((await client.request('/api/auth/google/token', options)).status).toBe(401);
    expect(User.findOne).not.toHaveBeenCalled();
    axios.get.mockResolvedValue({ data: { id: 'google-member', email: user.email, verified_email: true } });
    User.findOne.mockResolvedValue(user);
    const response = await client.request('/api/auth/google/token', options);
    expect(response.status).toBe(200);
    expect(jwt.verify(response.body.data.token, process.env.JWT_SECRET).userId).toBe(USER_ID);
  });
});
