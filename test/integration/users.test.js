'use strict';

// MUST be first
const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { setupTestApp } = require('../helpers/setup-app');
const { createUser, clearNonAdminUsers } = require('../helpers/seed');
const request = require('supertest');

let app, adminAgent;

beforeAll(() => {
  ({ app } = setupTestApp());
  adminAgent = request.agent(app);
  return adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin' });
});

beforeEach(() => {
  clearNonAdminUsers(db);
  db.prepare('DELETE FROM activity_logs').run();
});

describe('GET /api/users', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });
    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });

    const res = await userAgent.get('/api/users');
    expect(res.status).toBe(403);
  });

  it('returns all users for admin', async () => {
    createUser(db, { username: 'mario', displayName: 'Mario' });
    const res = await adminAgent.get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.users.length).toBeGreaterThanOrEqual(2);
  });
});

describe('PUT /api/users/:id', () => {
  it('returns 403 for non-admin', async () => {
    createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });
    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });

    const user = db.prepare('SELECT id FROM users WHERE username = ?').get('user1');
    const res = await userAgent.put(`/api/users/${user.id}`).send({ displayName: 'New Name' });
    expect(res.status).toBe(403);
  });

  it('updates display name and logs user_edited', async () => {
    const userId = createUser(db, { username: 'mario', displayName: 'Mario Rossi' });

    const res = await adminAgent.put(`/api/users/${userId}`).send({ displayName: 'Mario Bianchi' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
    expect(user.display_name).toBe('Mario Bianchi');

    const log = db.prepare("SELECT * FROM activity_logs WHERE event_type = 'user_edited'").get();
    expect(log).toBeDefined();
    expect(log.details).toContain('Mario Rossi');
    expect(log.details).toContain('Mario Bianchi');
  });

  it('resets password (no current password required for admin)', async () => {
    const userId = createUser(db, { username: 'mario', password: 'oldpass1', displayName: 'Mario' });

    const res = await adminAgent.put(`/api/users/${userId}`).send({ newPassword: 'newpass123' });
    expect(res.status).toBe(200);

    // Can log in with new password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'mario', password: 'newpass123' });
    expect(loginRes.status).toBe(200);
  });

  it('returns 400 when new password too short', async () => {
    const userId = createUser(db, { username: 'mario', displayName: 'Mario' });

    const res = await adminAgent.put(`/api/users/${userId}`).send({ newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('promotes user to admin', async () => {
    const userId = createUser(db, { username: 'mario', displayName: 'Mario', isAdmin: false });

    const res = await adminAgent.put(`/api/users/${userId}`).send({ isAdmin: true });
    expect(res.status).toBe(200);

    const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId);
    expect(user.is_admin).toBe(1);
  });

  it('cannot remove admin from last admin', async () => {
    const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');

    const res = await adminAgent.put(`/api/users/${adminUser.id}`).send({ isAdmin: false });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('ultimo');
  });

  it('returns 400 when no fields to update', async () => {
    const userId = createUser(db, { username: 'mario', displayName: 'Mario' });

    const res = await adminAgent.put(`/api/users/${userId}`).send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent user', async () => {
    const res = await adminAgent.put('/api/users/99999').send({ displayName: 'Ghost' });
    expect(res.status).toBe(404);
  });
});
