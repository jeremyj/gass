const express = require('express');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { processConsegneWithDynamicValues } = require('../services/calculations');

const router = express.Router();

// Require authentication for all storico routes
router.use(requireAuth);

// Get all consegne (storico)
router.get('/', (req, res) => {
  const timestamp = new Date().toISOString();

  console.log(`[STORICO] ${timestamp} - GET request for all consegne`);

  try {
    const consegne = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM movimenti WHERE consegna_id = c.id) as num_movimenti
      FROM consegne c
      ORDER BY c.data DESC
    `).all();

    console.log(`[STORICO] ${timestamp} - Retrieved ${consegne.length} consegne`);

    const processed = processConsegneWithDynamicValues(consegne);
    res.json({ success: true, consegne: processed });
  } catch (error) {
    console.error(`[STORICO] ${timestamp} - Error fetching storico:`, error);
    res.status(500).json({ success: false, error: 'Errore durante il recupero dello storico' });
  }
});

// Get detailed storico with movimenti
router.get('/dettaglio', (req, res) => {
  const timestamp = new Date().toISOString();

  console.log(`[STORICO] ${timestamp} - GET request for detailed storico`);

  try {
    const consegne = db.prepare('SELECT * FROM consegne ORDER BY data DESC').all();

    console.log(`[STORICO] ${timestamp} - Processing ${consegne.length} consegne with movimenti`);

    // Fetch all movimenti in a single query instead of N+1
    const allMovimenti = db.prepare(`
      SELECT m.*, p.display_name AS nome
      FROM movimenti m
      JOIN users p ON m.partecipante_id = p.id
    `).all();

    // Group movimenti by consegna_id
    const movimentiByConsegna = {};
    allMovimenti.forEach(m => {
      if (!movimentiByConsegna[m.consegna_id]) {
        movimentiByConsegna[m.consegna_id] = [];
      }
      movimentiByConsegna[m.consegna_id].push(m);
    });

    // Quote teatro paid in each consegna, per person: on their movimento, or in teatro_extra when they bought nothing
    const teatro = db.prepare(`
      SELECT t.consegna_id, t.user_id, u.display_name AS nome, ROUND(SUM(t.importo), 2) AS importo
      FROM teatro_pagamenti t
      JOIN users u ON u.id = t.user_id
      WHERE t.consegna_id IS NOT NULL
      GROUP BY t.consegna_id, t.user_id
    `).all();

    const storico = processConsegneWithDynamicValues(consegne).map(consegna => {
      const movimenti = movimentiByConsegna[consegna.id] || [];
      const quote = teatro.filter(t => t.consegna_id === consegna.id);
      movimenti.forEach(m => { m.teatro = quote.find(t => t.user_id === m.partecipante_id)?.importo || 0; });
      const teatroExtra = quote.filter(t => !movimenti.some(m => m.partecipante_id === t.user_id))
        .map(({ nome, importo }) => ({ nome, importo }));
      return { ...consegna, movimenti, teatro_extra: teatroExtra };
    });

    console.log(`[STORICO] ${timestamp} - Successfully processed detailed storico (${allMovimenti.length} total movimenti)`);

    res.json({ success: true, storico });
  } catch (error) {
    console.error(`[STORICO] ${timestamp} - Error fetching detailed storico:`, error);
    res.status(500).json({ success: false, error: 'Errore durante il recupero del dettaglio storico' });
  }
});

module.exports = router;
