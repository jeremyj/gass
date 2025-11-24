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

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} - User: ${req.session?.user?.username || 'anonymous'}`);
  next();
});

// Mount routes
app.use('/api/auth', authRouter);
app.use('/', pagesRouter);
app.use('/api/consegna', consegnaRouter);
app.use('/api/participants', participantsRouter);
app.use('/api/storico', storicoRouter);

// Error logging middleware
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();

  console.log('\n=== GASS Server Started ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Port: ${PORT}`);
  console.log(`Database: ${dbPath}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('\nAccess URLs:');
  console.log(`  Local:   http://localhost:${PORT}`);

  // Dynamically detect and display network addresses
  Object.keys(interfaces).forEach(ifname => {
    interfaces[ifname].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`  Network: http://${iface.address}:${PORT}`);
      }
    });
  });

  console.log('\nPress Ctrl+C to stop\n');
});
