/**
 * Quota teatro: each person owes a quota per semester (teatro_dovuti, 0 = non dovuto);
 * payments are a running total spread over the owed semesters oldest first
 * (teatro-calc.allocate), an excess being an advance. The cassa teatro is separate
 * from the consegna cassa: payments made in GASS plus manual entries (teatro_cassa).
 * Payments imported from the old sheet (fonte = 'foglio') are not in the cassa.
 * Takes the db handle so the CLI can pass its own connection.
 */

const { semestreOf, semestreLabel, isSemestre, allocate } = require('./teatro-calc');

const DEFAULT_QUOTA = 15;
const round = x => Math.round(x * 100) / 100;
const nomeDi = (db, id) => db.prepare('SELECT display_name FROM users WHERE id = ?').get(id)?.display_name;

// Opens the semester of `today` once: its quota is the last semester's, and every
// attivo owes it. People who join later are added by an admin (setDovuto).
function ensureSemestre(db, today) {
  const s = semestreOf(today);
  if (db.prepare('SELECT 1 FROM teatro_semestri WHERE semestre = ?').get(s)) return;
  const last = db.prepare('SELECT quota FROM teatro_semestri WHERE semestre < ? ORDER BY semestre DESC LIMIT 1').get(s);
  const quota = last ? last.quota : DEFAULT_QUOTA;
  db.transaction(() => {
    db.prepare('INSERT INTO teatro_semestri (semestre, quota) VALUES (?, ?)').run(s, quota);
    db.prepare(`INSERT OR IGNORE INTO teatro_dovuti (user_id, semestre, dovuto)
                SELECT id, ?, ? FROM users WHERE stato = 'attivo'`).run(s, quota);
  })();
}

function setQuota(db, semestre, quota, audit) {
  const q = Number(quota);
  if (!isSemestre(semestre) || !Number.isFinite(q) || q < 0) return { error: 'Quota non valida' };
  const old = db.prepare('SELECT quota FROM teatro_semestri WHERE semestre = ?').get(semestre);
  db.transaction(() => {
    db.prepare('INSERT INTO teatro_semestri (semestre, quota) VALUES (?, ?) ON CONFLICT(semestre) DO UPDATE SET quota = excluded.quota').run(semestre, q);
    // People on the old quota follow it; reduced quotas and non dovuto stay
    if (old) db.prepare('UPDATE teatro_dovuti SET dovuto = ? WHERE semestre = ? AND dovuto = ?').run(q, semestre, old.quota);
  })();
  return { changes: [`quota ${semestreLabel(semestre)}: ${q} €`] };
}

// dovuto: amount owed (0 = non dovuto), null = remove the row (not in the GASS that semester)
function setDovuto(db, userId, semestre, dovuto, audit) {
  if (!isSemestre(semestre) || !nomeDi(db, userId)) return { error: 'Dati non validi' };
  if (dovuto === null) {
    db.prepare('DELETE FROM teatro_dovuti WHERE user_id = ? AND semestre = ?').run(userId, semestre);
    return { changes: [`${nomeDi(db, userId)}, ${semestreLabel(semestre)}: non nel GASS`] };
  }
  const d = Number(dovuto);
  if (!Number.isFinite(d) || d < 0) return { error: 'Importo non valido' };
  db.prepare(`INSERT INTO teatro_dovuti (user_id, semestre, dovuto) VALUES (?, ?, ?)
              ON CONFLICT(user_id, semestre) DO UPDATE SET dovuto = excluded.dovuto`).run(userId, semestre, d);
  return { changes: [`${nomeDi(db, userId)}, ${semestreLabel(semestre)}: ${d ? `dovuto ${d} €` : 'non dovuto'}`] };
}

function totalePagato(db, userId) {
  return db.prepare('SELECT COALESCE(SUM(importo), 0) AS t FROM teatro_pagamenti WHERE user_id = ?').get(userId).t;
}

// Per-semester rows { semestre, label, dovuto, pagato }, what is still owed and any advance
function statoTeatro(db, userId) {
  const dovuti = db.prepare('SELECT semestre, dovuto FROM teatro_dovuti WHERE user_id = ?').all(userId);
  const r = allocate(dovuti, totalePagato(db, userId));
  return { ...r, righe: r.righe.map(x => ({ ...x, label: semestreLabel(x.semestre) })) };
}

