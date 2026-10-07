'use strict';

// MUST be first: patch require cache before loading app
const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { setupTestApp } = require('../helpers/setup-app');
const { createUser, createConsegna, createMovimento, createRettifica, clearConsegne, clearNonAdminUsers } = require('../helpers/seed');
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

// ===== GET /:date =====

describe('GET /api/consegna/:date', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/consegna/2026-02-19');
    expect(res.status).toBe(401);
  });

  it('returns found=false when no consegna exists for date', async () => {
    const res = await adminAgent.get('/api/consegna/2026-02-19');
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(false);
  });

  it('returns consegna with movimenti and saldiBefore', async () => {
    const userId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin').id;
    const consegnaId = createConsegna(db, { data: '2026-02-19', trovatoInCassa: 100, lasciatoInCassa: 120 });
    createMovimento(db, { consegnaId, partecipanteId: userId, creditoLasciato: 20, importoSaldato: 30 });

    const res = await adminAgent.get('/api/consegna/2026-02-19');
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.consegna.id).toBe(consegnaId);
    expect(res.body.movimenti).toHaveLength(1);
    expect(res.body.saldiBefore).toBeDefined();
  });

  it('includes lasciatoPrecedente from previous day', async () => {
    createConsegna(db, { data: '2026-02-18', lasciatoInCassa: 75 });

    const res = await adminAgent.get('/api/consegna/2026-02-19');
    expect(res.body.lasciatoPrecedente).toBe(75);
  });
});

// ===== POST / — saldo calculation (the critical bug regression test) =====

