/**
 * Appwrite Configuration
 * Central control plane for identity, authentication, and agent management
 */

const { Client, Databases, Account, Users, Functions, Storage } = require('node-appwrite');

// Appwrite configuration from environment variables
const APPWRITE_CONFIG = {
  endpoint: process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  projectId: process.env.APPWRITE_PROJECT_ID || '',
  apiKey:
    process.env.APPWRITE_API_KEY ||
    process.env.APPWRITE_APIKEY ||
    process.env.APPWRITE_KEY ||
    '',
  databaseId: process.env.APPWRITE_DATABASE_ID || 'cyberforge',
  
  // Collection IDs
  collections: {
    users: process.env.APPWRITE_COLLECTION_USERS || 'users',
    devices: process.env.APPWRITE_COLLECTION_DEVICES || 'devices',
    browsers: process.env.APPWRITE_COLLECTION_BROWSERS || 'browsers',
    browserEvents: process.env.APPWRITE_COLLECTION_BROWSER_EVENTS || 'browser_events',
    agents: process.env.APPWRITE_COLLECTION_AGENTS || 'agents',
    agentTasks: process.env.APPWRITE_COLLECTION_AGENT_TASKS || 'agent_tasks',
    alerts: process.env.APPWRITE_COLLECTION_ALERTS || 'alerts',
    evidenceMetadata: process.env.APPWRITE_COLLECTION_EVIDENCE_METADATA || 'evidence_metadata',
    browserIntelligence: process.env.APPWRITE_COLLECTION_BROWSER_INTELLIGENCE || 'browser_intelligence'
  }
};

/**
 * Create and configure Appwrite client for server-side operations
 */
function createAppwriteClient() {
  const client = new Client();

  client
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId);

  if (APPWRITE_CONFIG.apiKey) {
    client.setKey(APPWRITE_CONFIG.apiKey);
  }
  
  return client;
}

/**
 * Initialize all Appwrite services
 */
function initializeAppwriteServices() {
  const client = createAppwriteClient();
  
  return {
    client,
    databases: new Databases(client),
    account: new Account(client),
    users: new Users(client),
    functions: new Functions(client),
    storage: new Storage(client)
  };
}

module.exports = {
  APPWRITE_CONFIG,
  createAppwriteClient,
  initializeAppwriteServices
};
