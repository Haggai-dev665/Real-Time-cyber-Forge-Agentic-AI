/**
 * Runs data migrations in order and keeps the ledger.
 *
 * A migration is a file in this folder named `NNN-what-it-does.js` exporting
 * `{ id, description, up({ apply, log }) }`. `up` returns a summary: counts,
 * and the IDs of any records it set aside for a person to look at.
 *
 * Rules a migration follows:
 *   - With `apply: false` it reads and counts and changes nothing.
 *   - It can be run twice: a second run finds its own work and does no more.
 *   - A record that cannot be assigned with certainty is set aside and reported,
 *     never given to an arbitrary account.
 *   - If it throws, nothing is written to the ledger and it runs again next time.
 */
const fs = require('fs');
const path = require('path');
const MigrationRecord = require('../models/MigrationRecord');

const FILE = /^\d{3}-[a-z0-9-]+\.js$/;

/** Every migration in this folder, in the order of their numbers. */
function loadMigrations(directory = __dirname) {
  const migrations = fs.readdirSync(directory)
    .filter(name => FILE.test(name))
    .sort()
    .map(name => ({ file: name, ...require(path.join(directory, name)) }));
  for (const migration of migrations) {
    if (migration.id !== migration.file.replace(/\.js$/, '')) {
      throw new Error(`${migration.file} must export the id "${migration.file.replace(/\.js$/, '')}"`);
    }
    if (typeof migration.description !== 'string' || typeof migration.up !== 'function') {
      throw new Error(`${migration.file} must export a description and an up() function`);
    }
  }
  return migrations;
}

/** Which migrations have been applied, and which are waiting. */
async function migrationStatus(migrations = loadMigrations()) {
  const applied = new Map((await MigrationRecord.find({})).map(record => [record.migrationId, record]));
  return migrations.map(migration => ({
    id: migration.id,
    description: migration.description,
    appliedAt: applied.has(migration.id) ? applied.get(migration.id).appliedAt : null
  }));
}

/**
 * Run every migration that is not in the ledger. With `apply: false` each one
 * reports what it would do and nothing is recorded. Stops at the first failure.
 */
async function runMigrations({ apply = false, migrations = loadMigrations(), log = () => {} } = {}) {
  const results = [];
  for (const entry of await migrationStatus(migrations)) {
    if (entry.appliedAt) {
      results.push({ id: entry.id, state: 'already applied', appliedAt: entry.appliedAt });
      continue;
    }
    const migration = migrations.find(candidate => candidate.id === entry.id);
    const started = Date.now();
    log(`${apply ? 'applying' : 'dry run of'} ${migration.id}: ${migration.description}`);
    const summary = await migration.up({ apply, log });
    if (apply) {
      await MigrationRecord.create({
        migrationId: migration.id,
        description: migration.description,
        appliedAt: new Date(),
        durationMs: Date.now() - started,
        summary
      });
    }
    results.push({ id: migration.id, state: apply ? 'applied' : 'would apply', summary });
  }
  return results;
}

module.exports = { loadMigrations, migrationStatus, runMigrations };
