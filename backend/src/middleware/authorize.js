/**
 * Authorization Middleware
 * Provides role-based access control for protected routes
 */

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Check if user exists (should be set by auth middleware)
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
      });
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient permissions to access this resource',
      });
    }

    // User is authorized, proceed to the next middleware
    next();
  };
};

// Helper middleware functions for common role combinations
const adminOnly = authorize('ADMIN');
const adminOrManager = authorize('ADMIN', 'MANAGER');
const chefOnly = authorize('CHEF');
const allRoles = authorize('ADMIN', 'MANAGER', 'CHEF');

module.exports = {
  authorize,
  adminOnly,
  adminOrManager,
  chefOnly,
  allRoles,
};
