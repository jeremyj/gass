'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Photos go to a temp folder, never the repo
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'gass-scontrini-'));
process.env.SCONTRINI_DIR = DIR;

// MUST be first: patch require cache before loading app
const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { setupTestApp } = require('../helpers/setup-app');
const { createUser, createConsegna, clearConsegne, clearNonAdminUsers, loginAs } = require('../helpers/seed');
const request = require('supertest');

// Smallest valid-looking JPEG: the server checks only the FF D8 FF signature and the size
const JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46, 0, 1, 0xFF, 0xD9]).toString('base64');
const PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A]).toString('base64');

let app, adminAgent, userAgent, otherAgent, mario, luigi;

const foto = (over = {}) => ({ data: '2026-10-13', partecipanteId: mario, foto: JPEG, thumb: JPEG, larghezza: 1200, altezza: 1600, ...over });

// Log in once: the login rate limit would refuse a login per test
beforeAll(async () => {
  ({ app } = setupTestApp());
  clearConsegne(db);
  clearNonAdminUsers(db);
  mario = createUser(db, { username: 'mario' });
  luigi = createUser(db, { username: 'luigi' });
  adminAgent = request.agent(app);
  userAgent = request.agent(app);
  otherAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin' });
  await loginAs(userAgent, 'mario');
  await loginAs(otherAgent, 'luigi');
});

afterAll(() => fs.rmSync(DIR, { recursive: true, force: true }));

beforeEach(() => clearConsegne(db));

describe('/api/scontrini', () => {
  it('returns 401 when not authenticated', async () => {
    expect((await request(app).get('/api/scontrini?data=2026-10-13')).status).toBe(401);
    expect((await request(app).get('/api/scontrini/1/foto')).status).toBe(401);
  });

  it('first photo of the day creates the consegna with trovato = previous lasciato', async () => {
    createConsegna(db, { data: '2026-10-06', lasciatoInCassa: 187 });
    const res = await userAgent.post('/api/scontrini').send(foto());
    expect(res.status).toBe(200);
    const c = db.prepare('SELECT * FROM consegne WHERE data = ?').get('2026-10-13');
    expect(c.id).toBe(res.body.consegnaId);
    expect(c.trovato_in_cassa).toBe(187);
    expect(c.lasciato_in_cassa).toBe(187);
    expect(fs.existsSync(path.join(DIR, String(c.id)))).toBe(true);
  });

  it('lists, serves and logs the photo', async () => {
    const { body } = await userAgent.post('/api/scontrini').send(foto());
    const list = await otherAgent.get('/api/scontrini?data=2026-10-13');
    expect(list.body.scontrini).toHaveLength(1);
    expect(list.body.scontrini[0]).toMatchObject({ id: body.id, partecipante_id: mario, nome: 'mario', autore: 'mario' });
    const img = await otherAgent.get(`/api/scontrini/${body.id}/foto`);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toMatch(/image\/jpeg/);
    expect(img.headers['cache-control']).toMatch(/private/);
    expect((await otherAgent.get(`/api/scontrini/${body.id}/thumb`)).status).toBe(200);
    expect(db.prepare("SELECT COUNT(*) AS n FROM activity_logs WHERE event_type = 'scontrino_aggiunto'").get().n).toBe(1);
  });

  it('refuses non-JPEG, oversized and unknown people', async () => {
    expect((await userAgent.post('/api/scontrini').send(foto({ foto: PNG }))).status).toBe(400);
    const big = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF]), Buffer.alloc(1.6 * 1024 * 1024)]).toString('base64');
    expect((await userAgent.post('/api/scontrini').send(foto({ foto: big }))).status).toBe(400);
    expect((await userAgent.post('/api/scontrini').send(foto({ partecipanteId: 99999 }))).status).toBe(400);
    expect((await userAgent.post('/api/scontrini').send(foto({ data: '13/10/2026' }))).status).toBe(400);
    expect((await userAgent.get('/api/scontrini/99999/foto')).status).toBe(404);
  });

  it('allows at most 3 photos per person per consegna', async () => {
    for (let i = 0; i < 3; i++) expect((await userAgent.post('/api/scontrini').send(foto())).status).toBe(200);
    const res = await userAgent.post('/api/scontrini').send(foto());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Massimo 3/);
    expect((await userAgent.post('/api/scontrini').send(foto({ partecipanteId: luigi }))).status).toBe(200);
  });

  it('closed consegna: no photo added or removed', async () => {
    const { body } = await userAgent.post('/api/scontrini').send(foto());
    db.prepare('UPDATE consegne SET chiusa = 1').run();
    expect((await userAgent.post('/api/scontrini').send(foto())).status).toBe(403);
    expect((await userAgent.delete(`/api/scontrini/${body.id}`)).status).toBe(403);
    expect((await adminAgent.delete(`/api/scontrini/${body.id}`)).status).toBe(403);
    expect((await otherAgent.get('/api/scontrini?data=2026-10-13')).body.chiusa).toBe(true);
  });

  it('only the author or an admin removes a photo, files included', async () => {
    const a = (await userAgent.post('/api/scontrini').send(foto())).body;
    const b = (await userAgent.post('/api/scontrini').send(foto())).body;
    expect((await otherAgent.delete(`/api/scontrini/${a.id}`)).status).toBe(403);
    expect((await userAgent.delete(`/api/scontrini/${a.id}`)).status).toBe(200);
    expect((await adminAgent.delete(`/api/scontrini/${b.id}`)).status).toBe(200);
    expect(fs.readdirSync(path.join(DIR, String(a.consegnaId)))).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM activity_logs WHERE event_type = 'scontrino_rimosso'").get().n).toBe(2);
  });

  it('deleting the consegna removes rows and folder', async () => {
    const { body } = await userAgent.post('/api/scontrini').send(foto());
    await userAgent.post('/api/scontrini').send(foto());
    expect((await adminAgent.delete(`/api/consegna/${body.consegnaId}`)).status).toBe(200);
    expect(db.prepare('SELECT COUNT(*) AS n FROM scontrini').get().n).toBe(0);
    expect(fs.existsSync(path.join(DIR, String(body.consegnaId)))).toBe(false);
  });

  it('a later Salva keeps working on the consegna the photo created', async () => {
    const { body } = await userAgent.post('/api/scontrini').send(foto());
    const res = await userAgent.post('/api/consegna').send({
      data: '2026-10-13', trovatoInCassa: 0, pagatoProduttore: 10, lasciatoInCassa: 0, noteGiornata: '',
      partecipanti: [{ partecipante_id: mario, contoProduttore: 10, importoSaldato: 10 }]
    });
    expect(res.body.success).toBe(true);
    expect(db.prepare('SELECT COUNT(*) AS n FROM consegne').get().n).toBe(1);
    expect(db.prepare('SELECT consegna_id FROM movimenti').get().consegna_id).toBe(body.consegnaId);
  });

  it('deleting a user without movimenti removes their photos', async () => {
    const peach = createUser(db, { username: 'peach' });
    const { body } = await userAgent.post('/api/scontrini').send(foto({ partecipanteId: peach }));
    const res = await adminAgent.delete(`/api/participants/${peach}`);
    expect(res.status).toBe(200);
    expect(db.prepare('SELECT COUNT(*) AS n FROM scontrini').get().n).toBe(0);
    expect(fs.readdirSync(path.join(DIR, String(body.consegnaId)))).toEqual([]);
  });
});
