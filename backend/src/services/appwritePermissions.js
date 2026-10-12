// Collection-wide grants bypass owner-scoped document permissions. The backend
// service key creates records; direct clients receive explicit document grants.
const PRIVATE_COLLECTION_PERMISSIONS = Object.freeze([]);

function isScopedDocumentPermission(permission) {
  return typeof permission === 'string' &&
    /^(?:read|update|delete|write)\("(?:user|team|member):[^"\s]+"\)$/.test(permission);
}

function assertPrivateDocumentPermissions(permissions) {
  if (!Array.isArray(permissions) || !permissions.every(isScopedDocumentPermission)) {
    throw new Error('Private Appwrite documents require explicit user, team or member permissions; broad or malformed grants are not allowed.');
  }
}

module.exports = { PRIVATE_COLLECTION_PERMISSIONS, isScopedDocumentPermission, assertPrivateDocumentPermissions };
