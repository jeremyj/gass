const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const fs = require('fs');

// Initialize database (creates tables if needed)
const db = require('./server/config/database');

// Determine database path (same logic as database.js)
const dbDir = fs.existsSync('/app/data') ? '/app/data' : __dirname;
const dbPath = path.join(dbDir, 'gass.db');

// Import routes
const pagesRouter = require('./server/routes/pages');
const consegnaRouter = require('./server/routes/consegna');
const participantsRouter = require('./server/routes/participants');
const storicoRouter = require('./server/routes/storico');
const authRouter = require('./server/routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());

// Session configuration
app.use(session({
  store: new SQLiteStore({
    dir: dbDir,
    db: 'gass.db',
    table: 'sessions'
  }),
  secret: process.env.SESSION_SECRET || 'gass-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

app.use(express.static('public'));

// Mount routes
app.use('/api/auth', authRouter);
app.use('/', pagesRouter);
app.use('/api/consegna', consegnaRouter);
app.use('/api/participants', participantsRouter);
app.use('/api/storico', storicoRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Network: http://192.168.178.21:${PORT}`);
});
