#!/usr/bin/env node
/**
 * Turni utility
 *
 * Commands:
 *   import <file.csv>  - Load weeks from a CSV: data;username1;username2;nota
 *                        (replaces every week from the first date in the file)
 *   list               - Show the next 12 weeks
 *
 * Docker usage:
 *   docker cp turni.csv gass:/app/data/turni.csv
 *   docker exec gass node manage-turni.js import /app/data/turni.csv
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { importTurni, listTurni } = require('./server/services/turni');
const { toLocalDateString } = require('./server/services/calculations');

const dbDir = fs.existsSync('/app/data') ? '/app/data' : __dirname;
const dbPath = path.join(dbDir, 'gass.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Error: database not found at ${dbPath}`);
  process.exit(1);
}
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const [cmd, file] = process.argv.slice(2);

if (cmd === 'import' && file) {
  const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !/^data\b/i.test(l))
    .map(l => {
      const [data, username1, username2, nota] = l.split(';').map(s => (s || '').trim());
      return { data, username1, username2, nota };
    });
  const result = importTurni(db, rows, toLocalDateString());
  if (result.error) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }
  console.log(`✓ Imported ${result.imported} week(s)`);
  const inFile = new Set(rows.flatMap(r => [r.username1, r.username2]).filter(Boolean));
  const missing = db.prepare("SELECT username, display_name FROM users WHERE stato = 'attivo' ORDER BY username").all()
    .filter(u => !inFile.has(u.username));
  if (missing.length) {
    console.log("These attivo users are not in the file and will be scheduled first; set them sospeso if they don't do turni: node manage-users.js stato <username> sospeso");
    for (const u of missing) console.log(`  ${u.username}  ${u.display_name}`);
  }
} else if (cmd === 'list') {
  for (const t of listTurni(db, toLocalDateString())) {
    const names = t.saltata ? 'niente consegna' : t.turnisti.map(p => (p ? p.nome : 'da coprire')).join(' + ');
    console.log(`${t.data}  ${names}${t.riunione ? '  [riunione]' : ''}${t.nota ? `  (${t.nota})` : ''}`);
  }
} else {
  console.log('Usage: node manage-turni.js import <file.csv> | list');
  process.exit(cmd ? 1 : 0);
}
