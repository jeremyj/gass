#!/usr/bin/env node
/**
 * User Management Utility
 *
 * Manages users in the GASS database.
 *
 * Commands:
 *   list                           - List all users
 *   add <username> <password> <displayName>  - Add new user
 *   delete <username>              - Delete user
 *   password <username> <newPassword>  - Change user password
 *
 * Examples:
 *   node manage-users.js list
 *   node manage-users.js add john MyPass123 "John Smith"
 *   node manage-users.js delete john
 *   node manage-users.js password admin NewPassword123
 *
 * Docker usage:
 *   docker exec gass node manage-users.js list
 *   docker exec gass node manage-users.js add john MyPass123 "John Smith"
 *   docker exec gass node manage-users.js password admin NewPassword123
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
const command = args[0];

// Show usage if no command provided
if (!command) {
  showUsage();
  process.exit(0);
}

// Execute command
try {
  switch (command.toLowerCase()) {
    case 'list':
      listUsers();
      break;
    case 'add':
      addUser(args[1], args[2], args[3]);
      break;
    case 'delete':
    case 'remove':
      deleteUser(args[1]);
      break;
    case 'password':
    case 'passwd':
      changePassword(args[1], args[2]);
      break;
    case 'help':
    case '--help':
    case '-h':
      showUsage();
      break;
    default:
      console.error(`Error: Unknown command '${command}'`);
      console.log('');
      showUsage();
      process.exit(1);
  }
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  db.close();
}

// Command functions

function showUsage() {
  console.log('User Management Utility for GASS');
  console.log('');
  console.log('Usage: node manage-users.js <command> [arguments]');
  console.log('');
  console.log('Commands:');
  console.log('  list                                      List all users');
  console.log('  add <username> <password> <displayName>   Add new user');
  console.log('  delete <username>                         Delete user');
  console.log('  password <username> <newPassword>         Change user password');
  console.log('  help                                      Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node manage-users.js list');
  console.log('  node manage-users.js add john MyPass123 "John Smith"');
  console.log('  node manage-users.js delete john');
  console.log('  node manage-users.js password admin NewPassword123');
  console.log('');
  console.log('Docker:');
  console.log('  docker exec gass node manage-users.js list');
  console.log('  docker exec gass node manage-users.js add john MyPass123 "John Smith"');
}

function listUsers() {
  const users = db.prepare(`
    SELECT id, username, display_name, created_at, updated_at
    FROM users
    ORDER BY id ASC
  `).all();

  if (users.length === 0) {
    console.log('No users found in database.');
    return;
  }

  console.log(`\nFound ${users.length} user(s):\n`);
  console.log('ID  Username          Display Name         Created');
  console.log('─'.repeat(70));

  users.forEach(user => {
    const created = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
    const id = String(user.id).padEnd(4);
    const username = String(user.username).padEnd(18);
    const displayName = String(user.display_name).padEnd(20);
    console.log(`${id}${username}${displayName}${created}`);
  });
  console.log('');
}

function addUser(username, password, displayName) {
  // Validate arguments
  if (!username || !password || !displayName) {
    console.error('Error: Missing required arguments');
    console.log('Usage: node manage-users.js add <username> <password> <displayName>');
    console.log('Example: node manage-users.js add john MyPass123 "John Smith"');
    process.exit(1);
  }

  // Validate password length
  if (password.length < 4) {
    console.error('Error: Password must be at least 4 characters long');
    process.exit(1);
  }

  // Check if user already exists
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUser) {
    console.error(`Error: User '${username}' already exists`);
    process.exit(1);
  }

  console.log(`Creating user: ${username} (${displayName})`);
  console.log('Hashing password...');

  // Hash the password with bcrypt
  const passwordHash = bcrypt.hashSync(password, 12);
  const now = new Date().toISOString();

  // Insert the user
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, display_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(username, passwordHash, displayName, now, now);

  console.log(`✓ User created successfully (ID: ${result.lastInsertRowid})`);
  console.log('');
  console.log('Login credentials:');
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);
  console.log('');
}

function deleteUser(username) {
  // Validate argument
  if (!username) {
    console.error('Error: Username is required');
    console.log('Usage: node manage-users.js delete <username>');
    console.log('Example: node manage-users.js delete john');
    process.exit(1);
  }

  // Check if user exists
  const user = db.prepare('SELECT id, username, display_name FROM users WHERE username = ?').get(username);
  if (!user) {
    console.error(`Error: User '${username}' not found`);
    listUsers();
    process.exit(1);
  }

  // Prevent deleting the last admin user
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 1) {
    console.error('Error: Cannot delete the last user in the system');
    process.exit(1);
  }

  console.log(`Deleting user: ${username} (${user.display_name})`);

  // Delete the user
  const result = db.prepare('DELETE FROM users WHERE username = ?').run(username);

  if (result.changes === 0) {
    console.error('Error: User deletion failed');
    process.exit(1);
  }

  console.log(`✓ User '${username}' deleted successfully`);
}

function changePassword(username, newPassword) {
  // Validate arguments
  if (!username || !newPassword) {
    console.error('Error: Username and password are required');
    console.log('Usage: node manage-users.js password <username> <newPassword>');
    console.log('Example: node manage-users.js password admin NewPassword123');
    process.exit(1);
  }

  // Validate password length
  if (newPassword.length < 4) {
    console.error('Error: Password must be at least 4 characters long');
    process.exit(1);
  }

  // Check if user exists
  const user = db.prepare('SELECT id, username, display_name FROM users WHERE username = ?').get(username);
  if (!user) {
    console.error(`Error: User '${username}' not found`);
    listUsers();
    process.exit(1);
  }

  console.log(`Changing password for user: ${username} (${user.display_name})`);
  console.log('Hashing password...');

  // Hash the password with bcrypt
  const passwordHash = bcrypt.hashSync(newPassword, 12);

  // Update the password in the database
  const result = db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE username = ?')
    .run(passwordHash, new Date().toISOString(), username);

  if (result.changes === 0) {
    console.error('Error: Password update failed (no rows affected)');
    process.exit(1);
  }

  console.log(`✓ Password updated successfully for user: ${username}`);
  console.log('');
  console.log('New login credentials:');
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${newPassword}`);
  console.log('');
}
