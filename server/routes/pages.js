const express = require('express');
const path = require('path');
const { shouldUseMobileView } = require('../middleware/userAgent');

const router = express.Router();

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
