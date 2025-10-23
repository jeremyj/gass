const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use same logic as database.js
const dbDir = fs.existsSync('/app/data') ? '/app/data' : __dirname;
const db = new Database(path.join(dbDir, 'gass.db'));

db.pragma('foreign_keys = ON');

console.log('🗑️  Clearing database data...');

// Clear movimenti and consegne, keep partecipanti
db.exec(`
  DELETE FROM movimenti;
  DELETE FROM consegne;
`);

// Reset all participant balances to 0
db.prepare('UPDATE partecipanti SET saldo = 0, ultima_modifica = NULL').run();

// Create initial consegna with 100€ left in cassa (dated yesterday)
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = yesterday.toISOString().split('T')[0];

db.prepare(`
  INSERT INTO consegne (data, trovato_in_cassa, pagato_produttore, lasciato_in_cassa, note, discrepanza_cassa, discrepanza_trovata, discrepanza_pagato)
  VALUES (?, ?, ?, ?, ?, 0, 0, 0)
`).run(yesterdayStr, 0, 0, 100, 'Inizializzazione: 100€ lasciati in cassa');

console.log('✅ Database reset complete!');

// Show current participants
const participants = db.prepare('SELECT nome, saldo FROM partecipanti ORDER BY nome').all();
console.log('\n👥 Partecipanti:');
participants.forEach(p => {
  console.log(`  • ${p.nome}: ${p.saldo}€`);
});

console.log('\n💰 Prossima consegna troverà 100€ in cassa');

db.close();
