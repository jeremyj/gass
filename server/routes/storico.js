const express = require('express');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const {
  calculateTrovatoInCassa,
  calculateLasciatoInCassa,
  processConsegneWithDynamicValues
} = require('../services/calculations');

const router = express.Router();

// Require authentication for all storico routes
router.use(requireAuth);

// Get all consegne (storico)
router.get('/', (req, res) => {
  try {
    const consegne = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM movimenti WHERE consegna_id = c.id) as num_movimenti
      FROM consegne c
      ORDER BY c.data DESC
    `).all();

    const processed = processConsegneWithDynamicValues(consegne);
    res.json({ success: true, consegne: processed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get detailed storico with movimenti
router.get('/dettaglio', (req, res) => {
  try {
    const consegne = db.prepare('SELECT * FROM consegne ORDER BY data DESC').all();
    const consegneAsc = [...consegne].reverse();

    const storico = consegneAsc.map((consegna, index) => {
      const movimenti = db.prepare(`
        SELECT m.*, p.nome
        FROM movimenti m
        JOIN partecipanti p ON m.partecipante_id = p.id
        WHERE m.consegna_id = ?
      `).all(consegna.id);

      const previousLasciato = index > 0
        ? (consegneAsc[index - 1].lasciato_in_cassa_calculated ?? consegneAsc[index - 1].lasciato_in_cassa)
        : undefined;

      const trovato = calculateTrovatoInCassa(consegna, previousLasciato);
      const lasciato = calculateLasciatoInCassa(consegna, trovato);

      return {
        ...consegna,
        trovato_in_cassa: trovato,
        lasciato_in_cassa: lasciato,
        lasciato_in_cassa_calculated: lasciato,
        movimenti
      };
    });

    res.json({ success: true, storico: storico.reverse() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
