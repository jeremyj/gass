/**
 * User Management Routes (Admin only)
 *
 * Handles user profile updates by admins.
 */

const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../services/activity');

const router = express.Router();

// All routes require authentication and admin
router.use(requireAuth);
router.use(requireAdmin);

/**
 * PUT /api/users/:id
 * Update user profile (admin only)
 * Can update: displayName, password, isAdmin
 * Cannot update: username (immutable)
 */
router.put('/:id', async (req, res) => {
  const timestamp = new Date().toISOString();
  const { id } = req.params;
  const { displayName, newPassword } = req.body;

  console.log(`[USERS] ${timestamp} - Admin ${req.session.username} updating user ID: ${id}`);

  try {
    // Get target user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    const name = displayName?.trim();
    const hasPassword = newPassword !== undefined && newPassword.length > 0;

    if (hasPassword && newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'La password deve essere di almeno 8 caratteri'
      });
    }

    // Build the update and the activity log details together
    const updates = [];
    const params = [];
    const changes = [];

    if (name) {
      updates.push('display_name = ?');
      params.push(name);
      changes.push(`display_name: "${user.display_name}" → "${name}"`);
    }

    if (hasPassword) {
      updates.push('password_hash = ?');
      params.push(await bcrypt.hash(newPassword, 12));
      changes.push('password reset');
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessun campo da aggiornare'
      });
    }

    db.prepare(`UPDATE users SET ${updates.join(', ')}, updated_by = ?, updated_at = ? WHERE id = ?`)
      .run(...params, req.session.userId, timestamp, id);

    logActivity({
      eventType: 'user_edited',
      targetUserId: parseInt(id),
      actorUserId: req.session.userId,
      details: changes.join(', '),
      createdAt: timestamp
    });

    console.log(`[USERS] ${timestamp} - User ${user.username} updated by admin ${req.session.username}`);

    res.json({
      success: true,
      message: 'Utente aggiornato con successo'
    });

  } catch (error) {
    console.error(`[USERS] ${timestamp} - Error updating user:`, error);
    res.status(500).json({
      success: false,
      error: 'Errore durante l\'aggiornamento dell\'utente'
    });
  }
});

/**
 * GET /api/users
 * Get all users (admin only)
 */
router.get('/', (req, res) => {
  const timestamp = new Date().toISOString();

  console.log(`[USERS] ${timestamp} - Admin ${req.session.username} listing users`);

  try {
    const users = db.prepare(`
      SELECT id, username, display_name, is_admin, saldo, ultima_modifica, created_at
      FROM users
      ORDER BY display_name
    `).all();

    res.json({
      success: true,
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        isAdmin: u.is_admin === 1,
        saldo: u.saldo,
        ultimaModifica: u.ultima_modifica,
        createdAt: u.created_at
      }))
    });

  } catch (error) {
    console.error(`[USERS] ${timestamp} - Error listing users:`, error);
    res.status(500).json({
      success: false,
      error: 'Errore durante il recupero degli utenti'
    });
  }
});

module.exports = router;
