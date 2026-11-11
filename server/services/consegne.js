// Creating a consegna row, shared by POST /api/consegna and the first photo of the day
const { roundToCents } = require('./calculations');
const { logActivity } = require('./activity');

// The consegna of that date, created if missing: trovato = previous lasciato, nothing paid yet
// (POST /api/consegna then overwrites the cassa fields with what it computes)
function ensureConsegna(db, data, audit) {
  const existing = db.prepare('SELECT * FROM consegne WHERE data = ?').get(data);
  if (existing) return existing;

  const prev = db.prepare('SELECT lasciato_in_cassa FROM consegne WHERE data < ? ORDER BY data DESC LIMIT 1').get(data);
  const trovato = roundToCents(prev?.lasciato_in_cassa ?? 0);
  const id = db.prepare(`
    INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa, note,
                          created_by, created_at, updated_by, updated_at)
    VALUES (?, ?, 0, ?, '', ?, ?, ?, ?)
  `).run(data, trovato, trovato, audit.created_by, audit.created_at, audit.created_by, audit.created_at).lastInsertRowid;

  logActivity({
    eventType: 'consegna_created',
    actorUserId: audit.created_by,
    consegnaId: id,
    details: `consegna: ${data}`,
    createdAt: audit.created_at
  });
  return db.prepare('SELECT * FROM consegne WHERE id = ?').get(id);
}

// After a change on or before `data` (save, correction, delete), each later consegna takes the
// previous lasciato as trovato and its lasciato moves by the same amount. Only the difference is
// carried, so a lasciato set by hand (15/9 and 22/9/2026, loaded from the old sheet) keeps its gap.
function propagaCassa(db, data) {
  let prev = db.prepare('SELECT lasciato_in_cassa FROM consegne WHERE data <= ? ORDER BY data DESC LIMIT 1').get(data);
  if (!prev) return;
  const update = db.prepare('UPDATE consegne SET trovato_in_cassa = ?, lasciato_in_cassa = ? WHERE id = ?');
  for (const c of db.prepare('SELECT id, trovato_in_cassa, lasciato_in_cassa FROM consegne WHERE data > ? ORDER BY data').all(data)) {
    const delta = roundToCents(prev.lasciato_in_cassa - c.trovato_in_cassa);
    if (delta !== 0) {
      c.trovato_in_cassa = roundToCents(prev.lasciato_in_cassa);
      c.lasciato_in_cassa = roundToCents(c.lasciato_in_cassa + delta);
      update.run(c.trovato_in_cassa, c.lasciato_in_cassa, c.id);
    }
    prev = c;
  }
}

module.exports = { ensureConsegna, propagaCassa };
