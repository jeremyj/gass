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

describe('GET /api/storico', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/storico');
    expect(res.status).toBe(401);
  });

  it('returns empty list when no consegne', async () => {
    const res = await adminAgent.get('/api/storico');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.consegne).toHaveLength(0);
  });

  it('returns consegne in DESC order with num_movimenti', async () => {
    const userId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin').id;
    const c1 = createConsegna(db, { data: '2026-01-01' });
    const c2 = createConsegna(db, { data: '2026-02-01' });
    createMovimento(db, { consegnaId: c1, partecipanteId: userId });
    createMovimento(db, { consegnaId: c1, partecipanteId: userId, creditoLasciato: 10 });

    const res = await adminAgent.get('/api/storico');
    expect(res.status).toBe(200);
    expect(res.body.consegne).toHaveLength(2);
    expect(res.body.consegne[0].data).toBe('2026-02-01'); // newest first
    expect(res.body.consegne[1].data).toBe('2026-01-01');
    expect(res.body.consegne[1].num_movimenti).toBe(2);
  });

  it('sums incassato and quota teatro per consegna', async () => {
    const a = createUser(db, { username: 'ta', displayName: 'Anna' });
    const b = createUser(db, { username: 'tb', displayName: 'Bruno' });
    const c = createConsegna(db, { data: '2026-03-03' });
    createConsegna(db, { data: '2026-03-10' });
    createMovimento(db, { consegnaId: c, partecipanteId: a, importoSaldato: 10.1 });
    createMovimento(db, { consegnaId: c, partecipanteId: b, importoSaldato: 0.2 });
    const pay = db.prepare('INSERT INTO teatro_pagamenti (user_id, data, importo, consegna_id) VALUES (?, ?, ?, ?)');
    pay.run(a, '2026-03-03', 10, c);
    pay.run(b, '2026-03-03', 5, c);

    const res = await adminAgent.get('/api/storico');
    const [vuota, piena] = res.body.consegne;
    expect(piena.incassato).toBe(10.3);
    expect(piena.teatro).toBe(15);
    expect(vuota.incassato).toBe(0);
    expect(vuota.teatro).toBe(0);
  });

  it('no longer serves /dettaglio', async () => {
    const res = await adminAgent.get('/api/storico/dettaglio');
    expect(res.status).toBe(404);
  });

  it('chains trovato_in_cassa from previous lasciato_in_cassa', async () => {
    createConsegna(db, { data: '2026-01-01', lasciatoInCassa: 75 });
    createConsegna(db, { data: '2026-02-01', lasciatoInCassa: 50 });

    const res = await adminAgent.get('/api/storico');
    const c2 = res.body.consegne.find(c => c.data === '2026-02-01');
    // trovato for second consegna should be 75 (lasciato from first)
    expect(c2.trovato_in_cassa).toBe(75);
  });
});
