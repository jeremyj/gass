/**
 * Quota teatro API: anyone sees a person's status and records a payment (at the
 * consegna); the overview, corrections and the cassa log are admin-only.
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

router.get('/utente/:id', (req, res) => {
  T.ensureSemestre(db, toLocalDateString());
  res.json({ success: true, ...T.statoTeatro(db, Number(req.params.id)) });
});

// Quotas collected on a day (default today), kept apart from the consegna cassa
router.get('/oggi', (req, res) => {
  res.json({ success: true, totale: T.quoteDelGiorno(db, req.query.data || toLocalDateString()) });
});

router.post('/pagamenti', (req, res) => {
  const { userId, importo, consegnaId } = req.body || {};
  const today = toLocalDateString();
  T.ensureSemestre(db, today);
  act(req, res, 'teatro_pagamento', audit =>
    T.registraPagamento(db, { userId: Number(userId), importo, data: today, consegnaId: consegnaId || null }, audit));
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
