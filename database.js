const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use /app/data for Docker volume, or current directory for local dev
const dbDir = fs.existsSync('/app/data') ? '/app/data' : __dirname;
const db = new Database(path.join(dbDir, 'gass.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS partecipanti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL,
    saldo REAL DEFAULT 0,
    ultima_modifica DATE
  );

  CREATE TABLE IF NOT EXISTS consegne (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data DATE NOT NULL,
    trovato_in_cassa REAL DEFAULT 0,
    pagato_produttore REAL DEFAULT 0,
    lasciato_in_cassa REAL DEFAULT 0,
    discrepanza_cassa BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS movimenti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consegna_id INTEGER NOT NULL,
    partecipante_id INTEGER NOT NULL,
    salda_tutto BOOLEAN DEFAULT 0,
    importo_saldato REAL DEFAULT 0,
    usa_credito REAL DEFAULT 0,
    debito_lasciato REAL DEFAULT 0,
    credito_lasciato REAL DEFAULT 0,
    salda_debito_totale BOOLEAN DEFAULT 0,
    debito_saldato REAL DEFAULT 0,
    note TEXT,
    FOREIGN KEY (consegna_id) REFERENCES consegne(id) ON DELETE CASCADE,
    FOREIGN KEY (partecipante_id) REFERENCES partecipanti(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_consegne_data ON consegne(data);
  CREATE INDEX IF NOT EXISTS idx_movimenti_consegna ON movimenti(consegna_id);
  CREATE INDEX IF NOT EXISTS idx_movimenti_partecipante ON movimenti(partecipante_id);
`);

// Initialize with participants list
const count = db.prepare('SELECT COUNT(*) as count FROM partecipanti').get().count;
if (count === 0) {
  const insert = db.prepare('INSERT INTO partecipanti (nome, saldo) VALUES (?, ?)');
  const participants = [
    'Alessandra Solimene',
    'Fernanda Fischione',
    'Jeremy (Rossellino)',
    'Rachele Brivio'
  ];

  participants.forEach(name => {
    insert.run(name, 0);
  });

  console.log(`Initialized database with ${participants.length} participants`);
}

module.exports = db;