describe('POST /api/consegna/ — saldo calculation', () => {
  it('correctly calculates saldo on first save', async () => {
    const userId = createUser(db, { username: 'mario', password: 'password1', displayName: 'Mario', saldo: 0 });

    const res = await adminAgent.post('/api/consegna/').send({
      data: '2026-02-19',
      trovatoInCassa: 0,
      pagatoProduttore: 0,
      lasciatoInCassa: 0,
      partecipanti: [{
        partecipante_id: userId,
        importoSaldato: 0,
        usaCredito: 0,
        debitoLasciato: 0,
        creditoLasciato: 20,
        saldaDebitoTotale: false,
        debitoSaldato: 0,
        contoProduttore: 0,
        note: ''
      }]
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const user = db.prepare('SELECT saldo FROM users WHERE id = ?').get(userId);
    expect(user.saldo).toBe(20);
  });

  it('correctly re-calculates saldo on re-save (stored saldo - onOrAfterEffect)', async () => {
    // Reproduce the exact bug: re-saving a consegna should use stored saldo minus
    // movements on/after the consegna date, NOT movimenti sum from scratch.
    const userId = createUser(db, { username: 'mario', password: 'password1', displayName: 'Mario', saldo: 0 });

    // Consegna 1: +20 credit → saldo = 20
    await adminAgent.post('/api/consegna/').send({
      data: '2026-02-01',
      trovatoInCassa: 0, pagatoProduttore: 0, lasciatoInCassa: 0,
      partecipanti: [{ partecipante_id: userId, importoSaldato: 0, usaCredito: 0,
        debitoLasciato: 0, creditoLasciato: 20, saldaDebitoTotale: false, debitoSaldato: 0,
        contoProduttore: 0, note: '' }]
    });

    let user = db.prepare('SELECT saldo FROM users WHERE id = ?').get(userId);
    expect(user.saldo).toBe(20);

    // Consegna 2: +15 credit → saldo = 35
    await adminAgent.post('/api/consegna/').send({
      data: '2026-02-15',
      trovatoInCassa: 0, pagatoProduttore: 0, lasciatoInCassa: 0,
      partecipanti: [{ partecipante_id: userId, importoSaldato: 0, usaCredito: 0,
        debitoLasciato: 0, creditoLasciato: 15, saldaDebitoTotale: false, debitoSaldato: 0,
        contoProduttore: 0, note: '' }]
    });

    user = db.prepare('SELECT saldo FROM users WHERE id = ?').get(userId);
    expect(user.saldo).toBe(35);

    // Re-save consegna 2 with creditoLasciato=30 instead of 15
    // Expected: saldoBefore = 35 - 15 = 20, newSaldo = 20 + 30 = 50
    await adminAgent.post('/api/consegna/').send({
      data: '2026-02-15',
      trovatoInCassa: 0, pagatoProduttore: 0, lasciatoInCassa: 0,
      partecipanti: [{ partecipante_id: userId, importoSaldato: 0, usaCredito: 0,
        debitoLasciato: 0, creditoLasciato: 30, saldaDebitoTotale: false, debitoSaldato: 0,
        contoProduttore: 0, note: '' }]
    });

    user = db.prepare('SELECT saldo FROM users WHERE id = ?').get(userId);
    expect(user.saldo).toBe(50);
  });

  it('pagato_produttore is recalculated from movements', async () => {
    const userId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin').id;

    await adminAgent.post('/api/consegna/').send({
      data: '2026-02-19',
      trovatoInCassa: 100, pagatoProduttore: 0, lasciatoInCassa: 0,
      partecipanti: [{ partecipante_id: userId, importoSaldato: 50, usaCredito: 0,
        debitoLasciato: 0, creditoLasciato: 0, saldaDebitoTotale: false, debitoSaldato: 0,
        contoProduttore: 30, note: '' }]
    });

    const consegna = db.prepare("SELECT pagato_produttore FROM consegne WHERE data = '2026-02-19'").get();
    expect(consegna.pagato_produttore).toBe(30);
  });

  it('lasciato_in_cassa is recalculated as trovato + incassato - pagato', async () => {
    const userId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin').id;

    // trovato=100, importo_saldato=50 (incassato), conto_produttore=30 (pagato)
    // lasciato = 100 + 50 - 30 = 120
    await adminAgent.post('/api/consegna/').send({
      data: '2026-02-19',
      trovatoInCassa: 100, pagatoProduttore: 0, lasciatoInCassa: 999, // 999 should be overridden
      partecipanti: [{ partecipante_id: userId, importoSaldato: 50, usaCredito: 0,
        debitoLasciato: 0, creditoLasciato: 0, saldaDebitoTotale: false, debitoSaldato: 0,
        contoProduttore: 30, note: '' }]
    });

    const consegna = db.prepare("SELECT lasciato_in_cassa FROM consegne WHERE data = '2026-02-19'").get();
    expect(consegna.lasciato_in_cassa).toBe(120);
  });

  it('subtracts the uscite di cassa, and keeps them when a save does not send them', async () => {
    const userId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin').id;
    const movimento = { partecipante_id: userId, importoSaldato: 50, contoProduttore: 30 };
    const uscite = [{ importo: 45, motivo: 'teatro' }, { importo: 20, motivo: 'tofu' }];

    await adminAgent.post('/api/consegna/').send({ data: '2026-02-19', trovatoInCassa: 100, uscite, partecipanti: [movimento] }).expect(200);
    const lasciato = () => db.prepare("SELECT lasciato_in_cassa FROM consegne WHERE data = '2026-02-19'").get().lasciato_in_cassa;
    expect(lasciato()).toBe(55);
    expect((await adminAgent.get('/api/consegna/2026-02-19')).body.uscite).toEqual(uscite);

    // A client that predates the field (cached page) must not wipe them
    await adminAgent.post('/api/consegna/').send({ data: '2026-02-19', trovatoInCassa: 100, partecipanti: [] }).expect(200);
    expect(lasciato()).toBe(55);

    await adminAgent.post('/api/consegna/').send({ data: '2026-02-19', trovatoInCassa: 100, uscite: [], partecipanti: [] }).expect(200);
    expect(lasciato()).toBe(120);
    expect((await adminAgent.get('/api/consegna/2026-02-19')).body.uscite).toEqual([]);
  });

  it('counts a negative uscita (entrata, e.g. Altobelli paid rounded down) in the lasciato', async () => {
    const uscite = [{ importo: 90, motivo: 'teatro' }, { importo: 0.8, motivo: 'arrotondamento Altobelli' }, { importo: -0.2, motivo: 'arrotondamento' }];
    await adminAgent.post('/api/consegna/').send({ data: '2026-02-19', trovatoInCassa: 200, pagatoProduttore: 0, uscite, partecipanti: [] }).expect(200);
    expect(db.prepare("SELECT lasciato_in_cassa FROM consegne WHERE data = '2026-02-19'").get().lasciato_in_cassa).toBe(109.4);
    expect((await adminAgent.get('/api/consegna/2026-02-19')).body.uscite).toEqual(uscite);
  });

  it('returns 403 when non-admin tries to save to a closed consegna', async () => {
    const userId = createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });
    const consegnaId = createConsegna(db, { data: '2026-02-19', chiusa: true });

    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });

    const res = await userAgent.post('/api/consegna/').send({
      data: '2026-02-19',
      trovatoInCassa: 0, pagatoProduttore: 0, lasciatoInCassa: 0,
      partecipanti: [{ partecipante_id: userId, importoSaldato: 0, usaCredito: 0,
        debitoLasciato: 0, creditoLasciato: 0, saldaDebitoTotale: false, debitoSaldato: 0,
        contoProduttore: 0, note: '' }]
    });

    expect(res.status).toBe(403);
  });

  it('admin can save to a closed consegna', async () => {
    const userId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin').id;
    createConsegna(db, { data: '2026-02-19', chiusa: true });

    const res = await adminAgent.post('/api/consegna/').send({
      data: '2026-02-19',
      trovatoInCassa: 0, pagatoProduttore: 0, lasciatoInCassa: 0,
      partecipanti: [{ partecipante_id: userId, importoSaldato: 0, usaCredito: 0,
        debitoLasciato: 0, creditoLasciato: 0, saldaDebitoTotale: false, debitoSaldato: 0,
        contoProduttore: 0, note: '' }]
    });

    expect(res.status).toBe(200);
  });
});

