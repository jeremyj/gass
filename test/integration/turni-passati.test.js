'use strict';

// Admin edits of past turni ("Giorno"); own file because the login limiter allows 10 logins per app
const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { setupTestApp } = require('../helpers/setup-app');
const { createUser, createTurno, createConsegna, clearTurni, clearNonAdminUsers } = require('../helpers/seed');
const request = require('supertest');

let adminAgent;

beforeAll(async () => {
  const { app } = setupTestApp();
  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin' });
});

beforeEach(() => {
  clearNonAdminUsers(db);
  clearTurni(db);
  db.prepare('DELETE FROM consegne').run();
});

describe('past turni', () => {
  it('lets only admins edit the day of a past consegna, never its names', async () => {
    const [a, b] = ['pa', 'pb'].map(u => createUser(db, { username: u }));
    const x = createTurno(db, { settimana: '2020-01-07', t1: a, t2: b });
    expect((await adminAgent.put(`/api/turni/${x}`).send({ turnista1Id: null })).status).toBe(400);
    expect((await adminAgent.put(`/api/turni/${x}`).send({ saltata: true, nota: 'pioggia' })).status).toBe(200);
    expect(db.prepare('SELECT saltata, turnista1_id, nota FROM turni WHERE id = ?').get(x))
      .toEqual({ saltata: 1, turnista1_id: null, nota: 'pioggia' });
    expect((await adminAgent.put(`/api/turni/${x}`).send({ saltata: false })).status).toBe(200);
    expect(db.prepare('SELECT saltata FROM turni WHERE id = ?').get(x).saltata).toBe(0);
  });

  it('refuses niente consegna on a past date with a recorded consegna', async () => {
    const x = createTurno(db, { settimana: '2020-01-14' });
    createConsegna(db, { data: '2020-01-14' });
    const res = await adminAgent.put(`/api/turni/${x}`).send({ saltata: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/consegna registrata/);
  });
});
