/**
 * Authentication Middleware
 *
 * Provides session-based authentication for GASS application.
 */

/**
 * Middleware to require authentication for routes
 * Responds with 401 if user is not logged in
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  res.status(401).json({
    error: 'Authentication required',
    message: 'You must be logged in to access this resource'
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
      displayName: req.session.displayName
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
  attachUser,
  getAuditFields
};
