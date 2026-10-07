const express = require('express');
const path = require('path');
const { shouldUseMobileView } = require('../middleware/userAgent');
const packageJson = require('../../package.json');

const router = express.Router();
const PUBLIC = path.join(__dirname, '../../public');

// Login page (public, no auth required)
router.get('/login', (req, res) => {
  // If already logged in, redirect to consegna
  if (req.session && req.session.userId) {
    return res.redirect('/consegna');
  }
  res.sendFile(path.join(PUBLIC, 'login.html'));
});

// First-access video (public, no auth required)
router.get('/comefunziona', (req, res) => {
  res.sendFile(path.join(PUBLIC, 'comefunziona.html'));
});

// Admin features video (public, shared only with admins)
router.get('/admin-video', (req, res) => {
  res.sendFile(path.join(PUBLIC, 'admin-video.html'));
});

// API endpoint to get app version (public, no auth required)
router.get('/api/version', (req, res) => {
  res.json({ version: packageJson.version });
});

// Middleware to require authentication for all other pages
const requireAuthForPages = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/login');
};

router.use(requireAuthForPages);

// Pages with a mobile and a desktop version: <page>.html / <page>-desktop.html
for (const page of ['consegna', 'storico', 'debiti', 'turni']) {
  router.get(`/${page}`, (req, res) => {
    const file = shouldUseMobileView(req) ? `${page}.html` : `${page}-desktop.html`;
    res.sendFile(path.join(PUBLIC, file));
  });
}

// Desktop only - admin restriction enforced at API level
router.get('/logs', (req, res) => {
  res.sendFile(path.join(PUBLIC, 'logs-desktop.html'));
});

router.get('/teatro', (req, res) => {
  res.sendFile(path.join(PUBLIC, 'teatro-desktop.html'));
});

// Experimental Altobelli check: desktop only, admin restriction enforced at API level
router.get('/altobelli', (req, res) => {
  if (shouldUseMobileView(req)) return res.redirect('/consegna');
  res.sendFile(path.join(PUBLIC, 'altobelli-desktop.html'));
});

router.get('/cambia-password', (req, res) => {
  if (!req.session.requirePasswordChange) return res.redirect('/consegna');
  res.sendFile(path.join(PUBLIC, 'change-password-oidc.html'));
});

// Redirect root to consegna
router.get('/', (req, res) => {
  res.redirect('/consegna');
});

module.exports = router;
