const express = require('express');
const db = require('../config/database');
const { requireAuth, requireAdmin, getAuditFields } = require('../middleware/auth');
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
      SELECT m.*, p.display_name AS nome, p.id as partecipante_id
      FROM movimenti m
      JOIN users p ON m.partecipante_id = p.id
      WHERE m.consegna_id = ?
    `).all(consegna.id);

    console.log(`[CONSEGNA] ${timestamp} - Retrieved ${movimenti.length} movimenti for consegna ${consegna.id}`);

    // Calculate saldo before this consegna for each participant.
    // Use stored saldo minus movements on/after this date — same logic as POST handler —
    // so that initial balances stored in users.saldo are correctly included.
    const saldoRows = db.prepare(`
      SELECT u.id AS partecipante_id,
        COALESCE(u.saldo - COALESCE(on_or_after.effect, 0), 0) AS saldo
      FROM users u
      LEFT JOIN (
        SELECT m2.partecipante_id,
          SUM(m2.credito_lasciato) - SUM(m2.usa_credito) + SUM(m2.debito_saldato) - SUM(m2.debito_lasciato) AS effect
        FROM movimenti m2
        JOIN consegne c2 ON m2.consegna_id = c2.id
        WHERE c2.data >= ?
        GROUP BY m2.partecipante_id
      ) on_or_after ON on_or_after.partecipante_id = u.id
    `).all(date);

    const saldiBefore = {};
    saldoRows.forEach(row => {
      saldiBefore[row.partecipante_id] = row.saldo || 0;
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
    res.status(500).json({ success: false, error: 'Errore interno del server' });
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
        UPDATE users SET saldo = ?, ultima_modifica = ?, updated_by = ?, updated_at = ? WHERE id = ?
      `);

      let movimentiCreated = 0;
      let movimentiUpdated = 0;

      const logMovimentoChange = db.prepare(`
        INSERT INTO activity_logs (event_type, target_user_id, actor_user_id, details, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      partecipanti.forEach(p => {
        // Look up by ID (sent from client as partecipante_id)
        const partecipante = db.prepare('SELECT * FROM users WHERE id = ?').get(p.partecipante_id);
        if (!partecipante) return;

        const existingMovimento = db.prepare(`
          SELECT * FROM movimenti WHERE consegna_id = ? AND partecipante_id = ?
        `).get(consegna.id, partecipante.id);

        // Compute saldoBefore BEFORE the upsert so the query sees the existing state.
        // Use stored saldo minus movements on/after this date: this preserves admin
        // manual saldo adjustments while correctly handling re-saves of existing consegne.
        const onOrAfterEffect = db.prepare(`
          SELECT COALESCE(SUM(m2.credito_lasciato) - SUM(m2.usa_credito) + SUM(m2.debito_saldato) - SUM(m2.debito_lasciato), 0) AS saldo
          FROM movimenti m2
          JOIN consegne c2 ON m2.consegna_id = c2.id
          WHERE m2.partecipante_id = ? AND c2.data >= ?
        `).get(partecipante.id, data)?.saldo || 0;
        const saldoBefore = (partecipante.saldo || 0) - onOrAfterEffect;

        const movimentoData = [
          p.saldaTutto ? 1 : 0, p.importoSaldato || 0, p.usaCredito || 0,
          p.debitoLasciato || 0, p.creditoLasciato || 0,
          p.saldaDebitoTotale ? 1 : 0, p.debitoSaldato || 0, p.contoProduttore || 0, p.note || ''
        ];

        if (existingMovimento) {
          // Track only manually entered fields (not auto-calculated ones)
          const changes = [];
          if (existingMovimento.conto_produttore !== (p.contoProduttore || 0)) {
            changes.push(`conto: ${existingMovimento.conto_produttore} → ${p.contoProduttore || 0}`);
          }
          if (existingMovimento.importo_saldato !== (p.importoSaldato || 0)) {
            changes.push(`saldato: ${existingMovimento.importo_saldato} → ${p.importoSaldato || 0}`);
          }

          const updateAudit = getAuditFields(req, 'update');
          updateMovimento.run(...movimentoData, updateAudit.updated_by, updateAudit.updated_at,
                              consegna.id, partecipante.id);

          // Log movimento change if something actually changed
          if (changes.length > 0) {
            logMovimentoChange.run(
              'movimento_changed',
              partecipante.id,
              req.session.userId,
              `consegna: ${data}, ${changes.join(', ')}`,
              timestamp
            );
          }
          movimentiUpdated++;
        } else {
          const createAudit = getAuditFields(req, 'create');
          insertMovimento.run(consegna.id, partecipante.id, ...movimentoData,
                             createAudit.created_by, createAudit.created_at,
                             createAudit.updated_by, createAudit.updated_at);
          movimentiCreated++;
        }

        const movimentoForCalc = {
          salda_tutto: p.saldaTutto ? 1 : 0,
          usa_credito: p.usaCredito || 0,
          salda_debito_totale: p.saldaDebitoTotale ? 1 : 0,
          debito_saldato: p.debitoSaldato || 0,
          debito_lasciato: p.debitoLasciato || 0,
          credito_lasciato: p.creditoLasciato || 0
        };

        const nuovoSaldo = applySaldoChanges(saldoBefore, movimentoForCalc);
        const saldoAudit = getAuditFields(req, 'update');
        updateSaldo.run(nuovoSaldo, data, saldoAudit.updated_by, saldoAudit.updated_at, partecipante.id);
      });

      console.log(`[CONSEGNA] ${timestamp} - Movimenti: ${movimentiCreated} created, ${movimentiUpdated} updated`);

      // Recalculate pagato_produttore from movements
      const movimenti = db.prepare('SELECT * FROM movimenti WHERE consegna_id = ?').all(consegna.id);
      let totalPagato = 0;
      movimenti.forEach(m => {
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

      console.log(`[CONSEGNA] ${timestamp} - Calculated lasciato_in_cassa: ${lasciato}€`);
    });

    transaction();
    console.log(`[CONSEGNA] ${timestamp} - Successfully saved consegna for ${data}`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[CONSEGNA] ${timestamp} - Error saving consegna for ${data}:`, error);
    res.status(500).json({ success: false, error: 'Errore durante il salvataggio' });
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
      // Log deletion before removing data
      const movimenti = db.prepare(`
        SELECT m.*, p.display_name
        FROM movimenti m
        JOIN users p ON m.partecipante_id = p.id
        WHERE m.consegna_id = ?
      `).all(id);

      const partecipanti = movimenti.map(m => m.display_name).join(', ');
      const details = `consegna: ${consegna.data}, partecipanti: ${partecipanti || 'nessuno'}, movimenti: ${movimenti.length}`;

      db.prepare(`
        INSERT INTO activity_logs (event_type, actor_user_id, details, created_at)
        VALUES ('consegna_deleted', ?, ?, ?)
      `).run(req.session.userId, details, timestamp);

      db.prepare('DELETE FROM consegne WHERE id = ?').run(id);

      const resetAudit = getAuditFields(req, 'update');
      db.prepare('UPDATE users SET saldo = 0, ultima_modifica = NULL, updated_by = ?, updated_at = ? WHERE 1=1')
        .run(resetAudit.updated_by, resetAudit.updated_at);

      console.log(`[CONSEGNA] ${timestamp} - Reset all participant saldi to 0`);

      const consegne = db.prepare('SELECT * FROM consegne ORDER BY data ASC').all();
      console.log(`[CONSEGNA] ${timestamp} - Recalculating saldi for ${consegne.length} remaining consegne`);

      consegne.forEach(c => {
        const movimenti = db.prepare(`
          SELECT m.*, p.saldo as current_saldo
          FROM movimenti m
          JOIN users p ON m.partecipante_id = p.id
          WHERE m.consegna_id = ?
        `).all(c.id);

        movimenti.forEach(m => {
          const nuovoSaldo = applySaldoChanges(m.current_saldo || 0, m);
          const saldoAudit = getAuditFields(req, 'update');
          db.prepare('UPDATE users SET saldo = ?, ultima_modifica = ?, updated_by = ?, updated_at = ? WHERE id = ?')
            .run(nuovoSaldo, c.data, saldoAudit.updated_by, saldoAudit.updated_at, m.partecipante_id);
        });
      });
    });

    transaction();
    console.log(`[CONSEGNA] ${timestamp} - Successfully deleted consegna ID: ${id} and recalculated saldi`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[CONSEGNA] ${timestamp} - Error deleting consegna ID ${id}:`, error);
    res.status(500).json({ success: false, error: 'Errore durante l\'eliminazione' });
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
    res.status(500).json({ success: false, error: 'Errore durante la chiusura' });
  }
});

// Reopen consegna (admin only)
router.post('/:id/reopen', requireAdmin, (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;

  console.log(`[CONSEGNA] ${timestamp} - Reopen request for consegna ID: ${id} by user ${req.session.username}`);

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
    res.status(500).json({ success: false, error: 'Errore durante la riapertura' });
  }
});

module.exports = router;
