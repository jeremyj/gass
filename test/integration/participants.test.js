'use strict';

// MUST be first
const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { setupTestApp } = require('../helpers/setup-app');
const { createUser, createConsegna, createMovimento, createRettifica, clearConsegne, clearNonAdminUsers } = require('../helpers/seed');
const request = require('supertest');
const { toLocalDateString } = require('../../server/services/calculations');

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

  it('includes disabled participants with attivo = 0', async () => {
    const id = createUser(db, { username: 'gone', displayName: 'Gone' });
    db.prepare('UPDATE users SET attivo = 0 WHERE id = ?').run(id);

    const res = await adminAgent.get('/api/participants');
    expect(res.body.participants.find(p => p.id === id).attivo).toBe(0);
    expect(res.body.participants.find(p => p.nome === 'admin' || p.username === 'admin').attivo).toBe(1);
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
    expect(res.body.transactions[0].data).toBe('2026-01-10');
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
    expect(res.body.transactions[0].data).toBe('2026-02-01');
    expect(res.body.transactions[1].data).toBe('2026-01-01');
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

  it('records the difference as a dated rettifica and logs saldo_updated', async () => {
    const userId = createUser(db, { username: 'mario', displayName: 'Mario', saldo: -12.5 });
    createRettifica(db, { partecipanteId: userId, data: '2026-01-01', importo: -12.5 });

    const res = await adminAgent.put(`/api/participants/${userId}`).send({ saldo: 20 });
    expect(res.status).toBe(200);

    const user = db.prepare('SELECT saldo, ultima_modifica FROM users WHERE id = ?').get(userId);
    expect(user.saldo).toBe(20);

    const r = db.prepare('SELECT * FROM rettifiche_saldo WHERE partecipante_id = ? ORDER BY id DESC').get(userId);
    expect(r.importo).toBe(32.5);
    expect(r.data).toBe(toLocalDateString());
    expect(user.ultima_modifica).toBe(r.data);

    const log = db.prepare("SELECT * FROM activity_logs WHERE event_type = 'saldo_updated'").get();
    expect(log.details).toBe('saldo: -12.5 → 20');
  });

  it('does nothing when the saldo is unchanged', async () => {
    const userId = createUser(db, { username: 'mario', displayName: 'Mario' });
    await adminAgent.put(`/api/participants/${userId}`).send({ saldo: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM rettifiche_saldo').get().n).toBe(0);
  });

  it('returns 400 for a non-numeric saldo', async () => {
    const userId = createUser(db, { username: 'mario', displayName: 'Mario' });
    const res = await adminAgent.put(`/api/participants/${userId}`).send({ saldo: '10' });
    expect(res.status).toBe(400);
  });
});

describe('manual rettifiche in the ledger', () => {
  it('historical saldo counts a rettifica only from its date', async () => {
    const userId = createUser(db, { username: 'mario', displayName: 'Mario' });
    const c1 = createConsegna(db, { data: '2026-01-01' });
    createMovimento(db, { consegnaId: c1, partecipanteId: userId, creditoLasciato: 30 });
    createRettifica(db, { partecipanteId: userId, data: '2026-01-10', importo: -5 });

    const before = await adminAgent.get('/api/participants?date=2026-01-09');
    expect(before.body.participants.find(p => p.id === userId).saldo).toBe(30);
    const after = await adminAgent.get('/api/participants?date=2026-01-10');
    const mario = after.body.participants.find(p => p.id === userId);
    expect(mario.saldo).toBe(25);
    expect(mario.ultima_modifica).toBe('2026-01-10');
  });

  it('transactions include rettifiche with the running saldo', async () => {
    const userId = createUser(db, { username: 'mario', displayName: 'Mario' });
    const c1 = createConsegna(db, { data: '2026-01-01' });
    createMovimento(db, { consegnaId: c1, partecipanteId: userId, debitoLasciato: 10 });
    createRettifica(db, { partecipanteId: userId, data: '2026-01-05', importo: 10 });

    const res = await adminAgent.get(`/api/participants/${userId}/transactions`);
    expect(res.body.transactions.map(t => [t.tipo, t.data, t.saldo_dopo])).toEqual([
      ['rettifica', '2026-01-05', 0],
      ['movimento', '2026-01-01', -10]
    ]);
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

  it('refuses to delete a participant with movimenti', async () => {
    const userId = createUser(db, { username: 'withmov', displayName: 'With Mov' });
    const c = createConsegna(db, { data: '2026-01-10' });
    createMovimento(db, { consegnaId: c, partecipanteId: userId, importoSaldato: 10, creditoLasciato: 10 });

    const res = await adminAgent.delete(`/api/participants/${userId}`);
    expect(res.status).toBe(400);
    expect(db.prepare('SELECT id FROM users WHERE id = ?').get(userId)).toBeDefined();
  });

  it('refuses to delete a participant with rettifiche', async () => {
    const userId = createUser(db, { username: 'withrett', displayName: 'With Rett' });
    createRettifica(db, { partecipanteId: userId, data: '2026-01-10', importo: 5 });

    const res = await adminAgent.delete(`/api/participants/${userId}`);
    expect(res.status).toBe(400);
  });

  it('keeps log and audit rows referencing the deleted user, unlinked', async () => {
    const userId = createUser(db, { username: 'edited', displayName: 'Edited' });
    await adminAgent.put(`/api/users/${userId}`).send({ displayName: 'Edited 2' });
    const c = createConsegna(db, { data: '2026-01-11' });
    db.prepare('UPDATE consegne SET chiusa_by = ? WHERE id = ?').run(userId, c);

    const res = await adminAgent.delete(`/api/participants/${userId}`);
    expect(res.status).toBe(200);

    const edited = db.prepare("SELECT target_user_id FROM activity_logs WHERE event_type = 'user_edited'").get();
    expect(edited).toBeDefined();
    expect(edited.target_user_id).toBeNull();
    expect(db.prepare('SELECT chiusa_by FROM consegne WHERE id = ?').get(c).chiusa_by).toBeNull();
  });

  it('refuses an admin deleting their own account', async () => {
    createUser(db, { username: 'other', displayName: 'Other' });
    const adminId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin').id;

    const res = await adminAgent.delete(`/api/participants/${adminId}`);
    expect(res.status).toBe(400);
    expect(db.prepare('SELECT id FROM users WHERE id = ?').get(adminId)).toBeDefined();
  });
});

describe('deleteUser service (also used by manage-users.js)', () => {
  const { deleteUser } = require('../../server/services/users');

  it('refuses a user with movimenti, leaving them in place', () => {
    const userId = createUser(db, { username: 'climov', displayName: 'Cli Mov' });
    const c = createConsegna(db, { data: '2026-01-12' });
    createMovimento(db, { consegnaId: c, partecipanteId: userId, importoSaldato: 5, creditoLasciato: 5 });

    expect(deleteUser(db, userId)).toMatch(/movimenti/);
    expect(db.prepare('SELECT id FROM users WHERE id = ?').get(userId)).toBeDefined();
  });

  it('refuses to delete the last user', () => {
    // admin is the only user after beforeEach cleanup
    const adminId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin').id;
    expect(deleteUser(db, adminId)).toContain('ultimo');
  });

  it('deletes a user without history', () => {
    const userId = createUser(db, { username: 'cliok', displayName: 'Cli Ok' });
    expect(deleteUser(db, userId)).toBeNull();
    expect(db.prepare('SELECT id FROM users WHERE id = ?').get(userId)).toBeUndefined();
  });
});
