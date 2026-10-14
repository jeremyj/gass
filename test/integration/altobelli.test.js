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
  createConsegna(db, { data: '2026-10-13' });

  // The sheet: /edit lists the tabs, export?format=csv&gid= gives one
  realFetch = global.fetch;
  global.fetch = async url => {
    if (String(url).includes('/edit')) return new Response(fixture('edit.html'));
    if (String(url).includes('gid=555')) return new Response(fixture('29-settembre.csv'));
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

  it('refuses the check until a sheet link is set', async () => {
    const r = await adminAgent.get('/api/altobelli/confronto?data=2026-10-06');
    expect(r.status).toBe(400);
    expect((await adminAgent.get('/api/altobelli/foglio')).body.url).toBe('');
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

  it('returns all tabs, newest first, and asks to pick when two match', async () => {
    const res = await adminAgent.get('/api/altobelli/confronto?data=2026-06-23');
    expect(res.status).toBe(200);
    expect(res.body.scheda).toBeNull();
    expect(res.body.righe).toBeUndefined();
    expect(res.body.messaggio).toBe('Più schede per il 23 giugno: scegli quella da confrontare');
    // October and September are after June: previous year
    expect(res.body.schede.map(s => s.gid)).toEqual(['444', '222', '333', '111', '666', '555']);
  });

  it('gives no error when the sheet has no tab for the date: the admin picks one', async () => {
    const res = await adminAgent.get('/api/altobelli/confronto?data=2026-10-13');
    expect(res.status).toBe(200);
    expect(res.body.scheda).toBeNull();
    expect(res.body.messaggio).toBe('Nel foglio non c\'è una scheda per il 13 ottobre: scegli la scheda da confrontare');
    expect(res.body.schede).toHaveLength(6);
  });

  it('reads the tab of the given gid, even if it is not the date\'s', async () => {
    const res = await adminAgent.get('/api/altobelli/confronto?data=2026-10-13&gid=555');
    expect(res.status).toBe(200);
    expect(res.body.scheda).toEqual({ nome: '29 settembre', gid: '555' });
    expect(res.body.righe.length).toBeGreaterThan(0);
    expect(res.body.messaggio).toBeUndefined();
    const bad = await adminAgent.get('/api/altobelli/confronto?data=2026-10-13&gid=999');
    expect(bad.status).toBe(404);
    expect(bad.body.error).toBe('Scheda non trovata nel foglio');
  });

  it('remembers the picked tab per consegna', async () => {
    expect((await adminAgent.put('/api/altobelli/scheda').send({ data: '2026-10-6', gid: '555' })).status).toBe(400);
    expect((await adminAgent.put('/api/altobelli/scheda').send({ data: '2026-11-03', gid: '555' })).status).toBe(404);
    expect((await userAgent.put('/api/altobelli/scheda').send({ data: '2026-10-13', gid: '555' })).status).toBe(403);
    expect((await adminAgent.put('/api/altobelli/scheda').send({ data: '2026-10-13', gid: '555' })).status).toBe(200);
    let res = await adminAgent.get('/api/altobelli/confronto?data=2026-10-13');
    expect(res.body.scheda.gid).toBe('555');
    expect(res.body.messaggio).toBeUndefined();

    // a remembered tab that left the sheet falls back to the date
    db.prepare("UPDATE consegne SET altobelli_gid = '999' WHERE data = '2026-10-13'").run();
    res = await adminAgent.get('/api/altobelli/confronto?data=2026-10-13');
    expect(res.status).toBe(200);
    expect(res.body.scheda).toBeNull();

    await adminAgent.put('/api/altobelli/scheda').send({ data: '2026-10-13', gid: '555' });
    expect((await adminAgent.put('/api/altobelli/scheda').send({ data: '2026-10-13', gid: null })).status).toBe(200);
    expect(db.prepare("SELECT altobelli_gid FROM consegne WHERE data = '2026-10-13'").get().altobelli_gid).toBeNull();
    res = await adminAgent.get('/api/altobelli/confronto?data=2026-10-13');
    expect(res.body.scheda).toBeNull();
  });

  it('answers 400 on a bad date', async () => {
    expect((await adminAgent.get('/api/altobelli/confronto?data=2026-10-6')).status).toBe(400);
  });
});
