// Uscite di cassa: cash taken out of a consegna's cassa, each with its motivo
const { roundToCents } = require('./calculations');

function listUscite(db, consegnaId) {
  return db.prepare('SELECT importo, motivo FROM uscite_cassa WHERE consegna_id = ? ORDER BY id').all(consegnaId);
}

function totaleUscite(uscite) {
  return roundToCents(uscite.reduce((sum, u) => sum + u.importo, 0));
}

// Replace the consegna's uscite with the ones from the form (saved together with the note)
function sostituisciUscite(db, consegnaId, uscite, audit) {
  db.prepare('DELETE FROM uscite_cassa WHERE consegna_id = ?').run(consegnaId);
  const insert = db.prepare('INSERT INTO uscite_cassa (consegna_id, importo, motivo, created_by, created_at) VALUES (?, ?, ?, ?, ?)');
  uscite.forEach(u => insert.run(consegnaId, roundToCents(u.importo), u.motivo.trim(), audit.created_by, audit.created_at));
}

module.exports = { listUscite, totaleUscite, sostituisciUscite };
