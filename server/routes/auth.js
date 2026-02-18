/**
 * Authentication Routes
 *
 * Handles user login, logout, and session management.
 */

const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts', message: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const timestamp = new Date().toISOString();

  console.log(`[AUTH] ${timestamp} - Login attempt for user: ${username}`);

  if (!username || !password) {
    console.log(`[AUTH] ${timestamp} - Login failed: Missing credentials`);
    return res.status(400).json({
      error: 'Missing credentials',
      message: 'Username and password are required'
    });
  }

  try {
    // Find user by username
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      console.log(`[AUTH] ${timestamp} - Login failed: User not found - ${username}`);
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username or password is incorrect'
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      console.log(`[AUTH] ${timestamp} - Login failed: Invalid password - ${username}`);
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username or password is incorrect'
      });
    }

    // Regenerate session to prevent session fixation
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Create session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.displayName = user.display_name;
    req.session.isAdmin = user.is_admin === 1;

    console.log(`[AUTH] ${timestamp} - Login successful: ${username} (ID: ${user.id}, Admin: ${user.is_admin === 1})`);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        isAdmin: user.is_admin === 1
      }
    });

  } catch (error) {
    console.error(`[AUTH] ${timestamp} - Login error for ${username}:`, error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred during login'
    });
  }
});

/**
 * POST /api/auth/logout
 * Destroy session and log out user
 */
router.post('/logout', (req, res) => {
  const username = req.session?.username || 'unknown';
  const timestamp = new Date().toISOString();

  console.log(`[AUTH] ${timestamp} - Logout request from user: ${username}`);

  req.session.destroy((err) => {
    if (err) {
      console.error(`[AUTH] ${timestamp} - Logout error for ${username}:`, err);
      return res.status(500).json({
        error: 'Server error',
        message: 'An error occurred during logout'
      });
    }

    console.log(`[AUTH] ${timestamp} - Logout successful: ${username}`);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

/**
 * GET /api/auth/session
 * Check current session status and return user info
 */
router.get('/session', (req, res) => {
  const timestamp = new Date().toISOString();

  if (req.session && req.session.userId) {
    console.log(`[AUTH] ${timestamp} - Session check: Authenticated - ${req.session.username} (Admin: ${req.session.isAdmin || false})`);
    res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        displayName: req.session.displayName,
        isAdmin: req.session.isAdmin || false
      }
    });
  } else {
    console.log(`[AUTH] ${timestamp} - Session check: Not authenticated`);
    res.json({
      authenticated: false
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change own password (requires current password)
 */
router.post('/change-password', async (req, res) => {
  const timestamp = new Date().toISOString();
  const { currentPassword, newPassword } = req.body;

  // Check authentication
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: 'Non autenticato'
    });
  }

  console.log(`[AUTH] ${timestamp} - Password change request from user: ${req.session.username}`);

  // Validate input
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Password attuale e nuova password sono obbligatorie'
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'La nuova password deve essere di almeno 8 caratteri'
    });
  }

  try {
    // Get current user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    // Verify current password
    if (!await bcrypt.compare(currentPassword, user.password_hash)) {
      console.log(`[AUTH] ${timestamp} - Password change failed: Invalid current password - ${req.session.username}`);
      return res.status(401).json({
        success: false,
        error: 'Password attuale non corretta'
      });
    }

    // Hash and update new password
    const newHash = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(newHash, timestamp, req.session.userId);

    // Log the password change event
    db.prepare(`
      INSERT INTO activity_logs (event_type, target_user_id, actor_user_id, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('password_changed', req.session.userId, req.session.userId, 'Self password change', timestamp);

    console.log(`[AUTH] ${timestamp} - Password changed successfully for user: ${req.session.username}`);

    res.json({
      success: true,
      message: 'Password modificata con successo'
    });

  } catch (error) {
    console.error(`[AUTH] ${timestamp} - Password change error:`, error);
    res.status(500).json({
      success: false,
      error: 'Errore durante la modifica della password'
    });
  }
});

module.exports = router;
