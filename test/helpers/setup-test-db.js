'use strict';

const DB_MODULE_PATH = require.resolve('../../server/config/database');

/**
 * Creates an in-memory SQLite database with the full schema and patches
 * the require cache so all subsequent require('./config/database') calls
 * return this test DB instance.
 *
 * Must be called BEFORE requiring any app/route modules.
 */
function setupTestDb() {
  // Load the database module — in test mode (NODE_ENV=test) this exports
  // { createDatabase } without creating the production singleton.
  const dbModule = require(DB_MODULE_PATH);
  const createDatabase = dbModule.createDatabase || dbModule;

  const testDb = createDatabase(':memory:');

  // Patch require cache so routes/middleware get the test DB
  if (require.cache[DB_MODULE_PATH]) {
    require.cache[DB_MODULE_PATH].exports = testDb;
  }

  return testDb;
}

module.exports = { setupTestDb };
