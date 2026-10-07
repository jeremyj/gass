/**
 * Quota teatro API: anyone sees a person's status; the quota is paid inside the movimento
 * (teatroVersato in POST /api/consegna). Direct payments, the overview, corrections and
 * the cassa log are admin-only.
 */

const express = require('express');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../services/activity');
const { toLocalDateString } = require('../services/calculations');
const T = require('../services/teatro');

const router = express.Router();
router.use(requireAuth);

const auditOf = req => ({ userId: req.session.userId, timestamp: new Date().toISOString() });

// Runs a service call, logs its changes, answers 400 on error
function act(req, res, eventType, fn) {
  const audit = auditOf(req);
  const result = fn(audit);
  if (result.error) return res.status(400).json({ success: false, error: result.error });
  logActivity({ eventType, actorUserId: req.session.userId, details: result.changes.join(', '), createdAt: audit.timestamp });
  res.json({ success: true });
}

// ?consegna=<id>: without the quota paid in that consegna, returned apart as giaQui
router.get('/utente/:id', (req, res) => {
  T.ensureSemestre(db, toLocalDateString());
  const userId = Number(req.params.id);
  const consegna = Number(req.query.consegna) || null;
  const giaQui = consegna ? T.quotePerPersona(db, consegna).find(q => q.user_id === userId)?.importo || 0 : 0;
  res.json({ success: true, ...T.statoTeatro(db, userId, consegna), giaQui });
});

// Quotas collected in a consegna, kept apart from its cassa
router.get('/consegna/:id', (req, res) => {
  res.json({ success: true, totale: T.quoteDellaConsegna(db, Number(req.params.id)) });
});

// Admin payment at a consegna: it must exist and be open, and gives the payment its date
router.post('/pagamenti', requireAdmin, (req, res) => {
  const { userId, importo, consegnaId } = req.body || {};
  const consegna = consegnaId && db.prepare('SELECT id, data, chiusa FROM consegne WHERE id = ?').get(consegnaId);
  if (!consegna || consegna.chiusa) {
    return res.status(400).json({ success: false, error: 'La quota teatro si registra dentro una consegna aperta' });
  }
  T.ensureSemestre(db, toLocalDateString());
  act(req, res, 'teatro_pagamento', audit =>
    T.registraPagamento(db, { userId: Number(userId), importo, data: consegna.data, consegnaId: consegna.id }, audit));
});

router.get('/', requireAdmin, (req, res) => {
  T.ensureSemestre(db, toLocalDateString());
  res.json({ success: true, ...T.riepilogo(db) });
});

router.put('/dovuti', requireAdmin, (req, res) => {
  const { userId, semestre, dovuto } = req.body || {};
  act(req, res, 'teatro_modifica', audit => T.setDovuto(db, Number(userId), semestre, dovuto === null ? null : dovuto, audit));
});

router.put('/semestri/:semestre', requireAdmin, (req, res) => {
  act(req, res, 'teatro_modifica', audit => T.setQuota(db, req.params.semestre, (req.body || {}).quota, audit));
});

router.put('/nota', requireAdmin, (req, res) => {
  const { userId, nota } = req.body || {};
  act(req, res, 'teatro_modifica', () => T.setNota(db, Number(userId), nota));
});

router.delete('/pagamenti/:id', requireAdmin, (req, res) => {
  act(req, res, 'teatro_modifica', () => T.deletePagamento(db, Number(req.params.id)));
});

router.post('/cassa', requireAdmin, (req, res) => {
  act(req, res, 'teatro_cassa', audit => T.addCassa(db, req.body || {}, audit));
});

module.exports = router;
