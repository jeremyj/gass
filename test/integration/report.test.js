'use strict';

const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { createUser, createConsegna, createMovimento, createTurno, clearConsegne, clearNonAdminUsers, clearTeatro } = require('../helpers/seed');
const { buildReport, notifyClosed } = require('../../server/services/report');

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

describe('buildReport', () => {
  it('follows the layout of the turno report emails', () => {
    const id = setup();
    expect(buildReport(db, id, URL)).toBe([
      '<b>Report turno 29/09/2026</b>',
      'In turno: Sara B + Matias',
      '',
      'Trovato in cassa: 589 €',
      'Pagato al produttore: 357,20 €',
      '',
      'Debiti saldati: Fernanda 50, Franky 30 (resta debito 0,85)',
      'Debiti lasciati: Jeremy 8,99',
      'Crediti lasciati: Rachele 3,45',
      'Crediti usati: S&amp;P 2,20',
      'Quota teatro: Jeremy 15',
      '',
      'Lasciato in cassa: 553,70 €',
      `${URL}/consegna?data=2026-09-29`
    ].join('\n'));
  });

  it('leaves out empty sections and the turno line when nobody is on turno', () => {
    const id = createConsegna(db, { data: '2026-09-29', lasciatoInCassa: 10, chiusa: true });
    expect(buildReport(db, id, URL)).toBe([
      '<b>Report turno 29/09/2026</b>',
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
  it('sends once, then again marked (corretto) only when the report changed', async () => {
    const id = setup();
    const sent = [];
    const send = async text => { sent.push(text); };

    await notifyClosed(db, id, URL, send);
    await notifyClosed(db, id, URL, send);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatch(/^<b>Report turno 29\/09\/2026<\/b>\n/);

    db.prepare('UPDATE consegne SET lasciato_in_cassa = 550 WHERE id = ?').run(id);
    await notifyClosed(db, id, URL, send);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatch(/^<b>Report turno 29\/09\/2026 \(corretto\)<\/b>\n/);
    expect(sent[1]).toContain('Lasciato in cassa: 550 €');
  });

  it('retries on the next close when sending failed', async () => {
    const id = setup();
    await expect(notifyClosed(db, id, URL, async () => { throw new Error('down'); })).rejects.toThrow('down');
    const sent = [];
    await notifyClosed(db, id, URL, async text => { sent.push(text); });
    expect(sent[0]).toMatch(/^<b>Report turno 29\/09\/2026<\/b>/);
  });
});
