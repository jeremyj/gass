const Database = require('better-sqlite3');
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, 'gass.db');
const db = new Database(dbPath);

// Helper function to format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Calculate dates for last 3 weeks
const today = new Date();
const date1 = new Date(today);
date1.setDate(today.getDate() - 21); // 3 weeks ago

const date2 = new Date(today);
date2.setDate(today.getDate() - 14); // 2 weeks ago

const date3 = new Date(today);
date3.setDate(today.getDate() - 7); // 1 week ago

console.log('🗑️  Resetting database...');

// Delete all data
db.exec('DELETE FROM movimenti');
db.exec('DELETE FROM consegne');
db.exec('DELETE FROM partecipanti');

console.log('✅ Database cleared');

// Insert participants
console.log('👥 Creating participants...');
const insertParticipant = db.prepare('INSERT INTO partecipanti (nome, saldo, ultima_modifica) VALUES (?, ?, ?)');

const participants = [
  { nome: 'Renzo', saldo: 0 },
  { nome: 'Livia', saldo: 0 },
  { nome: 'Jeremy', saldo: 0 },
  { nome: 'Giovanni', saldo: 0 }
];

const participantIds = {};
for (const p of participants) {
  const result = insertParticipant.run(p.nome, p.saldo, formatDate(date1));
  participantIds[p.nome] = result.lastInsertRowid;
  console.log(`   ✓ ${p.nome} (ID: ${participantIds[p.nome]})`);
}

