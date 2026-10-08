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

module.exports = { ensureConsegna };
