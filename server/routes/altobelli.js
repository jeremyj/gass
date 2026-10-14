/**
 * Altobelli check (experimental, admin-only): the consegna's tab of the producer's sheet
 * compared with the conti in GASS (services/altobelli.js).
 */

const express = require('express');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const A = require('../services/altobelli');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// Leonardo opens a new sheet each year and an admin pastes its link. Never hardcode it: the sheet
// is open to anyone with the link and holds members' names and amounts, and this repo is public
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

function foglioUrl() {
  return db.prepare("SELECT value FROM settings WHERE key = 'altobelli_foglio'").get()?.value || '';
}

const giorno = date => {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${A.MESI[m - 1]}`;
};

router.get('/confronto', async (req, res) => {
  const { data } = req.query;
  let gid = req.query.gid || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data))) return res.status(400).json({ success: false, error: 'Data non valida' });
  const url = foglioUrl();
  if (!url) return res.status(400).json({ success: false, error: 'Manca il link del foglio: incollalo in "Link del foglio"' });
  // No gid asked: the tab remembered for this consegna, if it is still in the sheet
  const ricordato = gid ? null : db.prepare('SELECT altobelli_gid FROM consegne WHERE data = ?').get(data)?.altobelli_gid || null;
  let letto;
  try {
    letto = await A.leggiFoglio(url, data, gid || ricordato);
  } catch (error) {
    if (ricordato && error.message === 'Scheda non trovata nel foglio') {
      try { letto = await A.leggiFoglio(url, data, null); } catch (e) { return res.status(502).json({ success: false, error: e.message, foglio: url }); }
    } else {
      return res.status(error.message === 'Scheda non trovata nel foglio' ? 404 : 502).json({ success: false, error: error.message, foglio: url });
    }
  }
  const persone = db.prepare('SELECT id, display_name AS nome FROM users ORDER BY display_name COLLATE NOCASE').all();
  const perData = A.trovaSchede(letto.schede, data);
  // schedaData: the tab chosen by date alone (the client stores null for it)
  const base = { success: true, foglio: url, schede: letto.schede, scheda: letto.scheda, schedaData: perData.length === 1 ? perData[0].gid : null, persone };
  if (!letto.scheda) {
    return res.json({ ...base, messaggio: perData.length
      ? `Più schede per il ${giorno(data)}: scegli quella da confrontare`
      : `Nel foglio non c'è una scheda per il ${giorno(data)}: scegli la scheda da confrontare` });
  }

  const movimenti = db.prepare(`
    SELECT m.partecipante_id, m.conto_produttore FROM movimenti m JOIN consegne c ON c.id = m.consegna_id WHERE c.data = ?
  `).all(data);
  const nomi = Object.fromEntries(db.prepare('SELECT nome, user_id FROM altobelli_nomi').all().map(n => [n.nome, n.user_id]));
  res.json({ ...base, ...A.confronta(letto.foglio, movimenti, nomi, persone) });
});

// The tab the admin picked for a consegna (null or '' = back to the one matching the date)
router.put('/scheda', (req, res) => {
  const { data, gid } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data))) return res.status(400).json({ success: false, error: 'Data non valida' });
  const consegna = db.prepare('SELECT id FROM consegne WHERE data = ?').get(data);
  if (!consegna) return res.status(404).json({ success: false, error: 'Consegna non trovata' });
  db.prepare('UPDATE consegne SET altobelli_gid = ? WHERE id = ?').run(gid ? String(gid) : null, consegna.id);
  res.json({ success: true });
});

router.get('/foglio', (req, res) => res.json({ success: true, url: foglioUrl() }));

router.put('/foglio', (req, res) => {
  const url = String((req.body || {}).url || '').trim();
  if (!A.foglioId(url)) return res.status(400).json({ success: false, error: 'Link del foglio non valido' });
  db.prepare("INSERT INTO settings (key, value) VALUES ('altobelli_foglio', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(url);
  res.json({ success: true });
});

// userId null removes the mapping
router.put('/nomi', (req, res) => {
  const { nome, userId } = req.body || {};
  const key = norm(nome);
  if (!key) return res.status(400).json({ success: false, error: 'Nome non valido' });
  if (userId == null) {
    db.prepare('DELETE FROM altobelli_nomi WHERE nome = ?').run(key);
    return res.json({ success: true });
  }
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) return res.status(400).json({ success: false, error: 'Persona non trovata' });
  db.prepare('INSERT INTO altobelli_nomi (nome, user_id) VALUES (?, ?) ON CONFLICT(nome) DO UPDATE SET user_id = excluded.user_id').run(key, userId);
  res.json({ success: true });
});

module.exports = router;
