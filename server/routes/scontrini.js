const express = require('express');
const db = require('../config/database');
const { requireAuth, getAuditFields } = require('../middleware/auth');
const { logActivity } = require('../services/activity');
const { ensureConsegna } = require('../services/consegne');
const {
  MAX_FOTO_PERSONA, MAX_FOTO_BYTES, MAX_THUMB_BYTES,
  fileFoto, decodeJpeg, listScontrini, contaPerPersona, salvaScontrino, rimuoviScontrino
} = require('../services/scontrini');

const router = express.Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.use(requireAuth);

// Photos of the consegna of that date (none when it does not exist yet)
router.get('/', (req, res) => {
  const { data } = req.query;
  if (!DATE_RE.test(data || '')) return res.status(400).json({ success: false, error: 'Data non valida' });
  const consegna = db.prepare('SELECT id, chiusa FROM consegne WHERE data = ?').get(data);
  res.json({
    success: true,
    consegnaId: consegna?.id ?? null,
    chiusa: consegna?.chiusa === 1,
    max: MAX_FOTO_PERSONA,
    scontrini: consegna ? listScontrini(db, consegna.id) : []
  });
});

// One photo of one person; the first photo of the day creates the consegna (like the first Salva)
router.post('/', (req, res) => {
  const { data, partecipanteId, foto, thumb, larghezza, altezza } = req.body;
  if (!DATE_RE.test(data || '')) return res.status(400).json({ success: false, error: 'Data non valida' });
  const persona = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(partecipanteId);
  if (!persona) return res.status(400).json({ success: false, error: 'Partecipante non trovato' });

  const fotoBuf = decodeJpeg(foto, MAX_FOTO_BYTES);
  const thumbBuf = decodeJpeg(thumb, MAX_THUMB_BYTES);
  if (!fotoBuf || !thumbBuf) return res.status(400).json({ success: false, error: 'La foto deve essere un JPEG di al massimo 1,5 MB' });

  const esistente = db.prepare('SELECT id, chiusa FROM consegne WHERE data = ?').get(data);
  if (esistente?.chiusa === 1) return res.status(403).json({ success: false, error: 'Consegna chiusa' });
  if (esistente && contaPerPersona(db, esistente.id, persona.id) >= MAX_FOTO_PERSONA) {
    return res.status(400).json({ success: false, error: `Massimo ${MAX_FOTO_PERSONA} foto per persona` });
  }

  try {
    const audit = getAuditFields(req, 'create');
    const consegna = ensureConsegna(db, data, audit);
    const id = salvaScontrino(db, { consegnaId: consegna.id, partecipanteId: persona.id, foto: fotoBuf, thumb: thumbBuf, larghezza, altezza }, audit);
    logActivity({
      eventType: 'scontrino_aggiunto',
      targetUserId: persona.id,
      actorUserId: req.session.userId,
      consegnaId: consegna.id,
      details: `consegna: ${data}`,
      createdAt: audit.created_at
    });
    res.json({ success: true, id, consegnaId: consegna.id });
  } catch (error) {
    console.error('[SCONTRINI] Error saving photo:', error);
    res.status(500).json({ success: false, error: 'Errore durante il salvataggio della foto' });
  }
});

function inviaFoto(thumb) {
  return (req, res) => {
    const row = db.prepare('SELECT consegna_id, file FROM scontrini WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Foto non trovata' });
    res.set('Cache-Control', 'private, max-age=604800'); // a photo never changes, only goes away
    res.type('image/jpeg').sendFile(fileFoto(row, thumb), err => {
      if (err && !res.headersSent) res.status(404).json({ success: false, error: 'Foto non trovata' });
    });
  };
}

router.get('/:id/foto', inviaFoto(false));
router.get('/:id/thumb', inviaFoto(true));

// Whoever took it, or an admin, while the consegna is open
router.delete('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT s.*, c.data, c.chiusa FROM scontrini s JOIN consegne c ON c.id = s.consegna_id WHERE s.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Foto non trovata' });
  if (row.chiusa === 1) return res.status(403).json({ success: false, error: 'Consegna chiusa' });
  if (row.created_by !== req.session.userId && !req.session.isAdmin) {
    return res.status(403).json({ success: false, error: 'Può toglierla solo chi l\'ha scattata o un admin' });
  }
  rimuoviScontrino(db, row);
  logActivity({
    eventType: 'scontrino_rimosso',
    targetUserId: row.partecipante_id,
    actorUserId: req.session.userId,
    consegnaId: row.consegna_id,
    details: `consegna: ${row.data}`
  });
  res.json({ success: true });
});

module.exports = router;
