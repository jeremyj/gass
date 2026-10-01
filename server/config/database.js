const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

function createDatabase(dbPath) {
  const isTest = process.env.NODE_ENV === 'test';
  const log = isTest ? () => {} : console.log;
  const bcryptRounds = isTest ? 4 : 12;

  const dbExists = dbPath !== ':memory:' && fs.existsSync(dbPath);
  const db = new Database(dbPath);

  log('\n=== Database Initialization ===');
  log(`Path: ${dbPath}`);
  log(`Mode: ${dbExists ? 'Existing database' : 'New database'}`);
  log(`Environment: ${fs.existsSync('/app/data') ? 'Docker' : 'Local'}`);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  log('Foreign keys: ENABLED');

  // Create tables
  log('\n--- Creating base tables ---');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      saldo REAL DEFAULT 0,
      ultima_modifica DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS consegne (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data DATE NOT NULL,
      trovato_in_cassa REAL DEFAULT 0,
      pagato_produttore REAL DEFAULT 0,
      lasciato_in_cassa REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS movimenti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consegna_id INTEGER NOT NULL,
      partecipante_id INTEGER NOT NULL,
      importo_saldato REAL DEFAULT 0,
      usa_credito REAL DEFAULT 0,
      debito_lasciato REAL DEFAULT 0,
      credito_lasciato REAL DEFAULT 0,
      salda_debito_totale BOOLEAN DEFAULT 0,
      debito_saldato REAL DEFAULT 0,
      note TEXT,
      FOREIGN KEY (consegna_id) REFERENCES consegne(id) ON DELETE CASCADE,
      FOREIGN KEY (partecipante_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_consegne_data ON consegne(data);
    CREATE INDEX IF NOT EXISTS idx_movimenti_consegna ON movimenti(consegna_id);
    CREATE INDEX IF NOT EXISTS idx_movimenti_partecipante ON movimenti(partecipante_id);
  `);
  log('Base tables created/verified');

  log('\n--- Running schema migrations ---');

  // Helper to safely add a column (ignores if already exists)
  function tryAddColumn(table, column, definition) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      log(`[MIGRATION] Added ${column} column to ${table} table`);
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
    }
  }

  // Helper to safely drop a column (ignores if column doesn't exist)
  function safeDropColumn(table, column) {
    try {
      db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
      log(`[CLEANUP] Dropped ${column} from ${table}`);
      return true;
    } catch (err) {
      if (err.message.includes('no such column')) {
        return false; // Already removed
      }
      throw err;
    }
  }

  tryAddColumn('consegne', 'note', 'TEXT');
  tryAddColumn('movimenti', 'conto_produttore', 'REAL DEFAULT 0');
  tryAddColumn('consegne', 'updated_by', 'INTEGER REFERENCES users(id)');
  tryAddColumn('movimenti', 'updated_by', 'INTEGER REFERENCES users(id)');

  log('\n--- Audit tracking migration (v1.4) ---');

  tryAddColumn('users', 'created_by', 'INTEGER REFERENCES users(id)');
  tryAddColumn('users', 'updated_by', 'INTEGER REFERENCES users(id)');
  tryAddColumn('users', 'updated_at', 'DATETIME');
  tryAddColumn('users', 'saldo', 'REAL DEFAULT 0');
  tryAddColumn('users', 'ultima_modifica', 'DATE');
  tryAddColumn('consegne', 'created_by', 'INTEGER REFERENCES users(id)');
  tryAddColumn('consegne', 'updated_at', 'DATETIME');
  tryAddColumn('movimenti', 'created_by', 'INTEGER REFERENCES users(id)');
  tryAddColumn('movimenti', 'created_at', 'DATETIME');
  tryAddColumn('movimenti', 'updated_at', 'DATETIME');

  // Create performance indexes for audit queries
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_consegne_created_by ON consegne(created_by)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_consegne_updated_by ON consegne(updated_by)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_movimenti_created_by ON movimenti(created_by)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_movimenti_updated_by ON movimenti(updated_by)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_updated_by ON users(updated_by)`);
    log('[AUDIT] Created audit tracking indexes');
  } catch (err) {
    if (!isTest) console.error('[AUDIT] Error creating audit indexes:', err.message);
  }

  log('\n--- Admin role migration (v1.7) ---');

  tryAddColumn('users', 'is_admin', 'INTEGER DEFAULT 0');

  log('\n--- User state (v2.17) ---');

  // attivo (0/1) becomes stato: attivo | sospeso (in GASS, no turni) | disattivato (no login, hidden)
  tryAddColumn('users', 'stato', "TEXT NOT NULL DEFAULT 'attivo' CHECK (stato IN ('attivo', 'sospeso', 'disattivato'))");
  // Day a user (re)joined the turni queue; NULL = since created_at
  tryAddColumn('users', 'turni_dal', 'DATE');
  const hasAttivo = db.prepare("SELECT 1 FROM pragma_table_info('users') WHERE name = 'attivo'").get();
  if (hasAttivo) {
    db.prepare("UPDATE users SET stato = 'disattivato' WHERE attivo = 0").run();
    safeDropColumn('users', 'attivo');
  }

  log('\n--- Chiudi consegna feature (v1.7) ---');

  tryAddColumn('consegne', 'chiusa', 'INTEGER DEFAULT 0');
  tryAddColumn('consegne', 'chiusa_by', 'INTEGER REFERENCES users(id)');
  tryAddColumn('consegne', 'chiusa_at', 'DATETIME');

  log('\n--- Reopen tracking migration (v1.9) ---');

  tryAddColumn('consegne', 'riaperta_by', 'INTEGER REFERENCES users(id)');
  tryAddColumn('consegne', 'riaperta_at', 'DATETIME');

  log('\n--- Activity logs table (v2.1) ---');

  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      target_user_id INTEGER REFERENCES users(id),
      actor_user_id INTEGER REFERENCES users(id),
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON activity_logs(event_type);
  `);
  log('[ACTIVITY] Created activity_logs table');

  tryAddColumn('activity_logs', 'consegna_id', 'INTEGER');

  // Backfill consegna_id from details field for existing rows
  try {
    const backfilled = db.prepare(`
      UPDATE activity_logs SET consegna_id = (
        SELECT c.id FROM consegne c
        WHERE activity_logs.details LIKE 'consegna: ' || c.data || ',%'
           OR activity_logs.details LIKE 'consegna: ' || c.data
      )
      WHERE consegna_id IS NULL
        AND details LIKE 'consegna: ____-__-__%'
    `).run();
    if (backfilled.changes > 0) {
      log(`[ACTIVITY] Backfilled consegna_id for ${backfilled.changes} activity_logs rows`);
    }
  } catch (err) {
    if (!isTest) console.error('[ACTIVITY] Error backfilling consegna_id:', err.message);
  }

  log('\n--- Cleanup migration (v1.8) - removing unused columns ---');

  safeDropColumn('consegne', 'user_id');
  safeDropColumn('movimenti', 'user_id');
  safeDropColumn('consegne', 'discrepanza_cassa');
  safeDropColumn('consegne', 'discrepanza_trovata');
  safeDropColumn('consegne', 'discrepanza_pagato');

  log('\n--- FK constraint fix (v1.9.3) ---');

  const movimentiSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='movimenti'").get();
  if (movimentiSchema && movimentiSchema.sql.includes('REFERENCES partecipanti')) {
    log('[FK-FIX] Detected old FK referencing partecipanti, recreating movimenti table...');

    db.pragma('foreign_keys = OFF');

    db.transaction(() => {
      db.exec(`
        CREATE TABLE movimenti_new (
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
          conto_produttore REAL DEFAULT 0,
          created_by INTEGER REFERENCES users(id),
          created_at DATETIME,
          updated_by INTEGER REFERENCES users(id),
          updated_at DATETIME,
          FOREIGN KEY (consegna_id) REFERENCES consegne(id) ON DELETE CASCADE,
          FOREIGN KEY (partecipante_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      db.exec(`
        INSERT INTO movimenti_new
        SELECT id, consegna_id, partecipante_id, salda_tutto, importo_saldato,
               usa_credito, debito_lasciato, credito_lasciato, salda_debito_totale,
               debito_saldato, note, conto_produttore, created_by, created_at,
               updated_by, updated_at
        FROM movimenti
      `);

      db.exec('DROP TABLE movimenti');
      db.exec('ALTER TABLE movimenti_new RENAME TO movimenti');

      db.exec('CREATE INDEX IF NOT EXISTS idx_movimenti_consegna ON movimenti(consegna_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_movimenti_partecipante ON movimenti(partecipante_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_movimenti_created_by ON movimenti(created_by)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_movimenti_updated_by ON movimenti(updated_by)');
    })();

    db.pragma('foreign_keys = ON');
    log('[FK-FIX] Successfully fixed movimenti FK to reference users');
  }

  // Drop legacy partecipanti table if it exists and is empty
  try {
    const partecipantiCount = db.prepare('SELECT COUNT(*) as count FROM partecipanti').get();
    if (partecipantiCount.count === 0) {
      db.exec('DROP TABLE partecipanti');
      log('[FK-FIX] Dropped empty legacy partecipanti table');
    }
  } catch (err) {
    // Table doesn't exist, ignore
  }

  log('\n--- Manual saldo corrections (v2.7) ---');

  // Admin saldo edits are stored as dated, signed corrections so the saldo can
  // always be rebuilt from movimenti + rettifiche (see server/services/saldi.js)
  db.exec(`
    CREATE TABLE IF NOT EXISTS rettifiche_saldo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partecipante_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data DATE NOT NULL,
      importo REAL NOT NULL,
      note TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_rettifiche_partecipante ON rettifiche_saldo(partecipante_id);
  `);

  // salda_tutto had no UI since 2025-10 and was never set in production
  safeDropColumn('movimenti', 'salda_tutto');

  log('\n--- Turni (v2.17) ---');

  // One row per consegna week, keyed by its Tuesday; data = real day (moved within the week)
  db.exec(`
    CREATE TABLE IF NOT EXISTS turni (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      settimana DATE NOT NULL UNIQUE,
      data DATE NOT NULL,
      turnista1_id INTEGER REFERENCES users(id),
      turnista2_id INTEGER REFERENCES users(id),
      saltata INTEGER NOT NULL DEFAULT 0,
      riunione INTEGER NOT NULL DEFAULT 0,
      nota TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME,
      updated_by INTEGER REFERENCES users(id),
      updated_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_turni_data ON turni(data);

    CREATE TABLE IF NOT EXISTS turni_pause (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dal DATE NOT NULL,
      al DATE NOT NULL,
      nota TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME
    );

    -- App switches (key/value), e.g. turni_auto = '0' pauses automatic turni
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  log('\n--- Quota teatro (v2.19) ---');

  // Rent of the theatre: a quota per semester ('2026-2'), what each person owes
  // (0 = non dovuto), payments (spread oldest first) and a separate cassa
  db.exec(`
    CREATE TABLE IF NOT EXISTS teatro_semestri (
      semestre TEXT PRIMARY KEY,
      quota REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS teatro_dovuti (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      semestre TEXT NOT NULL,
      dovuto REAL NOT NULL,
      PRIMARY KEY (user_id, semestre)
    );
    CREATE TABLE IF NOT EXISTS teatro_pagamenti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data DATE NOT NULL,
      importo REAL NOT NULL,
      consegna_id INTEGER,
      fonte TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_teatro_pagamenti_user ON teatro_pagamenti(user_id);
    CREATE TABLE IF NOT EXISTS teatro_cassa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data DATE NOT NULL,
      importo REAL NOT NULL,
      descrizione TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME
    );
  `);
  tryAddColumn('users', 'teatro_nota', 'TEXT');

  log('\n--- Data initialization ---');

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const passwordHash = bcrypt.hashSync('admin', bcryptRounds);
    const insertUser = db.prepare('INSERT INTO users (username, password_hash, display_name, is_admin, saldo) VALUES (?, ?, ?, 1, 0)');
    insertUser.run('admin', passwordHash, 'Administrator');
    log('[INIT] Created default admin user (username: admin, password: admin)');
  } else {
    log(`[INIT] Found ${userCount} existing user(s)`);

    const firstUserAdmin = db.prepare('SELECT id, is_admin FROM users ORDER BY id ASC LIMIT 1').get();
    if (firstUserAdmin && firstUserAdmin.is_admin !== 1) {
      db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(firstUserAdmin.id);
      log(`[ADMIN] Set first user (id: ${firstUserAdmin.id}) as admin`);
    }
  }

  const consegneCount = db.prepare('SELECT COUNT(*) as count FROM consegne').get().count;
  const movimentiCount = db.prepare('SELECT COUNT(*) as count FROM movimenti').get().count;

  log('\n--- Database statistics ---');
  log(`Users (participants): ${db.prepare('SELECT COUNT(*) as count FROM users').get().count}`);
  log(`Consegne: ${consegneCount}`);
  log(`Movimenti: ${movimentiCount}`);
  log('\nDatabase initialization complete!\n');

  return db;
}

// Production singleton — only created outside test environment
let db;
if (process.env.NODE_ENV !== 'test') {
  const projectRoot = path.join(__dirname, '../..');
  const dbDir = fs.existsSync('/app/data') ? '/app/data' : projectRoot;
  db = createDatabase(path.join(dbDir, 'gass.db'));
  module.exports = db;
  module.exports.createDatabase = createDatabase;
} else {
  // In test mode: export only the factory; caller patches require.cache with a real DB
  module.exports = { createDatabase };
}
