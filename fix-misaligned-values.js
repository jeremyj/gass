// Script to fix misaligned calculated values in the database
// Run with: node fix-misaligned-values.js

const Database = require('better-sqlite3');
const db = new Database('./gass.db');

console.log('Checking for misaligned consegna values...\n');

const consegne = db.prepare(`
  SELECT
    c.id,
    c.data,
    c.trovato_in_cassa,
    c.pagato_produttore as stored_pagato,
    c.lasciato_in_cassa as stored_lasciato,
    c.discrepanza_trovata,
    c.discrepanza_pagato,
    c.discrepanza_cassa
  FROM consegne c
  ORDER BY c.data DESC
`).all();

let fixCount = 0;

consegne.forEach(c => {
  // Get movements for this consegna
  const movements = db.prepare(`
    SELECT
      importo_saldato,
      usa_credito,
      debito_lasciato,
      credito_lasciato,
      debito_saldato
    FROM movimenti
    WHERE consegna_id = ?
  `).all(c.id);

  // Calculate correct values
  let calculatedPagato = 0;
  let incassato = 0;

  movements.forEach(m => {
    const conto = (m.importo_saldato || 0) + (m.usa_credito || 0) +
                 (m.debito_lasciato || 0) - (m.credito_lasciato || 0) -
                 (m.debito_saldato || 0);
    calculatedPagato += conto;
    incassato += (m.importo_saldato || 0);
  });

  calculatedPagato = Math.round(calculatedPagato * 100) / 100;
  const calculatedLasciato = Math.round(((c.trovato_in_cassa || 0) + incassato - calculatedPagato) * 100) / 100;

  // Check for misalignment
  const pagatoMismatch = c.discrepanza_pagato === 0 &&
                        Math.abs(c.stored_pagato - calculatedPagato) > 0.01;
  const lasciatoMismatch = c.discrepanza_cassa === 0 &&
                          Math.abs(c.stored_lasciato - calculatedLasciato) > 0.01;

  if (pagatoMismatch || lasciatoMismatch) {
    console.log(`\nFound misalignment on ${c.data}:`);
    if (pagatoMismatch) {
      console.log(`  Pagato: stored=${c.stored_pagato}, calculated=${calculatedPagato}`);
    }
    if (lasciatoMismatch) {
      console.log(`  Lasciato: stored=${c.stored_lasciato}, calculated=${calculatedLasciato}`);
    }

    // Fix it
    try {
      db.prepare(`
        UPDATE consegne
        SET pagato_produttore = ?,
            lasciato_in_cassa = ?
        WHERE id = ?
      `).run(calculatedPagato, calculatedLasciato, c.id);
      console.log(`  ✓ Fixed`);
      fixCount++;
    } catch (err) {
      console.error(`  Error fixing: ${err}`);
    }
  }
});

console.log(`\n\nTotal fixes applied: ${fixCount}`);
db.close();
