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
      const participants = db.prepare('SELECT id, nome FROM partecipanti ORDER BY nome').all();

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
          nome: p.nome,
          saldo: saldo,
          ultima_modifica: ultima_modifica
        };
      });

      console.log(`[PARTICIPANTS] ${timestamp} - Successfully calculated saldi for ${date}`);
      res.json({ success: true, participants: participantsWithSaldi });
    } else {
      // Return current saldi
      const participants = db.prepare('SELECT * FROM partecipanti ORDER BY nome').all();
      console.log(`[PARTICIPANTS] ${timestamp} - Retrieved ${participants.length} participants with current saldi`);
      res.json({ success: true, participants });
    }
  } catch (error) {
    console.error(`[PARTICIPANTS] ${timestamp} - Error fetching participants:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update participant saldo
router.put('/:id', (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;
  const { saldo } = req.body;

  console.log(`[PARTICIPANTS] ${timestamp} - PUT request to update participant ID: ${id}, new saldo: ${saldo}€`);

  try {
    const current = db.prepare('SELECT saldo FROM partecipanti WHERE id = ?').get(id);

    if (current && current.saldo !== saldo) {
      const audit = getAuditFields(req, 'update');
      db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = DATE(), updated_by = ?, updated_at = ? WHERE id = ?')
        .run(saldo, audit.updated_by, audit.updated_at, id);
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

// Add new participant
router.post('/', (req, res) => {
  const timestamp = new Date().toISOString();
  const { nome } = req.body;

  console.log(`[PARTICIPANTS] ${timestamp} - POST request to create new participant: ${nome}`);

  try {
    const audit = getAuditFields(req, 'create');
    const result = db.prepare('INSERT INTO partecipanti (nome, saldo, created_by, created_at, updated_by, updated_at) VALUES (?, 0, ?, ?, ?, ?)')
      .run(nome, audit.created_by, audit.created_at, audit.updated_by, audit.updated_at);
    console.log(`[PARTICIPANTS] ${timestamp} - Successfully created participant: ${nome} (ID: ${result.lastInsertRowid})`);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error(`[PARTICIPANTS] ${timestamp} - Error creating participant ${nome}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete participant
router.delete('/:id', (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;

  console.log(`[PARTICIPANTS] ${timestamp} - DELETE request for participant ID: ${id}`);

  try {
    const participant = db.prepare('SELECT nome FROM partecipanti WHERE id = ?').get(id);
    db.prepare('DELETE FROM partecipanti WHERE id = ?').run(id);
    console.log(`[PARTICIPANTS] ${timestamp} - Successfully deleted participant: ${participant?.nome || id} (ID: ${id})`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[PARTICIPANTS] ${timestamp} - Error deleting participant ID ${id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
