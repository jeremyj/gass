const express = require('express');
const db = require('../config/database');
const {
  calculateTrovatoInCassa,
  calculateLasciatoInCassa,
  applyDynamicCalculations,
  applySaldoChanges
} = require('../services/calculations');

const router = express.Router();

// Get consegna data for a specific date
router.get('/:date', (req, res) => {
  try {
    const { date } = req.params;

    const consegna = db.prepare('SELECT * FROM consegne WHERE data = ?').get(date);

    const previousConsegna = db.prepare(`
      SELECT lasciato_in_cassa FROM consegne
      WHERE data < ?
      ORDER BY data DESC
      LIMIT 1
    `).get(date);

    if (!consegna) {
      return res.json({
        success: true,
        found: false,
        lasciatoPrecedente: previousConsegna?.lasciato_in_cassa ?? null
      });
    }

    const movimenti = db.prepare(`
      SELECT m.*, p.nome, p.id as partecipante_id
      FROM movimenti m
      JOIN partecipanti p ON m.partecipante_id = p.id
      WHERE m.consegna_id = ?
    `).all(consegna.id);

    // Calculate saldo before this consegna for each participant
    const saldiBefore = {};

    // If this is the first consegna ever, all participants start from 0
    if (!previousConsegna) {
      movimenti.forEach(m => {
        saldiBefore[m.nome] = 0;
      });
    } else {
      // Calculate saldoBefore by reversing this consegna's effects
      movimenti.forEach(m => {
        const participant = db.prepare('SELECT saldo FROM partecipanti WHERE id = ?').get(m.partecipante_id);
        let saldoBefore = participant?.saldo || 0;

        // Reverse the effects of this movimento
        if (m.credito_lasciato > 0) saldoBefore -= m.credito_lasciato;
        if (m.debito_lasciato > 0) saldoBefore += m.debito_lasciato;
        if (m.usa_credito > 0) saldoBefore += m.usa_credito;
        if (m.debito_saldato > 0) saldoBefore -= m.debito_saldato;

        if (m.salda_debito_totale || m.salda_tutto) {
          const prevMovimenti = db.prepare(`
            SELECT m2.*
            FROM movimenti m2
            JOIN consegne c2 ON m2.consegna_id = c2.id
            WHERE m2.partecipante_id = ? AND c2.data < ?
            ORDER BY c2.data DESC
            LIMIT 1
          `).get(m.partecipante_id, date);

          if (prevMovimenti) {
            saldoBefore = prevMovimenti.credito_lasciato - prevMovimenti.debito_lasciato;
          }
        }

        saldiBefore[m.nome] = saldoBefore;
      });
    }

    // Apply dynamic calculations
    const processedConsegna = applyDynamicCalculations(consegna, previousConsegna?.lasciato_in_cassa);

    res.json({
      success: true,
      found: true,
      consegna: processedConsegna,
      movimenti,
      saldiBefore,
      lasciatoPrecedente: previousConsegna?.lasciato_in_cassa ?? null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save consegna data
router.post('/', (req, res) => {
  try {
    const { data, trovatoInCassa, pagatoProduttore, lasciatoInCassa,
            noteGiornata, partecipanti } = req.body;

    const transaction = db.transaction(() => {
      let consegna = db.prepare('SELECT * FROM consegne WHERE data = ?').get(data);

      const consegnaData = [
        trovatoInCassa, pagatoProduttore, lasciatoInCassa, noteGiornata || ''
      ];

      if (consegna) {
        db.prepare(`
          UPDATE consegne
          SET trovato_in_cassa = ?, pagato_produttore = ?, lasciato_in_cassa = ?, note = ?
          WHERE id = ?
        `).run(...consegnaData, consegna.id);
      } else {
        const result = db.prepare(`
          INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa, note)
          VALUES (?, ?, ?, ?, ?)
        `).run(data, ...consegnaData);
        consegna = { id: result.lastInsertRowid };
      }

      // Upsert movimenti and update saldi
      const insertMovimento = db.prepare(`
        INSERT INTO movimenti (
          consegna_id, partecipante_id, salda_tutto, importo_saldato,
          usa_credito, debito_lasciato, credito_lasciato,
          salda_debito_totale, debito_saldato, conto_produttore, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateMovimento = db.prepare(`
        UPDATE movimenti
        SET salda_tutto = ?, importo_saldato = ?, usa_credito = ?,
            debito_lasciato = ?, credito_lasciato = ?,
            salda_debito_totale = ?, debito_saldato = ?, conto_produttore = ?, note = ?
        WHERE consegna_id = ? AND partecipante_id = ?
      `);

      const updateSaldo = db.prepare(`
        UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?
      `);

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
          updateMovimento.run(...movimentoData, consegna.id, partecipante.id);
        } else {
          insertMovimento.run(consegna.id, partecipante.id, ...movimentoData);
        }

        updateSaldo.run(p.nuovoSaldo, data, partecipante.id);
      });

      // Recalculate pagato_produttore from movements
      const movimenti = db.prepare('SELECT * FROM movimenti WHERE consegna_id = ?').all(consegna.id);
      let totalPagato = 0;
      movimenti.forEach(m => {
        // Pagato produttore = sum of all conto_produttore values
        totalPagato += (m.conto_produttore || 0);
      });
      db.prepare('UPDATE consegne SET pagato_produttore = ? WHERE id = ?').run(totalPagato, consegna.id);

      // Recalculate lasciato_in_cassa from movements
      const currentConsegna = db.prepare('SELECT * FROM consegne WHERE id = ?').get(consegna.id);
      let incassato = 0;
      movimenti.forEach(m => {
        incassato += (m.importo_saldato || 0);
      });
      const lasciato = currentConsegna.trovato_in_cassa + incassato - currentConsegna.pagato_produttore;
      db.prepare('UPDATE consegne SET lasciato_in_cassa = ? WHERE id = ?').run(lasciato, consegna.id);
    });

    transaction();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete consegna and recalculate all saldi
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM consegne WHERE id = ?').run(id);
      db.prepare('UPDATE partecipanti SET saldo = 0').run();

      const consegne = db.prepare('SELECT * FROM consegne ORDER BY data ASC').all();

      consegne.forEach(consegna => {
        const movimenti = db.prepare(`
          SELECT m.*, p.saldo as current_saldo
          FROM movimenti m
          JOIN partecipanti p ON m.partecipante_id = p.id
          WHERE m.consegna_id = ?
        `).all(consegna.id);

        movimenti.forEach(m => {
          const nuovoSaldo = applySaldoChanges(m.current_saldo || 0, m);
          db.prepare('UPDATE partecipanti SET saldo = ? WHERE id = ?').run(nuovoSaldo, m.partecipante_id);
        });
      });
    });

    transaction();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
