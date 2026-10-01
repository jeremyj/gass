'use strict';

const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { setupTestApp } = require('../helpers/setup-app');
const { createUser, clearTeatro } = require('../helpers/seed');
const request = require('supertest');

let app, adminAgent, userAgent, me;

beforeAll(async () => {
  ({ app } = setupTestApp());
  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin' });
  me = createUser(db, { username: 'tuser', password: 'password1' });
  userAgent = request.agent(app);
  await userAgent.post('/api/auth/login').send({ username: 'tuser', password: 'password1' });
});

beforeEach(() => {
  clearTeatro(db);
  db.prepare("DELETE FROM activity_logs WHERE event_type LIKE 'teatro%'").run();
});

describe('/api/teatro', () => {
  it('opens the current semester and shows a person what they owe', async () => {
    const res = await userAgent.get(`/api/teatro/utente/${me}`);
    expect(res.status).toBe(200);
    expect(res.body.righe).toHaveLength(1);
    expect(res.body.residuo).toBe(15);
  });

  it('lets anyone record a payment, logged, and shows it in the participants list', async () => {
    const res = await userAgent.post('/api/teatro/pagamenti').send({ userId: me, importo: 20 });
    expect(res.status).toBe(200);
    const p = (await userAgent.get('/api/participants')).body.participants.find(x => x.id === me);
    expect(p.teatro_residuo).toBe(-5); // 15 owed, 20 paid: 5 in advance
    expect(db.prepare("SELECT COUNT(*) n FROM activity_logs WHERE event_type = 'teatro_pagamento'").get().n).toBe(1);
    expect((await userAgent.get('/api/teatro/oggi')).body.totale).toBe(20);
    expect((await userAgent.post('/api/teatro/pagamenti').send({ userId: me, importo: -1 })).status).toBe(400);
  });

  it('keeps the admin page and the corrections admin-only', async () => {
    expect((await userAgent.get('/api/teatro')).status).toBe(403);
    expect((await userAgent.put('/api/teatro/dovuti').send({ userId: me, semestre: '2026-2', dovuto: 7 })).status).toBe(403);
    const res = await adminAgent.get('/api/teatro');
    expect(res.status).toBe(200);
    expect(res.body.semestri.length).toBeGreaterThan(0);
    expect((await adminAgent.put('/api/teatro/dovuti').send({ userId: me, semestre: '2026-2', dovuto: 7 })).status).toBe(200);
    expect((await adminAgent.put('/api/teatro/semestri/2026-2').send({ quota: 18 })).status).toBe(200);
    expect((await adminAgent.post('/api/teatro/cassa').send({ data: '2026-10-10', importo: -300, descrizione: 'affitto' })).status).toBe(200);
    expect((await adminAgent.put('/api/teatro/nota').send({ userId: me, nota: 'da marzo' })).status).toBe(200);
    await userAgent.post('/api/teatro/pagamenti').send({ userId: me, importo: 7 });
    const pid = (await adminAgent.get('/api/teatro')).body.pagamenti[0].id;
    expect((await userAgent.delete(`/api/teatro/pagamenti/${pid}`)).status).toBe(403);
    expect((await adminAgent.delete(`/api/teatro/pagamenti/${pid}`)).status).toBe(200);
  });
});
