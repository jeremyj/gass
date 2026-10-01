/**
 * Turni (consegna shifts): one row per week, filled by the rolling queue.
 * Takes the db handle so the CLI can pass its own connection.
 * Weeks already written never change unless an admin edits them.
 */

const { addDays, tuesdayOf, nextTuesday, inPause, isDateString, pickPair } = require('./turni-schedule');

const HORIZON_DAYS = 84; // always 12 weeks ahead

const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function pairCounts(db) {
  const counts = new Map();
  const rows = db.prepare(`
    SELECT turnista1_id AS a, turnista2_id AS b FROM turni
    WHERE saltata = 0 AND turnista1_id IS NOT NULL AND turnista2_id IS NOT NULL
  `).all();
  for (const { a, b } of rows) counts.set(pairKey(a, b), (counts.get(pairKey(a, b)) || 0) + 1);
  return counts;
}

// Attivo users with the date they have been waiting since: their last counted
// shift, or the day they (re)joined the queue (turni_dal, else created_at)
function waitingPeople(db) {
  return db.prepare(`
    SELECT u.id,
           MAX(COALESCE(u.turni_dal, substr(u.created_at, 1, 10), ''), COALESCE(MAX(t.data), '')) AS waitKey
    FROM users u
    LEFT JOIN turni t ON t.saltata = 0 AND (t.turnista1_id = u.id OR t.turnista2_id = u.id)
    WHERE u.stato = 'attivo'
    GROUP BY u.id
  `).all();
}

// Inserts a row for every Tuesday from the next one to the horizon that has none
// and is not in a pause (so weeks freed by a deleted pause get filled). Existing
// rows are never touched and past weeks are never backfilled.
function ensureTurni(db, today, rnd = Math.random) {
  const horizon = addDays(today, HORIZON_DAYS);
  db.transaction(() => {
    const pauses = db.prepare('SELECT dal, al FROM turni_pause').all();
    const exists = db.prepare('SELECT 1 FROM turni WHERE settimana = ?');
    const counts = pairCounts(db);
    const insert = db.prepare('INSERT INTO turni (settimana, data, turnista1_id, turnista2_id, created_at) VALUES (?, ?, ?, ?, ?)');
    for (let week = nextTuesday(today); week < horizon; week = addDays(week, 7)) {
      if (exists.get(week) || inPause(week, pauses)) continue;
      const [a, b] = pickPair(waitingPeople(db), (x, y) => counts.get(pairKey(x, y)) || 0, rnd);
      insert.run(week, week, a, b, new Date().toISOString());
      if (a && b) counts.set(pairKey(a, b), (counts.get(pairKey(a, b)) || 0) + 1);
    }
  })();
}

function listTurni(db, today) {
  return db.prepare(`
    SELECT t.*, u1.display_name AS nome1, u2.display_name AS nome2
    FROM turni t
    LEFT JOIN users u1 ON u1.id = t.turnista1_id
    LEFT JOIN users u2 ON u2.id = t.turnista2_id
    WHERE t.data >= ? AND t.settimana < ?
    ORDER BY t.settimana
  `).all(today, addDays(today, HORIZON_DAYS)).map(r => ({
    id: r.id,
    settimana: r.settimana,
    data: r.data,
    saltata: r.saltata === 1,
    riunione: r.riunione === 1,
    nota: r.nota,
    scambio: r.scambio,
    turnisti: [
      r.turnista1_id ? { id: r.turnista1_id, nome: r.nome1 } : null,
      r.turnista2_id ? { id: r.turnista2_id, nome: r.nome2 } : null
    ]
  }));
}

function listPause(db, today) {
  return db.prepare('SELECT id, dal, al, nota FROM turni_pause WHERE al >= ? ORDER BY dal').all(today);
}

const isAttivo = (db, id) => !!db.prepare("SELECT 1 FROM users WHERE id = ? AND stato = 'attivo'").get(id);
const ddmm = dateStr => `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}`;

