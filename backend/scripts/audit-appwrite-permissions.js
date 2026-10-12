const { Query } = require('node-appwrite');
const { isScopedDocumentPermission } = require('../src/services/appwritePermissions');

function inspectDocument(document, { metadataCollection = false } = {}) {
  const issues = [];
  const permissions = document.$permissions;
  if (!Array.isArray(permissions)) return ['permissions_metadata_missing'];
  if (permissions.some(permission => !isScopedDocumentPermission(permission))) issues.push('broad_or_malformed_grant');
  if (metadataCollection && permissions.some(permission => !String(permission).startsWith('read('))) {
    issues.push('client_writable_identity_metadata');
  }
  if (permissions.length) {
    const owner = document.user_id;
    if (typeof owner !== 'string' || !owner || owner === 'system' || permissions.some(permission => /\("(?:team|member):/.test(permission))) {
      issues.push('owner_mapping_requires_review');
    }
    else if (permissions.some(permission => {
      const match = /^\w+\("user:([^"/]+)(?:\/[^"/]+)?"\)$/.exec(permission);
      return match && match[1] !== owner;
    })) issues.push('owner_grant_mismatch');
  }
  return issues;
}

/** Read-only inventory. Deliberately no update/create/delete SDK methods. */
async function auditAppwritePermissions({ databases, databaseId, collectionIds, metadataCollectionId = 'users', pageSize = 100 }) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Invalid audit page size');
  if (!databaseId || !Array.isArray(collectionIds) || !collectionIds.length) throw new Error('Audit database and collections are required');
  const report = { databaseId, complete: true, documentsExamined: 0, issueCount: 0, collections: [] };
  for (const collectionId of [...new Set(collectionIds)]) {
    const result = { collectionId, complete: false, documentsExamined: 0, issues: [], documents: [] };
    report.collections.push(result);
    try {
      const collection = await databases.getCollection({ databaseId, collectionId });
      result.permissions = collection.$permissions;
      result.documentSecurity = collection.documentSecurity;
      if (!Array.isArray(collection.$permissions) || collection.$permissions.length) result.issues.push('collection_grants_bypass_document_ownership');
      if (collection.documentSecurity !== true) result.issues.push('document_security_disabled');
      let cursor;
      let previousTotal;
      const seen = new Set();
      while (true) {
        const queries = [Query.limit(pageSize), Query.orderAsc('$id')];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const page = await databases.listDocuments({ databaseId, collectionId, queries });
        if (!Array.isArray(page.documents) || !Number.isInteger(page.total) || page.total < 0) {
          throw new Error('Invalid inventory page');
        }
        if (previousTotal !== undefined && previousTotal !== page.total) throw new Error('Inventory changed during pagination');
        previousTotal = page.total;
        for (const document of page.documents) {
          if (!document.$id || seen.has(document.$id)) throw new Error('Repeated or missing document cursor');
          seen.add(document.$id);
          result.documentsExamined += 1;
          const issues = inspectDocument(document, { metadataCollection: collectionId === metadataCollectionId });
          if (issues.length) {
            // Only identifiers, grants and issue codes. No telemetry, roles,
            // session payloads or other document contents leave the inventory.
            result.documents.push({ documentId: document.$id, permissions: document.$permissions, issues });
          }
        }
        if (page.documents.length < pageSize) {
          if (seen.size !== page.total) throw new Error('Incomplete inventory');
          break;
        }
        cursor = page.documents[page.documents.length - 1].$id;
      }
      result.complete = true;
    } catch (error) {
      report.complete = false;
      // Provider messages may contain sensitive values; report only status.
      result.error = { code: Number.isInteger(error.code) ? error.code : null, reason: 'inventory_incomplete' };
    }
    report.documentsExamined += result.documentsExamined;
    report.issueCount += result.issues.length + result.documents.reduce((count, document) => count + document.issues.length, 0);
  }
  return report;
}

async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node scripts/audit-appwrite-permissions.js [--env-file <path>]\nRead-only JSON inventory; no default .env is loaded. Exit 0: complete/no issues, 2: issues found, 1: incomplete/configuration error.');
    return;
  }
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--env-file' || !args[1]) throw new Error('Expected --env-file <path>');
    const loaded = require('dotenv').config({ path: args[1] });
    if (loaded.error) throw new Error('Could not read the specified environment file');
  }
  const { APPWRITE_CONFIG, initializeAppwriteServices } = require('../src/config/appwrite.config');
  if (!APPWRITE_CONFIG.projectId || !APPWRITE_CONFIG.apiKey) throw new Error('APPWRITE_PROJECT_ID and APPWRITE_API_KEY are required');
  const { databases } = initializeAppwriteServices();
  const report = await auditAppwritePermissions({
    databases, databaseId: APPWRITE_CONFIG.databaseId,
    collectionIds: Object.values(APPWRITE_CONFIG.collections),
    metadataCollectionId: APPWRITE_CONFIG.collections.users
  });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = !report.complete ? 1 : report.issueCount ? 2 : 0;
}

if (require.main === module) {
  main().catch(() => {
    console.error('Permission inventory could not run. Check command arguments, the selected environment file and Appwrite configuration.');
    process.exitCode = 1;
  });
}

module.exports = { auditAppwritePermissions, inspectDocument };
