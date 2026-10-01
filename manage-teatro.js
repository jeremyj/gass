#!/usr/bin/env node
/**
 * Quota teatro utility
 *
 * Commands:
 *   import <file.csv>  - Load the old sheet. Header: username;2024-1;2024-2;...;nota
 *                        then one line per person. A number = owed and paid that amount
 *                        (0 = non dovuto), '-' or empty = not in the GASS that semester.
 *                        Imported payments stay out of the cassa teatro.
 *   list               - Show each person's quota situation
 *
 * Docker usage:
 *   docker cp teatro.csv gass:/app/data/teatro.csv
 *   docker exec gass node manage-teatro.js import /app/data/teatro.csv
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const T = require('./server/services/teatro');
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
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  if (!lines.length) {
    console.error('Error: empty file');
    process.exit(1);
  }
  const header = lines.shift().split(';').map(s => s.trim());
  const notaCol = header.findIndex(h => /^nota$/i.test(h));
  const semestri = header.slice(1, notaCol === -1 ? undefined : notaCol);
  const rows = lines.map(l => {
    const cells = l.split(';');
    return {
      username: (cells[0] || '').trim(),
      valori: semestri.map((_, i) => cells[i + 1]),
      nota: notaCol === -1 ? undefined : (cells[notaCol] || '').trim()
    };
  });
  const result = T.importFoglio(db, semestri, rows);
  if (result.error) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }
  console.log(`✓ Imported ${result.imported} person(s), semesters ${semestri.join(', ')}`);
  T.ensureSemestre(db, toLocalDateString());
} else if (cmd === 'list') {
  T.ensureSemestre(db, toLocalDateString());
  const { semestri, persone, saldo } = T.riepilogo(db);
  console.log(`${'gassista'.padEnd(30)}${semestri.map(s => s.semestre.padStart(9)).join('')}   situazione`);
  for (const p of persone) {
    const cells = semestri.map(s => {
      const r = p.righe.find(x => x.semestre === s.semestre);
      return (!r ? '-' : r.dovuto === 0 ? '0' : r.pagato >= r.dovuto ? String(r.pagato) : `${r.pagato}/${r.dovuto}`).padStart(9);
    }).join('');
    const sit = p.residuo > 0 ? `da pagare ${p.residuo} €` : p.anticipo > 0 ? `anticipo ${p.anticipo} €` : 'in regola';
    console.log(`${p.nome.slice(0, 29).padEnd(30)}${cells}   ${sit}`);
  }
  console.log(`\nCassa teatro: ${saldo} €`);
} else {
  console.log('Usage: node manage-teatro.js import <file.csv> | list');
  process.exit(cmd ? 1 : 0);
}
