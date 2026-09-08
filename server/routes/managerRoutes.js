const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireRole } = require('../middleware/authMiddleware');
const { logAudit } = require('../utils/auditLogger');

// Protect all manager routes - only users with role='manager' are authorized
router.use(requireRole(['manager']));

/**
 * GET /api/manager/employees
 * List all active employees so the manager can select who to assign work to.
 */
router.get('/employees', async (req, res) => {
  try {
    const [employees] = await db.query(
      'SELECT user_id, name, email FROM User WHERE role = "employee" ORDER BY name ASC'
    );
    return res.status(200).json({
      success: true,
      employees
    });
  } catch (err) {
    console.error('Fetch employees error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch employee list.',
      error: err.message
    });
  }
});

/**
 * POST /api/manager/assign
 * Manager assigns a new piece of work to an employee.
 * Records initial assignment in WorkAssignment and creates an AuditLog record.
 */
router.post('/assign', async (req, res) => {
  try {
    const managerId = req.user.user_id;
    const { employee_id, title, description, due_date } = req.body;

    // 1. Validate required fields
    if (!employee_id || !title || !due_date) {
      return res.status(400).json({
        success: false,
        message: 'employee_id, title, and due_date are required fields.'
      });
    }

    // 2. Verify target employee exists and is an employee
    const [empCheck] = await db.query(
      'SELECT user_id, name FROM User WHERE user_id = ? AND role = "employee"',
      [employee_id]
    );
    if (empCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Target employee not found or is not an employee.'
      });
    }
    const employeeName = empCheck[0].name;

    // 3. Insert work assignment into database
    const [result] = await db.query(
      `INSERT INTO WorkAssignment 
       (manager_id, employee_id, title, description, assigned_date, due_date, status, rejection_reason, credit_awarded) 
       VALUES (?, ?, ?, ?, NOW(), ?, 'assigned', NULL, FALSE)`,
      [managerId, employee_id, title.trim(), description ? description.trim() : null, due_date]
    );

    const workId = result.insertId;

    // 4. Record transparent audit log entry
    await logAudit(
      workId,
      'WORK_ASSIGNED',
      managerId,
      `Manager ${req.user.name} assigned '${title.trim()}' to ${employeeName}. Due date: ${due_date}.`
    );

    return res.status(201).json({
      success: true,
      message: 'Work assigned successfully.',
      work_id: workId
    });
  } catch (err) {
    console.error('Assign work error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign work.',
      error: err.message
    });
  }
});

/**
 * GET /api/manager/work
 * Lists all work assignments created by the logged-in manager.
 * Includes assigned employee name and count of daily updates submitted.
 */
router.get('/work', async (req, res) => {
  try {
    const managerId = req.user.user_id;

    const [assignments] = await db.query(
      `SELECT 
         w.work_id,
         w.title,
         w.description,
         w.assigned_date,
         w.due_date,
         w.status,
         w.rejection_reason,
         w.credit_awarded,
         u.user_id AS employee_id,
         u.name AS employee_name,
         u.email AS employee_email,
         COUNT(up.update_id) AS total_updates
       FROM WorkAssignment w
       JOIN User u ON w.employee_id = u.user_id
       LEFT JOIN WorkUpdate up ON w.work_id = up.work_id
       WHERE w.manager_id = ?
       GROUP BY w.work_id
       ORDER BY w.assigned_date DESC`,
      [managerId]
    );

    return res.status(200).json({
      success: true,
      assignments
    });
  } catch (err) {
    console.error('Fetch manager work error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch manager work assignments.',
      error: err.message
    });
  }
});

/**
 * GET /api/manager/work/:workId
 * Get detailed view of a specific work item, including all employee progress updates.
 */
router.get('/work/:workId', async (req, res) => {
  try {
    const managerId = req.user.user_id;
    const { workId } = req.params;

    // Fetch assignment details
    const [rows] = await db.query(
      `SELECT 
         w.work_id,
         w.title,
         w.description,
         w.assigned_date,
         w.due_date,
         w.status,
         w.rejection_reason,
         w.credit_awarded,
         u.user_id AS employee_id,
         u.name AS employee_name,
         u.email AS employee_email
       FROM WorkAssignment w
       JOIN User u ON w.employee_id = u.user_id
       WHERE w.work_id = ? AND w.manager_id = ?`,
      [workId, managerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work assignment not found or not assigned by you.'
      });
    }

    // Fetch all updates submitted for this assignment
    const [updates] = await db.query(
      'SELECT update_id, update_text, update_date FROM WorkUpdate WHERE work_id = ? ORDER BY update_date ASC',
      [workId]
    );

    return res.status(200).json({
      success: true,
      work: rows[0],
      updates
    });
  } catch (err) {
    console.error('Fetch work details error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch work details.',
      error: err.message
    });
  }
});