// ===== DELETE /:id =====

describe('DELETE /api/consegna/:id', () => {
  it('rejects non-admin delete (403) and keeps the consegna', async () => {
    createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });
    const consegnaId = createConsegna(db, { data: '2026-02-19' });

    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });

    const res = await userAgent.delete(`/api/consegna/${consegnaId}`);
    expect(res.status).toBe(403);
    expect(db.prepare('SELECT id FROM consegne WHERE id = ?').get(consegnaId)).toBeDefined();
  });

  it('deletes consegna and recalculates saldi from scratch', async () => {
    const userId = createUser(db, { username: 'mario', password: 'password1', displayName: 'Mario', saldo: 0 });

    // Create two consegne
    await adminAgent.post('/api/consegna/').send({
      data: '2026-02-01',
      trovatoInCassa: 0, pagatoProduttore: 0, lasciatoInCassa: 0,
      partecipanti: [{ partecipante_id: userId, importoSaldato: 0, usaCredito: 0,
        debitoLasciato: 0, creditoLasciato: 20, saldaDebitoTotale: false, debitoSaldato: 0,
        contoProduttore: 0, note: '' }]
    });

    await adminAgent.post('/api/consegna/').send({
      data: '2026-02-15',
      trovatoInCassa: 0, pagatoProduttore: 0, lasciatoInCassa: 0,
      partecipanti: [{ partecipante_id: userId, importoSaldato: 0, usaCredito: 0,
        debitoLasciato: 0, creditoLasciato: 30, saldaDebitoTotale: false, debitoSaldato: 0,
        contoProduttore: 0, note: '' }]
    });

    let user = db.prepare('SELECT saldo FROM users WHERE id = ?').get(userId);
    expect(user.saldo).toBe(50); // 20 + 30

    // Delete the second consegna
    const c2 = db.prepare("SELECT id FROM consegne WHERE data = '2026-02-15'").get();
    const res = await adminAgent.delete(`/api/consegna/${c2.id}`);
    expect(res.status).toBe(200);

    // Saldo should be replayed from remaining consegna (only +20)
    user = db.prepare('SELECT saldo FROM users WHERE id = ?').get(userId);
    expect(user.saldo).toBe(20);
  });
});

