const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireRole, isEmployee, isManager, isSenior } = require('../middleware/authMiddleware');

/**
 * POST /api/auth/login
 * Validates user credentials and returns user details with authentic database role.
 * Any role sent by the client is strictly ignored.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate input presence
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Query User table in database
    const [users] = await db.query(
      'SELECT user_id, name, email, password, role FROM User WHERE LOWER(email) = ?',
      [cleanEmail]
    );

    // 3. Verify user exists
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const user = users[0];

    // 4. Verify password
    // In our college schema, passwords are stored as plain text for demo simplicity
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // 5. Success - Return authentic database role (any client-supplied role is ignored)
    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Database error during login processing.',
      error: err.message
    });
  }
});

/**
 * GET /api/auth/me
 * Returns current user's profile based on x-user-id header.
 * Allows frontend to persist login state across page refreshes.
 */
router.get('/me', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated: missing x-user-id header.'
      });
    }

    const [rows] = await db.query(
      'SELECT user_id, name, email, role FROM User WHERE user_id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    return res.status(200).json({
      success: true,
      user: rows[0]
    });
  } catch (err) {
    console.error('Fetch profile error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile.',
      error: err.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Standard logout acknowledgement.
 */
router.post('/logout', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
});

/**
 * GET /api/auth/demo-users
 * Returns list of seeded demo accounts (without passwords) for quick testing/demo selection.
 */
router.get('/demo-users', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT user_id, name, email, role FROM User ORDER BY FIELD(role, "employee", "manager", "senior"), user_id'
    );

    return res.status(200).json({
      success: true,
      users: rows
    });
  } catch (err) {
    console.error('Fetch demo users error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch demo users.',
      error: err.message
    });
  }
});

/**
 * GET /api/auth/test-access/:requiredRole
 * Test endpoint to verify role authorization middleware.
 */
router.get('/test-access/:requiredRole', async (req, res, next) => {
  const { requiredRole } = req.params;
  return requireRole([requiredRole])(req, res, () => {
    return res.status(200).json({
      success: true,
      message: `Access granted! You are authorized as '${req.user.role}'.`,
      user: req.user
    });
  });
});

module.exports = router;
