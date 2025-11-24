const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use /app/data for Docker volume, or project root for local dev
const projectRoot = path.join(__dirname, '../..');
const dbDir = fs.existsSync('/app/data') ? '/app/data' : projectRoot;
const dbPath = path.join(dbDir, 'gass.db');
const dbExists = fs.existsSync(dbPath);
const db = new Database(dbPath);

console.log('\n=== Database Initialization ===');
console.log(`Path: ${dbPath}`);
console.log(`Mode: ${dbExists ? 'Existing database' : 'New database'}`);
console.log(`Environment: ${fs.existsSync('/app/data') ? 'Docker' : 'Local'}`);

// Enable foreign keys
db.pragma('foreign_keys = ON');
console.log('Foreign keys: ENABLED');

// Create tables
console.log('\n--- Creating base tables ---');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

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
console.log('Base tables created/verified');

console.log('\n--- Running schema migrations ---');

// Add note column to consegne if it doesn't exist
try {
  db.exec(`ALTER TABLE consegne ADD COLUMN note TEXT`);
  console.log('[MIGRATION] Added note column to consegne table');
} catch (err) {
  // Column already exists, ignore
  if (!err.message.includes('duplicate column')) {
    throw err;
  }
}

// Add discrepanza_trovata column if it doesn't exist
try {
  db.exec(`ALTER TABLE consegne ADD COLUMN discrepanza_trovata BOOLEAN DEFAULT 0`);
  console.log('[MIGRATION] Added discrepanza_trovata column to consegne table');
} catch (err) {
  if (!err.message.includes('duplicate column')) {
    throw err;
  }
}

// Add discrepanza_pagato column if it doesn't exist
try {
  db.exec(`ALTER TABLE consegne ADD COLUMN discrepanza_pagato BOOLEAN DEFAULT 0`);
  console.log('[MIGRATION] Added discrepanza_pagato column to consegne table');
} catch (err) {
  if (!err.message.includes('duplicate column')) {
    throw err;
  }
}

// Add conto_produttore column to movimenti if it doesn't exist
try {
  db.exec(`ALTER TABLE movimenti ADD COLUMN conto_produttore REAL DEFAULT 0`);
  console.log('[MIGRATION] Added conto_produttore column to movimenti table');
} catch (err) {
  if (!err.message.includes('duplicate column')) {
    throw err;
  }
}

// Add user_id column to consegne if it doesn't exist
try {
  db.exec(`ALTER TABLE consegne ADD COLUMN user_id INTEGER REFERENCES users(id)`);
  console.log('[MIGRATION] Added user_id column to consegne table');
} catch (err) {
  if (!err.message.includes('duplicate column')) {
    throw err;
  }
}

// Add updated_by column to consegne if it doesn't exist
try {
  db.exec(`ALTER TABLE consegne ADD COLUMN updated_by INTEGER REFERENCES users(id)`);
  console.log('[MIGRATION] Added updated_by column to consegne table');
} catch (err) {
  if (!err.message.includes('duplicate column')) {
    throw err;
  }
}

// Add user_id column to movimenti if it doesn't exist
try {
  db.exec(`ALTER TABLE movimenti ADD COLUMN user_id INTEGER REFERENCES users(id)`);
  console.log('[MIGRATION] Added user_id column to movimenti table');
} catch (err) {
  if (!err.message.includes('duplicate column')) {
    throw err;
  }
}

// Add updated_by column to movimenti if it doesn't exist
try {
  db.exec(`ALTER TABLE movimenti ADD COLUMN updated_by INTEGER REFERENCES users(id)`);
  console.log('[MIGRATION] Added updated_by column to movimenti table');
} catch (err) {
  if (!err.message.includes('duplicate column')) {
    throw err;
  }
}

console.log('\n--- Audit tracking migration (v1.4) ---');

