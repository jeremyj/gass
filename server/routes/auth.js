/**
 * Authentication Routes
 *
 * Handles user login, logout, and session management.
 */

const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');

const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post('/login', (req, res) => {
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
    const passwordMatch = bcrypt.compareSync(password, user.password_hash);

    if (!passwordMatch) {
      console.log(`[AUTH] ${timestamp} - Login failed: Invalid password - ${username}`);
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username or password is incorrect'
      });
    }

    // Create session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.displayName = user.display_name;

    console.log(`[AUTH] ${timestamp} - Login successful: ${username} (ID: ${user.id})`);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name
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
    console.log(`[AUTH] ${timestamp} - Session check: Authenticated - ${req.session.username}`);
    res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        displayName: req.session.displayName
      }
    });
  } else {
    console.log(`[AUTH] ${timestamp} - Session check: Not authenticated`);
    res.json({
      authenticated: false
    });
  }
});

module.exports = router;