// ===== LEDGER: manual rettifiche and out-of-order saves =====

function saveConsegna(data, userId, creditoLasciato) {
  return adminAgent.post('/api/consegna/').send({
    data, trovatoInCassa: 0, pagatoProduttore: 0, lasciatoInCassa: 0,
    partecipanti: [{ partecipante_id: userId, importoSaldato: 0, usaCredito: 0,
      debitoLasciato: 0, creditoLasciato, saldaDebitoTotale: false, debitoSaldato: 0,
      contoProduttore: 0, note: '' }]
  });
}

describe('saldo ledger', () => {
  it('deleting a consegna keeps manual rettifiche', async () => {
    const userId = createUser(db, { username: 'mario', password: 'password1', displayName: 'Mario' });
    await saveConsegna('2026-02-01', userId, 20);
    await adminAgent.put(`/api/participants/${userId}`).send({ saldo: 100 }); // +80 rettifica
    await saveConsegna('2026-02-15', userId, 30);

    const c2 = db.prepare("SELECT id FROM consegne WHERE data = '2026-02-15'").get();
    await adminAgent.delete(`/api/consegna/${c2.id}`);

    expect(db.prepare('SELECT saldo FROM users WHERE id = ?').get(userId).saldo).toBe(100);
  });

  it('re-saving an earlier consegna keeps the effect of later ones', async () => {
    const userId = createUser(db, { username: 'mario', password: 'password1', displayName: 'Mario' });
    await saveConsegna('2026-02-01', userId, 20);
    await saveConsegna('2026-02-15', userId, 30);
    await saveConsegna('2026-02-01', userId, 25);

    expect(db.prepare('SELECT saldo FROM users WHERE id = ?').get(userId).saldo).toBe(55);
  });

  it('saldiBefore includes same-day rettifiche entered before the movimento', async () => {
    const userId = createUser(db, { username: 'mario', password: 'password1', displayName: 'Mario' });
    createRettifica(db, { partecipanteId: userId, data: '2026-03-01', importo: -10, createdAt: '2026-03-01T08:00:00.000Z' });

    let res = await adminAgent.get('/api/consegna/2026-03-01');
    expect(res.body.saldiBefore[userId]).toBe(-10);

    const c = createConsegna(db, { data: '2026-03-01' });
    createMovimento(db, { consegnaId: c, partecipanteId: userId, saldaDebitoTotale: 1, createdAt: '2026-03-01T09:00:00.000Z' });
    createRettifica(db, { partecipanteId: userId, data: '2026-03-01', importo: 5, createdAt: '2026-03-01T10:00:00.000Z' });

    res = await adminAgent.get('/api/consegna/2026-03-01');
    expect(res.body.saldiBefore[userId]).toBe(-10);
  });
});

// ===== CLOSE / REOPEN =====

describe('POST /api/consegna/:id/close and /reopen', () => {
  it('closes a consegna', async () => {
    const consegnaId = createConsegna(db, { data: '2026-02-19' });

    const res = await adminAgent.post(`/api/consegna/${consegnaId}/close`);
    expect(res.status).toBe(200);

    const consegna = db.prepare('SELECT chiusa FROM consegne WHERE id = ?').get(consegnaId);
    expect(consegna.chiusa).toBe(1);
  });

  it('returns 400 when trying to close an already closed consegna', async () => {
    const consegnaId = createConsegna(db, { data: '2026-02-19', chiusa: true });

    const res = await adminAgent.post(`/api/consegna/${consegnaId}/close`);
    expect(res.status).toBe(400);
  });

  it('reopens a closed consegna (admin only)', async () => {
    const consegnaId = createConsegna(db, { data: '2026-02-19', chiusa: true });

    const res = await adminAgent.post(`/api/consegna/${consegnaId}/reopen`);
    expect(res.status).toBe(200);

    const consegna = db.prepare('SELECT chiusa FROM consegne WHERE id = ?').get(consegnaId);
    expect(consegna.chiusa).toBe(0);
  });

  it('returns 403 when non-admin tries to reopen', async () => {
    createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });
    const consegnaId = createConsegna(db, { data: '2026-02-19', chiusa: true });

    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });

    const res = await userAgent.post(`/api/consegna/${consegnaId}/reopen`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent consegna', async () => {
    const res = await adminAgent.post('/api/consegna/99999/close');
    expect(res.status).toBe(404);
  });
});

