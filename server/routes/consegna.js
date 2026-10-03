const express = require('express');
const db = require('../config/database');
const { requireAuth, requireAdmin, getAuditFields } = require('../middleware/auth');
const { calculateTrovatoInCassa, roundToCents, toLocalDateString } = require('../services/calculations');
const { saldoBeforeConsegna, recalculateSaldo } = require('../services/saldi');
const { validateConsegnaPayload } = require('../services/validation');
const { logActivity } = require('../services/activity');
const { quotePerPersona } = require('../services/teatro');
const { apertura } = require('../services/apertura');
const { notifyClosed, canaliAttivi } = require('../services/report');

const router = express.Router();

// Require authentication for all consegna routes
router.use(requireAuth);

// Date the Consegna page opens on, and the open consegne to warn about (declared before /:date)
router.get('/apertura', (req, res) => {
  res.json({ success: true, ...apertura(db, toLocalDateString()) });
});

// Report channels configured on this server, offered in the close confirmation (declared before /:date)
router.get('/report-canali', (req, res) => {
  res.json({ success: true, canali: canaliAttivi() });
});

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

    // Saldo each participant's consegna form starts from, replayed from the ledger
    const saldiBefore = {};
    db.prepare('SELECT id FROM users').all().forEach(u => {
      saldiBefore[u.id] = saldoBeforeConsegna(u.id, date);
    });

    if (!consegna) {
      console.log(`[CONSEGNA] ${timestamp} - No consegna found for ${date}`);
      return res.json({
        success: true,
        found: false,
        lasciatoPrecedente: previousConsegna?.lasciato_in_cassa ?? null,
        saldiBefore
      });
    }

    console.log(`[CONSEGNA] ${timestamp} - Found consegna for ${date} (ID: ${consegna.id})`);

    const movimenti = db.prepare(`
      SELECT m.*, p.display_name AS nome, p.id as partecipante_id
      FROM movimenti m
      JOIN users p ON m.partecipante_id = p.id
      WHERE m.consegna_id = ?
    `).all(consegna.id);

    // Quota teatro paid in this consegna: on the payer's movimento, or as a row of its own
    const quote = quotePerPersona(db, consegna.id);
    movimenti.forEach(m => { m.teatro = quote.find(q => q.user_id === m.partecipante_id)?.importo || 0; });
    const teatroExtra = quote.filter(q => !movimenti.some(m => m.partecipante_id === q.user_id));

    console.log(`[CONSEGNA] ${timestamp} - Retrieved ${movimenti.length} movimenti for consegna ${consegna.id}`);

    console.log(`[CONSEGNA] ${timestamp} - Successfully processed consegna for ${date}`);

    res.json({
      success: true,
      found: true,
      consegna: {
        ...consegna,
        trovato_in_cassa: calculateTrovatoInCassa(consegna, previousConsegna?.lasciato_in_cassa),
        chiusa: consegna.chiusa === 1
      },
      movimenti,
      teatroExtra,
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
          noteGiornata, usciteCassa, usciteMotivo, partecipanti } = req.body;

  console.log(`[CONSEGNA] ${timestamp} - POST request for date: ${data}`);
  console.log(`[CONSEGNA] ${timestamp} - Saving ${partecipanti?.length || 0} participant movements`);

  const validationError = validateConsegnaPayload(req.body, id => saldoBeforeConsegna(id, data));
  if (validationError) {
    console.log(`[CONSEGNA] ${timestamp} - Rejected invalid payload: ${validationError}`);
    return res.status(400).json({ success: false, error: validationError });
  }

  try {
    const existingConsegna = db.prepare('SELECT * FROM consegne WHERE data = ?').get(data);

    // Non-admins cannot edit a closed consegna
    if (existingConsegna?.chiusa === 1 && !req.session.isAdmin) {
      console.log(`[CONSEGNA] ${timestamp} - Rejected: Consegna ${data} is closed and user is not admin`);
      return res.status(403).json({
        success: false,
        error: 'Consegna chiusa',
        message: 'Questa consegna è stata chiusa e non può essere modificata'
      });
    }
    const transaction = db.transaction(() => {
      let consegna = existingConsegna;

      // A save without the uscite fields (page cached before they existed) keeps the stored ones
      const uscite = usciteCassa ?? consegna?.uscite_cassa ?? 0;
      const motivo = usciteCassa == null ? (consegna?.uscite_motivo ?? '') : (usciteMotivo || '').trim();
      const consegnaData = [
        trovatoInCassa, pagatoProduttore, lasciatoInCassa, noteGiornata || '', roundToCents(uscite), motivo
      ];

      if (consegna) {
        console.log(`[CONSEGNA] ${timestamp} - Updating existing consegna ID: ${consegna.id}`);
        const updateAudit = getAuditFields(req, 'update');
        db.prepare(`
          UPDATE consegne
          SET trovato_in_cassa = ?, pagato_produttore = ?, lasciato_in_cassa = ?, note = ?,
              uscite_cassa = ?, uscite_motivo = ?, updated_by = ?, updated_at = ?
          WHERE id = ?
        `).run(...consegnaData, updateAudit.updated_by, updateAudit.updated_at, consegna.id);
      } else {
        const createAudit = getAuditFields(req, 'create');
        const result = db.prepare(`
          INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa, note,
                                uscite_cassa, uscite_motivo, created_by, created_at, updated_by, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(data, ...consegnaData, createAudit.created_by, createAudit.created_at,
               createAudit.updated_by, createAudit.updated_at);
        consegna = { id: result.lastInsertRowid };
        console.log(`[CONSEGNA] ${timestamp} - Created new consegna ID: ${consegna.id}`);

        logActivity({
          eventType: 'consegna_created',
          actorUserId: req.session.userId,
          consegnaId: consegna.id,
          details: `consegna: ${data}`,
          createdAt: timestamp
        });
      }

      // Upsert movimenti and update saldi
      const insertMovimento = db.prepare(`
        INSERT INTO movimenti (
          consegna_id, partecipante_id, importo_saldato,
          usa_credito, debito_lasciato, credito_lasciato,
          salda_debito_totale, debito_saldato, conto_produttore, note,
          created_by, created_at, updated_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateMovimento = db.prepare(`
        UPDATE movimenti
        SET importo_saldato = ?, usa_credito = ?,
            debito_lasciato = ?, credito_lasciato = ?,
            salda_debito_totale = ?, debito_saldato = ?, conto_produttore = ?, note = ?,
            updated_by = ?, updated_at = ?
        WHERE consegna_id = ? AND partecipante_id = ?
      `);

      let movimentiCreated = 0;
      let movimentiUpdated = 0;

      partecipanti.forEach(p => {
        // Look up by ID (sent from client as partecipante_id)
        const partecipante = db.prepare('SELECT * FROM users WHERE id = ?').get(p.partecipante_id);
        if (!partecipante) return;

        const existingMovimento = db.prepare(`
          SELECT * FROM movimenti WHERE consegna_id = ? AND partecipante_id = ?
        `).get(consegna.id, partecipante.id);

        const cents = v => roundToCents(v || 0);
        const contoProduttore = cents(p.contoProduttore);
        const importoSaldato = cents(p.importoSaldato);
        const movimentoData = [
          importoSaldato, cents(p.usaCredito),
          cents(p.debitoLasciato), cents(p.creditoLasciato),
          p.saldaDebitoTotale ? 1 : 0, cents(p.debitoSaldato), contoProduttore, p.note || ''
        ];

        if (existingMovimento) {
          // Track only manually entered fields (not auto-calculated ones)
          const changes = [];
          if (existingMovimento.conto_produttore !== contoProduttore) {
            changes.push(`conto: ${existingMovimento.conto_produttore} → ${contoProduttore}`);
          }
          if (existingMovimento.importo_saldato !== importoSaldato) {
            changes.push(`saldato: ${existingMovimento.importo_saldato} → ${importoSaldato}`);
          }

          const updateAudit = getAuditFields(req, 'update');
          updateMovimento.run(...movimentoData, updateAudit.updated_by, updateAudit.updated_at,
                              consegna.id, partecipante.id);

          // Log movimento change if something actually changed
          if (changes.length > 0) {
            logActivity({
              eventType: 'movimento_changed',
              targetUserId: partecipante.id,
              actorUserId: req.session.userId,
              details: changes.join(', '),
              consegnaId: consegna.id,
              createdAt: timestamp
            });
          }
          movimentiUpdated++;
        } else {
          const createAudit = getAuditFields(req, 'create');
          insertMovimento.run(consegna.id, partecipante.id, ...movimentoData,
                             createAudit.created_by, createAudit.created_at,
                             createAudit.updated_by, createAudit.updated_at);
          movimentiCreated++;
        }

        recalculateSaldo(partecipante.id, getAuditFields(req, 'update'));
      });

      console.log(`[CONSEGNA] ${timestamp} - Movimenti: ${movimentiCreated} created, ${movimentiUpdated} updated`);

      // Recalculate pagato_produttore and lasciato_in_cassa from movements
      const movimenti = db.prepare('SELECT conto_produttore, importo_saldato FROM movimenti WHERE consegna_id = ?').all(consegna.id);
      let totalPagato = 0;
      let incassato = 0;
      for (const m of movimenti) {
        totalPagato += m.conto_produttore || 0;
        incassato += m.importo_saldato || 0;
      }
      totalPagato = roundToCents(totalPagato);
      incassato = roundToCents(incassato);

      // Use trovato_in_cassa as SQLite stored it, not the raw body value
      const { trovato_in_cassa: trovato, uscite_cassa: usciteSalvate } =
        db.prepare('SELECT trovato_in_cassa, uscite_cassa FROM consegne WHERE id = ?').get(consegna.id);
      const lasciato = roundToCents(trovato + incassato - totalPagato - usciteSalvate);
      const cassaAudit = getAuditFields(req, 'update');
      db.prepare('UPDATE consegne SET pagato_produttore = ?, lasciato_in_cassa = ?, updated_by = ?, updated_at = ? WHERE id = ?')
        .run(totalPagato, lasciato, cassaAudit.updated_by, cassaAudit.updated_at, consegna.id);

      console.log(`[CONSEGNA] ${timestamp} - Calculated pagato_produttore: ${totalPagato}€`);
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
router.delete('/:id', requireAdmin, (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;

  console.log(`[CONSEGNA] ${timestamp} - DELETE request for consegna ID: ${id}`);

  try {
    const consegna = db.prepare('SELECT * FROM consegne WHERE id = ?').get(id);
    if (consegna) {
      console.log(`[CONSEGNA] ${timestamp} - Deleting consegna for date: ${consegna.data}`);
    }

    const transaction = db.transaction(() => {
      // Materialize movimenti log entries before cascade delete removes them
      const movimenti = db.prepare(`
        SELECT m.* FROM movimenti m WHERE m.consegna_id = ?
      `).all(id);

      movimenti.forEach(m => {
        const parts = [];
        if (m.conto_produttore) parts.push(`Conto: €${m.conto_produttore}`);
        if (m.importo_saldato) parts.push(`Saldato: €${m.importo_saldato}`);
        if (m.credito_lasciato) parts.push(`Cred: €${m.credito_lasciato}`);
        if (m.debito_lasciato) parts.push(`Deb: €${m.debito_lasciato}`);
        if (m.usa_credito) parts.push(`Usa Cred: €${m.usa_credito}`);
        if (m.debito_saldato) parts.push(`Salda Deb: €${m.debito_saldato}`);
        const details = `consegna: ${consegna.data}, ${parts.join(', ')}`;
        logActivity({
          eventType: 'movimento_created',
          targetUserId: m.partecipante_id,
          actorUserId: m.created_by || req.session.userId,
          details,
          consegnaId: parseInt(id),
          createdAt: m.created_at || timestamp
        });
      });

      // Log the consegna deletion itself
      logActivity({
        eventType: 'consegna_deleted',
        actorUserId: req.session.userId,
        details: `consegna: ${consegna.data}`,
        consegnaId: parseInt(id),
        createdAt: timestamp
      });

      // Quota teatro paid in this consegna goes with it
      const quote = db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(importo), 0) AS t FROM teatro_pagamenti WHERE consegna_id = ?').get(id);
      if (quote.n) {
        db.prepare('DELETE FROM teatro_pagamenti WHERE consegna_id = ?').run(id);
        logActivity({
          eventType: 'teatro_modifica',
          actorUserId: req.session.userId,
          details: `eliminate con la consegna ${consegna.data}: ${quote.n} quote teatro, ${quote.t} €`,
          consegnaId: parseInt(id),
          createdAt: timestamp
        });
      }

      db.prepare('DELETE FROM consegne WHERE id = ?').run(id);

      // Only participants with a movimento in the deleted consegna are affected
      const audit = getAuditFields(req, 'update');
      movimenti.forEach(m => recalculateSaldo(m.partecipante_id, audit));
      console.log(`[CONSEGNA] ${timestamp} - Recalculated saldi for ${movimenti.length} participants`);
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

    // Reports on the channels confirmed in the close dialog, after responding: a send failure never blocks the close
    const richiesti = Array.isArray(req.body?.report) ? req.body.report : [];
    canaliAttivi().filter(canale => richiesti.includes(canale)).forEach(canale => {
      notifyClosed(db, id, `${req.protocol}://${req.get('host')}`, canale)
        .catch(err => console.error(`[CONSEGNA] ${timestamp} - ${canale} report for consegna ${id} failed:`, err.message));
    });
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
