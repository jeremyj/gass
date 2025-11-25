#!/usr/bin/env node
/**
 * Database Clear Utility
 *
 * Clears all data from the GASS database.
 *
 * Usage:
 *   node clear-database.js              - Clear all data (keeps admin user)
 *   node clear-database.js --all        - Clear all data including users
 *   node clear-database.js --confirm    - Skip confirmation prompt
 *
 * Docker usage:
 *   docker exec -it gass node clear-database.js
 *   docker exec gass node clear-database.js --confirm
 */

const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Determine database path (same logic as database.js)
const projectRoot = __dirname;
const dbDir = fs.existsSync('/app/data') ? '/app/data' : projectRoot;
const dbPath = path.join(dbDir, 'gass.db');

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error(`Error: Database not found at ${dbPath}`);
  process.exit(1);
}

const Database = require('better-sqlite3');
const db = new Database(dbPath);

// Parse command line arguments
const args = process.argv.slice(2);
const clearUsers = args.includes('--all');
const skipConfirm = args.includes('--confirm');

// Show current statistics
function showStats() {
  const users = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const consegne = db.prepare('SELECT COUNT(*) as count FROM consegne').get().count;
  const movimenti = db.prepare('SELECT COUNT(*) as count FROM movimenti').get().count;
  const logs = db.prepare('SELECT COUNT(*) as count FROM activity_logs').get().count;

  let sessions = 0;
  try {
    sessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
  } catch (e) {
    // sessions table may not exist
  }

  let partecipanti = 0;
  try {
    partecipanti = db.prepare('SELECT COUNT(*) as count FROM partecipanti').get().count;
  } catch (e) {
    // partecipanti table may not exist (deprecated)
  }

  console.log('\nCurrent database statistics:');
  console.log(`  Users:         ${users}`);
  if (partecipanti > 0) {
    console.log(`  Partecipanti:  ${partecipanti} (deprecated table)`);
  }
  console.log(`  Consegne:      ${consegne}`);
  console.log(`  Movimenti:     ${movimenti}`);
  console.log(`  Activity logs: ${logs}`);
  console.log(`  Sessions:      ${sessions}`);
  console.log('');

  return { users, consegne, movimenti, logs, sessions, partecipanti };
}

// Clear the database
function clearDatabase() {
  console.log('\nClearing database...');

  db.pragma('foreign_keys = OFF');

  // Clear movimenti first (FK to consegne and users/partecipanti)
  const movimentiDeleted = db.prepare('DELETE FROM movimenti').run().changes;
  console.log(`  Deleted ${movimentiDeleted} movimenti`);

  // Clear consegne
  const consegneDeleted = db.prepare('DELETE FROM consegne').run().changes;
  console.log(`  Deleted ${consegneDeleted} consegne`);

  // Clear activity logs
  const logsDeleted = db.prepare('DELETE FROM activity_logs').run().changes;
  console.log(`  Deleted ${logsDeleted} activity logs`);

  // Clear sessions
  try {
    const sessionsDeleted = db.prepare('DELETE FROM sessions').run().changes;
    console.log(`  Deleted ${sessionsDeleted} sessions`);
  } catch (e) {
    // sessions table may not exist
  }

  // Clear deprecated partecipanti table if it exists
  try {
    const partecipantiDeleted = db.prepare('DELETE FROM partecipanti').run().changes;
    if (partecipantiDeleted > 0) {
      console.log(`  Deleted ${partecipantiDeleted} partecipanti (deprecated table)`);
    }
  } catch (e) {
    // partecipanti table may not exist
  }

  // Clear users if --all flag is set
  if (clearUsers) {
    const usersDeleted = db.prepare('DELETE FROM users').run().changes;
    console.log(`  Deleted ${usersDeleted} users`);

    // Create default admin user
    const bcrypt = require('bcrypt');
    const passwordHash = bcrypt.hashSync('admin', 12);
    db.prepare(`
      INSERT INTO users (username, password_hash, display_name, is_admin, saldo, created_at)
      VALUES (?, ?, ?, 1, 0, datetime('now'))
    `).run('admin', passwordHash, 'Administrator');
    console.log('  Created default admin user (admin/admin)');
  } else {
    // Reset user saldos to 0
    const usersReset = db.prepare('UPDATE users SET saldo = 0, ultima_modifica = NULL').run().changes;
    console.log(`  Reset saldo for ${usersReset} users`);
  }

  // Reset autoincrement counters
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('movimenti', 'consegne', 'activity_logs', 'partecipanti')").run();
  if (clearUsers) {
    db.prepare("DELETE FROM sqlite_sequence WHERE name = 'users'").run();
  }
  console.log('  Reset autoincrement counters');

  db.pragma('foreign_keys = ON');

  // Optimize database
  db.pragma('optimize');
  db.exec('VACUUM');
  console.log('  Optimized and vacuumed database');

  console.log('\n✓ Database cleared successfully!\n');
}

// Main execution
async function main() {
  console.log('GASS Database Clear Utility');
  console.log('===========================');
  console.log(`Database: ${dbPath}`);

  const stats = showStats();

  if (stats.consegne === 0 && stats.movimenti === 0 && stats.logs === 0) {
    console.log('Database is already empty. Nothing to clear.');
    db.close();
    process.exit(0);
  }

  if (clearUsers) {
    console.log('⚠️  WARNING: --all flag set. All users will be deleted!');
    console.log('   A new admin user will be created (admin/admin).\n');
  }

  if (skipConfirm) {
    clearDatabase();
    db.close();
    return;
  }

  // Ask for confirmation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Are you sure you want to clear the database? (yes/no): ', (answer) => {
    rl.close();

    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      clearDatabase();
    } else {
      console.log('\nOperation cancelled.\n');
    }

    db.close();
  });
}

main();
