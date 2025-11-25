const express = require('express');
const db = require('../config/database');
const { requireAuth, getAuditFields } = require('../middleware/auth');
const {
  calculateTrovatoInCassa,
  calculateLasciatoInCassa,
  applyDynamicCalculations,
  applySaldoChanges
} = require('../services/calculations');

const router = express.Router();

// Require authentication for all consegna routes
router.use(requireAuth);

// Get consegna data for a specific date
router.get('/:date', (req, res) => {
  const timestamp = new Date().toISOString();
  const { date } = req.params;

  console.log(`[CONSEGNA] ${timestamp} - GET request for date: ${date}`);

  try {
    const consegna = db.prepare('SELECT * FROM consegne WHERE data = ?').get(date);

    const previousConsegna = db.prepare(`
      SELECT lasciato_in_cassa FROM consegne
      WHERE data < ?
      ORDER BY data DESC
      LIMIT 1
    `).get(date);

    if (!consegna) {
      console.log(`[CONSEGNA] ${timestamp} - No consegna found for ${date}`);
      return res.json({
        success: true,
        found: false,
        lasciatoPrecedente: previousConsegna?.lasciato_in_cassa ?? null
      });
    }

    console.log(`[CONSEGNA] ${timestamp} - Found consegna for ${date} (ID: ${consegna.id})`);

    const movimenti = db.prepare(`
      SELECT m.*, p.nome, p.id as partecipante_id
      FROM movimenti m
      JOIN partecipanti p ON m.partecipante_id = p.id
      WHERE m.consegna_id = ?
    `).all(consegna.id);

    console.log(`[CONSEGNA] ${timestamp} - Retrieved ${movimenti.length} movimenti for consegna ${consegna.id}`);

    // Calculate saldo before this consegna for each participant
    const saldiBefore = {};

    // Calculate saldoBefore for each participant by summing all movements before this date
    movimenti.forEach(m => {
      // Get all movements for this participant before the current consegna date
      const previousMovimenti = db.prepare(`
        SELECT m2.*
        FROM movimenti m2
        JOIN consegne c2 ON m2.consegna_id = c2.id
        WHERE m2.partecipante_id = ? AND c2.data < ?
        ORDER BY c2.data ASC
      `).all(m.partecipante_id, date);

      // Calculate saldo by applying each previous movement's effects
      let saldoBefore = 0;
      previousMovimenti.forEach(prevM => {
        // Add credito, subtract debito
        if (prevM.credito_lasciato > 0) saldoBefore += prevM.credito_lasciato;
        if (prevM.debito_lasciato > 0) saldoBefore -= prevM.debito_lasciato;
        // Subtract used credit, add paid debt
        if (prevM.usa_credito > 0) saldoBefore -= prevM.usa_credito;
        if (prevM.debito_saldato > 0) saldoBefore += prevM.debito_saldato;
      });

      saldiBefore[m.nome] = saldoBefore;
    });

    // Apply dynamic calculations
    const processedConsegna = applyDynamicCalculations(consegna, previousConsegna?.lasciato_in_cassa);

    console.log(`[CONSEGNA] ${timestamp} - Successfully processed consegna for ${date}`);

    res.json({
      success: true,
      found: true,
      consegna: {
        ...processedConsegna,
        chiusa: consegna.chiusa === 1,
        chiusa_by: consegna.chiusa_by,
        chiusa_at: consegna.chiusa_at
      },
      movimenti,
      saldiBefore,
      lasciatoPrecedente: previousConsegna?.lasciato_in_cassa ?? null
    });
  } catch (error) {
    console.error(`[CONSEGNA] ${timestamp} - Error fetching consegna for ${date}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save consegna data
router.post('/', (req, res) => {
  const timestamp = new Date().toISOString();
  const { data, trovatoInCassa, pagatoProduttore, lasciatoInCassa,
          noteGiornata, partecipanti } = req.body;

  console.log(`[CONSEGNA] ${timestamp} - POST request for date: ${data}`);
  console.log(`[CONSEGNA] ${timestamp} - Saving ${partecipanti?.length || 0} participant movements`);

  try {
    // Check if consegna is closed (non-admins cannot edit)
    const existingConsegna = db.prepare('SELECT chiusa FROM consegne WHERE data = ?').get(data);
    if (existingConsegna && existingConsegna.chiusa === 1 && !req.session.isAdmin) {
      console.log(`[CONSEGNA] ${timestamp} - Rejected: Consegna ${data} is closed and user is not admin`);
      return res.status(403).json({
        success: false,
        error: 'Consegna chiusa',
        message: 'Questa consegna è stata chiusa e non può essere modificata'
      });
    }
    const transaction = db.transaction(() => {
      let consegna = db.prepare('SELECT * FROM consegne WHERE data = ?').get(data);

      const consegnaData = [
        trovatoInCassa, pagatoProduttore, lasciatoInCassa, noteGiornata || ''
      ];

      if (consegna) {
        console.log(`[CONSEGNA] ${timestamp} - Updating existing consegna ID: ${consegna.id}`);
        const updateAudit = getAuditFields(req, 'update');
        db.prepare(`
          UPDATE consegne
          SET trovato_in_cassa = ?, pagato_produttore = ?, lasciato_in_cassa = ?, note = ?,
              updated_by = ?, updated_at = ?
          WHERE id = ?
        `).run(...consegnaData, updateAudit.updated_by, updateAudit.updated_at, consegna.id);
      } else {
        const createAudit = getAuditFields(req, 'create');
        const result = db.prepare(`
          INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa, note,
                                created_by, created_at, updated_by, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(data, ...consegnaData, createAudit.created_by, createAudit.created_at,
               createAudit.updated_by, createAudit.updated_at);
        consegna = { id: result.lastInsertRowid };
        console.log(`[CONSEGNA] ${timestamp} - Created new consegna ID: ${consegna.id}`);
      }

      // Upsert movimenti and update saldi
      const insertMovimento = db.prepare(`
        INSERT INTO movimenti (
          consegna_id, partecipante_id, salda_tutto, importo_saldato,
          usa_credito, debito_lasciato, credito_lasciato,
          salda_debito_totale, debito_saldato, conto_produttore, note,
          created_by, created_at, updated_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateMovimento = db.prepare(`
        UPDATE movimenti
        SET salda_tutto = ?, importo_saldato = ?, usa_credito = ?,
            debito_lasciato = ?, credito_lasciato = ?,
            salda_debito_totale = ?, debito_saldato = ?, conto_produttore = ?, note = ?,
            updated_by = ?, updated_at = ?
        WHERE consegna_id = ? AND partecipante_id = ?
      `);

      const updateSaldo = db.prepare(`
        UPDATE partecipanti SET saldo = ?, ultima_modifica = ?, updated_by = ?, updated_at = ? WHERE id = ?
      `);

      let movimentiCreated = 0;
      let movimentiUpdated = 0;

      partecipanti.forEach(p => {
        const partecipante = db.prepare('SELECT * FROM partecipanti WHERE nome = ?').get(p.nome);
        if (!partecipante) return;

        const existingMovimento = db.prepare(`
          SELECT * FROM movimenti WHERE consegna_id = ? AND partecipante_id = ?
        `).get(consegna.id, partecipante.id);

        const movimentoData = [
          p.saldaTutto ? 1 : 0, p.importoSaldato || 0, p.usaCredito || 0,
          p.debitoLasciato || 0, p.creditoLasciato || 0,
          p.saldaDebitoTotale ? 1 : 0, p.debitoSaldato || 0, p.contoProduttore || 0, p.note || ''
        ];

        if (existingMovimento) {
          const updateAudit = getAuditFields(req, 'update');
          updateMovimento.run(...movimentoData, updateAudit.updated_by, updateAudit.updated_at,
                              consegna.id, partecipante.id);
          movimentiUpdated++;
        } else {
          const createAudit = getAuditFields(req, 'create');
          insertMovimento.run(consegna.id, partecipante.id, ...movimentoData,
                             createAudit.created_by, createAudit.created_at,
                             createAudit.updated_by, createAudit.updated_at);
          movimentiCreated++;
        }

        const saldoAudit = getAuditFields(req, 'update');
        updateSaldo.run(p.nuovoSaldo, data, saldoAudit.updated_by, saldoAudit.updated_at, partecipante.id);
      });

      console.log(`[CONSEGNA] ${timestamp} - Movimenti: ${movimentiCreated} created, ${movimentiUpdated} updated`);

      // Recalculate pagato_produttore from movements
      const movimenti = db.prepare('SELECT * FROM movimenti WHERE consegna_id = ?').all(consegna.id);
      let totalPagato = 0;
      movimenti.forEach(m => {
        // Pagato produttore = sum of all conto_produttore values
        totalPagato += (m.conto_produttore || 0);
      });
      const pagatoAudit = getAuditFields(req, 'update');
      db.prepare('UPDATE consegne SET pagato_produttore = ?, updated_by = ?, updated_at = ? WHERE id = ?')
        .run(totalPagato, pagatoAudit.updated_by, pagatoAudit.updated_at, consegna.id);

      console.log(`[CONSEGNA] ${timestamp} - Calculated pagato_produttore: ${totalPagato}€`);

      // Recalculate lasciato_in_cassa from movements
      const currentConsegna = db.prepare('SELECT * FROM consegne WHERE id = ?').get(consegna.id);
      let incassato = 0;
      movimenti.forEach(m => {
        incassato += (m.importo_saldato || 0);
      });
      const lasciato = currentConsegna.trovato_in_cassa + incassato - currentConsegna.pagato_produttore;
      const lasciatoAudit = getAuditFields(req, 'update');
      db.prepare('UPDATE consegne SET lasciato_in_cassa = ?, updated_by = ?, updated_at = ? WHERE id = ?')
        .run(lasciato, lasciatoAudit.updated_by, lasciatoAudit.updated_at, consegna.id);

      console.log(`[CONSEGNA] ${timestamp} - Calculated lasciato_in_cassa: ${lasciato}€ (trovato: ${currentConsegna.trovato_in_cassa}€ + incassato: ${incassato}€ - pagato: ${currentConsegna.pagato_produttore}€)`);
    });

    transaction();
    console.log(`[CONSEGNA] ${timestamp} - Successfully saved consegna for ${data}`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[CONSEGNA] ${timestamp} - Error saving consegna for ${data}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete consegna and recalculate all saldi
router.delete('/:id', (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;

  console.log(`[CONSEGNA] ${timestamp} - DELETE request for consegna ID: ${id}`);

  try {
    const consegna = db.prepare('SELECT * FROM consegne WHERE id = ?').get(id);
    if (consegna) {
      console.log(`[CONSEGNA] ${timestamp} - Deleting consegna for date: ${consegna.data}`);
    }

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM consegne WHERE id = ?').run(id);

      const resetAudit = getAuditFields(req, 'update');
      db.prepare('UPDATE partecipanti SET saldo = 0, updated_by = ?, updated_at = ? WHERE 1=1')
        .run(resetAudit.updated_by, resetAudit.updated_at);

      console.log(`[CONSEGNA] ${timestamp} - Reset all participant saldi to 0`);

      const consegne = db.prepare('SELECT * FROM consegne ORDER BY data ASC').all();
      console.log(`[CONSEGNA] ${timestamp} - Recalculating saldi for ${consegne.length} remaining consegne`);

      consegne.forEach(consegna => {
        const movimenti = db.prepare(`
          SELECT m.*, p.saldo as current_saldo
          FROM movimenti m
          JOIN partecipanti p ON m.partecipante_id = p.id
          WHERE m.consegna_id = ?
        `).all(consegna.id);

        movimenti.forEach(m => {
          const nuovoSaldo = applySaldoChanges(m.current_saldo || 0, m);
          const saldoAudit = getAuditFields(req, 'update');
          db.prepare('UPDATE partecipanti SET saldo = ?, updated_by = ?, updated_at = ? WHERE id = ?')
            .run(nuovoSaldo, saldoAudit.updated_by, saldoAudit.updated_at, m.partecipante_id);
        });
      });
    });

    transaction();
    console.log(`[CONSEGNA] ${timestamp} - Successfully deleted consegna ID: ${id} and recalculated saldi`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[CONSEGNA] ${timestamp} - Error deleting consegna ID ${id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Close consegna (any authenticated user)
router.post('/:id/close', (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;

  console.log(`[CONSEGNA] ${timestamp} - Close request for consegna ID: ${id} by user ${req.session.username}`);

  try {
    const consegna = db.prepare('SELECT * FROM consegne WHERE id = ?').get(id);
    if (!consegna) {
      return res.status(404).json({
        success: false,
        error: 'Consegna non trovata'
      });
    }

    if (consegna.chiusa === 1) {
      return res.status(400).json({
        success: false,
        error: 'Consegna già chiusa'
      });
    }

    db.prepare(`
      UPDATE consegne
      SET chiusa = 1, chiusa_by = ?, chiusa_at = ?
      WHERE id = ?
    `).run(req.session.userId, timestamp, id);

    console.log(`[CONSEGNA] ${timestamp} - Consegna ${id} closed by user ${req.session.username}`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[CONSEGNA] ${timestamp} - Error closing consegna ${id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reopen consegna (admin only)
router.post('/:id/reopen', (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;

  console.log(`[CONSEGNA] ${timestamp} - Reopen request for consegna ID: ${id} by user ${req.session.username}`);

  // Admin check
  if (!req.session.isAdmin) {
    console.log(`[CONSEGNA] ${timestamp} - Rejected: User ${req.session.username} is not admin`);
    return res.status(403).json({
      success: false,
      error: 'Solo gli amministratori possono riaprire una consegna'
    });
  }

  try {
    const consegna = db.prepare('SELECT * FROM consegne WHERE id = ?').get(id);
    if (!consegna) {
      return res.status(404).json({
        success: false,
        error: 'Consegna non trovata'
      });
    }

    if (consegna.chiusa !== 1) {
      return res.status(400).json({
        success: false,
        error: 'Consegna non è chiusa'
      });
    }

    db.prepare(`
      UPDATE consegne
      SET chiusa = 0, chiusa_by = NULL, chiusa_at = NULL,
          riaperta_by = ?, riaperta_at = ?
      WHERE id = ?
    `).run(req.session.userId, timestamp, id);

    console.log(`[CONSEGNA] ${timestamp} - Consegna ${id} reopened by admin ${req.session.username}`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[CONSEGNA] ${timestamp} - Error reopening consegna ${id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
