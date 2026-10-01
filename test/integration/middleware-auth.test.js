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

describe('disabled users', () => {
  it('refuses login for a disabled user', async () => {
    const userId = createUser(db, { username: 'off', password: 'password1', displayName: 'Off' });
    db.prepare('UPDATE users SET stato = \'disattivato\' WHERE id = ?').run(userId);

    const res = await request(app).post('/api/auth/login').send({ username: 'off', password: 'password1' });
    expect(res.status).toBe(403);
  });

  it('ends the session of a user disabled mid-session', async () => {
    const userId = createUser(db, { username: 'off2', password: 'password1', displayName: 'Off2' });
    const a = request.agent(app);
    await a.post('/api/auth/login').send({ username: 'off2', password: 'password1' });
    expect((await a.get('/api/participants')).status).toBe(200);

    db.prepare('UPDATE users SET stato = \'disattivato\' WHERE id = ?').run(userId);
    expect((await a.get('/api/participants')).status).toBe(401);
  });
});

describe('sospeso users', () => {
  it('lets a sospeso user log in and refuses a disattivato one', async () => {
    createUser(db, { username: 'sosp0', password: 'password1', stato: 'sospeso' });
    createUser(db, { username: 'dis', password: 'password1', stato: 'disattivato' });
    expect((await request(app).post('/api/auth/login').send({ username: 'sosp0', password: 'password1' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ username: 'dis', password: 'password1' })).status).toBe(403);
  });

  it('lets a sospeso user keep using the API', async () => {
    const userId = createUser(db, { username: 'sosp', password: 'password1' });
    const a = request.agent(app);
    await a.post('/api/auth/login').send({ username: 'sosp', password: 'password1' });
    db.prepare("UPDATE users SET stato = 'sospeso' WHERE id = ?").run(userId);
    const res = await a.get('/api/participants');
    expect(res.status).toBe(200);
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

describe('public endpoints', () => {
  it('serves the 2.17 news page without a session', async () => {
    const res = await request(app).get('/v2.17');
    expect(res.status).toBe(200);
    expect(res.text).toContain('gass-turni.mp4');
  });

  it('serves the admin video page without a session', async () => {
    const res = await request(app).get('/admin-video');
    expect(res.status).toBe(200);
    expect(res.text).toContain('gass-admin.mp4');
  });

  it('serves /api/version without a session', async () => {
    const res = await request(app).get('/api/version');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(require('../../package.json').version);
  });
});

describe('local login with OIDC enabled', () => {
  it('rejects local login for non-admins when OIDC is enabled, without starting a session', async () => {
    createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });
    const userAgent = request.agent(app);
    process.env.OIDC_ISSUER = 'https://auth.example.test';
    try {
      const res = await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });
      expect(res.status).toBe(403);
    } finally {
      delete process.env.OIDC_ISSUER;
    }
    const session = await userAgent.get('/api/auth/session');
    expect(session.body.authenticated).toBe(false);
  });
});
