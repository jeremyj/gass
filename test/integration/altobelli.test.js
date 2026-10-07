'use strict';

const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const fs = require('fs');
const path = require('path');
const { setupTestApp } = require('../helpers/setup-app');
const { createUser, createConsegna, createMovimento } = require('../helpers/seed');
const request = require('supertest');

const fixture = name => fs.readFileSync(path.join(__dirname, '../fixtures/altobelli', name), 'utf8');
const URL_FOGLIO = 'https://docs.google.com/spreadsheets/d/TESTID/edit';

let adminAgent, userAgent, anna, bruno, realFetch;

beforeAll(async () => {
  const { app } = setupTestApp();
  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin' });
  createUser(db, { username: 'alt-user', password: 'password1' });
  userAgent = request.agent(app);
  await userAgent.post('/api/auth/login').send({ username: 'alt-user', password: 'password1' });
  anna = createUser(db, { username: 'anna', displayName: 'Anna' });
  bruno = createUser(db, { username: 'bruno', displayName: 'Bruno' });
  const c = createConsegna(db, { data: '2026-10-06' });
  createMovimento(db, { consegnaId: c, partecipanteId: anna, contoProduttore: 37.61, importoSaldato: 40 });
  createMovimento(db, { consegnaId: c, partecipanteId: bruno, contoProduttore: 25, importoSaldato: 25 });

  // The sheet: /edit lists the tabs, export?format=csv&gid= gives one
  realFetch = global.fetch;
  global.fetch = async url => {
    if (String(url).includes('/edit')) return new Response(fixture('edit.html'));
    if (String(url).includes('gid=666')) return new Response(fixture('6-ottobre.csv'));
    return new Response('', { status: 404 });
  };
});

afterAll(() => { global.fetch = realFetch; });

describe('/api/altobelli', () => {
  it('is admin-only', async () => {
    expect((await userAgent.get('/api/altobelli/confronto?data=2026-10-06')).status).toBe(403);
    expect((await userAgent.put('/api/altobelli/nomi').send({ nome: 'Anna', userId: anna })).status).toBe(403);
  });

  it('stores the sheet link, refusing one without a spreadsheet id', async () => {
    expect((await adminAgent.put('/api/altobelli/foglio').send({ url: 'https://example.com' })).status).toBe(400);
    expect((await adminAgent.put('/api/altobelli/foglio').send({ url: URL_FOGLIO })).status).toBe(200);
    expect(db.prepare("SELECT value FROM settings WHERE key = 'altobelli_foglio'").get().value).toBe(URL_FOGLIO);
    expect((await adminAgent.get('/api/altobelli/foglio')).body.url).toBe(URL_FOGLIO);
  });

  it('compares the tab of the consegna with the conti, once names are mapped', async () => {
    let res = await adminAgent.get('/api/altobelli/confronto?data=2026-10-06');
    expect(res.status).toBe(200);
    expect(res.body.scheda).toEqual({ nome: '6 ottobre', gid: '666' });
    expect(res.body.righe.find(r => r.nome === 'Anna')).toMatchObject({ esito: 'da_associare', suggerito: anna });

    expect((await adminAgent.put('/api/altobelli/nomi').send({ nome: 'Anna', userId: anna })).status).toBe(200);
    expect((await adminAgent.put('/api/altobelli/nomi').send({ nome: 'Bruno ', userId: bruno })).status).toBe(200);
    res = await adminAgent.get('/api/altobelli/confronto?data=2026-10-06');
    expect(res.body.righe.find(r => r.nome === 'Anna')).toMatchObject({ esito: 'uguale', persona: 'Anna', conto: 37.61 });
    expect(res.body.righe.find(r => r.nome === 'Bruno')).toMatchObject({ esito: 'diverso', effettivo: 26, conto: 25 });
    expect(res.body.kpi.sommaEffettivi).toBe(319.51);
    expect(res.body.kpi.totaleDiverso).toBe(false);
    expect(res.body.persone.length).toBeGreaterThan(0);

    // null unmaps the name
    await adminAgent.put('/api/altobelli/nomi').send({ nome: 'anna', userId: null });
    res = await adminAgent.get('/api/altobelli/confronto?data=2026-10-06');
    expect(res.body.righe.find(r => r.nome === 'Anna').esito).toBe('da_associare');
  });

  it('asks to pick a tab when two match, and reads the picked one', async () => {
    const res = await adminAgent.get('/api/altobelli/confronto?data=2026-06-23');
    expect(res.status).toBe(200);
    expect(res.body.scelte.map(s => s.gid)).toEqual(['222', '333']);
  });

  it('answers 502 with a readable message when the sheet has no tab for the date or cannot be read', async () => {
    const res = await adminAgent.get('/api/altobelli/confronto?data=2026-10-16');
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/16 ottobre/);
    expect((await adminAgent.get('/api/altobelli/confronto?data=2026-10-6')).status).toBe(400);
  });
});
