const express = require('express');
const path = require('path');
const { shouldUseMobileView } = require('../middleware/userAgent');

const router = express.Router();

// Login page (public, no auth required)
router.get('/login', (req, res) => {
  // If already logged in, redirect to consegna
  if (req.session && req.session.userId) {
    return res.redirect('/consegna');
  }
  res.sendFile(path.join(__dirname, '../../public', 'login.html'));
});

// Middleware to require authentication for all other pages
const requireAuthForPages = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/login');
};

router.use(requireAuthForPages);

router.get('/consegna', (req, res) => {
  const useMobile = shouldUseMobileView(req);
  const file = useMobile ? 'consegna.html' : 'consegna-desktop.html';
  res.sendFile(path.join(__dirname, '../../public', file));
});

router.get('/storico', (req, res) => {
  const useMobile = shouldUseMobileView(req);
  const file = useMobile ? 'storico.html' : 'storico-desktop.html';
  res.sendFile(path.join(__dirname, '../../public', file));
});

router.get('/debiti', (req, res) => {
  const useMobile = shouldUseMobileView(req);
  const file = useMobile ? 'debiti.html' : 'debiti-desktop.html';
  res.sendFile(path.join(__dirname, '../../public', file));
});

// Redirect root to consegna
router.get('/', (req, res) => {
  res.redirect('/consegna');
});

module.exports = router;
