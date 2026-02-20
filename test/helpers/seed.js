'use strict';

const bcrypt = require('bcrypt');
const supertest = require('supertest');

const BCRYPT_ROUNDS = 4; // Fast rounds for test users

/**
 * Create a user directly in the test DB.
 * Returns the inserted row id.
 */
function createUser(db, { username, password = 'password123', displayName, isAdmin = 0, saldo = 0 } = {}) {
  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, display_name, saldo, is_admin)
    VALUES (?, ?, ?, ?, ?)
  `).run(username, passwordHash, displayName || username, saldo, isAdmin ? 1 : 0);
  return result.lastInsertRowid;
}

/**
 * Create a consegna record directly in the test DB.
 * Returns the inserted row id.
 */
function createConsegna(db, { data, trovatoInCassa = 0, pagatoProduttore = 0, lasciatoInCassa = 0, chiusa = 0 } = {}) {
  const result = db.prepare(`
    INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa, chiusa)
    VALUES (?, ?, ?, ?, ?)
  `).run(data, trovatoInCassa, pagatoProduttore, lasciatoInCassa, chiusa ? 1 : 0);
  return result.lastInsertRowid;
}

/**
 * Create a movimento record directly in the test DB.
 * Returns the inserted row id.
 */
function createMovimento(db, {
  consegnaId, partecipanteId,
  saldaTutto = 0, importoSaldato = 0, usaCredito = 0,
  debitoLasciato = 0, creditoLasciato = 0,
  saldaDebitoTotale = 0, debitoSaldato = 0,
  contoProduttore = 0, note = '',
  createdAt = null, updatedAt = null
} = {}) {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO movimenti (
      consegna_id, partecipante_id, salda_tutto, importo_saldato,
      usa_credito, debito_lasciato, credito_lasciato,
      salda_debito_totale, debito_saldato, conto_produttore, note,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    consegnaId, partecipanteId, saldaTutto, importoSaldato,
    usaCredito, debitoLasciato, creditoLasciato,
    saldaDebitoTotale, debitoSaldato, contoProduttore, note,
    createdAt || now, updatedAt || createdAt || now
  );
  return result.lastInsertRowid;
}

/**
 * Log in as a user via the API. Returns the supertest agent (with session cookie).
 */
async function loginAs(agent, username, password = 'password123') {
  const res = await agent.post('/api/auth/login').send({ username, password });
  if (!res.body.success) {
    throw new Error(`Login failed for ${username}: ${JSON.stringify(res.body)}`);
  }
  return res.body.user;
}

/**
 * Delete all consegne (cascades to movimenti) and reset saldi.
 * Leaves users intact.
 */
function clearConsegne(db) {
  db.prepare('DELETE FROM consegne').run();
  db.prepare('UPDATE users SET saldo = 0, ultima_modifica = NULL').run();
  db.prepare('DELETE FROM activity_logs').run();
}

/**
 * Delete all test-created users (everything except the initial 'admin' user)
 * and their FK-dependent records. Also resets admin's is_admin=1 in case
 * a test demoted/changed it.
 */
function clearNonAdminUsers(db) {
  // Must delete FK-dependent activity_logs rows before deleting users
  db.prepare("DELETE FROM activity_logs WHERE target_user_id IN (SELECT id FROM users WHERE username != 'admin')").run();
  db.prepare("DELETE FROM activity_logs WHERE actor_user_id IN (SELECT id FROM users WHERE username != 'admin')").run();
  // Clear audit FK references on remaining rows that point to users being deleted
  db.prepare("UPDATE users SET created_by = NULL, updated_by = NULL WHERE created_by IN (SELECT id FROM users WHERE username != 'admin') OR updated_by IN (SELECT id FROM users WHERE username != 'admin')").run();
  db.prepare("UPDATE consegne SET created_by = NULL, updated_by = NULL, chiusa_by = NULL, riaperta_by = NULL WHERE created_by IN (SELECT id FROM users WHERE username != 'admin') OR updated_by IN (SELECT id FROM users WHERE username != 'admin') OR chiusa_by IN (SELECT id FROM users WHERE username != 'admin') OR riaperta_by IN (SELECT id FROM users WHERE username != 'admin')").run();
  db.prepare("UPDATE movimenti SET created_by = NULL, updated_by = NULL WHERE created_by IN (SELECT id FROM users WHERE username != 'admin') OR updated_by IN (SELECT id FROM users WHERE username != 'admin')").run();
  db.prepare("DELETE FROM users WHERE username != 'admin'").run();
  // Reset admin's admin status in case a test modified it
  db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'admin'").run();
}

module.exports = { createUser, createConsegna, createMovimento, loginAs, clearConsegne, clearNonAdminUsers };
