/**
 * User Management Routes (Admin only)
 *
 * Handles user profile updates by admins.
 */

const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

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
  const { displayName, newPassword, isAdmin } = req.body;

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

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (displayName !== undefined && displayName.trim()) {
      updates.push('display_name = ?');
      params.push(displayName.trim());
    }

    if (newPassword !== undefined && newPassword.length > 0) {
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'La password deve essere di almeno 8 caratteri'
        });
      }
      updates.push('password_hash = ?');
      params.push(await bcrypt.hash(newPassword, 12));
    }

    if (isAdmin !== undefined) {
      // Prevent removing admin from last admin
      if (!isAdmin) {
        const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get().count;
        if (adminCount === 1 && user.is_admin === 1) {
          return res.status(400).json({
            success: false,
            error: 'Impossibile rimuovere i privilegi admin dall\'ultimo amministratore'
          });
        }
      }
      updates.push('is_admin = ?');
      params.push(isAdmin ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessun campo da aggiornare'
      });
    }

    // Add updated_at and id
    updates.push('updated_at = ?');
    params.push(timestamp);
    params.push(id);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...params);

    // Build details string for activity log
    const changes = [];
    if (displayName !== undefined && displayName.trim()) {
      changes.push(`display_name: "${user.display_name}" → "${displayName.trim()}"`);
    }
    if (newPassword !== undefined && newPassword.length > 0) {
      changes.push('password reset');
    }
    if (isAdmin !== undefined && isAdmin !== (user.is_admin === 1)) {
      changes.push(`admin: ${user.is_admin === 1} → ${isAdmin}`);
    }

    // Log the user edit event
    db.prepare(`
      INSERT INTO activity_logs (event_type, target_user_id, actor_user_id, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('user_edited', parseInt(id), req.session.userId, changes.join(', '), timestamp);

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
