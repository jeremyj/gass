'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { createDatabase } = require('../../server/config/database');

describe('users.stato migration', () => {
  it('turns attivo = 0 into disattivato and drops attivo', () => {
    const file = path.join(os.tmpdir(), `gass-stato-${process.pid}.db`);
    fs.rmSync(file, { force: true });
    const old = new Database(file);
    old.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, display_name TEXT NOT NULL, saldo REAL DEFAULT 0, ultima_modifica DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, is_admin INTEGER DEFAULT 0, attivo INTEGER NOT NULL DEFAULT 1)`);
    old.prepare("INSERT INTO users (username, password_hash, display_name, is_admin) VALUES ('a', 'x', 'A', 1)").run();
    old.prepare("INSERT INTO users (username, password_hash, display_name, attivo) VALUES ('b', 'x', 'B', 0)").run();
    old.close();

    const db = createDatabase(file);
    const rows = db.prepare('SELECT username, stato FROM users ORDER BY id').all();
    expect(rows).toEqual([{ username: 'a', stato: 'attivo' }, { username: 'b', stato: 'disattivato' }]);
    const cols = db.prepare("SELECT name FROM pragma_table_info('users')").all().map(c => c.name);
    expect(cols).not.toContain('attivo');
    expect(cols).toContain('turni_dal');
    db.close();
    fs.rmSync(file, { force: true });
  });

  it('rejects an unknown stato', () => {
    const db = createDatabase(':memory:');
    expect(() => db.prepare("UPDATE users SET stato = 'boh'").run()).toThrow(/CHECK/);
  });
});