function updateTurno(db, id, fields, audit) {
  const row = db.prepare('SELECT * FROM turni WHERE id = ?').get(id);
  if (!row) return { error: 'Turno non trovato' };
  const next = { ...row };
  const changes = [];

  if (fields.data !== undefined) {
    if (!isDateString(fields.data) || tuesdayOf(fields.data) !== row.settimana) {
      return { error: 'La consegna può spostarsi solo nella stessa settimana (da lunedì a domenica)' };
    }
    next.data = fields.data;
    if (next.data !== row.data) changes.push(`data ${row.data} → ${next.data}`);
  }
  for (const [field, col] of [['turnista1Id', 'turnista1_id'], ['turnista2Id', 'turnista2_id']]) {
    if (fields[field] === undefined) continue;
    const value = fields[field] === null ? null : Number(fields[field]);
    if (value !== null && !isAttivo(db, value)) return { error: 'Si possono assegnare solo utenti attivi' };
    next[col] = value;
    if (value !== row[col]) changes.push(`${col === 'turnista1_id' ? 'turnista 1' : 'turnista 2'} cambiato`);
  }
  if (fields.riunione !== undefined) {
    next.riunione = fields.riunione ? 1 : 0;
    if (next.riunione !== row.riunione) changes.push(next.riunione ? 'riunione' : 'niente riunione');
  }
  if (fields.nota !== undefined) {
    next.nota = String(fields.nota).trim() || null;
    if (next.nota !== row.nota) changes.push(`nota: ${next.nota || '—'}`);
  }
  if (fields.saltata !== undefined) {
    next.saltata = fields.saltata ? 1 : 0;
    if (next.saltata !== row.saltata) changes.push(next.saltata ? 'niente consegna' : 'consegna ripristinata');
  }
  // A skipped consegna doesn't count: its people go back to the front of the queue
  if (next.saltata) {
    next.turnista1_id = null;
    next.turnista2_id = null;
  }
  if (next.turnista1_id && next.turnista1_id === next.turnista2_id) {
    return { error: 'La stessa persona non può fare entrambi i turni' };
  }

  db.prepare(`
    UPDATE turni SET data = ?, turnista1_id = ?, turnista2_id = ?, saltata = ?, riunione = ?, nota = ?, updated_by = ?, updated_at = ?
    WHERE id = ?
  `).run(next.data, next.turnista1_id, next.turnista2_id, next.saltata, next.riunione, next.nota, audit.userId, audit.timestamp, id);
  return { changes };
}

function swapTurnisti(db, a, b, today, audit) {
  const col = slot => (Number(slot) === 1 ? 'turnista1_id' : Number(slot) === 2 ? 'turnista2_id' : null);
  const colA = col(a.slot), colB = col(b.slot);
  if (!colA || !colB) return { error: 'Turno non valido' };
  if (Number(a.id) === Number(b.id)) return { error: 'Scegli due consegne diverse' };
  const rowA = db.prepare('SELECT * FROM turni WHERE id = ?').get(a.id);
  const rowB = db.prepare('SELECT * FROM turni WHERE id = ?').get(b.id);
  if (!rowA || !rowB) return { error: 'Turno non trovato' };
  if (rowA.saltata || rowB.saltata || rowA.data < today || rowB.data < today) {
    return { error: 'Si possono scambiare solo consegne future' };
  }

  const newA = { ...rowA, [colA]: rowB[colB] };
  const newB = { ...rowB, [colB]: rowA[colA] };
  for (const r of [newA, newB]) {
    if (r.turnista1_id && r.turnista1_id === r.turnista2_id) {
      return { error: 'Con questo scambio una persona farebbe entrambi i turni della stessa consegna' };
    }
  }
  // Each swap is appended ("out ↔ in (dd/mm)"), so a consegna swapped twice keeps both
  const nome = id => (id && db.prepare('SELECT display_name FROM users WHERE id = ?').get(id)?.display_name) || 'da coprire';
  const addScambio = (row, out, inn, other) =>
    [row.scambio, `${nome(out)} ↔ ${nome(inn)} (${ddmm(other.data)})`].filter(Boolean).join('; ');
  db.transaction(() => {
    db.prepare(`UPDATE turni SET ${colA} = ?, scambio = ?, updated_by = ?, updated_at = ? WHERE id = ?`)
      .run(newA[colA], addScambio(rowA, rowA[colA], rowB[colB], rowB), audit.userId, audit.timestamp, rowA.id);
    db.prepare(`UPDATE turni SET ${colB} = ?, scambio = ?, updated_by = ?, updated_at = ? WHERE id = ?`)
      .run(newB[colB], addScambio(rowB, rowB[colB], rowA[colA], rowA), audit.userId, audit.timestamp, rowB.id);
  })();
  return { changes: [`${rowA.data} ↔ ${rowB.data}`] };
}

