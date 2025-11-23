const express = require('express');
const db = require('../config/database');

const router = express.Router();

// Get all participants with their balances
router.get('/', (req, res) => {
  try {
    const { date } = req.query;

    // If date is provided, calculate saldi as of that date
    if (date) {
      const participants = db.prepare('SELECT id, nome FROM partecipanti ORDER BY nome').all();

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

      res.json({ success: true, participants: participantsWithSaldi });
    } else {
      // Return current saldi
      const participants = db.prepare('SELECT * FROM partecipanti ORDER BY nome').all();
      res.json({ success: true, participants });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update participant saldo
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { saldo } = req.body;

    const current = db.prepare('SELECT saldo FROM partecipanti WHERE id = ?').get(id);

    if (current && current.saldo !== saldo) {
      db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = DATE() WHERE id = ?')
        .run(saldo, id);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add new participant
router.post('/', (req, res) => {
  try {
    const { nome } = req.body;
    const result = db.prepare('INSERT INTO partecipanti (nome, saldo) VALUES (?, 0)').run(nome);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete participant
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM partecipanti WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
