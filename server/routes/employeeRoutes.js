const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireRole } = require('../middleware/authMiddleware');
const { logAudit } = require('../utils/auditLogger');

// Protect all employee routes - only users with role='employee' are authorized
router.use(requireRole(['employee']));

/**
 * GET /api/employee/work
 * Lists all work assignments assigned to the logged-in employee.
 * Shows assigning manager's details, due date, status, credit status, and rejection reasons.
 */
router.get('/work', async (req, res) => {
  try {
    const employeeId = req.user.user_id;

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
         u.user_id AS manager_id,
         u.name AS manager_name,
         u.email AS manager_email,
         COUNT(up.update_id) AS total_updates
       FROM WorkAssignment w
       JOIN User u ON w.manager_id = u.user_id
       LEFT JOIN WorkUpdate up ON w.work_id = up.work_id
       WHERE w.employee_id = ?
       GROUP BY w.work_id
       ORDER BY w.assigned_date DESC`,
      [employeeId]
    );

    return res.status(200).json({
      success: true,
      assignments
    });
  } catch (err) {
    console.error('Fetch employee work error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch your assigned work.',
      error: err.message
    });
  }
});

/**
 * GET /api/employee/work/:workId
 * Get detailed view of a specific work assignment and all its recorded updates.
 */
router.get('/work/:workId', async (req, res) => {
  try {
    const employeeId = req.user.user_id;
    const { workId } = req.params;

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
         u.user_id AS manager_id,
         u.name AS manager_name,
         u.email AS manager_email
       FROM WorkAssignment w
       JOIN User u ON w.manager_id = u.user_id
       WHERE w.work_id = ? AND w.employee_id = ?`,
      [workId, employeeId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work assignment not found or not assigned to you.'
      });
    }

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
    console.error('Fetch employee work details error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch work details.',
      error: err.message
    });
  }
});

/**
 * POST /api/employee/work/:workId/update
 * Employee posts a daily work progress update.
 * If status is currently 'assigned', it automatically moves to 'in_progress'.
 * Records in WorkUpdate and AuditLog.
 */
router.post('/work/:workId/update', async (req, res) => {
  try {
    const employeeId = req.user.user_id;
    const { workId } = req.params;
    const { update_text } = req.body;

    if (!update_text || update_text.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Update text is required.'
      });
    }

    // 1. Verify work assignment belongs to this employee
    const [rows] = await db.query(
      'SELECT work_id, title, status FROM WorkAssignment WHERE work_id = ? AND employee_id = ?',
      [workId, employeeId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work assignment not found or not assigned to you.'
      });
    }

    const work = rows[0];

    // 2. Insert progress update
    const [insertResult] = await db.query(
      'INSERT INTO WorkUpdate (work_id, update_text, update_date) VALUES (?, ?, NOW())',
      [workId, update_text.trim()]
    );

    // 3. If work was still in 'assigned' status, transition to 'in_progress'
    let updatedStatus = work.status;
    if (work.status === 'assigned') {
      await db.query(
        "UPDATE WorkAssignment SET status = 'in_progress' WHERE work_id = ?",
        [workId]
      );
      updatedStatus = 'in_progress';
    }

    // 4. Record audit log
    await logAudit(
      workId,
      'WORK_UPDATE',
      employeeId,
      `Employee ${req.user.name} submitted progress update on '${work.title}'.`
    );

    return res.status(201).json({
      success: true,
      message: 'Progress update recorded successfully.',
      update_id: insertResult.insertId,
      status: updatedStatus
    });

  } catch (err) {
    console.error('Submit work update error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit work update.',
      error: err.message
    });
  }
});

/**
 * PUT /api/employee/work/:workId/submit
 * Employee marks work as completed and submits it for manager review.
 * Changes status to 'submitted'.
 * Records in AuditLog.
 */
router.put('/work/:workId/submit', async (req, res) => {
  try {
    const employeeId = req.user.user_id;
    const { workId } = req.params;

    // 1. Verify assignment belongs to this employee
    const [rows] = await db.query(
      'SELECT work_id, title, status FROM WorkAssignment WHERE work_id = ? AND employee_id = ?',
      [workId, employeeId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work assignment not found or not assigned to you.'
      });
    }

    const work = rows[0];

    // Check if already submitted or approved
    if (work.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'This work has already been approved.'
      });
    }

    // 2. Update status to 'submitted'
    await db.query(
      "UPDATE WorkAssignment SET status = 'submitted' WHERE work_id = ?",
      [workId]
    );

    // 3. Record audit log
    await logAudit(
      workId,
      'WORK_SUBMITTED',
      employeeId,
      `Employee ${req.user.name} submitted work '${work.title}' for manager review.`
    );

    return res.status(200).json({
      success: true,
      message: `Work '${work.title}' has been submitted for manager review.`,
      status: 'submitted'
    });

  } catch (err) {
    console.error('Submit work completion error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit work for review.',
      error: err.message
    });
  }
});

