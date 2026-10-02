/**
 * Turni API: everyone reads the next 6 months (and the last 3 on request) and edits names and days;
 * pauses, automatic generation and notes are admin-only.
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
    res.json({ success: true, oggi, auto: T.isAuto(db), note: T.getNote(db), turni: T.listTurni(db, oggi, { passati: !!req.query.passati }), pause: T.listPause(db, oggi) });
  } catch (error) {
    console.error('[TURNI] Error loading turni:', error);
    res.status(500).json({ success: false, error: 'Errore nel caricamento dei turni' });
  }
});

router.put('/note', requireAdmin, (req, res) => {
  const audit = auditOf(req);
  const result = T.setNote(db, (req.body || {}).note);
  if (result.error) return res.status(400).json({ success: false, error: result.error });
  log(req, audit, 'turno_modificato', 'note dei turni aggiornate');
  res.json({ success: true });
});

router.put('/auto', requireAdmin, (req, res) => {
  const audit = auditOf(req);
  const auto = !!(req.body || {}).auto;
  T.setAuto(db, auto);
  log(req, audit, 'turno_modificato', auto ? 'generazione automatica dei turni riattivata' : 'generazione automatica dei turni in pausa');
  res.json({ success: true });
});

router.put('/:id', (req, res) => {
  const audit = auditOf(req);
  const row = db.prepare('SELECT settimana, data FROM turni WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Turno non trovato' });
  if (row.data < toLocalDateString()) return res.status(400).json({ success: false, error: 'Le consegne passate non si modificano' });
  const result = T.updateTurno(db, Number(req.params.id), req.body, audit);
  if (result.error) return res.status(400).json({ success: false, error: result.error });
  if (result.changes.length > 0) log(req, audit, 'turno_modificato', `turno ${row.settimana}: ${result.changes.join(', ')}`);
  res.json({ success: true });
});

router.post('/scambio', (req, res) => {
  const audit = auditOf(req);
  const { a, userId } = req.body || {};
  if (!a || !userId) return res.status(400).json({ success: false, error: 'Scambio non valido' });
  const result = T.swapWithNext(db, a, Number(userId), toLocalDateString(), audit);
  if (result.error) return res.status(400).json({ success: false, error: result.error });
  log(req, audit, 'turno_scambio', `scambio ${result.changes.join(', ')}`);
  res.json({ success: true });
});

router.post('/lascia', (req, res) => {
  const audit = auditOf(req);
  const { a } = req.body || {};
  if (!a) return res.status(400).json({ success: false, error: 'Turno non valido' });
  const result = T.leaveTurno(db, a, toLocalDateString(), audit);
  if (result.error) return res.status(400).json({ success: false, error: result.error });
  log(req, audit, 'turno_modificato', result.changes.join(', '));
  res.json({ success: true });
});

router.post('/sposta', (req, res) => {
  const audit = auditOf(req);
  const { a, to } = req.body || {};
  if (!a || !to) return res.status(400).json({ success: false, error: 'Spostamento non valido' });
  const result = T.moveTurno(db, a, Number(to), toLocalDateString(), audit);
  if (result.error) return res.status(400).json({ success: false, error: result.error });
  log(req, audit, 'turno_modificato', `sposta ${result.changes.join(', ')}`);
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
