require('dotenv').config();

const { Client, Databases, AppwriteException } = require('node-appwrite');
const { PRIVATE_COLLECTION_PERMISSIONS } = require('../src/services/appwritePermissions');

// The project is never assumed: a key only works in the project it was created
// in, so a default ID here would silently point the setup at someone else's.
const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || 'cyberforge';
const databaseName = process.env.APPWRITE_DATABASE_NAME || 'cyberforge';

const missing = Object.entries({ APPWRITE_ENDPOINT: endpoint, APPWRITE_PROJECT_ID: projectId, APPWRITE_API_KEY: apiKey })
  .filter(([, value]) => !value).map(([name]) => name);
if (missing.length) {
  console.error(`❌ Missing ${missing.join(', ')}. Set them in backend/.env or pass them inline.`);
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

const collectionPermissions = PRIVATE_COLLECTION_PERMISSIONS;

// Every collection the backend reads or writes, with exactly the fields it
// sends (services/appwriteService.js, routes/network-capture.js). Appwrite
// refuses a document that carries a field its collection does not declare, so
// this has to stay in step with those writes. Each attribute the backend
// filters or sorts on has an index.
const schema = {
  users: {
    name: 'users',
    attributes: [
      { type: 'string', key: 'user_id', size: 128, required: true },
      { type: 'enum', key: 'role', elements: ['user', 'admin', 'expert'], required: true },
      { type: 'string', key: 'status', size: 64, required: true },
      { type: 'datetime', key: 'created_at', required: true }
    ],
    indexes: [
      { key: 'idx_users_user_id', type: 'key', attributes: ['user_id'] }
    ]
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
    indexes: [
      { key: 'idx_alerts_user_id', type: 'key', attributes: ['user_id'] },
      { key: 'idx_alerts_severity', type: 'key', attributes: ['severity'] },
      { key: 'idx_alerts_created_at', type: 'key', attributes: ['created_at'] }
    ]
  },
  agents: {
    name: 'agents',
    attributes: [
      { type: 'string', key: 'device_id', size: 128, required: true },
      { type: 'string', key: 'user_id', size: 128, required: true },
      { type: 'string', key: 'agent_type', size: 128, required: true },
      { type: 'string', key: 'agent_version', size: 64, required: true },
      { type: 'string', key: 'capabilities', size: 4096, required: false },
      { type: 'string', key: 'state', size: 32, required: true },
      { type: 'string', key: 'status', size: 32, required: true },
      { type: 'integer', key: 'error_count', required: false },
      { type: 'datetime', key: 'last_heartbeat', required: true },
      { type: 'datetime', key: 'created_at', required: true }
    ],
    indexes: [
      { key: 'idx_agents_device_id', type: 'key', attributes: ['device_id'] },
      { key: 'idx_agents_user_id', type: 'key', attributes: ['user_id'] }
    ]
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
      { type: 'datetime', key: 'updated_at', required: true },
      // The agent the task is queued for and the account that owns it. A task
      // is read back only by its owner, so both must be stored.
      { type: 'string', key: 'agent_id', size: 128, required: false },
      { type: 'string', key: 'user_id', size: 128, required: false }
    ],
    indexes: [
      { key: 'idx_tasks_agent_id', type: 'key', attributes: ['agent_id'] },
      { key: 'idx_tasks_user_id', type: 'key', attributes: ['user_id'] },
      { key: 'idx_tasks_status', type: 'key', attributes: ['status'] },
      { key: 'idx_tasks_priority', type: 'key', attributes: ['priority'] }
    ]
  },
  // Two kinds of record share this collection: an installed-browser inventory
  // (saveBrowserIntelligence) and a behavioural session snapshot
  // (createBrowserIntelligenceSnapshot). Only the fields both carry are required.
  browser_intelligence: {
    name: 'browser_intelligence',
    attributes: [
      { type: 'string', key: 'user_id', size: 128, required: true },
      { type: 'string', key: 'device_id', size: 128, required: false },
      { type: 'datetime', key: 'created_at', required: true },
      { type: 'string', key: 'os', size: 64, required: false },
      { type: 'string', key: 'os_display', size: 128, required: false },
      { type: 'string', key: 'default_browser', size: 128, required: false },
      { type: 'string', key: 'browsers_json', size: 16384, required: false },
      { type: 'integer', key: 'installed_count', required: false },
      { type: 'integer', key: 'running_count', required: false },
      { type: 'string', key: 'scan_timestamp', size: 64, required: false },
      { type: 'string', key: 'snapshot_id', size: 128, required: false },
      { type: 'integer', key: 'session_count', required: false },
      { type: 'integer', key: 'total_domains', required: false },
      { type: 'integer', key: 'total_alerts', required: false },
      { type: 'float', key: 'average_risk', required: false },
      { type: 'string', key: 'sessions_json', size: 16384, required: false }
    ],
    indexes: [
      { key: 'idx_intel_user_id', type: 'key', attributes: ['user_id'] },
      { key: 'idx_intel_created_at', type: 'key', attributes: ['created_at'] }
    ]
  },
  evidence_metadata: {
    name: 'evidence_metadata',
    attributes: [
      { type: 'string', key: 'userId', size: 128, required: false },
      { type: 'string', key: 'agentId', size: 128, required: false },
      { type: 'string', key: 'taskId', size: 128, required: false },
      { type: 'string', key: 'sourceType', size: 64, required: false },
      { type: 'string', key: 'targetUrl', size: 2048, required: false },
      { type: 'string', key: 'evidenceType', size: 64, required: false },
      { type: 'string', key: 'summary', size: 4096, required: false },
      { type: 'string', key: 'checksum', size: 128, required: false },
      { type: 'string', key: 'storageLocation', size: 1024, required: false },
      { type: 'string', key: 'metadata', size: 16384, required: false },
      { type: 'datetime', key: 'collectedAt', required: true }
    ],
    indexes: [
      { key: 'idx_evidence_user', type: 'key', attributes: ['userId'] }
    ]
  },
  network_captures: {
    name: 'network_captures',
    attributes: [
      { type: 'string', key: 'id', size: 64, required: true },
      { type: 'string', key: 'user_id', size: 128, required: true },
      { type: 'string', key: 'device_id', size: 64, required: true },
      { type: 'datetime', key: 'created_at', required: true },
      { type: 'string', key: 'host', size: 255, required: false },
      { type: 'string', key: 'url', size: 2048, required: false },
      { type: 'string', key: 'method', size: 16, required: false },
      { type: 'string', key: 'scheme', size: 16, required: false },
      { type: 'string', key: 'ip', size: 64, required: false },
      { type: 'integer', key: 'port', required: false },
      { type: 'integer', key: 'status', required: false },
      { type: 'string', key: 'mime', size: 128, required: false },
      { type: 'string', key: 'app', size: 255, required: false },
      { type: 'boolean', key: 'decrypted', required: false },
      { type: 'string', key: 'flags', size: 64, required: false, array: true },
      { type: 'float', key: 'req_bytes', required: false },
      { type: 'float', key: 'resp_bytes', required: false },
      { type: 'float', key: 'duration_ms', required: false }
    ],
    indexes: [
      { key: 'idx_captures_user_id', type: 'key', attributes: ['user_id'] },
      { key: 'idx_captures_created_at', type: 'key', attributes: ['created_at'] }
    ]
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
