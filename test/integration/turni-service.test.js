'use strict';

const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { createUser, createTurno, clearTurni, clearNonAdminUsers } = require('../helpers/seed');
const T = require('../../server/services/turni');
const { setStato } = require('../../server/services/users');

const TODAY = '2026-10-01'; // Thursday
const audit = { userId: null, timestamp: '2026-10-01T10:00:00.000Z' };
const rnd = () => 0.5;

beforeEach(() => {
  clearNonAdminUsers(db);
  clearTurni(db);
  db.prepare("UPDATE users SET stato = 'sospeso' WHERE username = 'admin'").run();
});

function people(n) {
  return Array.from({ length: n }, (_, i) => createUser(db, { username: `p${i + 1}` }));
}

describe('ensureTurni', () => {
  it('fills the next 12 Tuesdays from the first one after today', () => {
    people(6);
    T.ensureTurni(db, TODAY, rnd);
    const weeks = db.prepare('SELECT settimana FROM turni ORDER BY settimana').all().map(r => r.settimana);
    expect(weeks[0]).toBe('2026-10-06');
    expect(weeks).toHaveLength(12); // 2026-10-06 .. 2026-12-22 (today + 84 = 2026-12-24, excluded)
    expect(weeks[11]).toBe('2026-12-22');
  });

  it('counts today when today is a Tuesday, still 12 weeks', () => {
    people(2);
    T.ensureTurni(db, '2026-10-06', rnd);
    const weeks = db.prepare('SELECT settimana FROM turni ORDER BY settimana').all().map(r => r.settimana);
    expect(weeks).toHaveLength(12);
    expect(weeks[0]).toBe('2026-10-06');
    expect(weeks[11]).toBe('2026-12-22');
  });

  it('is idempotent', () => {
    people(6);
    T.ensureTurni(db, TODAY, Math.random);
    const before = db.prepare('SELECT * FROM turni ORDER BY settimana').all();
    T.ensureTurni(db, TODAY, Math.random);
    expect(db.prepare('SELECT * FROM turni ORDER BY settimana').all()).toEqual(before);
  });

  it('continues after the last written week and goes to the longest-waiting first', () => {
    const [a, b, c, d] = people(4);
    createTurno(db, { settimana: '2026-09-22', t1: a, t2: b });
    createTurno(db, { settimana: '2026-09-29', t1: c, t2: d });
    T.ensureTurni(db, TODAY, rnd);
    const next = db.prepare("SELECT turnista1_id, turnista2_id FROM turni WHERE settimana = '2026-10-06'").get();
    // a and b waited longest but were together last time: each gets c or d
    expect([a, b]).toContain(next.turnista1_id);
    expect([c, d]).toContain(next.turnista2_id);
  });

  it('skips Tuesdays inside a pause', () => {
    people(4);
    db.prepare("INSERT INTO turni_pause (dal, al) VALUES ('2026-10-13', '2026-10-20')").run();
    T.ensureTurni(db, TODAY, rnd);
    const weeks = db.prepare('SELECT settimana FROM turni').all().map(r => r.settimana);
    expect(weeks).not.toContain('2026-10-13');
    expect(weeks).not.toContain('2026-10-20');
    expect(weeks).toContain('2026-10-27');
  });

  it('fills weeks with empty slots when nobody is in turn', () => {
    T.ensureTurni(db, TODAY, rnd);
    const rows = db.prepare('SELECT turnista1_id, turnista2_id FROM turni').all();
    expect(rows).toHaveLength(12);
    expect(rows.every(r => r.turnista1_id === null && r.turnista2_id === null)).toBe(true);
  });

  it('ignores sospesi and disattivati', () => {
    const [a, b] = people(2);
    createUser(db, { username: 's', stato: 'sospeso' });
    createUser(db, { username: 'd', stato: 'disattivato' });
    T.ensureTurni(db, TODAY, rnd);
    const ids = new Set(db.prepare('SELECT turnista1_id a, turnista2_id b FROM turni').all().flatMap(r => [r.a, r.b]));
    expect([...ids].sort()).toEqual([a, b].sort());
  });

  it('puts a newcomer after everyone already waiting', () => {
    const old = people(4);
    db.prepare("UPDATE users SET created_at = '2025-01-01 00:00:00'").run();
    const nuovo = createUser(db, { username: 'nuovo' });
    db.prepare("UPDATE users SET created_at = '2026-10-01 00:00:00' WHERE id = ?").run(nuovo);
    T.ensureTurni(db, TODAY, rnd);
    const first = db.prepare("SELECT turnista1_id a, turnista2_id b FROM turni WHERE settimana = '2026-10-06'").get();
    expect(old).toContain(first.a);
    expect(first.a).not.toBe(nuovo);
  });
});

