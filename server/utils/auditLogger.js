const db = require('../db');

/**
 * Foundation Audit Logger Utility
 * Records an immutable audit log entry into the MySQL AuditLog table.
 * Used across work assignment, progress submission, review, approval/rejection,
 * credit assignment, and appeals to maintain total transparency.
 *
 * @param {number|null} workId - The work assignment ID (can be null for system/general events)
 * @param {string} actionType - E.g. 'WORK_ASSIGNED', 'WORK_UPDATE', 'WORK_SUBMITTED', 'WORK_APPROVED', 'WORK_REJECTED', 'APPEAL_CREATED', 'APPEAL_DECIDED'
 * @param {number} performedBy - The user_id of the person performing the action
 * @param {string} details - Descriptive text explaining the action
 */
async function logAudit(workId, actionType, performedBy, details) {
  try {
    const [result] = await db.query(
      'INSERT INTO AuditLog (work_id, action_type, performed_by, action_date, details) VALUES (?, ?, ?, NOW(), ?)',
      [workId, actionType, performedBy, details]
    );
    return { success: true, log_id: result.insertId };
  } catch (err) {
    // We log the error to server console, but do not crash the calling request
    console.error('Failed to write audit log entry:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  logAudit
};
