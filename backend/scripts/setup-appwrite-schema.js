require('dotenv').config();

const { Client, Databases, Permission, Role, AppwriteException } = require('node-appwrite');

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || '698d422300098f2baa8a';
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || 'cyberforge';
const databaseName = process.env.APPWRITE_DATABASE_NAME || 'cyberforge';

if (!apiKey) {
  console.error('❌ Missing APPWRITE_API_KEY. Set it in backend/.env or pass it inline.');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

const collectionPermissions = [
  Permission.read(Role.users()),
  Permission.create(Role.users()),
  Permission.update(Role.users()),
  Permission.delete(Role.users())
];

const schema = {
  users: {
    name: 'users',
    attributes: [
      { type: 'string', key: 'user_id', size: 128, required: true },
      { type: 'enum', key: 'role', elements: ['user', 'admin', 'expert'], required: true },
      { type: 'string', key: 'status', size: 64, required: true },
      { type: 'datetime', key: 'created_at', required: true }
    ],
    indexes: []
  },
  devices: {
    name: 'devices',
    attributes: [
      { type: 'string', key: 'device_id', size: 128, required: true },
      { type: 'string', key: 'user_id', size: 128, required: true },
      { type: 'string', key: 'os', size: 64, required: true },
      { type: 'string', key: 'hostname', size: 255, required: false },
      { type: 'string', key: 'agent_version', size: 64, required: true },
      { type: 'datetime', key: 'last_seen', required: true },
      { type: 'datetime', key: 'created_at', required: true }
    ],
    indexes: [
      { key: 'idx_devices_device_id', type: 'key', attributes: ['device_id'] },
      { key: 'idx_devices_user_id', type: 'key', attributes: ['user_id'] }
    ]
  },
  browsers: {
    name: 'browsers',
    attributes: [
      { type: 'string', key: 'browser_id', size: 128, required: true },
      { type: 'string', key: 'device_id', size: 128, required: true },
      { type: 'string', key: 'browser_name', size: 128, required: true },
      { type: 'string', key: 'browser_version', size: 64, required: false },
      { type: 'string', key: 'profile_path', size: 1024, required: true },
      { type: 'string', key: 'status', size: 64, required: true },
      { type: 'datetime', key: 'created_at', required: true }
    ],
    indexes: [
      { key: 'idx_browsers_browser_id', type: 'key', attributes: ['browser_id'] },
      { key: 'idx_browsers_device_id', type: 'key', attributes: ['device_id'] }
    ]
  },
  browser_events: {
    name: 'browser_events',
    attributes: [
      { type: 'string', key: 'event_id', size: 128, required: true },
      { type: 'string', key: 'browser_id', size: 128, required: true },
      { type: 'string', key: 'device_id', size: 128, required: true },
      { type: 'string', key: 'url', size: 2048, required: true },
      { type: 'string', key: 'domain', size: 255, required: true },
      { type: 'datetime', key: 'timestamp', required: true },
      { type: 'boolean', key: 'processed', required: true },
      { type: 'float', key: 'risk_score', required: false, min: 0, max: 1 },
      { type: 'datetime', key: 'created_at', required: true }
    ],
    indexes: [
      { key: 'idx_events_browser_id', type: 'key', attributes: ['browser_id'] },
      { key: 'idx_events_domain', type: 'key', attributes: ['domain'] },
      { key: 'idx_events_timestamp', type: 'key', attributes: ['timestamp'] }
    ]
  },
  alerts: {
    name: 'alerts',
    attributes: [
      { type: 'string', key: 'alert_id', size: 128, required: true },
      { type: 'enum', key: 'severity', elements: ['low', 'medium', 'high'], required: true },
      { type: 'enum', key: 'source', elements: ['browser', 'scraper', 'model'], required: true },
      { type: 'string', key: 'description', size: 4096, required: true },
      { type: 'string', key: 'evidence', size: 2048, required: false, array: true },
      { type: 'float', key: 'confidence', required: true, min: 0, max: 1 },
      { type: 'string', key: 'user_id', size: 128, required: true },
      { type: 'string', key: 'device_id', size: 128, required: true },
      { type: 'datetime', key: 'created_at', required: true }
    ],
    indexes: []
  },
  agent_tasks: {
    name: 'agent_tasks',
    attributes: [
      { type: 'string', key: 'task_id', size: 128, required: true },
      { type: 'string', key: 'task_type', size: 128, required: true },
      { type: 'enum', key: 'status', elements: ['pending', 'running', 'done', 'failed'], required: true },
      { type: 'integer', key: 'priority', required: true },
      { type: 'integer', key: 'retries', required: true },
      { type: 'datetime', key: 'created_at', required: true },
      { type: 'datetime', key: 'updated_at', required: true }
    ],
    indexes: []
  }
};

function isAlreadyExists(error) {
  if (!error) return false;
  return error.code === 409 || String(error.message || '').toLowerCase().includes('already exists');
}

async function ensureDatabase() {
  try {
    await databases.create(databaseId, databaseName, true);
    console.log(`✅ Database created: ${databaseId}`);
  } catch (error) {
    if (isAlreadyExists(error)) {
      console.log(`ℹ️ Database already exists: ${databaseId}`);
      return;
    }
    throw error;
  }
}

async function ensureCollection(collectionId, cfg) {
  try {
    await databases.createCollection(
      databaseId,
      collectionId,
      cfg.name,
      collectionPermissions,
      true,
      true
    );
    console.log(`✅ Collection created: ${collectionId}`);
  } catch (error) {
    if (isAlreadyExists(error)) {
      console.log(`ℹ️ Collection already exists: ${collectionId}`);
      return;
    }
    throw error;
  }
}

async function createAttribute(collectionId, attribute) {
  const { type, key, required = false, array = false } = attribute;

  try {
    if (type === 'string') {
      await databases.createStringAttribute(
        databaseId,
        collectionId,
        key,
        attribute.size,
        required,
        undefined,
        array,
        false
      );
    } else if (type === 'enum') {
      await databases.createEnumAttribute(
        databaseId,
        collectionId,
        key,
        attribute.elements,
        required,
        undefined,
        array
      );
    } else if (type === 'datetime') {
      await databases.createDatetimeAttribute(
        databaseId,
        collectionId,
        key,
        required,
        undefined,
        array
      );
    } else if (type === 'boolean') {
      await databases.createBooleanAttribute(
        databaseId,
        collectionId,
        key,
        required,
        undefined,
        array
      );
    } else if (type === 'float') {
      await databases.createFloatAttribute(
        databaseId,
        collectionId,
        key,
        required,
        attribute.min,
        attribute.max,
        undefined,
        array
      );
    } else if (type === 'integer') {
      await databases.createIntegerAttribute(
        databaseId,
        collectionId,
        key,
        required,
        undefined,
        undefined,
        undefined,
        array
      );
    } else {
      throw new Error(`Unsupported attribute type: ${type}`);
    }

    console.log(`  ✅ attribute: ${collectionId}.${key}`);
  } catch (error) {
    if (isAlreadyExists(error)) {
      console.log(`  ℹ️ attribute exists: ${collectionId}.${key}`);
      return;
    }
    throw error;
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAttributes(collectionId, keys, retries = 30) {
  for (let i = 0; i < retries; i += 1) {
    const result = await databases.listAttributes(databaseId, collectionId);
    const statusByKey = new Map(result.attributes.map((a) => [a.key, a.status]));

    const pending = keys.filter((key) => statusByKey.get(key) !== 'available');
    if (pending.length === 0) return;

    await sleep(1000);
  }

  throw new Error(`Timed out waiting for attributes to become available in ${collectionId}`);
}

async function createIndexWithRetry(collectionId, index, retries = 12) {
  for (let i = 0; i < retries; i += 1) {
    try {
      await databases.createIndex(
        databaseId,
        collectionId,
        index.key,
        index.type,
        index.attributes
      );
      console.log(`  ✅ index: ${collectionId}.${index.key}`);
      return;
    } catch (error) {
      if (isAlreadyExists(error)) {
        console.log(`  ℹ️ index exists: ${collectionId}.${index.key}`);
        return;
      }

      const message = String(error.message || '').toLowerCase();
      const retryable = message.includes('not yet available') || message.includes('attribute') || error.code === 400;
      if (!retryable || i === retries - 1) throw error;

      await sleep(1500);
    }
  }
}

async function run() {
  console.log('🚀 Setting up Appwrite schema...');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Project: ${projectId}`);
  console.log(`Database: ${databaseId}`);

  await ensureDatabase();

  for (const [collectionId, cfg] of Object.entries(schema)) {
    await ensureCollection(collectionId, cfg);

    for (const attribute of cfg.attributes) {
      await createAttribute(collectionId, attribute);
    }

    await waitForAttributes(collectionId, cfg.attributes.map((a) => a.key));

    for (const index of cfg.indexes) {
      await createIndexWithRetry(collectionId, index);
    }
  }

  console.log('✅ Appwrite schema setup complete.');
}

run().catch((error) => {
  const message = error instanceof AppwriteException ? error.response || error.message : error.message;
  console.error('❌ Schema setup failed:', message);
  process.exit(1);
});
