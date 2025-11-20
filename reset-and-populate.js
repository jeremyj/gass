const Database = require('better-sqlite3');
const db = new Database('./gass.db');

console.log('🗑️  Svuotamento database...\n');

// Delete all data
db.prepare('DELETE FROM movimenti').run();
db.prepare('DELETE FROM consegne').run();
db.prepare('DELETE FROM partecipanti').run();

console.log('✓ Database svuotato\n');

console.log('👥 Creazione partecipanti...\n');

// Insert participants
const participants = [
  { nome: 'Alessandra Solimene', saldo: 0, ultima_modifica: null },
  { nome: 'Fernanda Fischione', saldo: 0, ultima_modifica: null },
  { nome: 'Jeremy (Rossellino)', saldo: 0, ultima_modifica: null },
  { nome: 'Rachele Brivio', saldo: 0, ultima_modifica: null }
];

participants.forEach(p => {
  db.prepare('INSERT INTO partecipanti (nome, saldo, ultima_modifica) VALUES (?, ?, ?)')
    .run(p.nome, p.saldo, p.ultima_modifica);
  console.log(`✓ ${p.nome}`);
});

// Get participant IDs
const getParticipant = (nome) => db.prepare('SELECT * FROM partecipanti WHERE nome = ?').get(nome);

console.log('\n📦 Creazione consegne di test...\n');

