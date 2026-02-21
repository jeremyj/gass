'use strict';

// MUST be first
const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { setupTestApp } = require('../helpers/setup-app');
const { createUser, createConsegna, createMovimento, clearConsegne, clearNonAdminUsers } = require('../helpers/seed');
const request = require('supertest');

let app, adminAgent;

beforeAll(() => {
  ({ app } = setupTestApp());
  adminAgent = request.agent(app);
  return adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin' });
});

beforeEach(() => {
  clearConsegne(db);
  clearNonAdminUsers(db);
});

describe('GET /api/participants', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/participants');
    expect(res.status).toBe(401);
  });

  it('returns all participants with current saldi', async () => {
    createUser(db, { username: 'mario', displayName: 'Mario', saldo: 50 });

    const res = await adminAgent.get('/api/participants');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.participants.length).toBeGreaterThanOrEqual(2); // admin + mario
    const mario = res.body.participants.find(p => p.nome === 'Mario');
    expect(mario).toBeDefined();
    expect(mario.saldo).toBe(50);
  });

  it('calculates historical saldi as of a given date when ?date= provided', async () => {
    // users.saldo must reflect current state after all movimenti (as POST /api/consegna would set it)
    // +30 (c1) + +20 (c2) = 50 total
    const userId = createUser(db, { username: 'mario', displayName: 'Mario', saldo: 50 });
    const c1 = createConsegna(db, { data: '2026-01-01' });
    const c2 = createConsegna(db, { data: '2026-02-01' });
    createMovimento(db, { consegnaId: c1, partecipanteId: userId, creditoLasciato: 30 });
    createMovimento(db, { consegnaId: c2, partecipanteId: userId, creditoLasciato: 20 });

    // Historical saldo up to and including 2026-01-01: saldo(50) - all_mv(50) + date_mv(30) = 30
    const res = await adminAgent.get('/api/participants?date=2026-01-01');
    expect(res.status).toBe(200);
    const mario = res.body.participants.find(p => p.nome === 'Mario');
    expect(mario.saldo).toBe(30);
  });
});

describe('POST /api/participants', () => {
  it('returns 403 for non-admin', async () => {
    createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });
    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });

    const res = await userAgent
      .post('/api/participants')
      .send({ nome: 'Nuova', username: 'nuova', password: 'password123' });
    expect(res.status).toBe(403);
  });

  it('creates a participant and logs user_created event', async () => {
    const res = await adminAgent
      .post('/api/participants')
      .send({ nome: 'Nuova Persona', username: 'nuova', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.id).toBe('number');

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get('nuova');
    expect(user).toBeDefined();
    expect(user.display_name).toBe('Nuova Persona');

    const log = db.prepare("SELECT * FROM activity_logs WHERE event_type = 'user_created'").get();
    expect(log).toBeDefined();
  });

  it('returns 400 when username already exists', async () => {
    createUser(db, { username: 'dup', displayName: 'Dup' });

    const res = await adminAgent
      .post('/api/participants')
      .send({ nome: 'Dup2', username: 'dup', password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Username/i);
  });

  it('returns 400 when password too short', async () => {
    const res = await adminAgent
      .post('/api/participants')
      .send({ nome: 'Test', username: 'test123', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields missing', async () => {
    const res = await adminAgent
      .post('/api/participants')
      .send({ nome: 'Test' }); // missing username and password
    expect(res.status).toBe(400);
  });
});

describe('GET /api/participants/:id/transactions', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/participants/1/transactions');
    expect(res.status).toBe(401);
  });

  it('returns transactions for own user (non-admin)', async () => {
    const userId = createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });
    const c1 = createConsegna(db, { data: '2026-01-10' });
    createMovimento(db, { consegnaId: c1, partecipanteId: userId, contoProduttore: 100, importoSaldato: 80, creditoLasciato: 20 });

    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });

    const res = await userAgent.get(`/api/participants/${userId}/transactions`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0].consegna_data).toBe('2026-01-10');
    expect(res.body.transactions[0].conto_produttore).toBe(100);
    expect(res.body.transactions[0].credito_lasciato).toBe(20);
  });

  it('allows non-admin to view another user transactions', async () => {
    const userId1 = createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });
    const userId2 = createUser(db, { username: 'user2', password: 'password2', displayName: 'User2' });

    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });

    const res = await userAgent.get(`/api/participants/${userId2}/transactions`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('admin can view any user transactions', async () => {
    const userId = createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });
    const c1 = createConsegna(db, { data: '2026-01-10' });
    createMovimento(db, { consegnaId: c1, partecipanteId: userId, contoProduttore: 50, debitoLasciato: 10 });

    const res = await adminAgent.get(`/api/participants/${userId}/transactions`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0].debito_lasciato).toBe(10);
  });

  it('returns transactions sorted by date descending', async () => {
    const userId = createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });
    const c1 = createConsegna(db, { data: '2026-01-01' });
    const c2 = createConsegna(db, { data: '2026-02-01' });
    createMovimento(db, { consegnaId: c1, partecipanteId: userId, contoProduttore: 30 });
    createMovimento(db, { consegnaId: c2, partecipanteId: userId, contoProduttore: 50 });

    const res = await adminAgent.get(`/api/participants/${userId}/transactions`);
    expect(res.body.transactions).toHaveLength(2);
    expect(res.body.transactions[0].consegna_data).toBe('2026-02-01');
    expect(res.body.transactions[1].consegna_data).toBe('2026-01-01');
  });

  it('returns empty array when no transactions exist', async () => {
    const userId = createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });

    const res = await adminAgent.get(`/api/participants/${userId}/transactions`);
    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(0);
  });
});

describe('PUT /api/participants/:id', () => {
  it('returns 403 for non-admin', async () => {
    const userId = createUser(db, { username: 'user1', password: 'password1', displayName: 'User1', saldo: 10 });
    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });

    const res = await userAgent.put(`/api/participants/${userId}`).send({ saldo: 50 });
    expect(res.status).toBe(403);
  });

  it('updates saldo and logs saldo_updated event', async () => {
    const userId = createUser(db, { username: 'mario', displayName: 'Mario', saldo: 10 });

    const res = await adminAgent.put(`/api/participants/${userId}`).send({ saldo: 100 });
    expect(res.status).toBe(200);

    const user = db.prepare('SELECT saldo FROM users WHERE id = ?').get(userId);
    expect(user.saldo).toBe(100);

    const log = db.prepare("SELECT * FROM activity_logs WHERE event_type = 'saldo_updated'").get();
    expect(log).toBeDefined();
    expect(log.details).toContain('10');
    expect(log.details).toContain('100');
  });
});

describe('DELETE /api/participants/:id', () => {
  it('returns 403 for non-admin', async () => {
    const userId = createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });
    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });

    const res = await userAgent.delete(`/api/participants/${userId}`);
    expect(res.status).toBe(403);
  });

  it('deletes participant and logs user_deleted event', async () => {
    const userId = createUser(db, { username: 'deleteme', displayName: 'Delete Me' });

    const res = await adminAgent.delete(`/api/participants/${userId}`);
    expect(res.status).toBe(200);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    expect(user).toBeUndefined();

    const log = db.prepare("SELECT * FROM activity_logs WHERE event_type = 'user_deleted'").get();
    expect(log).toBeDefined();
  });

  it('returns 400 when trying to delete the last user', async () => {
    // admin is the only user after beforeEach cleanup
    const adminId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin').id;

    const res = await adminAgent.delete(`/api/participants/${adminId}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('ultimo');
  });
});
