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
  DELETE FROM partecipanti;
`);

console.log('✓ Database cleared');

// Recreate participants starting from zero
const insert = db.prepare('INSERT INTO partecipanti (nome, saldo, ultima_modifica) VALUES (?, 0, NULL)');
const participantNames = [
  'Alessandra Solimene',
  'Fernanda Fischione',
  'Jeremy (Rossellino)',
  'Rachele Brivio'
];

participantNames.forEach(name => insert.run(name));

// Get participant IDs
const participants = db.prepare('SELECT id, nome FROM partecipanti ORDER BY nome').all();
const pMap = {};
participants.forEach(p => {
  pMap[p.nome] = p.id;
});

console.log('📦 Creating test data for 2 days...');

// ==== GIORNO 1: 2025-10-20 ====
// Tutti partono da saldo 0
console.log('\n📅 Day 1: 2025-10-20');

// Calcoli:
// Alessandra: paga 30€, lascia credito 5€ → conto produttore = 30-5 = 25€
// Fernanda: paga 28€, lascia debito 3€ → conto produttore = 28+3 = 31€
// Jeremy: paga 25€, in pari → conto produttore = 25€
// Rachele: paga 22€, lascia credito 2€ → conto produttore = 22-2 = 20€
// Pagato produttore = 25 + 31 + 25 + 20 = 101€
// Incassato = importo_saldato + debito_saldato + credito_lasciato
// Incassato = (30+28+25+22) + 0 + (5+0+0+2) = 105 + 0 + 7 = 112€
// Lasciato = Trovato(0) + Incassato(112) - Pagato(101) = 11€

const consegna1 = db.prepare(`
  INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa, note, discrepanza_cassa, discrepanza_trovata, discrepanza_pagato)
  VALUES (?, ?, ?, ?, ?, 0, 0, 0)
`).run('2025-10-20', 0, 101, 11, 'Prima consegna di test');

const c1id = consegna1.lastInsertRowid;

// Alessandra: paga 30€, lascia credito 5€
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?)
`).run(c1id, pMap['Alessandra Solimene'], 30, 0, 5, 0, 'Primo movimento');

// Fernanda: paga 28€, lascia debito 3€
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)
`).run(c1id, pMap['Fernanda Fischione'], 28, 0, 0, 3);

// Jeremy: paga 25€, in pari
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)
`).run(c1id, pMap['Jeremy (Rossellino)'], 25, 0, 0, 0);

// Rachele: paga 22€, lascia credito 2€
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)
`).run(c1id, pMap['Rachele Brivio'], 22, 0, 2, 0);

// Update saldi after day 1
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(5, '2025-10-20', pMap['Alessandra Solimene']);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(-3, '2025-10-20', pMap['Fernanda Fischione']);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(0, '2025-10-20', pMap['Jeremy (Rossellino)']);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(2, '2025-10-20', pMap['Rachele Brivio']);

console.log('  • Alessandra: paga 30€, lascia credito 5€ (conto produttore: 25€) → saldo: +5€');
console.log('  • Fernanda: paga 28€, lascia debito 3€ (conto produttore: 31€) → saldo: -3€');
console.log('  • Jeremy: paga 25€, in pari (conto produttore: 25€) → saldo: 0€');
console.log('  • Rachele: paga 22€, lascia credito 2€ (conto produttore: 20€) → saldo: +2€');
console.log('  • Trovato: 0€, Pagato produttore: 101€, Incassato: 112€, Lasciato: 11€');

// ==== GIORNO 2: 2025-10-21 ====
console.log('\n📅 Day 2: 2025-10-21');

// Calcoli:
// Alessandra (saldo +5): paga 20€, usa credito 3€ → conto produttore = 20+3 = 23€, saldo = 5-3 = +2€
// Fernanda (saldo -3): paga 28€, salda debito 3€ → conto produttore = 28€, saldo = -3+3 = 0€
// Jeremy (saldo 0): paga 24€, lascia debito 1€ → conto produttore = 24+1 = 25€, saldo = 0-1 = -1€
// Rachele (saldo +2): paga 22€, usa credito 2€, lascia credito 1€ → conto produttore = 22+2-1 = 23€, saldo = 2-2+1 = +1€
// Pagato produttore = 23 + 28 + 25 + 23 = 99€
// Incassato = importo_saldato + debito_saldato + credito_lasciato
// Incassato = (20+28+24+22) + 3 + (0+0+0+1) = 94 + 3 + 1 = 98€
// Lasciato = Trovato(11) + Incassato(98) - Pagato(99) = 10€

const consegna2 = db.prepare(`
  INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa, note, discrepanza_cassa, discrepanza_trovata, discrepanza_pagato)
  VALUES (?, ?, ?, ?, ?, 0, 0, 0)
`).run('2025-10-21', 11, 99, 10, 'Seconda consegna di test');

const c2id = consegna2.lastInsertRowid;

// Alessandra: paga 20€, usa credito 3€
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?)
`).run(c2id, pMap['Alessandra Solimene'], 20, 3, 0, 0, 'Usa parte del credito');

// Fernanda: paga 28€, salda debito 3€
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 3)
`).run(c2id, pMap['Fernanda Fischione'], 28, 0, 0, 0);

// Jeremy: paga 24€, lascia debito 1€
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?)
`).run(c2id, pMap['Jeremy (Rossellino)'], 24, 0, 0, 1, 'Lascia un piccolo debito');

// Rachele: paga 22€, usa credito 2€, lascia credito 1€
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, importo_saldato, usa_credito, credito_lasciato, debito_lasciato, salda_tutto, salda_debito_totale, debito_saldato)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)
`).run(c2id, pMap['Rachele Brivio'], 22, 2, 1, 0);

// Update saldi after day 2
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(2, '2025-10-21', pMap['Alessandra Solimene']);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(0, '2025-10-21', pMap['Fernanda Fischione']);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(-1, '2025-10-21', pMap['Jeremy (Rossellino)']);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(1, '2025-10-21', pMap['Rachele Brivio']);

console.log('  • Alessandra: paga 20€, usa credito 3€ (conto produttore: 23€) → saldo: +2€');
console.log('  • Fernanda: paga 28€, salda debito 3€ (conto produttore: 28€) → saldo: 0€');
console.log('  • Jeremy: paga 24€, lascia debito 1€ (conto produttore: 25€) → saldo: -1€');
console.log('  • Rachele: paga 22€, usa credito 2€, lascia credito 1€ (conto produttore: 23€) → saldo: +1€');
console.log('  • Trovato: 11€, Pagato produttore: 99€, Incassato: 98€, Lasciato: 10€');

console.log('\n✅ Test data created successfully!');
console.log('\nFinal balances:');
console.log('  • Alessandra: +2€');
console.log('  • Fernanda: 0€');
console.log('  • Jeremy: -1€');
console.log('  • Rachele: +1€');

db.close();
