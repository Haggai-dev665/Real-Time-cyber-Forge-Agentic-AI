const express = require('express');
const { Client, Databases, Permission, Role } = require('node-appwrite');
const { auditAppwritePermissions, inspectDocument } = require('../../scripts/audit-appwrite-permissions');
const { serve } = require('../helpers/http');

const readOwner = Permission.read(Role.user('owner'));
const safeCollection = { $permissions: [], documentSecurity: true };
const privateDocument = id => ({ $id: id, user_id: 'owner', $permissions: [readOwner] });

test('inventories every page, detects risky grants, and excludes document contents', async () => {
  const pages = [
    { total: 3, documents: [privateDocument('1'), { ...privateDocument('2'), $permissions: ['read("any")'], sessions_json: 'sensitive-telemetry' }] },
    { total: 3, documents: [{ ...privateDocument('3'), $permissions: ['write("user:other")'], role: 'admin' }] }
  ];
  const databases = {
    getCollection: jest.fn().mockResolvedValue({ $permissions: ['read("users")'], documentSecurity: false }),
    listDocuments: jest.fn().mockImplementation(() => Promise.resolve(pages.shift()))
  };
  const report = await auditAppwritePermissions({ databases, databaseId: 'db', collectionIds: ['users'], pageSize: 2 });
  expect(report.complete).toBe(true);
  expect(report.documentsExamined).toBe(3);
  expect(report.issueCount).toBe(5);
  expect(report.collections[0].documents.map(document => document.documentId)).toEqual(['2', '3']);
  expect(JSON.stringify(report)).not.toContain('sensitive-telemetry');
  expect(JSON.stringify(report)).not.toContain('admin');
  expect(databases.listDocuments.mock.calls[1][0].queries.map(query => JSON.parse(query)))
    .toContainEqual({ method: 'cursorAfter', values: ['2'] });
});

test('backend-only documents and matching owner-read grants pass the inventory', async () => {
  const databases = {
    getCollection: jest.fn().mockResolvedValue(safeCollection),
    listDocuments: jest.fn().mockResolvedValue({ total: 2, documents: [privateDocument('1'), { $id: '2', $permissions: [] }] })
  };
  const report = await auditAppwritePermissions({ databases, databaseId: 'db', collectionIds: ['users', 'users'] });
  expect(report).toMatchObject({ complete: true, issueCount: 0, documentsExamined: 2 });
  expect(databases.getCollection).toHaveBeenCalledTimes(1);
});

test.each([
  { $permissions: ['read("guests")'] },
  { $permissions: ['read("users/verified")'] },
  { $permissions: ['read("label:agent")'] },
  { $permissions: [readOwner] },
  { $permissions: ['read("user:other")'], user_id: 'owner' },
  { $permissions: ['read("team:workspace")'], user_id: 'owner' },
  {}
])('flags broad grants, unknown owners, mismatches or missing metadata %#', document => {
  expect(inspectDocument(document).length).toBeGreaterThan(0);
});

test('a missing collection leaves the report incomplete while other collections are examined', async () => {
  const databases = {
    getCollection: jest.fn().mockRejectedValueOnce(Object.assign(new Error('secret-provider-message'), { code: 404 })).mockResolvedValue(safeCollection),
    listDocuments: jest.fn().mockResolvedValue({ total: 0, documents: [] })
  };
  const report = await auditAppwritePermissions({ databases, databaseId: 'db', collectionIds: ['missing', 'present'] });
  expect(report.complete).toBe(false);
  expect(report.collections[0].error.code).toBe(404);
  expect(report.collections[1].complete).toBe(true);
  expect(JSON.stringify(report)).not.toContain('secret-provider-message');
});

test.each(['repeated', 'changed', 'missing'])('cannot report a complete audit when pagination is %s', async failure => {
  const databases = {
    getCollection: jest.fn().mockResolvedValue(safeCollection),
    listDocuments: jest.fn()
      .mockResolvedValueOnce({ total: 2, documents: [privateDocument('1')] })
      .mockResolvedValue({ total: failure === 'changed' ? 3 : 2, documents: failure === 'missing' ? [] : [privateDocument('1')] })
  };
  const report = await auditAppwritePermissions({ databases, databaseId: 'db', collectionIds: ['users'], pageSize: 1 });
  expect(report.complete).toBe(false);
  expect(report.collections[0].error.reason).toBe('inventory_incomplete');
});

test('the real Appwrite SDK inventory performs only GET requests', async () => {
  const requests = [];
  const app = express();
  app.use((req, res) => {
    requests.push({ method: req.method, path: req.path });
    if (req.path.endsWith('/documents')) return res.json({ total: 1, documents: [privateDocument('1')] });
    res.json(safeCollection);
  });
  const fixture = await serve(app);
  try {
    const sdk = new Client().setEndpoint(`${fixture.url}/v1`).setProject('test-project').setKey('test-only-key');
    const report = await auditAppwritePermissions({ databases: new Databases(sdk), databaseId: 'db', collectionIds: ['users'] });
    expect(report).toMatchObject({ complete: true, issueCount: 0, documentsExamined: 1 });
    expect(requests).toEqual([
      { method: 'GET', path: '/v1/databases/db/collections/users' },
      { method: 'GET', path: '/v1/databases/db/collections/users/documents' }
    ]);
  } finally { await fixture.close(); }
});
