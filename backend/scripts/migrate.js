#!/usr/bin/env node
/**
 * Data migrations for the backend's database.
 *
 *   node scripts/migrate.js              dry run: reads and reports, changes nothing
 *   node scripts/migrate.js --status     which migrations are applied and which are waiting
 *   node scripts/migrate.js --apply      apply the waiting ones and record them in the ledger
 *
 * The database is the one named by DATABASE_URL (backend/.env, or the
 * environment). The address is never printed: it holds the password.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const { runMigrations, migrationStatus } = require('../src/migrations/runner');

const apply = process.argv.includes('--apply');
const statusOnly = process.argv.includes('--status');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  await mongoose.connect(process.env.DATABASE_URL, { serverSelectionTimeoutMS: 15000 });
  const where = `${mongoose.connection.host}/${mongoose.connection.name}`;
  try {
    if (statusOnly) {
      console.log(`Migrations for ${where}:`);
      for (const entry of await migrationStatus()) {
        console.log(`  ${entry.appliedAt ? 'applied ' + entry.appliedAt.toISOString() : 'waiting'}  ${entry.id}  ${entry.description}`);
      }
      return;
    }
    console.log(apply ? `APPLYING migrations to ${where}` : `DRY RUN against ${where} (nothing is changed; pass --apply to change it)`);
    const results = await runMigrations({ apply, log: line => console.log(`  ${line}`) });
    for (const result of results) {
      console.log(`${result.id}: ${result.state}`);
      if (result.summary) console.log(JSON.stringify(result.summary, null, 2).replace(/^/gm, '  '));
    }
    if (!results.some(result => result.state !== 'already applied')) console.log('Nothing is waiting.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error(`Migration failed: ${error.message}`);
  process.exit(1);
});