// CONSEGNA 1: 20/10/2025 - Inizializzazione
// - Trovato: 100€ (inizializzazione)
// - Alessandra: paga 20€ e lascia 5€ di credito
// - Fernanda: paga 15€
console.log('📅 Consegna 1: 20/10/2025 - Inizializzazione');
const consegna1 = db.prepare(`
  INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa, discrepanza_cassa, discrepanza_trovata, discrepanza_pagato, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run('2025-10-20', 100, 35, 80, 0, 0, 0, 'Inizializzazione: 100€ in cassa');

const alessandra = getParticipant('Alessandra Solimene');
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, salda_tutto, importo_saldato, usa_credito, debito_lasciato, credito_lasciato, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(consegna1.lastInsertRowid, alessandra.id, 0, 20, 0, 0, 5, 0, 0, '');

const fernanda = getParticipant('Fernanda Fischione');
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, salda_tutto, importo_saldato, usa_credito, debito_lasciato, credito_lasciato, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(consegna1.lastInsertRowid, fernanda.id, 0, 15, 0, 0, 0, 0, 0, '');

// Update saldi
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(5, '2025-10-20', alessandra.id);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(0, '2025-10-20', fernanda.id);

console.log('  ✓ Alessandra: +5€ credito');
console.log('  ✓ Fernanda: in pari\n');

// CONSEGNA 2: 21/10/2025 - Test usa credito e crea debito
// - Trovato: 80€ (dalla precedente)
// - Alessandra: usa 3€ di credito, lascia 2€ di credito
// - Jeremy: paga 25€ ma lascia 5€ di debito
console.log('📅 Consegna 2: 21/10/2025 - Usa credito e crea debito');
const consegna2 = db.prepare(`
  INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa, discrepanza_cassa, discrepanza_trovata, discrepanza_pagato, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run('2025-10-21', 80, 22, 83, 0, 0, 0, '');

db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, salda_tutto, importo_saldato, usa_credito, debito_lasciato, credito_lasciato, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(consegna2.lastInsertRowid, alessandra.id, 0, 25, 3, 0, 0, 0, 0, 'Usa parte del credito');

const jeremy = getParticipant('Jeremy (Rossellino)');
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, salda_tutto, importo_saldato, usa_credito, debito_lasciato, credito_lasciato, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(consegna2.lastInsertRowid, jeremy.id, 0, 25, 0, 5, 0, 0, 0, 'Non paga tutto');

// Update saldi: Alessandra 5-3=2, Jeremy 0-5=-5
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(2, '2025-10-21', alessandra.id);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(-5, '2025-10-21', jeremy.id);

console.log('  ✓ Alessandra: 5€ - 3€ (usa credito) = 2€ credito');
console.log('  ✓ Jeremy: -5€ debito\n');

// CONSEGNA 3: 22/10/2025 - Salda parzialmente debito
// - Trovato: 83€
// - Jeremy: paga 30€ e salda 3€ del debito, lascia ancora 2€ di debito
// - Rachele: paga 20€ ma lascia 8€ di debito
console.log('📅 Consegna 3: 22/10/2025 - Salda parzialmente debito');
const consegna3 = db.prepare(`
  INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa, discrepanza_cassa, discrepanza_trovata, discrepanza_pagato, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run('2025-10-22', 83, 50, 53, 0, 0, 0, '');

db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, salda_tutto, importo_saldato, usa_credito, debito_lasciato, credito_lasciato, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(consegna3.lastInsertRowid, jeremy.id, 0, 30, 0, 2, 0, 0, 3, 'Salda parte del debito');

const rachele = getParticipant('Rachele Brivio');
db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, salda_tutto, importo_saldato, usa_credito, debito_lasciato, credito_lasciato, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(consegna3.lastInsertRowid, rachele.id, 0, 20, 0, 8, 0, 0, 0, 'Pagamento incompleto');

// Update saldi: Jeremy -5+3-2=-4, Rachele 0-8=-8
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(-4, '2025-10-22', jeremy.id);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(-8, '2025-10-22', rachele.id);

console.log('  ✓ Jeremy: -5€ + 3€ (salda) - 2€ (debito) = -4€ debito');
console.log('  ✓ Rachele: -8€ debito\n');

// CONSEGNA 4: 23/10/2025 (OGGI) - Test completo: usa intero credito, salda tutto debito, credito/debito incrociati
// - Trovato: 53€
// - Alessandra: usa intero credito (2€) per pagare, lascia 3€ di nuovo credito
// - Jeremy: salda tutto il debito (4€) e paga normalmente
// - Fernanda: paga 18€ e lascia 2€ di credito
// - Rachele: paga 15€ e lascia ancora 3€ di debito (parziale)
console.log('📅 Consegna 4: 23/10/2025 (OGGI) - Test completo');
const today = new Date().toISOString().split('T')[0];
const consegna4 = db.prepare(`
  INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa, discrepanza_cassa, discrepanza_trovata, discrepanza_pagato, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(today, 53, 52, 51, 0, 0, 0, 'Test completo: tutti i casi');

db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, salda_tutto, importo_saldato, usa_credito, debito_lasciato, credito_lasciato, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(consegna4.lastInsertRowid, alessandra.id, 0, 18, 2, 0, 3, 0, 0, 'Usa intero credito + nuovo credito');

db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, salda_tutto, importo_saldato, usa_credito, debito_lasciato, credito_lasciato, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(consegna4.lastInsertRowid, jeremy.id, 0, 24, 0, 0, 0, 0, 4, 'Salda tutto il debito');

db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, salda_tutto, importo_saldato, usa_credito, debito_lasciato, credito_lasciato, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(consegna4.lastInsertRowid, fernanda.id, 0, 18, 0, 0, 2, 0, 0, 'Lascia credito');

db.prepare(`
  INSERT INTO movimenti (consegna_id, partecipante_id, salda_tutto, importo_saldato, usa_credito, debito_lasciato, credito_lasciato, salda_debito_totale, debito_saldato, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(consegna4.lastInsertRowid, rachele.id, 0, 15, 0, 3, 0, 0, 5, 'Salda parte + nuovo debito');

// Update saldi:
// Alessandra: 2-2+3=3
// Jeremy: -4+4=0
// Fernanda: 0+2=2
// Rachele: -8+5-3=-6
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(3, today, alessandra.id);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(0, today, jeremy.id);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(2, today, fernanda.id);
db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
  .run(-6, today, rachele.id);

console.log('  ✓ Alessandra: 2€ - 2€ (usa tutto) + 3€ (nuovo credito) = 3€ credito');
console.log('  ✓ Jeremy: -4€ + 4€ (salda tutto) = 0€ in pari');
console.log('  ✓ Fernanda: 0€ + 2€ (credito) = 2€ credito');
console.log('  ✓ Rachele: -8€ + 5€ (salda) - 3€ (debito) = -6€ debito\n');

console.log('✅ Database popolato con successo!\n');
console.log('📊 Riepilogo saldi finali:');
const finalParticipants = db.prepare('SELECT nome, saldo, ultima_modifica FROM partecipanti ORDER BY nome').all();
finalParticipants.forEach(p => {
  const saldoStr = p.saldo > 0 ? `+${p.saldo.toFixed(2)}€ (credito)` : p.saldo < 0 ? `${p.saldo.toFixed(2)}€ (debito)` : '0.00€ (in pari)';
  console.log(`  ${p.nome}: ${saldoStr} - ultimo movimento: ${p.ultima_modifica || 'mai'}`);
});

db.close();
