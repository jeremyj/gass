const db = require('../config/database');
const { applyEvent, compareEvents } = require('./calculations');

// A participant's saldo is derived from its ledger: movimenti (one per consegna)
// plus manual rettifiche, replayed from 0 in ledger order. users.saldo is a cache.

function getEvents(userId) {
  const movimenti = db.prepare(`
    SELECT m.*, c.data, 'movimento' AS tipo
    FROM movimenti m
    JOIN consegne c ON m.consegna_id = c.id
    WHERE m.partecipante_id = ?
  `).all(userId);
  const rettifiche = db.prepare(`
    SELECT r.*, 'rettifica' AS tipo FROM rettifiche_saldo r WHERE r.partecipante_id = ?
  `).all(userId);
  return [...movimenti, ...rettifiche].sort(compareEvents);
}

// Saldo at the end of `date`, and the date of the last event up to it
function saldoAt(userId, date) {
  let saldo = 0;
  let ultimaModifica = null;
  for (const e of getEvents(userId)) {
    if (e.data > date) break;
    saldo = applyEvent(saldo, e);
    ultimaModifica = e.data;
  }
  return { saldo, ultimaModifica };
}

// Saldo the consegna form for `date` starts from: everything before the participant's
// movimento on that date (same-day rettifiche entered earlier count)
function saldoBeforeConsegna(userId, date) {
  let saldo = 0;
  for (const e of getEvents(userId)) {
    if (e.data > date || (e.data === date && e.tipo === 'movimento')) break;
    saldo = applyEvent(saldo, e);
  }
  return saldo;
}

function currentSaldo(userId) {
  return saldoAt(userId, '9999-12-31').saldo;
}

// Rebuild the users.saldo cache from the ledger
function recalculateSaldo(userId, audit) {
  const { saldo, ultimaModifica } = saldoAt(userId, '9999-12-31');
  db.prepare('UPDATE users SET saldo = ?, ultima_modifica = ?, updated_by = ?, updated_at = ? WHERE id = ?')
    .run(saldo, ultimaModifica, audit.updated_by, audit.updated_at, userId);
  return saldo;
}

// Ledger newest-first, each event with the saldo right after it
function getTransactions(userId) {
  let saldo = 0;
  return getEvents(userId)
    .map(e => ({ ...e, saldo_dopo: (saldo = applyEvent(saldo, e)) }))
    .reverse();
}

module.exports = { saldoAt, saldoBeforeConsegna, currentSaldo, recalculateSaldo, getTransactions };
