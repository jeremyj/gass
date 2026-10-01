/**
 * Turni API: everyone reads the next 12 weeks and swaps their own turni, admins edit.
 */

const express = require('express');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../services/activity');
const { toLocalDateString } = require('../services/calculations');
const T = require('../services/turni');

const router = express.Router();
router.use(requireAuth);

const auditOf = req => ({ userId: req.session.userId, timestamp: new Date().toISOString() });

function log(req, audit, eventType, details) {
  logActivity({ eventType, actorUserId: req.session.userId, details, createdAt: audit.timestamp });
}

router.get('/', (req, res) => {
  try {
    const oggi = toLocalDateString();
    T.ensureTurni(db, oggi);
    res.json({ success: true, oggi, turni: T.listTurni(db, oggi), pause: T.listPause(db, oggi) });
  } catch (error) {
    console.error('[TURNI] Error loading turni:', error);
    res.status(500).json({ success: false, error: 'Errore nel caricamento dei turni' });
  }
});

router.put('/:id', requireAdmin, (req, res) => {
  const audit = auditOf(req);
  const row = db.prepare('SELECT settimana FROM turni WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Turno non trovato' });
  const result = T.updateTurno(db, Number(req.params.id), req.body, audit);
  if (result.error) return res.status(400).json({ success: false, error: result.error });
  if (result.changes.length > 0) log(req, audit, 'turno_modificato', `turno ${row.settimana}: ${result.changes.join(', ')}`);
  res.json({ success: true });
});

router.post('/scambio', (req, res) => {
  const audit = auditOf(req);
  const { a, userId } = req.body || {};
  if (!a || !userId) return res.status(400).json({ success: false, error: 'Scambio non valido' });
  if (!req.session.isAdmin) {
    const row = db.prepare('SELECT turnista1_id, turnista2_id FROM turni WHERE id = ?').get(a.id);
    const own = row && row[Number(a.slot) === 1 ? 'turnista1_id' : 'turnista2_id'] === req.session.userId;
    if (!own) return res.status(403).json({ success: false, error: 'Puoi scambiare solo i tuoi turni' });
  }
  const result = T.swapWithNext(db, a, Number(userId), toLocalDateString(), audit);
  if (result.error) return res.status(400).json({ success: false, error: result.error });
  log(req, audit, 'turno_scambio', `scambio ${result.changes.join(', ')}`);
  res.json({ success: true });
});

router.post('/pause', requireAdmin, (req, res) => {
  const audit = auditOf(req);
  const result = T.addPause(db, req.body || {}, toLocalDateString(), audit);
  if (result.error) return res.status(400).json({ success: false, error: result.error });
  log(req, audit, 'pausa_aggiunta', `pausa ${req.body.dal} – ${req.body.al}${req.body.nota ? `: ${req.body.nota}` : ''}`);
  res.json({ success: true, id: result.id });
});

router.delete('/pause/:id', requireAdmin, (req, res) => {
  const audit = auditOf(req);
  const pausa = db.prepare('SELECT dal, al FROM turni_pause WHERE id = ?').get(req.params.id);
  if (!pausa || !T.deletePause(db, req.params.id)) {
    return res.status(404).json({ success: false, error: 'Pausa non trovata' });
  }
  log(req, audit, 'pausa_eliminata', `pausa ${pausa.dal} – ${pausa.al}`);
  res.json({ success: true });
});

module.exports = router;
