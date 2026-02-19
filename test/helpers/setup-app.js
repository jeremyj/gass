'use strict';

const supertest = require('supertest');

/**
 * Creates a supertest agent wrapping a fresh app instance.
 * The agent persists cookies across requests (session support).
 *
 * Must be called AFTER setupTestDb() has patched the require cache.
 */
function setupTestApp() {
  const createApp = require('../../server/app');
  const app = createApp();
  const agent = supertest.agent(app);
  return { app, agent };
}

module.exports = { setupTestApp };
