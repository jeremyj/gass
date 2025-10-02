const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// ===== HELPER FUNCTIONS =====

// Round to 0.1€ (1 decimo) to avoid floating-point precision errors
const roundToCents = (num) => Math.round(num * 10) / 10;

// Calculate trovato_in_cassa dynamically from previous consegna's lasciato
// Returns calculated value UNLESS manual override flag is set
function calculateTrovatoInCassa(consegna, previousLasciato) {
  if (consegna.discrepanza_trovata === 1) {
    return consegna.trovato_in_cassa; // Manual override
  }
  return previousLasciato !== undefined ? roundToCents(previousLasciato) : consegna.trovato_in_cassa;
}

// Calculate lasciato_in_cassa dynamically: trovato - pagato
// Returns calculated value UNLESS manual override flag is set
function calculateLasciatoInCassa(consegna, trovato) {
  if (consegna.discrepanza_cassa === 1) {
    return consegna.lasciato_in_cassa; // Manual override
  }
  return roundToCents(trovato - consegna.pagato_produttore);
}

// Apply dynamic calculations to single consegna
function applyDynamicCalculations(consegna, previousLasciato) {
  const trovato = calculateTrovatoInCassa(consegna, previousLasciato);
  const lasciato = calculateLasciatoInCassa(consegna, trovato);

  return {
    ...consegna,
    trovato_in_cassa: trovato,
    lasciato_in_cassa: lasciato
  };
}

// Process array of consegne in chronological order with recursive calculation
function processConsegneWithDynamicValues(consegne, isAscending = false) {
  const consegneAsc = isAscending ? consegne : [...consegne].reverse();

  const processed = consegneAsc.map((consegna, index) => {
    const previousLasciato = index > 0
      ? (consegneAsc[index - 1].lasciato_in_cassa_calculated ?? consegneAsc[index - 1].lasciato_in_cassa)
      : undefined;

    const trovato = calculateTrovatoInCassa(consegna, previousLasciato);
    const lasciato = calculateLasciatoInCassa(consegna, trovato);

    return {
      ...consegna,
      trovato_in_cassa: trovato,
      lasciato_in_cassa: lasciato,
      lasciato_in_cassa_calculated: lasciato // Store for next iteration
    };
  });

  return isAscending ? processed : processed.reverse();
}

// Recalculate participant saldo from movimento
function applySaldoChanges(currentSaldo, movimento) {
  let saldo = currentSaldo;

  if (movimento.salda_tutto) {
    saldo = 0;
  }

  if (movimento.usa_credito > 0) {
    saldo -= movimento.usa_credito;
  }

  if (movimento.salda_debito_totale && saldo < 0) {
    saldo = 0;
  } else if (movimento.debito_saldato > 0 && saldo < 0) {
    saldo = Math.min(0, saldo + movimento.debito_saldato);
  }

  if (movimento.debito_lasciato > 0) {
    saldo -= movimento.debito_lasciato;
  }

  if (movimento.credito_lasciato > 0) {
    saldo += movimento.credito_lasciato;
  }

  return saldo;
}

// ===== API ROUTES =====

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
app.post('/api/consegna', (req, res) => {
  try {
    const { data, trovatoInCassa, pagatoProduttore, lasciatoInCassa,
            discrepanzaCassa, discrepanzaTrovata, discrepanzaPagato,
            noteGiornata, partecipanti } = req.body;

    const transaction = db.transaction(() => {
      let consegna = db.prepare('SELECT * FROM consegne WHERE data = ?').get(data);

      // Auto-detect discrepancy if not manually set
      let discrepanzaFlag = discrepanzaCassa ? 1 : 0;
      if (!discrepanzaCassa) {
        const previousConsegna = db.prepare(`
          SELECT lasciato_in_cassa FROM consegne
          WHERE data < ?
          ORDER BY data DESC
          LIMIT 1
        `).get(data);
        discrepanzaFlag = previousConsegna && previousConsegna.lasciato_in_cassa !== trovatoInCassa ? 1 : 0;
      }

      const consegnaData = [
        trovatoInCassa, pagatoProduttore, lasciatoInCassa, discrepanzaFlag,
        discrepanzaTrovata ? 1 : 0, discrepanzaPagato ? 1 : 0, noteGiornata || ''
      ];

      if (consegna) {
        db.prepare(`
          UPDATE consegne
          SET trovato_in_cassa = ?, pagato_produttore = ?, lasciato_in_cassa = ?,
              discrepanza_cassa = ?, discrepanza_trovata = ?, discrepanza_pagato = ?, note = ?
          WHERE id = ?
        `).run(...consegnaData, consegna.id);
      } else {
        const result = db.prepare(`
          INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa,
                                discrepanza_cassa, discrepanza_trovata, discrepanza_pagato, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(data, ...consegnaData);
        consegna = { id: result.lastInsertRowid };
      }

      // Upsert movimenti and update saldi
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
          p.saldaDebitoTotale ? 1 : 0, p.debitoSaldato || 0, p.note || ''
        ];

        if (existingMovimento) {
          updateMovimento.run(...movimentoData, consegna.id, partecipante.id);
        } else {
          insertMovimento.run(consegna.id, partecipante.id, ...movimentoData);
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

    const processed = processConsegneWithDynamicValues(consegne);
    res.json({ success: true, consegne: processed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get detailed storico with movimenti
app.get('/api/storico/dettaglio', (req, res) => {
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

// Delete consegna and recalculate all saldi
app.delete('/api/consegna/:id', (req, res) => {
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

// Update participant saldo
app.put('/api/participants/:id', (req, res) => {
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
