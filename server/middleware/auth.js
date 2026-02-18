/**
 * Authentication Middleware
 *
 * Provides session-based authentication for GASS application.
 */
const db = require('../config/database');

/**
 * Middleware to require authentication for routes
 * Validates that session user still exists in database
 * Responds with 401 if user is not logged in or no longer exists
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    // Verify user still exists in database (prevents FK constraint failures)
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.session.userId);
    if (user) {
      return next();
    }
    // User no longer exists - destroy stale session
    req.session.destroy();
  }

  res.status(401).json({
    error: 'Authentication required',
    message: 'You must be logged in to access this resource'
  });
}

/**
 * Middleware to require admin privileges
 * Must be used AFTER requireAuth
 * Queries DB to verify current admin status (prevents stale session privilege escalation)
 * Responds with 403 if user is not admin
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.userId) {
    const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.session.userId);
    if (user && user.is_admin === 1) {
      // Keep session in sync
      req.session.isAdmin = true;
      return next();
    }
    // Admin revoked - update session
    req.session.isAdmin = false;
  }

  res.status(403).json({
    error: 'Admin privileges required',
    message: 'Solo gli amministratori possono accedere a questa risorsa'
  });
}

/**
 * Middleware to attach user info to request object
 * Does not block unauthenticated requests, just adds user data if available
 */
function attachUser(req, res, next) {
  if (req.session && req.session.userId) {
    req.user = {
      id: req.session.userId,
      username: req.session.username,
      displayName: req.session.displayName,
      isAdmin: req.session.isAdmin || false
    };
  }
  next();
}

/**
 * Helper function to get audit fields for database operations
 * Returns an object with created_by/updated_by user ID and timestamp
 *
 * @param {object} req - Express request object with user session
 * @param {string} operation - 'create' or 'update'
 * @returns {object} Audit fields object
 */
function getAuditFields(req, operation = 'create') {
  const userId = req.session?.userId || req.user?.id || null;
  const timestamp = new Date().toISOString();

  if (operation === 'create') {
    return {
      created_by: userId,
      created_at: timestamp,
      updated_by: userId,
      updated_at: timestamp
    };
  } else if (operation === 'update') {
    return {
      updated_by: userId,
      updated_at: timestamp
    };
  }

  throw new Error(`Invalid audit operation: ${operation}. Use 'create' or 'update'.`);
}

module.exports = {
  requireAuth,
  requireAdmin,
  attachUser,
  getAuditFields
};
