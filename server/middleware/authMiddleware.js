const db = require('../db');

/**
 * Middleware factory to restrict access to specific user roles.
 * Verifies role directly from the database or verified user object.
 *
 * Example usage:
 *   router.get('/employee/tasks', requireRole(['employee']), controller);
 *   router.post('/manager/assign', requireRole(['manager']), controller);
 *   router.get('/senior/appeals', requireRole(['senior']), controller);
 */
function requireRole(allowedRoles) {
  return async (req, res, next) => {
    try {
      // Check if user object is already attached to request
      let userRole = req.user ? req.user.role : null;
      let userId = req.user ? req.user.user_id : null;

      // If not yet attached, inspect x-user-id header sent by client
      if (!userRole) {
        const headerUserId = req.headers['x-user-id'];
        if (!headerUserId) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required: missing user identification header (x-user-id).'
          });
        }

        // Query database directly to get genuine, tamper-proof user role
        const [rows] = await db.query(
          'SELECT user_id, name, email, role FROM User WHERE user_id = ?',
          [headerUserId]
        );

        if (rows.length === 0) {
          return res.status(401).json({
            success: false,
            message: 'User account not found.'
          });
        }

        req.user = rows[0];
        userRole = rows[0].role;
        userId = rows[0].user_id;
      }

      // Check if user's actual database role matches any allowed roles
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: `Access denied: role '${userRole}' is not authorized for this action. Allowed: ${allowedRoles.join(', ')}.`
        });
      }

      next();
    } catch (err) {
      console.error('Role authorization error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during authorization.',
        error: err.message
      });
    }
  };
}

// Simple role-specific helper middleware
const isEmployee = requireRole(['employee']);
const isManager = requireRole(['manager']);
const isSenior = requireRole(['senior']);

module.exports = {
  requireRole,
  isEmployee,
  isManager,
  isSenior
};
