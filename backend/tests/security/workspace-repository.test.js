// A store built on the workspace repository cannot be made to read, change or
// delete another workspace's record, whatever the handler passes it
// (SEC-01, B10; plan section 4.2 item 3).
const { fakeCollection } = require('../helpers/fakeCollection');
const { workspaceRepository, WorkspaceRequiredError, MAX_PAGE, DEFAULT_PAGE } = require('../../src/repositories/workspaceRepository');

const alice = { userId: 'user-alice', workspaceId: 'ws-alice' };
const bob = { userId: 'user-bob', workspaceId: 'ws-bob' };
let Device;
let devices;

beforeEach(() => {
  Device = fakeCollection();
  devices = workspaceRepository(Device);
});

test('a record is created in the caller\'s workspace, whatever the fields say', async () => {
  const made = await devices.create(alice, { name: 'Laptop', workspaceId: 'ws-bob', createdBy: 'user-bob', _id: 'chosen-id', id: 'x' });
  expect(made).toMatchObject({ name: 'Laptop', workspaceId: 'ws-alice', createdBy: 'user-alice' });
  expect(made._id).not.toBe('chosen-id');
  expect(made.id).toBeUndefined();
});

test('another workspace\'s record is not found, not changed and not deleted', async () => {
  const laptop = await devices.create(alice, { name: 'Laptop' });

  expect(await devices.findById(bob, laptop._id)).toBeNull();
  expect(await devices.updateById(bob, laptop._id, { name: 'Taken' })).toBe(false);
  expect(await devices.deleteById(bob, laptop._id)).toBe(false);
  expect(Device.docs).toHaveLength(1);
  expect(Device.docs[0].name).toBe('Laptop');

  // its own workspace can do all three
  expect((await devices.findById(alice, laptop._id)).name).toBe('Laptop');
  expect(await devices.updateById(alice, laptop._id, { name: 'Renamed' })).toBe(true);
  expect(Device.docs[0].name).toBe('Renamed');
  expect(await devices.deleteById(alice, laptop._id)).toBe(true);
  expect(Device.docs).toHaveLength(0);
});

test('an update cannot move a record to another workspace or change who created it', async () => {
  const laptop = await devices.create(alice, { name: 'Laptop' });
  await devices.updateById(alice, laptop._id, { name: 'Renamed', workspaceId: 'ws-bob', createdBy: 'user-bob' });
  expect(Device.docs[0]).toMatchObject({ name: 'Renamed', workspaceId: 'ws-alice', createdBy: 'user-alice' });
});

test('a listing holds only the caller\'s records, and a filter cannot widen it', async () => {
  await devices.create(alice, { name: 'Laptop', kind: 'desktop' });
  await devices.create(alice, { name: 'Phone', kind: 'mobile' });
  await devices.create(bob, { name: 'Bob\'s laptop', kind: 'desktop' });

  expect((await devices.find(alice)).map(d => d.name).sort()).toEqual(['Laptop', 'Phone']);
  expect((await devices.find(alice, { kind: 'desktop' })).map(d => d.name)).toEqual(['Laptop']);
  expect(await devices.count(alice)).toBe(2);
  expect(await devices.count(bob, { kind: 'desktop' })).toBe(1);

  // attempts to reach outside the workspace through the filter
  for (const filter of [
    { workspaceId: 'ws-bob' },
    { $or: [{ workspaceId: 'ws-bob' }, { workspaceId: 'ws-alice' }] },
    { $where: 'true' },
    { workspaceId: { $in: ['ws-alice', 'ws-bob'] } }
  ]) {
    const found = await devices.find(alice, filter);
    expect(found.every(d => d.workspaceId === 'ws-alice')).toBe(true);
    expect(found).toHaveLength(2);
    expect(await devices.count(alice, filter)).toBe(2);
  }
});

test('a listing is a bounded page', async () => {
  for (let i = 0; i < MAX_PAGE + 30; i += 1) await devices.create(alice, { name: `device-${i}` });
  expect(await devices.find(alice)).toHaveLength(DEFAULT_PAGE);
  expect(await devices.find(alice, {}, { limit: 10 })).toHaveLength(10);
  expect(await devices.find(alice, {}, { limit: 100000 })).toHaveLength(MAX_PAGE);
  expect(await devices.find(alice, {}, { limit: -5 })).toHaveLength(DEFAULT_PAGE);
  expect(await devices.find(alice, {}, { limit: MAX_PAGE, skip: MAX_PAGE })).toHaveLength(30);
});

test('nothing works without a workspace on the principal', async () => {
  await devices.create(alice, { name: 'Laptop' });
  for (const principal of [undefined, null, {}, { userId: 'user-x' }, { userId: 'user-x', workspaceId: null }, { userId: 'user-x', workspaceId: '' }]) {
    await expect(devices.find(principal)).rejects.toBeInstanceOf(WorkspaceRequiredError);
    await expect(devices.create(principal, { name: 'x' })).rejects.toBeInstanceOf(WorkspaceRequiredError);
    await expect(devices.findById(principal, Device.docs[0]._id)).rejects.toBeInstanceOf(WorkspaceRequiredError);
    await expect(devices.updateById(principal, Device.docs[0]._id, { name: 'y' })).rejects.toBeInstanceOf(WorkspaceRequiredError);
    await expect(devices.deleteById(principal, Device.docs[0]._id)).rejects.toBeInstanceOf(WorkspaceRequiredError);
    await expect(devices.count(principal)).rejects.toBeInstanceOf(WorkspaceRequiredError);
  }
  expect(Device.docs).toHaveLength(1);
});

test('a record with its own public ID is found and deleted only in its workspace', async () => {
  await devices.create(alice, { name: 'Laptop', serial: 'S-1' });
  expect(await devices.findOne(bob, { serial: 'S-1' })).toBeNull();
  expect(await devices.findOne(bob, { serial: 'S-1', workspaceId: 'ws-alice' })).toBeNull();
  expect(await devices.deleteOne(bob, { serial: 'S-1' })).toBe(false);
  expect(await devices.deleteOne(bob, { $or: [{ serial: 'S-1' }] })).toBe(false);
  expect((await devices.findOne(alice, { serial: 'S-1' })).name).toBe('Laptop');
  expect(await devices.deleteOne(alice, { serial: 'S-1' })).toBe(true);
  expect(Device.docs).toHaveLength(0);
  await expect(devices.findOne(undefined, { serial: 'S-1' })).rejects.toBeInstanceOf(WorkspaceRequiredError);
});