/**
 * PUT /api/manager/work/:workId/review
 * Manager reviews completed work: approves or rejects, and awards or denies credit.
 * If rejected, a rejection reason is required.
 * An audit log entry is recorded permanently.
 */
router.put('/work/:workId/review', async (req, res) => {
  try {
    const managerId = req.user.user_id;
    const { workId } = req.params;
    const { action, credit_awarded, rejection_reason } = req.body;

    // 1. Validate action
    if (!action || !['approve', 'reject'].includes(action.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be 'approve' or 'reject'."
      });
    }

    // 2. Fetch current work assignment
    const [rows] = await db.query(
      `SELECT w.*, u.name AS employee_name 
       FROM WorkAssignment w
       JOIN User u ON w.employee_id = u.user_id
       WHERE w.work_id = ? AND w.manager_id = ?`,
      [workId, managerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work assignment not found or not assigned by you.'
      });
    }

    const work = rows[0];

    // 3. Process approval or rejection
    if (action.toLowerCase() === 'approve') {
      const grantCredit = credit_awarded === true || credit_awarded === 'true' || credit_awarded === 1;

      await db.query(
        `UPDATE WorkAssignment 
         SET status = 'approved', rejection_reason = NULL, credit_awarded = ? 
         WHERE work_id = ?`,
        [grantCredit, workId]
      );

      // Audit log
      await logAudit(
        workId,
        'WORK_APPROVED',
        managerId,
        `Manager ${req.user.name} approved work '${work.title}'. Credit awarded: ${grantCredit ? 'YES' : 'NO'}.`
      );

      return res.status(200).json({
        success: true,
        message: `Work '${work.title}' has been approved. Credit awarded: ${grantCredit ? 'Yes' : 'No'}.`,
        status: 'approved',
        credit_awarded: grantCredit
      });

    } else {
      // Rejection branch
      if (!rejection_reason || rejection_reason.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'A rejection reason is mandatory when rejecting work.'
        });
      }

      await db.query(
        `UPDATE WorkAssignment 
         SET status = 'rejected', rejection_reason = ?, credit_awarded = FALSE 
         WHERE work_id = ?`,
        [rejection_reason.trim(), workId]
      );

      // Audit log
      await logAudit(
        workId,
        'WORK_REJECTED',
        managerId,
        `Manager ${req.user.name} rejected work '${work.title}'. Reason: ${rejection_reason.trim()}.`
      );

      return res.status(200).json({
        success: true,
        message: `Work '${work.title}' has been rejected.`,
        status: 'rejected',
        rejection_reason: rejection_reason.trim(),
        credit_awarded: false
      });
    }

  } catch (err) {
    console.error('Review work error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to review work assignment.',
      error: err.message
    });
  }
});

/**
 * GET /api/manager/appeals
 * Lists all appeals filed against work assigned by the logged-in manager.
 */
router.get('/appeals', async (req, res) => {
  try {
    const managerId = req.user.user_id;

    const [appeals] = await db.query(
      `SELECT 
         a.appeal_id,
         a.work_id,
         a.appeal_reason,
         a.appeal_date,
         a.status AS appeal_status,
         a.decision_reason,
         a.decision_date,
         w.title AS work_title,
         w.status AS work_status,
         w.rejection_reason AS manager_rejection_reason,
         w.credit_awarded,
         emp.user_id AS employee_id,
         emp.name AS employee_name,
         emp.email AS employee_email,
         snr.name AS senior_name
       FROM Appeal a
       JOIN WorkAssignment w ON a.work_id = w.work_id
       JOIN User emp ON a.employee_id = emp.user_id
       LEFT JOIN User snr ON a.senior_id = snr.user_id
       WHERE w.manager_id = ?
       ORDER BY a.appeal_date DESC`,
      [managerId]
    );

    return res.status(200).json({
      success: true,
      appeals
    });
  } catch (err) {
    console.error('Fetch manager appeals error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch manager appeals.',
      error: err.message
    });
  }
});

module.exports = router;
