jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../../src/services/websocket', () => ({ wsManager: { broadcastToDesktops: jest.fn(), broadcastToMobiles: jest.fn() } }));
const { Permission, Role } = require('node-appwrite');
const { AppwriteService, appwriteService } = require('../../src/services/appwriteService');
const { PRIVATE_COLLECTION_PERMISSIONS } = require('../../src/services/appwritePermissions');

let service;
let databases;
beforeEach(() => {
  databases = {
    createDocument: jest.fn().mockResolvedValue({ $id: 'created' }),
    updateDocument: jest.fn().mockResolvedValue({ $id: 'existing' }),
    listDocuments: jest.fn().mockResolvedValue({ documents: [] })
  };
  service = new AppwriteService();
  service.services = { databases };
  service.isInitialized = true;
});

test('absent document grants stay empty instead of granting public access', async () => {
  await service.createPrivateDocument('db', 'collection', 'doc', { secret: 'private' });
  expect(databases.createDocument).toHaveBeenCalledWith('db', 'collection', 'doc', { secret: 'private' }, []);
  expect(PRIVATE_COLLECTION_PERMISSIONS).toEqual([]);
  expect(Object.isFrozen(PRIVATE_COLLECTION_PERMISSIONS)).toBe(true);
});

test('preserves intentional owner permissions', async () => {
  const permissions = [Permission.read(Role.user('owner')), Permission.update(Role.user('owner'))];
  await service.createPrivateDocument('db', 'collection', 'doc', {}, permissions);
  expect(databases.createDocument).toHaveBeenCalledWith('db', 'collection', 'doc', {}, permissions);
});

test.each([
  "Permissions must be one of: (any, guests)", "No permissions provided for action 'create'", 'Invalid document structure', 'Service unavailable'
])('never retries a failed write with broader grants: %s', async message => {
  const error = new Error(message);
  databases.createDocument.mockRejectedValue(error);
  await expect(service.createPrivateDocument('db', 'collection', 'doc', {}, [Permission.read(Role.user('owner'))])).rejects.toBe(error);
  expect(databases.createDocument).toHaveBeenCalledTimes(1);
});

test.each([
  [Permission.read(Role.any())], [Permission.write(Role.guests())],
  [Permission.read(Role.users())], [Permission.read(Role.users('verified'))],
  [Permission.read(Role.label('agent'))], ['invalid'], null, {}
].map(permissions => [permissions]))('rejects broad or malformed private-document grants %# before a write', async permissions => {
  await expect(service.createPrivateDocument('db', 'collection', 'doc', {}, permissions)).rejects.toThrow('Private Appwrite documents');
  expect(databases.createDocument).not.toHaveBeenCalled();
});

test('device registration grants only the supplied owner access', async () => {
  await service.registerDevice({ userId: 'owner', hostname: 'test', platform: 'test' });
  expect(databases.createDocument.mock.calls[0][4]).toEqual([
    Permission.read(Role.user('owner')), Permission.update(Role.user('owner')), Permission.delete(Role.user('owner'))
  ]);
});

test('system tasks and browser snapshots stay backend-only', async () => {
  await service.createAgentTask({ agentId: 'agent', taskType: 'scan' });
  await service.createBrowserIntelligenceSnapshot({ sessions_json: '[]' });
  for (const call of databases.createDocument.mock.calls) expect(call[4]).toEqual([]);
});

test.each([false, true])('role/status metadata is owner-readable but never client-writable (existing=%s)', async existing => {
  if (existing) databases.listDocuments.mockResolvedValue({ documents: [{ $id: 'existing' }] });
  await service.upsertUserMetadata({ userId: 'owner', role: 'user' });
  const call = existing ? databases.updateDocument.mock.calls[0] : databases.createDocument.mock.calls[0];
  expect(call[4]).toEqual([Permission.read(Role.user('owner'))]);
});

test.each([false, true])('capture ingest uses private persistence and reports its result (failure=%s)', async failure => {
  const express = require('express');
  const User = require('../../src/models/User');
  const { signSessionToken } = require('../../src/services/sessionTokens');
  const { serve } = require('../helpers/http');
  const user = { _id: '507f1f77bcf86cd799439011', role: 'user', isActive: true, activity: {}, isLocked: () => false, save: jest.fn() };
  User.findById.mockResolvedValue(user);
  appwriteService.services = { databases };
  appwriteService.isInitialized = true;
  if (failure) databases.createDocument.mockRejectedValue(new Error('Permissions must be one of: (any, guests)'));
  const app = express();
  app.use(express.json());
  app.use('/capture', require('../../src/routes/network-capture'));
  const fixture = await serve(app);
  try {
    const response = await fixture.request('/capture/ingest', {
      method: 'POST', headers: { Authorization: `Bearer ${signSessionToken(user)}` },
      body: { deviceId: 'test-device', flows: [{ id: 'test-flow', host: 'example.com' }] }
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ stored: 1, persisted: failure ? 0 : 1 });
    expect(databases.createDocument).toHaveBeenCalledTimes(1);
    expect(databases.createDocument.mock.calls[0][4]).toEqual([]);
    expect(databases.createDocument.mock.calls[0][3].user_id).toBe(user._id);
  } finally { await fixture.close(); }
});

test('no backend caller still references the removed permissive helper', () => {
  const fs = require('fs');
  const path = require('path');
  const visit = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? visit(filename) : filename.endsWith('.js') ? [filename] : [];
  });
  for (const filename of visit(path.resolve(__dirname, '../../src'))) {
    expect(fs.readFileSync(filename, 'utf8')).not.toContain('createDocumentWithPermissionFallback');
  }
});
