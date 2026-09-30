const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { requireAuth, requireAdmin, getAuditFields } = require('../middleware/auth');
const { roundToCents, toLocalDateString } = require('../services/calculations');
const { saldoAt, currentSaldo, recalculateSaldo, getTransactions } = require('../services/saldi');

const router = express.Router();

// Require authentication for all participant routes
router.use(requireAuth);

// Get all participants with their balances
router.get('/', (req, res) => {
  const timestamp = new Date().toISOString();
  const { date } = req.query;

  console.log(`[PARTICIPANTS] ${timestamp} - GET request${date ? ` for date: ${date}` : ''}`);

  try {
    // If date is provided, calculate saldi as of that date
    if (date) {
      // Replay each participant's ledger up to and including the requested date
      const participantsWithSaldi = db.prepare(
        'SELECT id, username, display_name AS nome, is_admin FROM users ORDER BY display_name'
      ).all().map(u => {
        const { saldo, ultimaModifica } = saldoAt(u.id, date);
        return { ...u, saldo, ultima_modifica: ultimaModifica };
      });

      console.log(`[PARTICIPANTS] ${timestamp} - Successfully calculated saldi for ${date} (${participantsWithSaldi.length} participants)`);
      res.json({ success: true, participants: participantsWithSaldi });
    } else {
      // Return current saldi
      const participants = db.prepare('SELECT id, username, display_name AS nome, saldo, ultima_modifica, is_admin FROM users ORDER BY display_name').all();
      console.log(`[PARTICIPANTS] ${timestamp} - Retrieved ${participants.length} participants with current saldi`);
      res.json({ success: true, participants });
    }
  } catch (error) {
    console.error(`[PARTICIPANTS] ${timestamp} - Error fetching participants:`, error);
    res.status(500).json({ success: false, error: 'Errore durante il recupero dei partecipanti' });
  }
});

// Get transactions for a specific participant
router.get('/:id/transactions', (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;

  console.log(`[PARTICIPANTS] ${timestamp} - GET transactions for participant ID: ${id}`);

  try {
    const transactions = getTransactions(id);

    console.log(`[PARTICIPANTS] ${timestamp} - Retrieved ${transactions.length} transactions for participant ID: ${id}`);
    res.json({ success: true, transactions });
  } catch (error) {
    console.error(`[PARTICIPANTS] ${timestamp} - Error fetching transactions for participant ID ${id}:`, error);
    res.status(500).json({ success: false, error: 'Errore durante il recupero delle transazioni' });
  }
});

// Set participant saldo (admin only): recorded as a dated rettifica for the difference
router.put('/:id', requireAdmin, (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;
  const { saldo } = req.body;

  console.log(`[PARTICIPANTS] ${timestamp} - PUT request to update participant ID: ${id}, new saldo: ${saldo}€`);

  if (typeof saldo !== 'number' || !Number.isFinite(saldo)) {
    return res.status(400).json({ success: false, error: 'Saldo non valido' });
  }

  try {
    const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    const before = exists ? currentSaldo(id) : null;
    const importo = exists ? roundToCents(saldo - before) : 0;

    if (importo !== 0) {
      const audit = getAuditFields(req, 'create');
      db.transaction(() => {
        db.prepare(`
          INSERT INTO rettifiche_saldo (partecipante_id, data, importo, created_by, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(id, toLocalDateString(), importo, audit.created_by, audit.created_at);
        recalculateSaldo(id, audit);

        db.prepare(`
          INSERT INTO activity_logs (event_type, target_user_id, actor_user_id, details, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run('saldo_updated', parseInt(id), req.session.userId, `saldo: ${before} → ${saldo}`, timestamp);
      })();

      console.log(`[PARTICIPANTS] ${timestamp} - Successfully updated participant ID ${id} saldo from ${before}€ to ${saldo}€`);
    } else {
      console.log(`[PARTICIPANTS] ${timestamp} - No change needed for participant ID ${id}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error(`[PARTICIPANTS] ${timestamp} - Error updating participant ID ${id}:`, error);
    res.status(500).json({ success: false, error: 'Errore durante l\'aggiornamento del saldo' });
  }
});

// Add new participant (creates a user account, admin only)
router.post('/', requireAdmin, async (req, res) => {
  const timestamp = new Date().toISOString();
  const { nome, username, password } = req.body;

  console.log(`[PARTICIPANTS] ${timestamp} - POST request to create new participant: ${nome}`);

  // Validate required fields
  if (!nome || !username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Nome, username e password sono obbligatori'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'La password deve essere di almeno 8 caratteri'
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const audit = getAuditFields(req, 'create');

    const result = db.prepare(`
      INSERT INTO users (username, password_hash, display_name, saldo, is_admin, created_by, created_at, updated_by, updated_at)
      VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?)
    `).run(username, passwordHash, nome, audit.created_by, audit.created_at, audit.updated_by, audit.updated_at);

    // Log user creation event
    db.prepare(`
      INSERT INTO activity_logs (event_type, target_user_id, actor_user_id, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('user_created', result.lastInsertRowid, req.session.userId, `username: ${username}, display_name: ${nome}`, timestamp);

    console.log(`[PARTICIPANTS] ${timestamp} - Successfully created participant: ${nome} (ID: ${result.lastInsertRowid})`);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error(`[PARTICIPANTS] ${timestamp} - Error creating participant ${nome}:`, error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, error: 'Username già esistente' });
    }
    res.status(500).json({ success: false, error: 'Errore durante la creazione del partecipante' });
  }
});

// Delete participant (deletes user account, admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;

  console.log(`[PARTICIPANTS] ${timestamp} - DELETE request for participant ID: ${id}`);

  try {
    // Prevent deleting the last user
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount === 1) {
      return res.status(400).json({
        success: false,
        error: 'Impossibile eliminare l\'ultimo utente del sistema'
      });
    }

    const participant = db.prepare('SELECT display_name, username FROM users WHERE id = ?').get(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    // Log user deletion event
    db.prepare(`
      INSERT INTO activity_logs (event_type, target_user_id, actor_user_id, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('user_deleted', null, req.session.userId, `username: ${participant?.username}, display_name: ${participant?.display_name}`, timestamp);

    console.log(`[PARTICIPANTS] ${timestamp} - Successfully deleted participant: ${participant?.display_name || id} (ID: ${id})`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[PARTICIPANTS] ${timestamp} - Error deleting participant ID ${id}:`, error);
    res.status(500).json({ success: false, error: 'Errore durante l\'eliminazione del partecipante' });
  }
});

module.exports = router;
