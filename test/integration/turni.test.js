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

describe('GET /api/turni', () => {
  it('returns 401 when not authenticated', async () => {
    expect((await request(app).get('/api/turni')).status).toBe(401);
  });

  it('generates and returns 26 weeks for any user', async () => {
    const res = await userAgent.get('/api/turni');
    expect(res.status).toBe(200);
    expect(res.body.auto).toBe(true);
    expect(res.body.turni).toHaveLength(26);
    expect(res.body.turni[0].turnisti).toHaveLength(2);
    expect(res.body.oggi).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('edits', () => {
  async function firstTurno() {
    return (await adminAgent.get('/api/turni')).body.turni[0];
  }

  it('lets any user edit names and the day, but only admins add pauses', async () => {
    const t = await firstTurno();
    const other = createUser(db, { username: 'other', displayName: 'Other' });
    expect((await userAgent.put(`/api/turni/${t.id}`).send({ nota: 'x', turnista1Id: other })).status).toBe(200);
    expect(db.prepare('SELECT turnista1_id t, nota FROM turni WHERE id = ?').get(t.id)).toEqual({ t: other, nota: 'x' });
    expect((await userAgent.post('/api/turni/pause').send({ dal: '2027-08-01', al: '2027-08-31' })).status).toBe(403);
  });

  it('refuses edits to past consegne', async () => {
    const x = createTurno(db, { settimana: '2020-01-07' });
    expect((await adminAgent.put(`/api/turni/${x}`).send({ nota: 'x' })).status).toBe(400);
    expect((await userAgent.put(`/api/turni/${x}`).send({ nota: 'x' })).status).toBe(400);
  });

  it('moves a consegna within its week and logs it', async () => {
    const t = await firstTurno();
    const wed = new Date(`${t.settimana}T12:00:00Z`);
    wed.setUTCDate(wed.getUTCDate() + 1);
    const res = await adminAgent.put(`/api/turni/${t.id}`).send({ data: wed.toISOString().slice(0, 10) });
    expect(res.status).toBe(200);
    expect(db.prepare("SELECT details FROM activity_logs WHERE event_type = 'turno_modificato'").get().details).toContain('data');
  });

  it('rejects a date outside the week', async () => {
    const t = await firstTurno();
    const res = await adminAgent.put(`/api/turni/${t.id}`).send({ data: '1999-01-01' });
    expect(res.status).toBe(400);
    expect(db.prepare('SELECT data FROM turni WHERE id = ?').get(t.id).data).toBe(t.data);
  });

  it('returns 404 for an unknown turno', async () => {
    expect((await adminAgent.put('/api/turni/999999').send({ nota: 'x' })).status).toBe(404);
  });

  it('swaps a person with someone else\'s next turno and logs who', async () => {
    const [a, b, c, d] = ['sa', 'sb', 'sc', 'sd'].map(u => createUser(db, { username: u, displayName: u.toUpperCase() }));
    const x = createTurno(db, { settimana: '2099-02-03', t1: a, t2: b });
    const y = createTurno(db, { settimana: '2099-02-10', t1: c, t2: d });
    const res = await adminAgent.post('/api/turni/scambio').send({ a: { id: x, slot: 1 }, userId: c });
    expect(res.status).toBe(200);
    expect(db.prepare('SELECT turnista1_id t FROM turni WHERE id = ?').get(x).t).toBe(c);
    expect(db.prepare('SELECT turnista1_id t FROM turni WHERE id = ?').get(y).t).toBe(a);
    const row = db.prepare("SELECT details FROM activity_logs WHERE event_type = 'turno_scambio'").get();
    expect(row.details).toBe('scambio SA (03/02) ↔ SC (10/02)');
    expect((await adminAgent.post('/api/turni/scambio').send({ a: { id: x, slot: 1 } })).status).toBe(400);
  });

  it('lets a user swap anyone\'s turno', async () => {
    const [a, b, c, d] = ['ua', 'ub', 'uc', 'ud'].map(u => createUser(db, { username: u }));
    const x = createTurno(db, { settimana: '2099-03-03', t1: a, t2: b });
    const y = createTurno(db, { settimana: '2099-03-10', t1: c, t2: d });
    expect((await userAgent.post('/api/turni/scambio').send({ a: { id: x, slot: 2 }, userId: c })).status).toBe(200);
    expect(db.prepare('SELECT turnista2_id t FROM turni WHERE id = ?').get(x).t).toBe(c);
    expect(db.prepare('SELECT turnista1_id t FROM turni WHERE id = ?').get(y).t).toBe(b);
  });

  it('adds and deletes a pause', async () => {
    let res = await adminAgent.post('/api/turni/pause').send({ dal: '2099-08-01', al: '2099-08-31', nota: 'Estate' });
    expect(res.status).toBe(200);
    res = await adminAgent.delete(`/api/turni/pause/${res.body.id}`);
    expect(res.status).toBe(200);
    expect((await adminAgent.delete('/api/turni/pause/999999')).status).toBe(404);
    expect((await adminAgent.post('/api/turni/pause').send({ dal: '2099-09-01', al: '2099-08-01' })).status).toBe(400);
  });
});