// Prepare statements
const insertConsegna = db.prepare(`
  INSERT INTO consegne (
    data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa,
    discrepanza_cassa, discrepanza_trovata, discrepanza_pagato, note
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMovimento = db.prepare(`
  INSERT INTO movimenti (
    consegna_id, partecipante_id, salda_tutto, importo_saldato,
    usa_credito, debito_lasciato, credito_lasciato, salda_debito_totale,
    debito_saldato, note
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

console.log('\n📦 Creating mock deliveries...');

// DELIVERY 1: ~3 weeks ago
console.log(`\n📅 Delivery 1: ${formatDate(date1)}`);
const consegna1 = insertConsegna.run(
  formatDate(date1),
  50.0,           // trovato_in_cassa (starting cash)
  73.0,           // pagato_produttore (AUTO: 15+20+18+20)
  47.0,           // lasciato_in_cassa (AUTO: 50+70-73)
  0,              // discrepanza_cassa
  0,              // discrepanza_trovata
  0,              // discrepanza_pagato
  'Prima consegna - calcoli automatici'
);
const consegna1Id = consegna1.lastInsertRowid;

// Renzo: Full settlement (salda_tutto)
insertMovimento.run(
  consegna1Id, participantIds['Renzo'],
  1,    // salda_tutto = TRUE
  15.0, // importo_saldato
  0,    // usa_credito
  0,    // debito_lasciato
  0,    // credito_lasciato
  0,    // salda_debito_totale
  0,    // debito_saldato
  'Salda tutto - inizia da zero'
);
console.log('   ✓ Renzo: Full settlement (salda_tutto) → balance: 0€');

// Livia: Leaves credit
insertMovimento.run(
  consegna1Id, participantIds['Livia'],
  0,    // salda_tutto
  25.0, // importo_saldato
  0,    // usa_credito
  0,    // debito_lasciato
  5.0,  // credito_lasciato
  0,    // salda_debito_totale
  0,    // debito_saldato
  'Paga extra - lascia credito'
);
console.log('   ✓ Livia: Leaves credit (+5€) → balance: +5€');

// Jeremy: Leaves debt
insertMovimento.run(
  consegna1Id, participantIds['Jeremy'],
  0,    // salda_tutto
  10.0, // importo_saldato
  0,    // usa_credito
  8.0,  // debito_lasciato
  0,    // credito_lasciato
  0,    // salda_debito_totale
  0,    // debito_saldato
  'Paga parziale - lascia debito'
);
console.log('   ✓ Jeremy: Leaves debt (-8€) → balance: -8€');

// Giovanni: Simple payment
insertMovimento.run(
  consegna1Id, participantIds['Giovanni'],
  0,    // salda_tutto
  20.0, // importo_saldato
  0,    // usa_credito
  0,    // debito_lasciato
  0,    // credito_lasciato
  0,    // salda_debito_totale
  0,    // debito_saldato
  'Pagamento semplice'
);
console.log('   ✓ Giovanni: Simple payment → balance: 0€');

// DELIVERY 2: ~2 weeks ago
console.log(`\n📅 Delivery 2: ${formatDate(date2)}`);
const consegna2 = insertConsegna.run(
  formatDate(date2),
  47.0,  // trovato_in_cassa (AUTO: from previous lasciato)
  73.0,  // pagato_produttore (AUTO: 18+20+13+22)
  46.0,  // lasciato_in_cassa (AUTO: 47+72-73)
  0,     // discrepanza_cassa
  0,     // discrepanza_trovata
  0,     // discrepanza_pagato
  'Seconda consegna - calcoli automatici'
);
const consegna2Id = consegna2.lastInsertRowid;

// Renzo: Leaves new debt
insertMovimento.run(
  consegna2Id, participantIds['Renzo'],
  0,    // salda_tutto
  12.0, // importo_saldato
  0,    // usa_credito
  6.0,  // debito_lasciato
  0,    // credito_lasciato
  0,    // salda_debito_totale
  0,    // debito_saldato
  'Nuovo debito dopo settlement precedente'
);
console.log('   ✓ Renzo: Leaves debt (-6€) → balance: -6€');

// Livia: Uses existing credit
insertMovimento.run(
  consegna2Id, participantIds['Livia'],
  0,    // salda_tutto
  15.0, // importo_saldato
  5.0,  // usa_credito (uses previous +5€)
  0,    // debito_lasciato
  0,    // credito_lasciato
  0,    // salda_debito_totale
  0,    // debito_saldato
  'Usa credito precedente'
);
console.log('   ✓ Livia: Uses credit (5€) → balance: 0€');

// Jeremy: Partial debt settlement
insertMovimento.run(
  consegna2Id, participantIds['Jeremy'],
  0,    // salda_tutto
  18.0, // importo_saldato
  0,    // usa_credito
  0,    // debito_lasciato
  0,    // credito_lasciato
  0,    // salda_debito_totale
  5.0,  // debito_saldato (pays 5€ of 8€ debt)
  'Salda parzialmente il debito'
);
console.log('   ✓ Jeremy: Partial debt settlement (5€ of 8€) → balance: -3€');

// Giovanni: Full debt settlement (even though balance is 0)
insertMovimento.run(
  consegna2Id, participantIds['Giovanni'],
  0,    // salda_tutto
  22.0, // importo_saldato
  0,    // usa_credito
  0,    // debito_lasciato
  0,    // credito_lasciato
  1,    // salda_debito_totale (settles all debt if any)
  0,    // debito_saldato
  'Test salda_debito_totale'
);
console.log('   ✓ Giovanni: Full debt settlement flag → balance: 0€');

// DELIVERY 3: ~1 week ago
console.log(`\n📅 Delivery 3: ${formatDate(date3)}`);
const consegna3 = insertConsegna.run(
  formatDate(date3),
  46.0,  // trovato_in_cassa (AUTO: from previous lasciato)
  64.5,  // pagato_produttore (AUTO: 20+14+21+9.5)
  52.0,  // lasciato_in_cassa (AUTO: 46+70.5-64.5)
  0,     // discrepanza_cassa
  0,     // discrepanza_trovata
  0,     // discrepanza_pagato
  'Terza consegna - calcoli automatici'
);
const consegna3Id = consegna3.lastInsertRowid;

// Renzo: Settles all debt
insertMovimento.run(
  consegna3Id, participantIds['Renzo'],
  0,    // salda_tutto
  20.0, // importo_saldato
  0,    // usa_credito
  0,    // debito_lasciato
  0,    // credito_lasciato
  1,    // salda_debito_totale (clears -6€)
  0,    // debito_saldato
  'Salda tutto il debito'
);
console.log('   ✓ Renzo: Settles all debt → balance: 0€');

// Livia: Leaves more credit
insertMovimento.run(
  consegna3Id, participantIds['Livia'],
  0,    // salda_tutto
  22.0, // importo_saldato
  0,    // usa_credito
  0,    // debito_lasciato
  8.0,  // credito_lasciato
  0,    // salda_debito_totale
  0,    // debito_saldato
  'Accumula altro credito'
);
console.log('   ✓ Livia: Leaves more credit (+8€) → balance: +8€');

// Jeremy: Mixed transaction (payment + new debt)
insertMovimento.run(
  consegna3Id, participantIds['Jeremy'],
  0,    // salda_tutto
  16.5, // importo_saldato
  0,    // usa_credito
  4.5,  // debito_lasciato (new debt on top of existing -3€)
  0,    // credito_lasciato
  0,    // salda_debito_totale
  0,    // debito_saldato
  'Pagamento + nuovo debito'
);
console.log('   ✓ Jeremy: Payment + new debt → balance: -7.5€');

// Giovanni: Uses credit + leaves debt (complex)
insertMovimento.run(
  consegna3Id, participantIds['Giovanni'],
  0,    // salda_tutto
  12.0, // importo_saldato
  0,    // usa_credito (no credit to use)
  0,    // debito_lasciato
  2.5,  // credito_lasciato
  0,    // salda_debito_totale
  0,    // debito_saldato
  'Scenario complesso'
);
console.log('   ✓ Giovanni: Leaves credit → balance: +2.5€');

// Calculate final balances
console.log('\n💰 Calculating final balances...');

function calculateSaldi() {
  const saldi = {};
  for (const nome in participantIds) {
    saldi[participantIds[nome]] = 0;
  }

  const consegne = db.prepare('SELECT * FROM consegne ORDER BY data ASC').all();

  for (const consegna of consegne) {
    const movimenti = db.prepare('SELECT * FROM movimenti WHERE consegna_id = ?').all(consegna.id);

    for (const m of movimenti) {
      let saldo = saldi[m.partecipante_id];

      if (m.salda_tutto) {
        saldo = 0;
      }

      if (m.usa_credito > 0) {
        saldo -= m.usa_credito;
      }

      if (m.salda_debito_totale && saldo < 0) {
        saldo = 0;
      } else if (m.debito_saldato > 0) {
        saldo = Math.min(0, saldo + m.debito_saldato);
      }

      if (m.debito_lasciato > 0) {
        saldo -= m.debito_lasciato;
      }

      if (m.credito_lasciato > 0) {
        saldo += m.credito_lasciato;
      }

      saldi[m.partecipante_id] = Math.round(saldo * 10) / 10;
    }
  }

  return saldi;
}

const finalSaldi = calculateSaldi();

// Update participant balances
const updateSaldo = db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?');
for (const nome in participantIds) {
  const id = participantIds[nome];
  const saldo = finalSaldi[id];
  updateSaldo.run(saldo, formatDate(date3), id);

  const sign = saldo > 0 ? '+' : '';
  console.log(`   ${nome}: ${sign}${saldo}€`);
}

console.log('\n✅ Mock data populated successfully!');
console.log('\n📊 Summary:');
console.log(`   - 4 participants created`);
console.log(`   - 3 deliveries created (${formatDate(date1)}, ${formatDate(date2)}, ${formatDate(date3)})`);
console.log(`   - 12 movements created (edge cases covered)`);
console.log(`   - All cash calculations: AUTOMATIC (no manual overrides)`);

db.close();
