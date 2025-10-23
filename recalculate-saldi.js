const Database = require('better-sqlite3');
const db = new Database('./gass.db');

console.log('🔄 Ricalcolo saldi da movimenti...\n');

// Get all participants
const participants = db.prepare('SELECT id, nome FROM partecipanti ORDER BY nome').all();

participants.forEach(p => {
  // Get all movimenti for this participant, ordered by date
  const movimenti = db.prepare(`
    SELECT m.*, c.data
    FROM movimenti m
    JOIN consegne c ON m.consegna_id = c.id
    WHERE m.partecipante_id = ?
    ORDER BY c.data
  `).all(p.id);

  let saldo = 0;
  let lastDate = null;

  movimenti.forEach(m => {
    // Calculate saldo change from this movimento
    // saldo += credito_lasciato - debito_lasciato - usa_credito + debito_saldato
    const change = (m.credito_lasciato || 0)
                 - (m.debito_lasciato || 0)
                 - (m.usa_credito || 0)
                 + (m.debito_saldato || 0);

    saldo += change;
    lastDate = m.data;

    console.log(`  ${p.nome} - ${m.data}: credito=${m.credito_lasciato} debito=${m.debito_lasciato} usa=${m.usa_credito} salda=${m.debito_saldato} → saldo=${saldo.toFixed(2)}`);
  });

  // Get current saldo from DB
  const currentParticipant = db.prepare('SELECT saldo, ultima_modifica FROM partecipanti WHERE id = ?').get(p.id);

  if (currentParticipant.saldo !== saldo || currentParticipant.ultima_modifica !== lastDate) {
    console.log(`\n✏️  Aggiorno ${p.nome}:`);
    console.log(`   Vecchio: saldo=${currentParticipant.saldo}, ultima_modifica=${currentParticipant.ultima_modifica}`);
    console.log(`   Nuovo:   saldo=${saldo.toFixed(2)}, ultima_modifica=${lastDate}`);

    // Update participant with correct saldo
    db.prepare('UPDATE partecipanti SET saldo = ?, ultima_modifica = ? WHERE id = ?')
      .run(saldo, lastDate, p.id);

    console.log('   ✅ Aggiornato!\n');
  } else {
    console.log(`\n✓ ${p.nome}: saldo corretto (${saldo.toFixed(2)})\n`);
  }
});

console.log('\n✅ Ricalcolo completato!');

db.close();
