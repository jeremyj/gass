'use strict';

const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { setupTestApp } = require('../helpers/setup-app');
const { createUser, createTurno, clearTurni, clearNonAdminUsers } = require('../helpers/seed');
const request = require('supertest');

let app, adminAgent, userAgent;

beforeAll(async () => {
  ({ app } = setupTestApp());
  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin' });
});

beforeEach(async () => {
  clearNonAdminUsers(db);
  clearTurni(db);
  db.prepare('DELETE FROM activity_logs').run();
  createUser(db, { username: 'user1', password: 'password1' });
  userAgent = request.agent(app);
  await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });
});

// Own-slot actions and the auto switch; a separate file because the login limiter
// (10 per window) is shared by all tests in one file
describe('own turno and automatic generation', () => {
  it('lets a user leave or move only their own turno', async () => {
    const me = db.prepare("SELECT id FROM users WHERE username = 'user1'").get().id;
    const [b, c] = ['lb', 'lc'].map(u => createUser(db, { username: u }));
    const x = createTurno(db, { settimana: '2099-04-07', t1: me, t2: b });
    const y = createTurno(db, { settimana: '2099-04-14', t1: c });
    expect((await userAgent.post('/api/turni/lascia').send({ a: { id: x, slot: 2 } })).status).toBe(403);
    expect((await userAgent.post('/api/turni/sposta').send({ a: { id: x, slot: 1 }, to: y })).status).toBe(200);
    expect(db.prepare('SELECT turnista2_id t FROM turni WHERE id = ?').get(y).t).toBe(me);
    expect((await userAgent.post('/api/turni/lascia').send({ a: { id: y, slot: 2 } })).status).toBe(200);
    expect(db.prepare('SELECT turnista2_id t FROM turni WHERE id = ?').get(y).t).toBeNull();
    expect(db.prepare("SELECT COUNT(*) n FROM activity_logs WHERE event_type = 'turno_modificato'").get().n).toBe(2);
  });

  it('pauses and resumes automatic generation (admin only)', async () => {
    expect((await userAgent.put('/api/turni/auto').send({ auto: false })).status).toBe(403);
    expect((await adminAgent.put('/api/turni/auto').send({ auto: false })).status).toBe(200);
    expect((await adminAgent.get('/api/turni')).body.auto).toBe(false);
    expect((await adminAgent.put('/api/turni/auto').send({ auto: true })).status).toBe(200);
  });

  it('keeps free-text notes that admins write and everyone reads', async () => {
    expect((await userAgent.get('/api/turni')).body.note).toBe('');
    expect((await userAgent.put('/api/turni/note').send({ note: 'x' })).status).toBe(403);
    expect((await adminAgent.put('/api/turni/note').send({ note: '  Dicembre: Anna affianca Luca\n' })).status).toBe(200);
    expect((await userAgent.get('/api/turni')).body.note).toBe('Dicembre: Anna affianca Luca');
    expect((await adminAgent.put('/api/turni/note').send({ note: 'a'.repeat(5001) })).status).toBe(400);
  });
  it('shows past weeks to admins who ask for them', async () => {
    createTurno(db, { settimana: '2020-01-07' });
    expect((await adminAgent.get('/api/turni')).body.turni.some(t => t.settimana === '2020-01-07')).toBe(false);
    expect((await adminAgent.get('/api/turni?passati=1')).body.turni[0].settimana).toBe('2020-01-07');
    expect((await userAgent.get('/api/turni?passati=1')).body.turni.some(t => t.settimana === '2020-01-07')).toBe(false);
  });
});
