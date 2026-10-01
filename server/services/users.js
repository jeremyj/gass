/**
 * User deletion, shared by DELETE /api/participants/:id and manage-users.js.
 * Takes the db handle so the CLI can pass its own connection.
 */

/**
 * Delete a user unless it is the last one or has financial history
 * (movimenti/rettifiche would CASCADE away). Log and audit rows that
 * reference the user are kept, unlinked (set to NULL).
 * Returns null on success, or the reason it was refused.
 */
function deleteUser(db, id) {
  if (db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 1) {
    return 'Impossibile eliminare l\'ultimo utente del sistema';
  }

  const hasHistory = db.prepare(`
    SELECT 1 FROM movimenti WHERE partecipante_id = ?
    UNION ALL SELECT 1 FROM rettifiche_saldo WHERE partecipante_id = ?
  `).get(id, id);
  if (hasHistory) {
    return 'Impossibile eliminare: il partecipante ha movimenti o rettifiche di saldo. Disattivalo invece';
  }

  db.transaction(() => {
    const refs = db.prepare(`
      SELECT m.name AS tbl, f."from" AS col
      FROM sqlite_master m, pragma_foreign_key_list(m.name) f
      WHERE m.type = 'table' AND f."table" = 'users' AND f.on_delete != 'CASCADE'
    `).all();
    for (const { tbl, col } of refs) {
      db.prepare(`UPDATE "${tbl}" SET "${col}" = NULL WHERE "${col}" = ?`).run(id);
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  })();
  return null;
}

const { toLocalDateString } = require('./calculations');

const STATI = ['attivo', 'sospeso', 'disattivato'];

/**
 * Change a user's stato. Returning to attivo restarts their turni wait from today.
 * Returns null on success, or the reason it was refused.
 */
function setStato(db, id, stato, today = toLocalDateString()) {
  if (!STATI.includes(stato)) return `Stato non valido: ${stato}`;
  db.prepare('UPDATE users SET stato = ?, turni_dal = CASE WHEN ? = \'attivo\' THEN ? ELSE turni_dal END WHERE id = ?')
    .run(stato, stato, today, id);
  return null;
}

module.exports = { deleteUser, setStato, STATI };