function addPause(db, { dal, al, nota }, today, audit) {
  if (!isDateString(dal) || !isDateString(al) || dal > al) return { error: 'Date della pausa non valide' };
  const text = (nota || '').trim() || 'pausa';
  let id;
  db.transaction(() => {
    id = db.prepare('INSERT INTO turni_pause (dal, al, nota, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(dal, al, text, audit.userId, audit.timestamp).lastInsertRowid;
    // Weeks already written inside the pause become "niente consegna" and free their people
    db.prepare(`
      UPDATE turni SET saltata = 1, turnista1_id = NULL, turnista2_id = NULL, nota = ?, updated_by = ?, updated_at = ?
      WHERE data BETWEEN ? AND ? AND data >= ?
    `).run(text, audit.userId, audit.timestamp, dal, al, today);
  })();
  return { id };
}

function deletePause(db, id) {
  return db.prepare('DELETE FROM turni_pause WHERE id = ?').run(id).changes > 0;
}

// A user leaving the queue (sospeso/disattivato) leaves their future slots "da coprire"
function freeFutureTurni(db, userId, today) {
  const a = db.prepare('UPDATE turni SET turnista1_id = NULL WHERE turnista1_id = ? AND data >= ?').run(userId, today).changes;
  const b = db.prepare('UPDATE turni SET turnista2_id = NULL WHERE turnista2_id = ? AND data >= ?').run(userId, today).changes;
  return a + b;
}

// rows: [{ data, username1, username2, nota }]; replaces every week from the first imported one
function importTurni(db, rows, today) {
  const byUsername = db.prepare('SELECT id, stato FROM users WHERE username = ?');
  const prepared = [];
  for (const r of rows) {
    if (!isDateString(r.data)) return { error: `Data non valida: ${r.data}` };
    if (r.username1 && r.username1 === r.username2) return { error: `Stessa persona due volte il ${r.data}` };
    const ids = [];
    for (const u of [r.username1, r.username2]) {
      if (!u) { ids.push(null); continue; }
      const user = byUsername.get(u);
      if (!user) return { error: `Utente non trovato: ${u}` };
      if (r.data >= today && user.stato !== 'attivo') return { error: `Utente non attivo nelle settimane future: ${u} (${r.data})` };
      ids.push(user.id);
    }
    const nota = (r.nota || '').trim();
    prepared.push({ settimana: tuesdayOf(r.data), data: r.data, ids, riunione: /riunione/i.test(nota) ? 1 : 0, nota: nota || null });
  }
  if (new Set(prepared.map(p => p.settimana)).size !== prepared.length) return { error: 'Due righe nella stessa settimana' };
  const first = prepared.map(p => p.settimana).sort()[0];
  db.transaction(() => {
    db.prepare('DELETE FROM turni WHERE settimana >= ?').run(first);
    const ins = db.prepare('INSERT INTO turni (settimana, data, turnista1_id, turnista2_id, riunione, nota, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const p of prepared) ins.run(p.settimana, p.data, p.ids[0], p.ids[1], p.riunione, p.nota, new Date().toISOString());
  })();
  return { imported: prepared.length };
}

module.exports = {
  HORIZON_DAYS, ensureTurni, listTurni, listPause, updateTurno, swapTurnisti,
  addPause, deletePause, freeFutureTurni, importTurni
};