/**
 * POST /api/employee/appeal
 * Employee submits an appeal for a rejected or uncredited work assignment.
 * Requires: work_id, appeal_reason.
 */
router.post('/appeal', async (req, res) => {
  try {
    const employeeId = req.user.user_id;
    const { work_id, appeal_reason } = req.body;

    // 1. Validate inputs
    if (!work_id || !appeal_reason || appeal_reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'work_id and appeal_reason are required.'
      });
    }

    // 2. Verify work belongs to this employee and is either rejected or uncredited
    const [rows] = await db.query(
      'SELECT work_id, title, status, credit_awarded, rejection_reason FROM WorkAssignment WHERE work_id = ? AND employee_id = ?',
      [work_id, employeeId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work assignment not found or not assigned to you.'
      });
    }

    const work = rows[0];

    // Must be rejected or uncredited to appeal
    if (work.status !== 'rejected' && work.credit_awarded === 1) {
      return res.status(400).json({
        success: false,
        message: 'You can only appeal work that has been rejected or has not received credit.'
      });
    }

    // 3. Check for existing pending appeal
    const [existingAppeals] = await db.query(
      'SELECT appeal_id FROM Appeal WHERE work_id = ? AND employee_id = ? AND status = "pending"',
      [work_id, employeeId]
    );

    if (existingAppeals.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A pending appeal already exists for this work assignment.'
      });
    }

    // 4. Insert Appeal
    const [insertResult] = await db.query(
      'INSERT INTO Appeal (work_id, employee_id, appeal_reason, appeal_date, status) VALUES (?, ?, ?, NOW(), "pending")',
      [work_id, employeeId, appeal_reason.trim()]
    );

    const appealId = insertResult.insertId;

    // 5. Record AuditLog
    await logAudit(
      work_id,
      'APPEAL_CREATED',
      employeeId,
      `Employee ${req.user.name} submitted appeal #${appealId} for '${work.title}'. Reason: ${appeal_reason.trim()}.`
    );

    return res.status(201).json({
      success: true,
      message: 'Appeal submitted successfully to Senior Authority.',
      appeal_id: appealId
    });

  } catch (err) {
    console.error('Submit appeal error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit appeal.',
      error: err.message
    });
  }
});

/**
 * GET /api/employee/appeals
 * Lists all appeals submitted by this employee with status and decision details.
 */
router.get('/appeals', async (req, res) => {
  try {
    const employeeId = req.user.user_id;

    const [appeals] = await db.query(
      `SELECT 
         a.appeal_id,
         a.work_id,
         a.appeal_reason,
         a.appeal_date,
         a.status,
         a.decision_reason,
         a.decision_date,
         w.title AS work_title,
         w.rejection_reason AS manager_rejection_reason,
         w.credit_awarded,
         mgr.name AS manager_name,
         snr.name AS senior_name
       FROM Appeal a
       JOIN WorkAssignment w ON a.work_id = w.work_id
       JOIN User mgr ON w.manager_id = mgr.user_id
       LEFT JOIN User snr ON a.senior_id = snr.user_id
       WHERE a.employee_id = ?
       ORDER BY a.appeal_date DESC`,
      [employeeId]
    );

    return res.status(200).json({
      success: true,
      appeals
    });
  } catch (err) {
    console.error('Fetch employee appeals error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch appeals.',
      error: err.message
    });
  }
});

/**
 * POST /api/employee/appeals/:appealId/evidence
 * Employee provides additional evidence/explanation requested by Senior Authority.
 */
router.post('/appeals/:appealId/evidence', async (req, res) => {
  try {
    const employeeId = req.user.user_id;
    const { appealId } = req.params;
    const { evidence_text } = req.body;

    if (!evidence_text || evidence_text.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Evidence text is required.'
      });
    }

    const [rows] = await db.query(
      'SELECT a.appeal_id, a.work_id, w.title FROM Appeal a JOIN WorkAssignment w ON a.work_id = w.work_id WHERE a.appeal_id = ? AND a.employee_id = ?',
      [appealId, employeeId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appeal not found or does not belong to you.'
      });
    }

    const appeal = rows[0];

    // Record evidence in AuditLog so Senior Authority can review it
    await logAudit(
      appeal.work_id,
      'APPEAL_EVIDENCE_PROVIDED',
      employeeId,
      `Employee ${req.user.name} submitted requested evidence for appeal #${appealId}: "${evidence_text.trim()}".`
    );

    return res.status(200).json({
      success: true,
      message: 'Evidence submitted successfully.',
      appeal_id: appeal.appeal_id
    });

  } catch (err) {
    console.error('Submit evidence error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit evidence.',
      error: err.message
    });
  }
});

module.exports = router;