// Users table audit columns
try {
  db.exec(`ALTER TABLE users ADD COLUMN created_by INTEGER REFERENCES users(id)`);
  console.log('[AUDIT] Added created_by column to users table');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

try {
  db.exec(`ALTER TABLE users ADD COLUMN updated_by INTEGER REFERENCES users(id)`);
  console.log('[AUDIT] Added updated_by column to users table');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

try {
  db.exec(`ALTER TABLE users ADD COLUMN updated_at DATETIME`);
  console.log('[AUDIT] Added updated_at column to users table');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

// Partecipanti table audit columns
try {
  db.exec(`ALTER TABLE partecipanti ADD COLUMN created_by INTEGER REFERENCES users(id)`);
  console.log('[AUDIT] Added created_by column to partecipanti table');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

try {
  db.exec(`ALTER TABLE partecipanti ADD COLUMN created_at DATETIME`);
  console.log('[AUDIT] Added created_at column to partecipanti table');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

try {
  db.exec(`ALTER TABLE partecipanti ADD COLUMN updated_by INTEGER REFERENCES users(id)`);
  console.log('[AUDIT] Added updated_by column to partecipanti table');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

try {
  db.exec(`ALTER TABLE partecipanti ADD COLUMN updated_at DATETIME`);
  console.log('[AUDIT] Added updated_at column to partecipanti table');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

// Consegne table audit columns (rename user_id to created_by conceptually, add created_at and updated_at)
try {
  db.exec(`ALTER TABLE consegne ADD COLUMN created_by INTEGER REFERENCES users(id)`);
  console.log('[AUDIT] Added created_by column to consegne table');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

try {
  db.exec(`ALTER TABLE consegne ADD COLUMN updated_at DATETIME`);
  console.log('[AUDIT] Added updated_at column to consegne table');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

// Copy user_id to created_by for existing consegne records (one-time migration)
try {
  const existingRecords = db.prepare('SELECT COUNT(*) as count FROM consegne WHERE created_by IS NULL AND user_id IS NOT NULL').get().count;
  if (existingRecords > 0) {
    db.exec(`UPDATE consegne SET created_by = user_id WHERE created_by IS NULL AND user_id IS NOT NULL`);
    console.log(`[AUDIT] Migrated ${existingRecords} consegne records: copied user_id to created_by`);
  }
} catch (err) {
  console.error('[AUDIT] Error migrating consegne user_id to created_by:', err.message);
}

// Movimenti table audit columns (rename user_id to created_by conceptually, add created_at and updated_at)
try {
  db.exec(`ALTER TABLE movimenti ADD COLUMN created_by INTEGER REFERENCES users(id)`);
  console.log('[AUDIT] Added created_by column to movimenti table');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

try {
  db.exec(`ALTER TABLE movimenti ADD COLUMN created_at DATETIME`);
  console.log('[AUDIT] Added created_at column to movimenti table');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

try {
  db.exec(`ALTER TABLE movimenti ADD COLUMN updated_at DATETIME`);
  console.log('[AUDIT] Added updated_at column to movimenti table');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

// Copy user_id to created_by for existing movimenti records (one-time migration)
try {
  const existingRecords = db.prepare('SELECT COUNT(*) as count FROM movimenti WHERE created_by IS NULL AND user_id IS NOT NULL').get().count;
  if (existingRecords > 0) {
    db.exec(`UPDATE movimenti SET created_by = user_id WHERE created_by IS NULL AND user_id IS NOT NULL`);
    console.log(`[AUDIT] Migrated ${existingRecords} movimenti records: copied user_id to created_by`);
  }
} catch (err) {
  console.error('[AUDIT] Error migrating movimenti user_id to created_by:', err.message);
}

// Create performance indexes for audit queries
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_consegne_created_by ON consegne(created_by)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_consegne_updated_by ON consegne(updated_by)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_movimenti_created_by ON movimenti(created_by)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_movimenti_updated_by ON movimenti(updated_by)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_partecipanti_updated_by ON partecipanti(updated_by)`);
  console.log('[AUDIT] Created audit tracking indexes');
} catch (err) {
  console.error('[AUDIT] Error creating audit indexes:', err.message);
}

console.log('\n--- Data initialization ---');

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

  console.log(`[INIT] Created ${participants.length} default participants`);
} else {
  console.log(`[INIT] Found ${count} existing participants`);
}

// Initialize with admin user if no users exist
const bcrypt = require('bcrypt');
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
  const passwordHash = bcrypt.hashSync('admin', 12);
  const insertUser = db.prepare('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)');
  insertUser.run('admin', passwordHash, 'Administrator');
  console.log('[INIT] Created default admin user (username: admin, password: admin)');
  console.log('[INIT] ⚠️  IMPORTANT: Change the default password immediately!');
} else {
  console.log(`[INIT] Found ${userCount} existing user(s)`);
}

// Get database statistics
const consegneCount = db.prepare('SELECT COUNT(*) as count FROM consegne').get().count;
const movimentiCount = db.prepare('SELECT COUNT(*) as count FROM movimenti').get().count;

console.log('\n--- Database statistics ---');
console.log(`Users: ${userCount}`);
console.log(`Participants: ${count}`);
console.log(`Consegne: ${consegneCount}`);
console.log(`Movimenti: ${movimentiCount}`);
console.log('\nDatabase initialization complete!\n');

module.exports = db;