// ===== POST / — payload validation =====

describe('POST /api/consegna/ — validation', () => {
  const movimento = (partecipante_id, fields = {}) => ({
    partecipante_id, importoSaldato: 0, usaCredito: 0, debitoLasciato: 0, creditoLasciato: 0,
    saldaDebitoTotale: false, debitoSaldato: 0, contoProduttore: 0, note: '', ...fields
  });

  it('returns 400 and writes nothing for a non-numeric amount', async () => {
    const userId = createUser(db, { username: 'mario', password: 'password1', displayName: 'Mario' });

    const res = await adminAgent.post('/api/consegna/').send({
      data: '2026-02-19', trovatoInCassa: 0,
      partecipanti: [movimento(userId, { importoSaldato: 'abc' })]
    });
    expect(res.status).toBe(400);
    expect(db.prepare('SELECT COUNT(*) AS n FROM consegne').get().n).toBe(0);
  });

  it('returns 400 when using more credit than the ledger saldo before the consegna', async () => {
    const userId = createUser(db, { username: 'mario', password: 'password1', displayName: 'Mario', saldo: 10 });
    createRettifica(db, { partecipanteId: userId, data: '2026-02-01', importo: 10 });

    const res = await adminAgent.post('/api/consegna/').send({
      data: '2026-02-19', trovatoInCassa: 0,
      partecipanti: [movimento(userId, { contoProduttore: 15, usaCredito: 15 })]
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Credito/);
  });

  it('stores amounts rounded to cents', async () => {
    const userId = createUser(db, { username: 'mario', password: 'password1', displayName: 'Mario' });

    const res = await adminAgent.post('/api/consegna/').send({
      data: '2026-02-19', trovatoInCassa: 0,
      partecipanti: [movimento(userId, { contoProduttore: 10.004, importoSaldato: 10.004 })]
    });
    expect(res.status).toBe(200);
    const m = db.prepare('SELECT conto_produttore, importo_saldato FROM movimenti WHERE partecipante_id = ?').get(userId);
    expect(m).toEqual({ conto_produttore: 10, importo_saldato: 10 });
  });
});

describe('GET /api/consegna/:date quote teatro', () => {
  it('puts each quota on the payer movimento, or in teatroExtra without one', async () => {
    const a = createUser(db, { username: 'ta', displayName: 'Anna' });
    const b = createUser(db, { username: 'tb', displayName: 'Bruno' });
    const c = createConsegna(db, { data: '2026-03-03' });
    createMovimento(db, { consegnaId: c, partecipanteId: a });
    const pay = db.prepare('INSERT INTO teatro_pagamenti (user_id, data, importo, consegna_id) VALUES (?, ?, ?, ?)');
    pay.run(a, '2026-03-03', 10, c);
    pay.run(a, '2026-03-03', 5, c);
    pay.run(b, '2026-03-03', 15, c);

    const res = await adminAgent.get('/api/consegna/2026-03-03');
    expect(res.body.movimenti[0].teatro).toBe(15);
    expect(res.body.teatroExtra).toEqual([{ user_id: b, nome: 'Bruno', importo: 15 }]);
  });

  it('gives teatro 0 and an empty teatroExtra without payments', async () => {
    const a = createUser(db, { username: 'ta', displayName: 'Anna' });
    const c = createConsegna(db, { data: '2026-03-03' });
    createMovimento(db, { consegnaId: c, partecipanteId: a });

    const res = await adminAgent.get('/api/consegna/2026-03-03');
    expect(res.body.movimenti[0].teatro).toBe(0);
    expect(res.body.teatroExtra).toEqual([]);
  });
});
