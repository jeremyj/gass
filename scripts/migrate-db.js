#!/usr/bin/env node
/**
 * Database Migration Script
 *
 * This script applies database migrations. The schema is managed in database.js
 * using idempotent ALTER TABLE statements that check for duplicate columns.
 *
 * Running this script will:
 * 1. Initialize any missing tables
 * 2. Add any missing columns
 * 3. Seed initial data (users, participants) if needed
 *
 * Usage:
 *   node scripts/migrate-db.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Determine database path (same logic as database.js)
const projectRoot = path.join(__dirname, '..');
const dbDir = fs.existsSync('/app/data') ? '/app/data' : projectRoot;
const dbPath = path.join(dbDir, 'gass.db');

console.log('=== GASS Database Migration ===');
console.log(`Database: ${dbPath}`);
console.log('');

// Backup existing database if it exists
if (fs.existsSync(dbPath)) {
  const backupPath = `${dbPath}.backup-${Date.now()}`;
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✓ Created backup: ${backupPath}`);
} else {
  console.log('! No existing database found, will create new one');
}

// The database.js module will handle all migrations automatically
// We just need to require it to trigger the initialization
console.log('');
console.log('Running migrations...');
require('../server/config/database');

console.log('');
console.log('✓ Migration complete!');
console.log('');