// Owed minus advance for every user (negative = advance), for the Saldi lists
function residui(db) {
  const out = {};
  for (const { id } of db.prepare('SELECT id FROM users').all()) {
    const s = statoTeatro(db, id);
    out[id] = round(s.residuo - s.anticipo);
  }
  return out;
}

function registraPagamento(db, { userId, importo, data, consegnaId = null, fonte = null }, audit) {
  const x = Number(importo);
  if (!Number.isFinite(x) || x <= 0) return { error: 'Importo non valido' };
  if (!nomeDi(db, userId)) return { error: 'Partecipante non trovato' };
  db.prepare(`INSERT INTO teatro_pagamenti (user_id, data, importo, consegna_id, fonte, created_by, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`).run(userId, data, round(x), consegnaId, fonte, audit.userId, audit.timestamp);
  const s = statoTeatro(db, userId);
  const after = s.residuo > 0 ? `resta ${s.residuo} €` : s.anticipo > 0 ? `anticipo ${s.anticipo} €` : 'in regola';
  return { changes: [`${nomeDi(db, userId)}: ${round(x)} € (${after})`] };
}

function deletePagamento(db, id) {
  const p = db.prepare('SELECT * FROM teatro_pagamenti WHERE id = ?').get(id);
  if (!p) return { error: 'Pagamento non trovato' };
  db.prepare('DELETE FROM teatro_pagamenti WHERE id = ?').run(id);
  return { changes: [`eliminato pagamento di ${nomeDi(db, p.user_id)}: ${p.importo} € del ${p.data}`] };
}

function addCassa(db, { data, importo, descrizione }, audit) {
  const x = Number(importo);
  const text = String(descrizione || '').trim();
  if (!Number.isFinite(x) || x === 0 || !text || !/^\d{4}-\d{2}-\d{2}$/.test(String(data))) return { error: 'Voce non valida' };
  db.prepare('INSERT INTO teatro_cassa (data, importo, descrizione, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(data, round(x), text, audit.userId, audit.timestamp);
  return { changes: [`cassa teatro ${x > 0 ? '+' : ''}${round(x)} €: ${text}`] };
}

function saldoCassa(db) {
  const p = db.prepare('SELECT COALESCE(SUM(importo), 0) AS t FROM teatro_pagamenti WHERE fonte IS NULL').get().t;
  const c = db.prepare('SELECT COALESCE(SUM(importo), 0) AS t FROM teatro_cassa').get().t;
  return round(p + c);
}

function quoteDelGiorno(db, data) {
  return round(db.prepare('SELECT COALESCE(SUM(importo), 0) AS t FROM teatro_pagamenti WHERE data = ? AND fonte IS NULL').get(data).t);
}

function setNota(db, userId, nota) {
  if (!nomeDi(db, userId)) return { error: 'Partecipante non trovato' };
  db.prepare('UPDATE users SET teatro_nota = ? WHERE id = ?').run(String(nota || '').trim() || null, userId);
  return { changes: [`${nomeDi(db, userId)}: nota teatro aggiornata`] };
}

// Everything the admin Teatro page shows
function riepilogo(db) {
  const semestri = db.prepare('SELECT semestre, quota FROM teatro_semestri ORDER BY semestre').all()
    .map(s => ({ ...s, label: semestreLabel(s.semestre) }));
  const people = db.prepare(`
    SELECT id, display_name AS nome, stato, teatro_nota AS nota FROM users
    WHERE stato != 'disattivato' OR id IN (SELECT user_id FROM teatro_dovuti) ORDER BY display_name
  `).all();
  const persone = people.map(p => {
    const s = statoTeatro(db, p.id);
    return { ...p, righe: s.righe, residuo: s.residuo, anticipo: s.anticipo };
  });
  const pagamenti = db.prepare(`
    SELECT p.id, p.user_id, u.display_name AS nome, p.data, p.importo, p.fonte FROM teatro_pagamenti p
    JOIN users u ON u.id = p.user_id ORDER BY p.data DESC, p.id DESC
  `).all();
  const cassa = db.prepare('SELECT id, data, importo, descrizione FROM teatro_cassa ORDER BY data DESC, id DESC').all();
  return { semestri, persone, pagamenti, cassa, saldo: saldoCassa(db) };
}

module.exports = {
  DEFAULT_QUOTA, ensureSemestre, setQuota, setDovuto, statoTeatro, residui, registraPagamento, deletePagamento,
  addCassa, saldoCassa, quoteDelGiorno, setNota, riepilogo
};