describe('editing', () => {
  it('updateTurno moves the day within its week and rejects other weeks', () => {
    const [a, b] = people(2);
    const id = createTurno(db, { settimana: '2026-12-08', t1: a, t2: b });
    expect(T.updateTurno(db, id, { data: '2026-12-09', nota: 'Immacolata' }, audit).error).toBeUndefined();
    expect(db.prepare('SELECT data, nota FROM turni WHERE id = ?').get(id)).toEqual({ data: '2026-12-09', nota: 'Immacolata' });
    expect(T.updateTurno(db, id, { data: '2026-12-15' }, audit).error).toBeTruthy();
    expect(T.updateTurno(db, id, { data: '2026-02-30' }, audit).error).toBeTruthy();
  });

  it('updateTurno with saltata empties the slots', () => {
    const [a, b] = people(2);
    const id = createTurno(db, { settimana: '2026-12-08', t1: a, t2: b });
    T.updateTurno(db, id, { saltata: true }, audit);
    expect(db.prepare('SELECT saltata, turnista1_id, turnista2_id FROM turni WHERE id = ?').get(id))
      .toEqual({ saltata: 1, turnista1_id: null, turnista2_id: null });
  });

  it('updateTurno refuses the same person twice and non-attivo users', () => {
    const [a, b] = people(2);
    const s = createUser(db, { username: 's', stato: 'sospeso' });
    const id = createTurno(db, { settimana: '2026-12-08', t1: a, t2: b });
    expect(T.updateTurno(db, id, { turnista2Id: a }, audit).error).toBeTruthy();
    expect(T.updateTurno(db, id, { turnista2Id: s }, audit).error).toBeTruthy();
    expect(T.updateTurno(db, id, { turnista2Id: null }, audit).error).toBeUndefined();
  });

  it('swapTurnisti exchanges two people and records it on both rows', () => {
    const [a, b, c, d] = people(4);
    const x = createTurno(db, { settimana: '2026-11-24', t1: a, t2: b });
    const y = createTurno(db, { settimana: '2026-12-01', t1: c, t2: d });
    expect(T.swapTurnisti(db, { id: x, slot: 1 }, { id: y, slot: 1 }, audit).error).toBeUndefined();
    expect(db.prepare('SELECT turnista1_id, scambio FROM turni WHERE id = ?').get(x)).toEqual({ turnista1_id: c, scambio: 'scambio con 01/12' });
    expect(db.prepare('SELECT turnista1_id, scambio FROM turni WHERE id = ?').get(y)).toEqual({ turnista1_id: a, scambio: 'scambio con 24/11' });
  });

  it('swapTurnisti refuses a swap that puts someone twice on one consegna', () => {
    const [a, b, c] = people(3);
    const x = createTurno(db, { settimana: '2026-11-24', t1: a, t2: b });
    const y = createTurno(db, { settimana: '2026-12-01', t1: c, t2: a });
    expect(T.swapTurnisti(db, { id: x, slot: 2 }, { id: y, slot: 2 }, audit).error).toBeTruthy();
    expect(T.swapTurnisti(db, { id: x, slot: 1 }, { id: x, slot: 2 }, audit).error).toBeTruthy();
  });
});

