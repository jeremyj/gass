'use strict';

// MUST be first: patch require cache before loading app
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
        saldaTutto: false,
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
      partecipanti: [{ partecipante_id: userId, saldaTutto: false, importoSaldato: 0, usaCredito: 0,
        debitoLasciato: 0, creditoLasciato: 20, saldaDebitoTotale: false, debitoSaldato: 0,
        contoProduttore: 0, note: '' }]
    });

    let user = db.prepare('SELECT saldo FROM users WHERE id = ?').get(userId);
    expect(user.saldo).toBe(20);

    // Consegna 2: +15 credit → saldo = 35
    await adminAgent.post('/api/consegna/').send({
      data: '2026-02-15',
      trovatoInCassa: 0, pagatoProduttore: 0, lasciatoInCassa: 0,
      partecipanti: [{ partecipante_id: userId, saldaTutto: false, importoSaldato: 0, usaCredito: 0,
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
      partecipanti: [{ partecipante_id: userId, saldaTutto: false, importoSaldato: 0, usaCredito: 0,
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
      partecipanti: [{ partecipante_id: userId, saldaTutto: false, importoSaldato: 50, usaCredito: 0,
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
      partecipanti: [{ partecipante_id: userId, saldaTutto: false, importoSaldato: 50, usaCredito: 0,
        debitoLasciato: 0, creditoLasciato: 0, saldaDebitoTotale: false, debitoSaldato: 0,
        contoProduttore: 30, note: '' }]
    });

    const consegna = db.prepare("SELECT lasciato_in_cassa FROM consegne WHERE data = '2026-02-19'").get();
    expect(consegna.lasciato_in_cassa).toBe(120);
  });

  it('returns 403 when non-admin tries to save to a closed consegna', async () => {
    const userId = createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });
    const consegnaId = createConsegna(db, { data: '2026-02-19', chiusa: true });

    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });

    const res = await userAgent.post('/api/consegna/').send({
      data: '2026-02-19',
      trovatoInCassa: 0, pagatoProduttore: 0, lasciatoInCassa: 0,
      partecipanti: [{ partecipante_id: userId, saldaTutto: false, importoSaldato: 0, usaCredito: 0,
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
      partecipanti: [{ partecipante_id: userId, saldaTutto: false, importoSaldato: 0, usaCredito: 0,
        debitoLasciato: 0, creditoLasciato: 0, saldaDebitoTotale: false, debitoSaldato: 0,
        contoProduttore: 0, note: '' }]
    });

    expect(res.status).toBe(200);
  });
});

// ===== DELETE /:id =====

describe('DELETE /api/consegna/:id', () => {
  it('allows non-admin to delete consegna', async () => {
    const userId = createUser(db, { username: 'user1', password: 'password1', displayName: 'User1' });
    const consegnaId = createConsegna(db, { data: '2026-02-19' });

    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/login').send({ username: 'user1', password: 'password1' });

    const res = await userAgent.delete(`/api/consegna/${consegnaId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('deletes consegna and recalculates saldi from scratch', async () => {
    const userId = createUser(db, { username: 'mario', password: 'password1', displayName: 'Mario', saldo: 0 });

    // Create two consegne
    await adminAgent.post('/api/consegna/').send({
      data: '2026-02-01',
      trovatoInCassa: 0, pagatoProduttore: 0, lasciatoInCassa: 0,
      partecipanti: [{ partecipante_id: userId, saldaTutto: false, importoSaldato: 0, usaCredito: 0,
        debitoLasciato: 0, creditoLasciato: 20, saldaDebitoTotale: false, debitoSaldato: 0,
        contoProduttore: 0, note: '' }]
    });

    await adminAgent.post('/api/consegna/').send({
      data: '2026-02-15',
      trovatoInCassa: 0, pagatoProduttore: 0, lasciatoInCassa: 0,
      partecipanti: [{ partecipante_id: userId, saldaTutto: false, importoSaldato: 0, usaCredito: 0,
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
