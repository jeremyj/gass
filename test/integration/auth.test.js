'use strict';

// MUST be first: patch require cache before loading app
const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { setupTestApp } = require('../helpers/setup-app');
const { createUser } = require('../helpers/seed');
const request = require('supertest');

let app, agent;

beforeAll(() => {
  ({ app, agent } = setupTestApp());
});

beforeEach(() => {
  // Remove non-admin users and clear session state between tests
  db.prepare('DELETE FROM users WHERE is_admin = 0').run();
  db.prepare('DELETE FROM activity_logs').run();
});

describe('POST /api/auth/login', () => {
  it('returns 200 and user data on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.username).toBe('admin');
    expect(res.body.user.isAdmin).toBe(true);
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBeUndefined();
  });

  it('returns 401 on unknown username', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'whatever' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when credentials are missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/logout', () => {
  it('destroys session and returns 200', async () => {
    // Use a persistent agent for this test
    const a = request.agent(app);
    await a.post('/api/auth/login').send({ username: 'admin', password: 'admin' });

    const logoutRes = await a.post('/api/auth/logout');
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Session should be gone
    const sessionRes = await a.get('/api/auth/session');
    expect(sessionRes.body.authenticated).toBe(false);
  });
});

describe('GET /api/auth/session', () => {
  it('returns authenticated=false when not logged in', async () => {
    const res = await request(app).get('/api/auth/session');
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(false);
  });

  it('returns authenticated=true with user data after login', async () => {
    const a = request.agent(app);
    await a.post('/api/auth/login').send({ username: 'admin', password: 'admin' });

    const res = await a.get('/api/auth/session');
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.user.username).toBe('admin');
  });
});

describe('POST /api/auth/change-password', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'admin', newPassword: 'newpass123' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when new password is too short', async () => {
    const a = request.agent(app);
    await a.post('/api/auth/login').send({ username: 'admin', password: 'admin' });

    const res = await a
      .post('/api/auth/change-password')
      .send({ currentPassword: 'admin', newPassword: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8/);
  });

  it('returns 401 when current password is wrong', async () => {
    const a = request.agent(app);
    await a.post('/api/auth/login').send({ username: 'admin', password: 'admin' });

    const res = await a
      .post('/api/auth/change-password')
      .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword123' });
    expect(res.status).toBe(401);
  });

  it('changes password successfully', async () => {
    createUser(db, { username: 'testuser', password: 'testpass1', displayName: 'Test' });
    const a = request.agent(app);
    await a.post('/api/auth/login').send({ username: 'testuser', password: 'testpass1' });

    const res = await a
      .post('/api/auth/change-password')
      .send({ currentPassword: 'testpass1', newPassword: 'newtestpass1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Can log in with new password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'newtestpass1' });
    expect(loginRes.status).toBe(200);
  });
});
