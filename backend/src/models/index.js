/**
 * Models Index
 * Central export for all database models
 */

const User = require('./User');
const Threat = require('./Threat');
const Analysis = require('./Analysis');

module.exports = {
  User,
  Threat,
  Analysis
};