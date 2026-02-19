const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');

function createApp() {
  const isTest = process.env.NODE_ENV === 'test';

  const app = express();

  // Warn on missing SESSION_SECRET in production
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    console.error('[FATAL] SESSION_SECRET environment variable is not set in production. Exiting.');
    process.exit(1);
  }

  // Trust proxy when behind nginx-proxy or other reverse proxy
  app.set('trust proxy', 1);

  // Security headers
  // script-src-attr 'unsafe-inline' allows onclick= handlers used throughout the HTML
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src-attr': ["'unsafe-inline'"],
        'upgrade-insecure-requests': null,
      },
    },
  }));

  app.use(express.json());
  app.use(cookieParser());

  // Session configuration
  const sessionOptions = {
    secret: process.env.SESSION_SECRET || 'gass-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  };

  if (!isTest) {
    const SQLiteStore = require('connect-sqlite3')(session);
    const dbDir = fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, '..');
    sessionOptions.store = new SQLiteStore({
      dir: dbDir,
      db: 'sessions.db',
      table: 'sessions'
    });
  }

  app.use(session(sessionOptions));

  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Request logging middleware (skip in tests to reduce noise)
  if (!isTest) {
    app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${req.method} ${req.url} - User: ${req.session?.username || 'anonymous'}`);
      next();
    });
  }

  // Import routes inside createApp so they load the DB from require.cache
  // (which has been patched by test helpers when NODE_ENV=test)
  const pagesRouter = require('./routes/pages');
  const consegnaRouter = require('./routes/consegna');
  const participantsRouter = require('./routes/participants');
  const storicoRouter = require('./routes/storico');
  const logsRouter = require('./routes/logs');
  const authRouter = require('./routes/auth');
  const usersRouter = require('./routes/users');

  // API routes first so their auth middleware (401) takes precedence over
  // the pages router's requireAuthForPages redirect (302)
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/consegna', consegnaRouter);
  app.use('/api/participants', participantsRouter);
  app.use('/api/storico', storicoRouter);
  app.use('/api/logs', logsRouter);
  // Pages router last — catches /, /consegna, /storico, /debiti, /logs HTML pages
  app.use('/', pagesRouter);

  // Error handler
  app.use((err, req, res, next) => {
    if (!isTest) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);
      console.error(err.stack);
    }
    if (res.headersSent) return;
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = createApp;
