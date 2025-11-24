#!/usr/bin/env node
/**
 * Change Password Utility
 *
 * Updates the password for a user in the GASS database.
 *
 * Usage:
 *   node change-password.js <username> <new-password>
 *
 * Example:
 *   node change-password.js admin MyNewPassword123
 *
 * Docker usage:
 *   docker exec gass node change-password.js admin MyNewPassword123
 */

const bcrypt = require('bcrypt');
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

if (args.length !== 2) {
  console.error('Usage: node change-password.js <username> <new-password>');
  console.error('Example: node change-password.js admin MyNewPassword123');
  process.exit(1);
}

const [username, newPassword] = args;

// Validate inputs
if (!username || !newPassword) {
  console.error('Error: Username and password are required');
  process.exit(1);
}

if (newPassword.length < 4) {
  console.error('Error: Password must be at least 4 characters long');
  process.exit(1);
}

// Check if user exists
const user = db.prepare('SELECT id, username, display_name FROM users WHERE username = ?').get(username);

if (!user) {
  console.error(`Error: User '${username}' not found`);
  console.log('\nAvailable users:');
  const users = db.prepare('SELECT username, display_name FROM users').all();
  users.forEach(u => console.log(`  - ${u.username} (${u.display_name})`));
  process.exit(1);
}

try {
  console.log(`Changing password for user: ${username} (${user.display_name})`);
  console.log('Hashing password...');

  // Hash the password with bcrypt (12 rounds, same as default user creation)
  const passwordHash = bcrypt.hashSync(newPassword, 12);

  // Update the password in the database
  const result = db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE username = ?')
    .run(passwordHash, new Date().toISOString(), username);

  if (result.changes === 0) {
    console.error('Error: Password update failed (no rows affected)');
    process.exit(1);
  }

  console.log(`✓ Password updated successfully for user: ${username}`);
  console.log(`\nYou can now login with:`);
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${newPassword}`);

} catch (error) {
  console.error('Error updating password:', error.message);
  process.exit(1);
} finally {
  db.close();
}
