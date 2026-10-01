'use strict';

const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { createUser, clearNonAdminUsers, clearTeatro } = require('../helpers/seed');
const T = require('../../server/services/teatro');
const { deleteUser } = require('../../server/services/users');

const audit = { userId: null, timestamp: '2026-10-01T10:00:00.000Z' };

beforeEach(() => {
  clearTeatro(db);
  clearNonAdminUsers(db);
  db.prepare("UPDATE users SET stato = 'sospeso' WHERE username = 'admin'").run();
});

describe('semesters', () => {
  it('opens the current semester once, for attivi only, with the last quota', () => {
    const a = createUser(db, { username: 'a' });
    createUser(db, { username: 's', stato: 'sospeso' });
    T.setQuota(db, '2026-1', 12, audit);
    T.ensureSemestre(db, '2026-10-01');
    T.ensureSemestre(db, '2026-10-02');
    expect(db.prepare("SELECT quota FROM teatro_semestri WHERE semestre = '2026-2'").get().quota).toBe(12);
    expect(db.prepare("SELECT user_id, dovuto FROM teatro_dovuti WHERE semestre = '2026-2'").all()).toEqual([{ user_id: a, dovuto: 12 }]);
  });

  it('starts from 15 € when no semester exists', () => {
    T.ensureSemestre(db, '2026-10-01');
    expect(db.prepare("SELECT quota FROM teatro_semestri WHERE semestre = '2026-2'").get().quota).toBe(15);
  });

  it('changing a semester quota moves the people on the old quota, not the reduced ones', () => {
    const [a, b] = ['a', 'b'].map(u => createUser(db, { username: u }));
    T.ensureSemestre(db, '2026-10-01');
    T.setDovuto(db, b, '2026-2', 7, audit);
    T.setQuota(db, '2026-2', 18, audit);
    const d = id => db.prepare("SELECT dovuto FROM teatro_dovuti WHERE user_id = ? AND semestre = '2026-2'").get(id).dovuto;
    expect([d(a), d(b)]).toEqual([18, 7]);
  });
});

describe('payments', () => {
  it('spreads a payment over the owed semesters and reports the rest', () => {
    const a = createUser(db, { username: 'a' });
    T.setDovuto(db, a, '2026-1', 15, audit);
    T.setDovuto(db, a, '2026-2', 15, audit);
    expect(T.registraPagamento(db, { userId: a, importo: 20, data: '2026-10-06' }, audit).changes).toEqual(['a: 20 € (resta 10 €)']);
    const s = T.statoTeatro(db, a);
    expect(s.righe.map(r => [r.semestre, r.pagato])).toEqual([['2026-1', 15], ['2026-2', 5]]);
    expect(s.residuo).toBe(10);
  });

  it('refuses a non-positive amount or an unknown user', () => {
    const a = createUser(db, { username: 'a' });
    expect(T.registraPagamento(db, { userId: a, importo: 0, data: '2026-10-06' }, audit).error).toBeTruthy();
    expect(T.registraPagamento(db, { userId: 999999, importo: 5, data: '2026-10-06' }, audit).error).toBeTruthy();
  });

  it('counts only payments made in GASS, plus manual entries, in the cassa teatro', () => {
    const a = createUser(db, { username: 'a' });
    T.setDovuto(db, a, '2026-1', 15, audit);
    T.registraPagamento(db, { userId: a, importo: 15, data: '2026-06-01', fonte: 'foglio' }, audit);
    T.registraPagamento(db, { userId: a, importo: 30, data: '2026-10-06' }, audit);
    T.addCassa(db, { data: '2026-10-10', importo: -20, descrizione: 'affitto' }, audit);
    expect(T.saldoCassa(db)).toBe(10);
    expect(T.quoteDelGiorno(db, '2026-10-06')).toBe(30);
  });

  it('refuses to delete a user who paid a quota', () => {
    const a = createUser(db, { username: 'a' });
    T.registraPagamento(db, { userId: a, importo: 15, data: '2026-10-06' }, audit);
    expect(deleteUser(db, a)).toMatch(/quote teatro/);
  });
});

describe('sheet import', () => {
  it('turns each number into owed and paid, 0 into non dovuto, - into no row, outside the cassa', () => {
    const a = createUser(db, { username: 'a' });
    const b = createUser(db, { username: 'b' });
    const r = T.importFoglio(db, ['2025-2', '2026-1'], [
      { username: 'a', valori: ['15', '7'], nota: 'da marzo' },
      { username: 'b', valori: ['-', '0'], nota: '' }
    ]);
    expect(r).toEqual({ imported: 2 });
    expect(T.statoTeatro(db, a).righe.map(x => [x.semestre, x.dovuto, x.pagato])).toEqual([['2025-2', 15, 15], ['2026-1', 7, 7]]);
    expect(T.statoTeatro(db, b).righe).toEqual([{ semestre: '2026-1', dovuto: 0, pagato: 0, label: '1° sem. 2026' }]);
    expect(db.prepare('SELECT teatro_nota n FROM users WHERE id = ?').get(a).n).toBe('da marzo');
    expect(T.saldoCassa(db)).toBe(0);
    // importing again replaces, no double payments
    T.importFoglio(db, ['2025-2', '2026-1'], [{ username: 'a', valori: ['15', '7'], nota: 'da marzo' }]);
    expect(T.statoTeatro(db, a).anticipo).toBe(0);
  });

  it('refuses unknown usernames and bad values without writing anything', () => {
    createUser(db, { username: 'a' });
    expect(T.importFoglio(db, ['2025-2'], [{ username: 'zz', valori: ['15'] }]).error).toMatch(/zz/);
    expect(T.importFoglio(db, ['2025-2'], [{ username: 'a', valori: ['x'] }]).error).toBeTruthy();
    expect(db.prepare('SELECT COUNT(*) n FROM teatro_dovuti').get().n).toBe(0);
  });
});
