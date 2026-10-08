// Receipt photos (scontrini) of a person in a consegna. Rows in table `scontrini`, JPEG files
// on the data volume: <dir>/<consegna_id>/<file>.jpg and <file>_t.jpg (thumbnail).
// The browser already shrinks the photo (public/js/shared/scontrini.js); here we only check it.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_FOTO_PERSONA = 3;
const MAX_FOTO_BYTES = 1.5 * 1024 * 1024;
const MAX_THUMB_BYTES = 100 * 1024;

// Never inside the app folder in Docker: /app/data is the volume
function scontriniDir() {
  if (process.env.SCONTRINI_DIR) return process.env.SCONTRINI_DIR;
  return fs.existsSync('/app/data') ? '/app/data/scontrini' : path.join(__dirname, '..', '..', 'data-scontrini');
}

function fileFoto(row, thumb = false) {
  return path.join(scontriniDir(), String(row.consegna_id), `${row.file}${thumb ? '_t' : ''}.jpg`);
}

// Base64 → Buffer, or null unless it is a JPEG (FF D8 FF) of at most max bytes
function decodeJpeg(b64, max) {
  if (typeof b64 !== 'string') return null;
  const buf = Buffer.from(b64.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
  if (buf.length < 3 || buf.length > max || buf[0] !== 0xFF || buf[1] !== 0xD8 || buf[2] !== 0xFF) return null;
  return buf;
}

function listScontrini(db, consegnaId) {
  return db.prepare(`
    SELECT s.id, s.partecipante_id, p.display_name AS nome, s.created_by, a.display_name AS autore,
           s.created_at, s.larghezza, s.altezza
    FROM scontrini s
    JOIN users p ON p.id = s.partecipante_id
    LEFT JOIN users a ON a.id = s.created_by
    WHERE s.consegna_id = ?
    ORDER BY s.id
  `).all(consegnaId);
}

function contaPerPersona(db, consegnaId, partecipanteId) {
  return db.prepare('SELECT COUNT(*) AS n FROM scontrini WHERE consegna_id = ? AND partecipante_id = ?')
    .get(consegnaId, partecipanteId).n;
}

// Files first, then the row; a failed insert leaves no file behind
function salvaScontrino(db, { consegnaId, partecipanteId, foto, thumb, larghezza, altezza }, audit) {
  const row = { consegna_id: consegnaId, file: crypto.randomUUID() };
  fs.mkdirSync(path.dirname(fileFoto(row)), { recursive: true });
  fs.writeFileSync(fileFoto(row), foto);
  fs.writeFileSync(fileFoto(row, true), thumb);
  try {
    const dim = v => (Number.isInteger(v) && v > 0 ? v : null);
    return db.prepare(`
      INSERT INTO scontrini (consegna_id, partecipante_id, file, larghezza, altezza, byte, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(consegnaId, partecipanteId, row.file, dim(larghezza), dim(altezza), foto.length,
           audit.created_by, audit.created_at).lastInsertRowid;
  } catch (err) {
    rimuoviFile(row);
    throw err;
  }
}

function rimuoviFile(row) {
  fs.rmSync(fileFoto(row), { force: true });
  fs.rmSync(fileFoto(row, true), { force: true });
}

function rimuoviScontrino(db, row) {
  db.prepare('DELETE FROM scontrini WHERE id = ?').run(row.id);
  rimuoviFile(row);
}

// The rows go with the consegna (CASCADE); the files are removed here
function rimuoviScontriniConsegna(consegnaId) {
  fs.rmSync(path.join(scontriniDir(), String(consegnaId)), { recursive: true, force: true });
}

// Before deleting a user: their photos' rows go by CASCADE, the files are removed here
function rimuoviScontriniUtente(db, userId) {
  db.prepare('SELECT consegna_id, file FROM scontrini WHERE partecipante_id = ?').all(userId).forEach(rimuoviFile);
}

module.exports = {
  MAX_FOTO_PERSONA, MAX_FOTO_BYTES, MAX_THUMB_BYTES,
  scontriniDir, fileFoto, decodeJpeg, listScontrini, contaPerPersona,
  salvaScontrino, rimuoviScontrino, rimuoviScontriniConsegna, rimuoviScontriniUtente
};
