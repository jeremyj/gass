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

    if (!consegna) {
      return res.json({ success: true, found: false });
    }

    const movimenti = db.prepare(`
      SELECT m.*, p.nome
      FROM movimenti m
      JOIN partecipanti p ON m.partecipante_id = p.id
      WHERE m.consegna_id = ?
    `).all(consegna.id);

    res.json({ success: true, found: true, consegna, movimenti });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save consegna data
app.post('/api/consegna', (req, res) => {
  try {
    const { data, trovatoInCassa, pagatoProduttore, lasciatoInCassa, partecipanti } = req.body;

    const transaction = db.transaction(() => {
      // Check if consegna already exists for this date
      let consegna = db.prepare('SELECT * FROM consegne WHERE data = ?').get(data);

      // Check for cash discrepancy
      const previousConsegna = db.prepare(`
        SELECT lasciato_in_cassa FROM consegne
        WHERE data < ?
        ORDER BY data DESC
        LIMIT 1
      `).get(data);

      const discrepanzaCassa = previousConsegna && previousConsegna.lasciato_in_cassa !== trovatoInCassa ? 1 : 0;

      if (consegna) {
        // Update existing consegna
        db.prepare(`
          UPDATE consegne
          SET trovato_in_cassa = ?, pagato_produttore = ?, lasciato_in_cassa = ?, discrepanza_cassa = ?
          WHERE id = ?
        `).run(trovatoInCassa, pagatoProduttore, lasciatoInCassa, discrepanzaCassa, consegna.id);

        // Delete old movimenti
        db.prepare('DELETE FROM movimenti WHERE consegna_id = ?').run(consegna.id);
      } else {
        // Insert new consegna
        const result = db.prepare(`
          INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa, discrepanza_cassa)
          VALUES (?, ?, ?, ?, ?)
        `).run(data, trovatoInCassa, pagatoProduttore, lasciatoInCassa, discrepanzaCassa);

        consegna = { id: result.lastInsertRowid };
      }

      // Insert movimenti and update saldi
      const insertMovimento = db.prepare(`
        INSERT INTO movimenti (
          consegna_id, partecipante_id, salda_tutto, importo_saldato,
          usa_credito, debito_lasciato, credito_lasciato,
          salda_debito_totale, debito_saldato, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateSaldo = db.prepare(`
        UPDATE partecipanti
        SET saldo = ?, ultima_modifica = ?
        WHERE id = ?
      `);

      partecipanti.forEach(p => {
        const partecipante = db.prepare('SELECT * FROM partecipanti WHERE nome = ?').get(p.nome);
        if (!partecipante) return;

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

    res.json({ success: true, consegne });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get detailed storico with movimenti
app.get('/api/storico/dettaglio', (req, res) => {
  try {
    const consegne = db.prepare('SELECT * FROM consegne ORDER BY data DESC').all();

    const storico = consegne.map(consegna => {
      const movimenti = db.prepare(`
        SELECT m.*, p.nome
        FROM movimenti m
        JOIN partecipanti p ON m.partecipante_id = p.id
        WHERE m.consegna_id = ?
      `).all(consegna.id);

      return { ...consegna, movimenti };
    });

    res.json({ success: true, storico });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete consegna
app.delete('/api/consegna/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM consegne WHERE id = ?').run(id);
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
