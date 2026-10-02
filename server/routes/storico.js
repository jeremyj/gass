const express = require('express');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { processConsegneWithDynamicValues, roundToCents } = require('../services/calculations');

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
        (SELECT COUNT(*) FROM movimenti WHERE consegna_id = c.id) AS num_movimenti,
        (SELECT COALESCE(SUM(importo_saldato), 0) FROM movimenti WHERE consegna_id = c.id) AS incassato,
        (SELECT COALESCE(SUM(importo), 0) FROM teatro_pagamenti WHERE consegna_id = c.id) AS teatro
      FROM consegne c
      ORDER BY c.data DESC
    `).all();

    console.log(`[STORICO] ${timestamp} - Retrieved ${consegne.length} consegne`);

    const processed = processConsegneWithDynamicValues(consegne)
      .map(c => ({ ...c, incassato: roundToCents(c.incassato), teatro: roundToCents(c.teatro) }));
    res.json({ success: true, consegne: processed });
  } catch (error) {
    console.error(`[STORICO] ${timestamp} - Error fetching storico:`, error);
    res.status(500).json({ success: false, error: 'Errore durante il recupero dello storico' });
  }
});

module.exports = router;
