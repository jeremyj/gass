'use strict';

const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { createUser, createConsegna, createMovimento, createTurno, clearConsegne, clearNonAdminUsers, clearTeatro } = require('../helpers/seed');
const { reportBody, reportTitle, notifyClosed, canaliAttivi } = require('../../server/services/report');

const { setupTestApp } = require('../helpers/setup-app');
const request = require('supertest');

const URL = 'https://gass.example';

beforeEach(() => {
  clearTeatro(db);
  clearConsegne(db);
  clearNonAdminUsers(db);
});

function setup() {
  const ids = {};
  for (const [u, n] of [['f', 'Fernanda'], ['k', 'Franky'], ['j', 'Jeremy'], ['r', 'Rachele'], ['s', 'S&P'], ['p', 'Pari'], ['m', 'Matias'], ['b', 'Sara B']]) {
    ids[u] = createUser(db, { username: u, displayName: n });
  }
  createConsegna(db, { data: '2026-09-22', lasciatoInCassa: 589 });
  const id = createConsegna(db, { data: '2026-09-29', trovatoInCassa: 589, pagatoProduttore: 357.2, lasciatoInCassa: 553.7, chiusa: true });
  db.prepare("UPDATE consegne SET uscite_cassa = 90, uscite_motivo = 'quote teatro al teatro' WHERE id = ?").run(id);
  createMovimento(db, { consegnaId: id, partecipanteId: ids.f, debitoSaldato: 50, saldaDebitoTotale: 1 });
  createMovimento(db, { consegnaId: id, partecipanteId: ids.k, debitoSaldato: 30.85, debitoLasciato: 0.85 });
  createMovimento(db, { consegnaId: id, partecipanteId: ids.j, debitoLasciato: 8.99 });
  createMovimento(db, { consegnaId: id, partecipanteId: ids.r, creditoLasciato: 3.45 });
  createMovimento(db, { consegnaId: id, partecipanteId: ids.s, usaCredito: 2.2 });
  createMovimento(db, { consegnaId: id, partecipanteId: ids.p, importoSaldato: 20, contoProduttore: 20 });
  createTurno(db, { settimana: '2026-09-29', t1: ids.b, t2: ids.m });
  db.prepare("INSERT INTO teatro_pagamenti (user_id, data, importo, consegna_id) VALUES (?, '2026-09-29', 15, ?)").run(ids.j, id);
  return id;
}

describe('reportBody', () => {
  it('follows the layout of the turno report emails', () => {
    const id = setup();
    expect(reportTitle('2026-09-29', false)).toBe('Report turno 29/09/2026');
    expect(reportBody(db, id, URL)).toBe([
      'In turno: Sara B + Matias',
      '',
      'Trovato in cassa: 589 €',
      'Pagato al produttore: 357,20 €',
      'Uscite di cassa: 90 € (quote teatro al teatro)',
      '',
      'Debiti saldati: Fernanda 50, Franky 30 (resta debito 0,85)',
      'Debiti lasciati: Jeremy 8,99',
      'Crediti lasciati: Rachele 3,45',
      'Crediti usati: S&P 2,20',
      'Quota teatro: Jeremy 15',
      '',
      'Lasciato in cassa: 553,70 €',
      `${URL}/consegna?data=2026-09-29`
    ].join('\n'));
  });

  it('leaves out empty sections and the turno line when nobody is on turno', () => {
    const id = createConsegna(db, { data: '2026-09-29', lasciatoInCassa: 10, chiusa: true });
    expect(reportBody(db, id, URL)).toBe([
      '',
      'Trovato in cassa: 0 €',
      'Pagato al produttore: 0 €',
      '',
      'Lasciato in cassa: 10 €',
      `${URL}/consegna?data=2026-09-29`
    ].join('\n'));
  });
});

describe('notifyClosed', () => {
  it('sends once per channel, then again marked (corretto) only when the report changed', async () => {
    const id = setup();
    const sent = [];
    const send = canale => async (title, body) => { sent.push({ canale, title, body }); };

    await notifyClosed(db, id, URL, 'telegram', send('telegram'));
    await notifyClosed(db, id, URL, 'telegram', send('telegram'));
    expect(sent.map(s => s.title)).toEqual(['Report turno 29/09/2026']);

    db.prepare('UPDATE consegne SET lasciato_in_cassa = 550 WHERE id = ?').run(id);
    await notifyClosed(db, id, URL, 'telegram', send('telegram'));
    // Email was never sent for this consegna: its first report is not a correction
    await notifyClosed(db, id, URL, 'email', send('email'));
    expect(sent.slice(1).map(s => [s.canale, s.title])).toEqual([
      ['telegram', 'Report turno 29/09/2026 (corretto)'],
      ['email', 'Report turno 29/09/2026']
    ]);
    expect(sent[2].body).toContain('Lasciato in cassa: 550 €');
  });

  it('retries on the next close when sending failed', async () => {
    const id = setup();
    await expect(notifyClosed(db, id, URL, 'email', async () => { throw new Error('down'); })).rejects.toThrow('down');
    const sent = [];
    await notifyClosed(db, id, URL, 'email', async title => { sent.push(title); });
    expect(sent).toEqual(['Report turno 29/09/2026']);
  });
});

describe('canaliAttivi', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('lists only the channels whose env vars are all set', () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 't');
    vi.stubEnv('TELEGRAM_CHAT_ID', '');
    vi.stubEnv('SMTP_HOST', 'smtp.example');
    vi.stubEnv('REPORT_EMAIL_TO', 'gass@example.org');
    expect(canaliAttivi()).toEqual(['email']);
    vi.stubEnv('TELEGRAM_CHAT_ID', '@gass');
    expect(canaliAttivi()).toEqual(['telegram', 'email']);
  });
});

describe('close route', () => {
  let agent;
  beforeAll(async () => {
    agent = request.agent(setupTestApp().app);
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin' });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('lists the configured channels and sends only the ones confirmed in the dialog', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 't');
    vi.stubEnv('TELEGRAM_CHAT_ID', '@gass');
    vi.stubEnv('SMTP_HOST', '');
    const fetch = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetch);

    expect((await agent.get('/api/consegna/report-canali')).body.canali).toEqual(['telegram']);

    const id = createConsegna(db, { data: '2026-09-29' });
    await agent.post(`/api/consegna/${id}/close`).send({ report: [] }).expect(200);
    await agent.post(`/api/consegna/${id}/reopen`).expect(200);
    await agent.post(`/api/consegna/${id}/close`).send({ report: ['telegram', 'email'] }).expect(200);
    await vi.waitFor(() => expect(db.prepare('SELECT report_telegram FROM consegne WHERE id = ?').get(id).report_telegram).toBeTruthy());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body).chat_id).toBe('@gass');
  });
});
