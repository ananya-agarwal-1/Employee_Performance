const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireRole } = require('../middleware/authMiddleware');
const { logAudit } = require('../utils/auditLogger');

// Protect all senior authority routes - only users with role='senior' are authorized
router.use(requireRole(['senior']));

/**
 * GET /api/senior/appeals
 * Lists all employee appeals with work title, employee, manager, and decision status.
 * Supports optional query filter: ?status=pending|accepted|rejected
 */
router.get('/appeals', async (req, res) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT 
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
        mgr.user_id AS manager_id,
        mgr.name AS manager_name,
        mgr.email AS manager_email,
        snr.name AS senior_name
      FROM Appeal a
      JOIN WorkAssignment w ON a.work_id = w.work_id
      JOIN User emp ON a.employee_id = emp.user_id
      JOIN User mgr ON w.manager_id = mgr.user_id
      LEFT JOIN User snr ON a.senior_id = snr.user_id
    `;

    const params = [];
    if (status && ['pending', 'accepted', 'rejected'].includes(status.toLowerCase())) {
      query += ' WHERE a.status = ?';
      params.push(status.toLowerCase());
    }

    query += ' ORDER BY a.appeal_date DESC';

    const [appeals] = await db.query(query, params);

    return res.status(200).json({
      success: true,
      appeals
    });
  } catch (err) {
    console.error('Fetch senior appeals error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch appeals list.',
      error: err.message
    });
  }
});

/**
 * GET /api/senior/appeals/:appealId/dossier
 * Returns the complete investigation dossier for an appeal:
 * 1. Appeal record
 * 2. Full work assignment record
 * 3. Employee daily updates history
 * 4. Complete AuditLog history (who assigned, submitted, rejected, appealed)
 */
router.get('/appeals/:appealId/dossier', async (req, res) => {
  try {
    const { appealId } = req.params;

    // 1. Fetch Appeal with Employee & Manager Info
    const [appealRows] = await db.query(
      `SELECT 
         a.*,
         emp.name AS employee_name,
         emp.email AS employee_email,
         mgr.name AS manager_name,
         mgr.email AS manager_email,
         snr.name AS senior_name
       FROM Appeal a
       JOIN WorkAssignment w ON a.work_id = w.work_id
       JOIN User emp ON a.employee_id = emp.user_id
       JOIN User mgr ON w.manager_id = mgr.user_id
       LEFT JOIN User snr ON a.senior_id = snr.user_id
       WHERE a.appeal_id = ?`,
      [appealId]
    );

    if (appealRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appeal not found.'
      });
    }

    const appeal = appealRows[0];
    const workId = appeal.work_id;

    // 2. Fetch Work Assignment details
    const [workRows] = await db.query(
      `SELECT 
         w.*,
         emp.name AS employee_name,
         mgr.name AS manager_name
       FROM WorkAssignment w
       JOIN User emp ON w.employee_id = emp.user_id
       JOIN User mgr ON w.manager_id = mgr.user_id
       WHERE w.work_id = ?`,
      [workId]
    );

    // 3. Fetch all progress updates submitted by the employee
    const [updates] = await db.query(
      'SELECT update_id, update_text, update_date FROM WorkUpdate WHERE work_id = ? ORDER BY update_date ASC',
      [workId]
    );

    // 4. Fetch complete AuditLog history for transparent review
    const [auditTrail] = await db.query(
      `SELECT 
         l.log_id,
         l.action_type,
         l.action_date,
         l.details,
         u.name AS performed_by_name,
         u.role AS performed_by_role
       FROM AuditLog l
       LEFT JOIN User u ON l.performed_by = u.user_id
       WHERE l.work_id = ?
       ORDER BY l.action_date ASC`,
      [workId]
    );

    return res.status(200).json({
      success: true,
      dossier: {
        appeal,
        work: workRows[0],
        updates,
        auditTrail
      }
    });

  } catch (err) {
    console.error('Fetch appeal dossier error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch appeal dossier.',
      error: err.message
    });
  }
});

/**
 * POST /api/senior/appeals/:appealId/request-evidence
 * Senior authority requests additional evidence or clarification from employee or manager.
 * Records the formal request in AuditLog so both parties can view it.
 */
router.post('/appeals/:appealId/request-evidence', async (req, res) => {
  try {
    const seniorId = req.user.user_id;
    const { appealId } = req.params;
    const { target, request_text } = req.body;

    if (!request_text || request_text.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Request text is required.'
      });
    }

    const [appealRows] = await db.query(
      'SELECT appeal_id, work_id, employee_id, status FROM Appeal WHERE appeal_id = ?',
      [appealId]
    );

    if (appealRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appeal not found.'
      });
    }

    const appeal = appealRows[0];
    const targetRole = target === 'manager' ? 'Manager' : 'Employee';

    // Record evidence request in AuditLog
    await logAudit(
      appeal.work_id,
      'APPEAL_EVIDENCE_REQUESTED',
      seniorId,
      `Senior Authority ${req.user.name} requested additional information from ${targetRole}: "${request_text.trim()}".`
    );

    return res.status(200).json({
      success: true,
      message: `Evidence/clarification request sent to ${targetRole}.`,
      work_id: appeal.work_id
    });

  } catch (err) {
    console.error('Request evidence error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to request evidence.',
      error: err.message
    });
  }
});

/**
 * PUT /api/senior/appeals/:appealId/decision
 * Senior authority makes the final binding decision on an appeal:
 * - 'accepted': Upheld! Sets work status to 'approved' and grants credit_awarded = TRUE.
 * - 'rejected': Denied! Manager rejection stands; credit remains FALSE.
 * - Records decision permanently in Appeal table and AuditLog table.
 */
router.put('/appeals/:appealId/decision', async (req, res) => {
  try {
    const seniorId = req.user.user_id;
    const { appealId } = req.params;
    const { decision, decision_reason } = req.body;

    // 1. Validate decision input
    if (!decision || !['accepted', 'rejected'].includes(decision.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Decision must be either 'accepted' or 'rejected'."
      });
    }

    if (!decision_reason || decision_reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'A formal decision reason is mandatory.'
      });
    }

    // 2. Fetch appeal
    const [appealRows] = await db.query(
      'SELECT a.*, w.title AS work_title FROM Appeal a JOIN WorkAssignment w ON a.work_id = w.work_id WHERE a.appeal_id = ?',
      [appealId]
    );

    if (appealRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appeal not found.'
      });
    }

    const appeal = appealRows[0];

    if (appeal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This appeal has already been decided as '${appeal.status}'.`
      });
    }

    const normalizedDecision = decision.toLowerCase();

    // 3. Update Appeal table
    await db.query(
      `UPDATE Appeal 
       SET status = ?, senior_id = ?, decision_reason = ?, decision_date = NOW() 
       WHERE appeal_id = ?`,
      [normalizedDecision, seniorId, decision_reason.trim(), appealId]
    );

    // 4. Update WorkAssignment based on outcome
    if (normalizedDecision === 'accepted') {
      // Appeal upheld: Grant credit and approve work
      await db.query(
        `UPDATE WorkAssignment 
         SET status = 'approved', credit_awarded = TRUE 
         WHERE work_id = ?`,
        [appeal.work_id]
      );
    }

    // 5. Record final decision in AuditLog
    await logAudit(
      appeal.work_id,
      'APPEAL_DECIDED',
      seniorId,
      `Senior Authority ${req.user.name} decided appeal #${appealId} as '${normalizedDecision.toUpperCase()}'. Reason: ${decision_reason.trim()}. Credit: ${normalizedDecision === 'accepted' ? 'AWARDED' : 'DENIED'}.`
    );

    return res.status(200).json({
      success: true,
      message: `Appeal #${appealId} has been ${normalizedDecision}.`,
      status: normalizedDecision,
      decision_reason: decision_reason.trim(),
      credit_awarded: normalizedDecision === 'accepted'
    });

  } catch (err) {
    console.error('Decide appeal error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to record appeal decision.',
      error: err.message
    });
  }
});

module.exports = router;
