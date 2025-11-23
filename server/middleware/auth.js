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

module.exports = {
  requireAuth,
  attachUser
};
