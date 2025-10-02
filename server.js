const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API Routes

// Get all participants with their balances
app.get('/api/participants', (req, res) => {
  try {
    const participants = db.prepare('SELECT * FROM partecipanti ORDER BY nome').all();
    res.json({ success: true, participants });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get consegna data for a specific date
app.get('/api/consegna/:date', (req, res) => {
  try {
    const { date } = req.params;

    const consegna = db.prepare('SELECT * FROM consegne WHERE data = ?').get(date);

    // Get previous consegna's lasciato_in_cassa for auto-populate
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
        lasciatoPrecedente: previousConsegna ? previousConsegna.lasciato_in_cassa : null
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
    movimenti.forEach(m => {
      // Get participant's current saldo
      const participant = db.prepare('SELECT saldo FROM partecipanti WHERE id = ?').get(m.partecipante_id);
      let saldoBefore = participant.saldo || 0;

      // Reverse the effects of this movimento
      if (m.credito_lasciato > 0) {
        saldoBefore -= m.credito_lasciato;
      }
      if (m.debito_lasciato > 0) {
        saldoBefore += m.debito_lasciato;
      }
      if (m.usa_credito > 0) {
        saldoBefore += m.usa_credito;
      }
      if (m.debito_saldato > 0) {
        saldoBefore -= m.debito_saldato;
      }
      if (m.salda_debito_totale) {
        // The saldo before was negative (debito)
        // After salda_debito_totale it became 0 or positive
        // We need to find what it was - check previous movimento
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
      if (m.salda_tutto) {
        // Similar to salda_debito_totale - need previous saldo
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

    // Calculate trovato_in_cassa dynamically from previous lasciato
    // UNLESS discrepanza_trovata is enabled (manual override)
    let trovatoInCassa = consegna.trovato_in_cassa;
    if (consegna.discrepanza_trovata !== 1 && previousConsegna) {
      trovatoInCassa = previousConsegna.lasciato_in_cassa;
    }

    // Calculate lasciato_in_cassa dynamically from trovato - pagato
    // UNLESS discrepanza_cassa is enabled (manual override)
    let lasciatoInCassa = consegna.lasciato_in_cassa;
    if (consegna.discrepanza_cassa !== 1) {
      lasciatoInCassa = trovatoInCassa - consegna.pagato_produttore;
    }

    res.json({
      success: true,
      found: true,
      consegna: {
        ...consegna,
        trovato_in_cassa: trovatoInCassa,
        lasciato_in_cassa: lasciatoInCassa
      },
      movimenti,
      saldiBefore,
      lasciatoPrecedente: previousConsegna ? previousConsegna.lasciato_in_cassa : null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save consegna data
app.post('/api/consegna', (req, res) => {
  try {
    const { data, trovatoInCassa, pagatoProduttore, lasciatoInCassa, discrepanzaCassa, discrepanzaTrovata, discrepanzaPagato, noteGiornata, partecipanti } = req.body;

    const transaction = db.transaction(() => {
      // Check if consegna already exists for this date
      let consegna = db.prepare('SELECT * FROM consegne WHERE data = ?').get(data);

      // Use provided discrepanzaCassa flag or auto-detect
      let discrepanzaFlag = discrepanzaCassa ? 1 : 0;
      if (!discrepanzaCassa) {
        // Auto-detect discrepancy if not manually set
        const previousConsegna = db.prepare(`
          SELECT lasciato_in_cassa FROM consegne
          WHERE data < ?
          ORDER BY data DESC
          LIMIT 1
        `).get(data);
        discrepanzaFlag = previousConsegna && previousConsegna.lasciato_in_cassa !== trovatoInCassa ? 1 : 0;
      }

      if (consegna) {
        // Update existing consegna
        db.prepare(`
          UPDATE consegne
          SET trovato_in_cassa = ?, pagato_produttore = ?, lasciato_in_cassa = ?,
              discrepanza_cassa = ?, discrepanza_trovata = ?, discrepanza_pagato = ?, note = ?
          WHERE id = ?
        `).run(trovatoInCassa, pagatoProduttore, lasciatoInCassa, discrepanzaFlag,
               discrepanzaTrovata ? 1 : 0, discrepanzaPagato ? 1 : 0, noteGiornata || '', consegna.id);
      } else {
        // Insert new consegna
        const result = db.prepare(`
          INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa,
                                discrepanza_cassa, discrepanza_trovata, discrepanza_pagato, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(data, trovatoInCassa, pagatoProduttore, lasciatoInCassa, discrepanzaFlag,
               discrepanzaTrovata ? 1 : 0, discrepanzaPagato ? 1 : 0, noteGiornata || '');

        consegna = { id: result.lastInsertRowid };
      }

      // Upsert movimenti and update saldi (only for provided participants)
      const insertMovimento = db.prepare(`
        INSERT INTO movimenti (
          consegna_id, partecipante_id, salda_tutto, importo_saldato,
          usa_credito, debito_lasciato, credito_lasciato,
          salda_debito_totale, debito_saldato, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateMovimento = db.prepare(`
        UPDATE movimenti
        SET salda_tutto = ?, importo_saldato = ?, usa_credito = ?,
            debito_lasciato = ?, credito_lasciato = ?,
            salda_debito_totale = ?, debito_saldato = ?, note = ?
        WHERE consegna_id = ? AND partecipante_id = ?
      `);

      const updateSaldo = db.prepare(`
        UPDATE partecipanti
        SET saldo = ?, ultima_modifica = ?
        WHERE id = ?
      `);

      partecipanti.forEach(p => {
        const partecipante = db.prepare('SELECT * FROM partecipanti WHERE nome = ?').get(p.nome);
        if (!partecipante) return;

        // Check if movimento already exists for this participant
        const existingMovimento = db.prepare(`
          SELECT * FROM movimenti
          WHERE consegna_id = ? AND partecipante_id = ?
        `).get(consegna.id, partecipante.id);

        if (existingMovimento) {
          // Update existing movimento
          updateMovimento.run(
            p.saldaTutto ? 1 : 0,
            p.importoSaldato || 0,
            p.usaCredito || 0,
            p.debitoLasciato || 0,
            p.creditoLasciato || 0,
            p.saldaDebitoTotale ? 1 : 0,
            p.debitoSaldato || 0,
            p.note || '',
            consegna.id,
            partecipante.id
          );
        } else {
          // Insert new movimento
          insertMovimento.run(
            consegna.id,
            partecipante.id,
            p.saldaTutto ? 1 : 0,
            p.importoSaldato || 0,
            p.usaCredito || 0,
            p.debitoLasciato || 0,
            p.creditoLasciato || 0,
            p.saldaDebitoTotale ? 1 : 0,
            p.debitoSaldato || 0,
            p.note || ''
          );
        }

        updateSaldo.run(p.nuovoSaldo, data, partecipante.id);
      });
    });

    transaction();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all consegne (storico)
app.get('/api/storico', (req, res) => {
  try {
    const consegne = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM movimenti WHERE consegna_id = c.id) as num_movimenti
      FROM consegne c
      ORDER BY c.data DESC
    `).all();

    // Calculate trovato_in_cassa and lasciato_in_cassa dynamically for each consegna
    // We need to process in chronological order (ASC) for recursive calculation
    const consegneAsc = [...consegne].reverse(); // Convert DESC to ASC

    const consegneWithDynamicValues = consegneAsc.map((consegna, index) => {
      // Calculate trovato from previous lasciato
      let trovatoInCassa = consegna.trovato_in_cassa;
      if (consegna.discrepanza_trovata !== 1 && index > 0) {
        const previousConsegna = consegneAsc[index - 1];
        // Use the calculated lasciato from previous iteration
        trovatoInCassa = previousConsegna.lasciato_in_cassa_calculated !== undefined
          ? previousConsegna.lasciato_in_cassa_calculated
          : previousConsegna.lasciato_in_cassa;
      }

      // Calculate lasciato from trovato - pagato
      let lasciatoInCassa = consegna.lasciato_in_cassa;
      if (consegna.discrepanza_cassa !== 1) {
        lasciatoInCassa = trovatoInCassa - consegna.pagato_produttore;
      }

      // Store calculated value for next iteration
      consegna.lasciato_in_cassa_calculated = lasciatoInCassa;

      return {
        ...consegna,
        trovato_in_cassa: trovatoInCassa,
        lasciato_in_cassa: lasciatoInCassa
      };
    });

    // Reverse back to DESC order
    res.json({ success: true, consegne: consegneWithDynamicValues.reverse() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get detailed storico with movimenti
app.get('/api/storico/dettaglio', (req, res) => {
  try {
    const consegne = db.prepare('SELECT * FROM consegne ORDER BY data DESC').all();

    // Process in chronological order (ASC) for recursive calculation
    const consegneAsc = [...consegne].reverse();

    const storico = consegneAsc.map((consegna, index) => {
      const movimenti = db.prepare(`
        SELECT m.*, p.nome
        FROM movimenti m
        JOIN partecipanti p ON m.partecipante_id = p.id
        WHERE m.consegna_id = ?
      `).all(consegna.id);

      // Calculate trovato from previous lasciato
      let trovatoInCassa = consegna.trovato_in_cassa;
      if (consegna.discrepanza_trovata !== 1 && index > 0) {
        const previousConsegna = consegneAsc[index - 1];
        trovatoInCassa = previousConsegna.lasciato_in_cassa_calculated !== undefined
          ? previousConsegna.lasciato_in_cassa_calculated
          : previousConsegna.lasciato_in_cassa;
      }

      // Calculate lasciato from trovato - pagato
      let lasciatoInCassa = consegna.lasciato_in_cassa;
      if (consegna.discrepanza_cassa !== 1) {
        lasciatoInCassa = trovatoInCassa - consegna.pagato_produttore;
      }

      // Store calculated value for next iteration
      consegna.lasciato_in_cassa_calculated = lasciatoInCassa;

      return {
        ...consegna,
        trovato_in_cassa: trovatoInCassa,
        lasciato_in_cassa: lasciatoInCassa,
        movimenti
      };
    });

    // Reverse back to DESC order
    res.json({ success: true, storico: storico.reverse() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete consegna and recalculate all saldi
app.delete('/api/consegna/:id', (req, res) => {
  try {
    const { id } = req.params;

    const transaction = db.transaction(() => {
      // Delete the consegna (movimenti will be deleted via CASCADE)
      db.prepare('DELETE FROM consegne WHERE id = ?').run(id);

      // Reset all participant saldi to 0
      db.prepare('UPDATE partecipanti SET saldo = 0').run();

      // Get all consegne in chronological order
      const consegne = db.prepare('SELECT * FROM consegne ORDER BY data ASC').all();

      // Recalculate saldi by replaying all movements in order
      consegne.forEach(consegna => {
        const movimenti = db.prepare(`
          SELECT m.*, p.saldo as current_saldo
          FROM movimenti m
          JOIN partecipanti p ON m.partecipante_id = p.id
          WHERE m.consegna_id = ?
        `).all(consegna.id);

        movimenti.forEach(m => {
          let nuovoSaldo = m.current_saldo || 0;

          // Apply the same logic as saveData
          if (m.salda_tutto) {
            nuovoSaldo = 0;
          }

          if (m.usa_credito > 0) {
            nuovoSaldo -= m.usa_credito;
          }

          if (m.salda_debito_totale && nuovoSaldo < 0) {
            nuovoSaldo = 0;
          } else if (m.debito_saldato > 0 && nuovoSaldo < 0) {
            nuovoSaldo = Math.min(0, nuovoSaldo + m.debito_saldato);
          }

          if (m.debito_lasciato > 0) {
            nuovoSaldo -= m.debito_lasciato;
          }
          if (m.credito_lasciato > 0) {
            nuovoSaldo += m.credito_lasciato;
          }

          // Update the participant saldo
          db.prepare('UPDATE partecipanti SET saldo = ? WHERE id = ?')
            .run(nuovoSaldo, m.partecipante_id);
        });
      });
    });

    transaction();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update participant saldo
app.put('/api/participants/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { saldo } = req.body;

    // Check if saldo has actually changed
    const current = db.prepare('SELECT saldo FROM partecipanti WHERE id = ?').get(id);

    if (current && current.saldo !== saldo) {
      // Saldo changed - update with new date
      db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = DATE() WHERE id = ?')
        .run(saldo, id);
    } else if (current && current.saldo === saldo) {
      // Saldo unchanged - don't update date
      // No action needed
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add new participant
app.post('/api/participants', (req, res) => {
  try {
    const { nome } = req.body;
    const result = db.prepare('INSERT INTO partecipanti (nome, saldo) VALUES (?, 0)').run(nome);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete participant
app.delete('/api/participants/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM partecipanti WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