describe('pauses and stato', () => {
  it('addPause skips written weeks and frees their people', () => {
    const [a, b, c, d] = people(4);
    db.prepare("UPDATE users SET created_at = '2025-01-01 00:00:00'").run(); // created_at defaults to the real now
    createTurno(db, { settimana: '2026-09-29', t1: c, t2: d });
    const id = createTurno(db, { settimana: '2026-12-29', t1: a, t2: b });
    expect(T.addPause(db, { dal: '2026-12-28', al: '2027-01-05', nota: 'Natale' }, TODAY, audit).error).toBeUndefined();
    expect(db.prepare('SELECT saltata, turnista1_id, turnista2_id, nota FROM turni WHERE id = ?').get(id))
      .toEqual({ saltata: 1, turnista1_id: null, turnista2_id: null, nota: 'Natale' });
    // a and b no longer have a counted shift, so they wait from created_at and go before c, d
    db.prepare('DELETE FROM turni WHERE id = ?').run(id);
    T.ensureTurni(db, TODAY, rnd);
    const first = db.prepare("SELECT turnista1_id a, turnista2_id b FROM turni WHERE settimana = '2026-10-06'").get();
    expect([first.a, first.b].sort()).toEqual([a, b].sort());
    const pid = db.prepare('SELECT id FROM turni_pause').get().id;
    expect(T.deletePause(db, pid)).toBe(true);
  });

  it('addPause validates the range', () => {
    expect(T.addPause(db, { dal: '2027-01-05', al: '2026-12-28' }, TODAY, audit).error).toBeTruthy();
    expect(T.addPause(db, { dal: 'x', al: '2026-12-28' }, TODAY, audit).error).toBeTruthy();
  });

  it('suspending a user empties only their future slots', () => {
    const [a, b] = people(2);
    const past = createTurno(db, { settimana: '2026-09-22', t1: a, t2: b });
    const fut = createTurno(db, { settimana: '2026-10-13', t1: b, t2: a });
    expect(setStato(db, a, 'sospeso', TODAY)).toBeNull();
    expect(db.prepare('SELECT turnista1_id, turnista2_id FROM turni WHERE id = ?').get(past)).toEqual({ turnista1_id: a, turnista2_id: b });
    expect(db.prepare('SELECT turnista1_id, turnista2_id FROM turni WHERE id = ?').get(fut)).toEqual({ turnista1_id: b, turnista2_id: null });
  });
});

describe('listTurni and importTurni', () => {
  it('lists the 12-week window with names and empty slots', () => {
    const [a] = people(1);
    createTurno(db, { settimana: '2026-09-29', t1: a });
    createTurno(db, { settimana: '2026-10-06', t1: a });
    const rows = T.listTurni(db, TODAY);
    expect(rows.map(r => r.settimana)).toEqual(['2026-10-06']);
    expect(rows[0].turnisti).toEqual([{ id: a, nome: 'p1' }, null]);
    expect(rows[0].saltata).toBe(false);
  });

  it('imports by username, replacing weeks from the first imported one', () => {
    people(4);
    createTurno(db, { settimana: '2026-10-06' });
    const res = T.importTurni(db, [
      { data: '2026-09-22', username1: 'p1', username2: 'p2', nota: '' },
      { data: '2026-09-29', username1: 'p3', username2: 'p4', nota: 'riunione gass' },
    ]);
    expect(res).toEqual({ imported: 2 });
    expect(db.prepare('SELECT settimana FROM turni ORDER BY settimana').all().map(r => r.settimana)).toEqual(['2026-09-22', '2026-09-29']);
    expect(db.prepare("SELECT riunione FROM turni WHERE settimana = '2026-09-29'").get().riunione).toBe(1);
    expect(T.importTurni(db, [{ data: '2026-10-06', username1: 'nessuno', username2: 'p1' }]).error).toMatch(/nessuno/);
  });
});
