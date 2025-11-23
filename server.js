const express = require('express');
const cookieParser = require('cookie-parser');

// Initialize database (creates tables if needed)
require('./server/config/database');

// Import routes
const pagesRouter = require('./server/routes/pages');
const consegnaRouter = require('./server/routes/consegna');
const participantsRouter = require('./server/routes/participants');
const storicoRouter = require('./server/routes/storico');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Mount routes
app.use('/', pagesRouter);
app.use('/api/consegna', consegnaRouter);
app.use('/api/participants', participantsRouter);
app.use('/api/storico', storicoRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Network: http://192.168.178.21:${PORT}`);
});
