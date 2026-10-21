/**
 * Models Index
 * Central export for all database models
 */

const User = require('./User');
const Threat = require('./Threat');
const Analysis = require('./Analysis');
const Workspace = require('./Workspace');
const Membership = require('./Membership');
const IdentityLink = require('./IdentityLink');
const MigrationRecord = require('./MigrationRecord');

module.exports = {
  User,
  Threat,
  Analysis,
  Workspace,
  Membership,
  IdentityLink,
  MigrationRecord
};