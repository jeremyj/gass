'use strict';

// MUST be first
const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { setupTestApp } = require('../helpers/setup-app');
const { createUser, clearNonAdminUsers } = require('../helpers/seed');
const request = require('supertest');

let app;

beforeAll(() => {
  ({ app } = setupTestApp());
});

beforeEach(() => {
  clearNonAdminUsers(db);
  db.prepare('DELETE FROM activity_logs').run();
});

describe('requireAuth middleware', () => {
  it('returns 401 for unauthenticated requests to protected routes', async () => {
    const protectedRoutes = [
      { method: 'get', path: '/api/participants' },
      { method: 'get', path: '/api/storico' },
      { method: 'get', path: '/api/storico/dettaglio' },
      { method: 'post', path: '/api/consegna/' },
    ];

    for (const route of protectedRoutes) {
      const res = await request(app)[route.method](route.path);
      expect(res.status).toBe(401);
    }
  });

  it('destroys session and returns 401 when user is deleted mid-session', async () => {
    const userId = createUser(db, { username: 'tempuser', password: 'password1', displayName: 'Temp' });

    const a = request.agent(app);
    await a.post('/api/auth/login').send({ username: 'tempuser', password: 'password1' });

    // Verify it works while user exists
    const res1 = await a.get('/api/participants');
    expect(res1.status).toBe(200);

    // Delete the user from DB while session is active
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    // Next request should get 401
    const res2 = await a.get('/api/participants');
    expect(res2.status).toBe(401);
  });
});

describe('requireAdmin middleware', () => {
  it('returns 403 for non-admin on admin-only routes', async () => {
    createUser(db, { username: 'user1', password: 'password1', displayName: 'User1', isAdmin: false });

    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });

    const adminRoutes = [
      { method: 'get', path: '/api/logs' },
      { method: 'get', path: '/api/users' },
    ];

    for (const route of adminRoutes) {
      const res = await userAgent[route.method](route.path);
      expect(res.status).toBe(403);
    }
  });

  it('returns 403 when admin privilege is revoked mid-session', async () => {
    // Create a second admin (so we can demote without triggering last-admin check)
    const userId = createUser(db, { username: 'admin2', password: 'password1', displayName: 'Admin2', isAdmin: true });

    const a = request.agent(app);
    await a.post('/api/auth/login').send({ username: 'admin2', password: 'password1' });

    // Confirm admin access works
    const res1 = await a.get('/api/logs');
    expect(res1.status).toBe(200);

    // Revoke admin privilege directly in DB
    db.prepare('UPDATE users SET is_admin = 0 WHERE id = ?').run(userId);

    // requireAdmin re-checks DB on every request, so 403 immediately
    const res2 = await a.get('/api/logs');
    expect(res2.status).toBe(403);
  });
});
