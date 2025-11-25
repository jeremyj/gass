const express = require('express');
const db = require('../config/database');
const { requireAuth, getAuditFields } = require('../middleware/auth');

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
      const participants = db.prepare('SELECT id, username, display_name AS nome FROM users ORDER BY display_name').all();

      console.log(`[PARTICIPANTS] ${timestamp} - Calculating saldi as of ${date} for ${participants.length} participants`);

      // For each participant, calculate saldo from movimenti up to and including the date
      const participantsWithSaldi = participants.map(p => {
        const movimenti = db.prepare(`
          SELECT m.*, c.data
          FROM movimenti m
          JOIN consegne c ON m.consegna_id = c.id
          WHERE m.partecipante_id = ? AND c.data <= ?
          ORDER BY c.data
        `).all(p.id, date);

        let saldo = 0;
        let ultima_modifica = null;

        movimenti.forEach(m => {
          saldo += m.credito_lasciato - m.debito_lasciato - m.usa_credito + m.debito_saldato;
          ultima_modifica = m.data;
        });

        return {
          id: p.id,
          username: p.username,
          nome: p.nome,
          saldo: saldo,
          ultima_modifica: ultima_modifica
        };
      });

      console.log(`[PARTICIPANTS] ${timestamp} - Successfully calculated saldi for ${date}`);
      res.json({ success: true, participants: participantsWithSaldi });
    } else {
      // Return current saldi
      const participants = db.prepare('SELECT id, username, display_name AS nome, saldo, ultima_modifica FROM users ORDER BY display_name').all();
      console.log(`[PARTICIPANTS] ${timestamp} - Retrieved ${participants.length} participants with current saldi`);
      res.json({ success: true, participants });
    }
  } catch (error) {
    console.error(`[PARTICIPANTS] ${timestamp} - Error fetching participants:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update participant saldo (admin only)
router.put('/:id', (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;
  const { saldo } = req.body;

  console.log(`[PARTICIPANTS] ${timestamp} - PUT request to update participant ID: ${id}, new saldo: ${saldo}€`);

  // Admin check
  if (!req.session.isAdmin) {
    console.log(`[PARTICIPANTS] ${timestamp} - Rejected: User ${req.session.username} is not admin`);
    return res.status(403).json({
      success: false,
      error: 'Solo gli amministratori possono modificare i saldi'
    });
  }

  try {
    const current = db.prepare('SELECT saldo, username, display_name FROM users WHERE id = ?').get(id);

    if (current && current.saldo !== saldo) {
      const audit = getAuditFields(req, 'update');
      db.prepare('UPDATE users SET saldo = ?, ultima_modifica = DATE(), updated_by = ?, updated_at = ? WHERE id = ?')
        .run(saldo, audit.updated_by, audit.updated_at, id);

      // Log saldo modification
      db.prepare(`
        INSERT INTO activity_logs (event_type, target_user_id, actor_user_id, details, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('saldo_updated', parseInt(id), req.session.userId, `saldo: ${current.saldo} → ${saldo}`, timestamp);

      console.log(`[PARTICIPANTS] ${timestamp} - Successfully updated participant ID ${id} saldo from ${current.saldo}€ to ${saldo}€`);
    } else {
      console.log(`[PARTICIPANTS] ${timestamp} - No change needed for participant ID ${id}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error(`[PARTICIPANTS] ${timestamp} - Error updating participant ID ${id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add new participant (creates a user account)
router.post('/', (req, res) => {
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

  if (password.length < 4) {
    return res.status(400).json({
      success: false,
      error: 'La password deve essere di almeno 4 caratteri'
    });
  }

  try {
    const bcrypt = require('bcrypt');
    const passwordHash = bcrypt.hashSync(password, 12);
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete participant (deletes user account)
router.delete('/:id', (req, res) => {
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
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
