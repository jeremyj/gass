const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use same logic as database.js
const dbDir = fs.existsSync('/app/data') ? '/app/data' : __dirname;
const db = new Database(path.join(dbDir, 'gass.db'));

db.pragma('foreign_keys = ON');

console.log('🗑️  Clearing database...');

// Clear all data
db.exec(`
  DELETE FROM movimenti;
  DELETE FROM consegne;
  UPDATE partecipanti SET saldo = 0, ultima_modifica = NULL;
`);

console.log('✓ Database cleared');

// Get participant IDs
const participants = db.prepare('SELECT id, nome FROM partecipanti ORDER BY nome').all();
const pMap = {};
participants.forEach(p => {
  pMap[p.nome] = p.id;
});

console.log('📦 Creating test data for 2 days...');

// ==== GIORNO 1: 2025-10-20 ====
console.log('\n📅 Day 1: 2025-10-20');

const consegna1 = db.prepare(`
  INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa, note, discrepanza_cassa, discrepanza_trovata, discrepanza_pagato)
  VALUES (?, ?, ?, ?, ?, 0, 0, 0)
`).run('2025-10-20', 0, 87, 10, 'Prima consegna di test');

const c1id = consegna1.lastInsertRowid;

// Alessandra: paga 25€, lascia credito 5€
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?)
`).run(c1id, pMap['Alessandra Solimene'], 25, 0, 5, 0, 'Primo movimento');

// Fernanda: paga 25€, in pari
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)
`).run(c1id, pMap['Fernanda Fischione'], 25, 0, 0, 0);

// Jeremy: paga 24€, lascia credito 2€
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)
`).run(c1id, pMap['Jeremy (Rossellino)'], 24, 0, 2, 0);

// Rachele: paga 23€, lascia credito 3€
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)
`).run(c1id, pMap['Rachele Brivio'], 23, 0, 3, 0);

// Update saldi after day 1
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(5, '2025-10-20', pMap['Alessandra Solimene']);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(0, '2025-10-20', pMap['Fernanda Fischione']);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(2, '2025-10-20', pMap['Jeremy (Rossellino)']);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(3, '2025-10-20', pMap['Rachele Brivio']);

console.log('  • Alessandra: paga 25€, lascia credito 5€ → saldo: +5€');
console.log('  • Fernanda: paga 25€, in pari → saldo: 0€');
console.log('  • Jeremy: paga 24€, lascia credito 2€ → saldo: +2€');
console.log('  • Rachele: paga 23€, lascia credito 3€ → saldo: +3€');
console.log('  • Trovato: 0€, Pagato produttore: 87€, Lasciato: 10€');

// ==== GIORNO 2: 2025-10-21 ====
console.log('\n📅 Day 2: 2025-10-21');

const consegna2 = db.prepare(`
  INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa, note, discrepanza_cassa, discrepanza_trovata, discrepanza_pagato)
  VALUES (?, ?, ?, ?, ?, 0, 0, 0)
`).run('2025-10-21', 10, 92, 6, 'Seconda consegna di test');

const c2id = consegna2.lastInsertRowid;

// Alessandra: usa credito 3€, paga 25€, in pari (saldo: 5 - 3 = 2)
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?)
`).run(c2id, pMap['Alessandra Solimene'], 25, 3, 0, 0, 'Usa parte del credito');

// Fernanda: paga 25€, lascia debito 8€ (saldo: 0 - 8 = -8)
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)
`).run(c2id, pMap['Fernanda Fischione'], 25, 0, 0, 8);

// Jeremy: paga 22€, usa intero credito 2€, in pari (saldo: 2 - 2 = 0)
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?)
`).run(c2id, pMap['Jeremy (Rossellino)'], 22, 2, 0, 0, 'Usa tutto il credito');

// Rachele: paga 22€, usa credito 1€, in pari (saldo: 3 - 1 = 2)
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)
`).run(c2id, pMap['Rachele Brivio'], 22, 1, 0, 0);

// Update saldi after day 2
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(2, '2025-10-21', pMap['Alessandra Solimene']);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(-8, '2025-10-21', pMap['Fernanda Fischione']);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(0, '2025-10-21', pMap['Jeremy (Rossellino)']);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(2, '2025-10-21', pMap['Rachele Brivio']);

console.log('  • Alessandra: paga 25€, usa credito 3€, in pari → saldo: +2€');
console.log('  • Fernanda: paga 25€, lascia debito 8€ → saldo: -8€');
console.log('  • Jeremy: paga 22€, usa intero credito 2€, in pari → saldo: 0€');
console.log('  • Rachele: paga 22€, usa credito 1€, in pari → saldo: +2€');
console.log('  • Trovato: 10€, Pagato produttore: 92€, Lasciato: 6€');

console.log('\n✅ Test data created successfully!');
console.log('\nFinal balances:');
console.log('  • Alessandra: +2€');
console.log('  • Fernanda: -8€');
console.log('  • Jeremy: 0€');
console.log('  • Rachele: +2€');

db.close();
