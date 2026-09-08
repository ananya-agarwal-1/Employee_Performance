import React, { useState, useEffect } from 'react';

export default function SeniorDashboard({ user }) {
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'pending' | 'accepted' | 'rejected'
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Dossier Modal State
  const [dossierModalOpen, setDossierModalOpen] = useState(false);
  const [selectedAppealId, setSelectedAppealId] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  // Evidence Request Form inside Dossier
  const [evidenceTarget, setEvidenceTarget] = useState('employee'); // 'employee' | 'manager'
  const [evidenceRequestText, setEvidenceRequestText] = useState('');

  // Final Decision Form inside Dossier
  const [decisionChoice, setDecisionChoice] = useState('accepted'); // 'accepted' | 'rejected'
  const [decisionReason, setDecisionReason] = useState('');

  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': user.user_id.toString()
  };

  // Fetch Appeals
  const fetchAppeals = async () => {
    setLoading(true);
    setError('');
    try {
      const url = filterStatus === 'all' ? '/api/senior/appeals' : `/api/senior/appeals?status=${filterStatus}`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (res.ok) {
        setAppeals(data.appeals || []);
      } else {
        setError(data.message || 'Failed to fetch appeals.');
      }
    } catch (err) {
      console.error(err);
      setError('Server error fetching appeals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppeals();
  }, [filterStatus]);

  // Open Dossier
  const handleOpenDossier = async (appealId) => {
    setSelectedAppealId(appealId);
    setDossier(null);
    setDossierLoading(true);
    setDossierModalOpen(true);
    setEvidenceRequestText('');
    setDecisionReason('');

    try {
      const res = await fetch(`/api/senior/appeals/${appealId}/dossier`, { headers });
      const data = await res.json();
      if (res.ok) {
        setDossier(data.dossier);
      } else {
        setError(data.message || 'Failed to load appeal dossier.');
      }
    } catch (err) {
      setError('Server error loading investigation dossier.');
    } finally {
      setDossierLoading(false);
    }
  };

  // Send Evidence Request
  const handleRequestEvidence = async (e) => {
    e.preventDefault();
    if (!evidenceRequestText.trim()) return;

    try {
      const res = await fetch(`/api/senior/appeals/${selectedAppealId}/request-evidence`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          target: evidenceTarget,
          request_text: evidenceRequestText.trim()
        })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(data.message);
        setEvidenceRequestText('');
        // Reload dossier to see the new audit log entry
        handleOpenDossier(selectedAppealId);
      } else {
        setError(data.message || 'Failed to send evidence request.');
      }
    } catch (err) {
      setError('Server error requesting evidence.');
    }
  };

  // Submit Final Decision
  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    if (!decisionReason.trim()) {
      setError('A formal decision reason is mandatory.');
      return;
    }

    if (!window.confirm(`Are you sure you want to mark this appeal as '${decisionChoice.toUpperCase()}'? This decision is final and recorded permanently.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/senior/appeals/${selectedAppealId}/decision`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          decision: decisionChoice,
          decision_reason: decisionReason.trim()
        })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(data.message);
        setDossierModalOpen(false);
        fetchAppeals();
      } else {
        setError(data.message || 'Failed to record decision.');
      }
    } catch (err) {
      setError('Server error submitting final decision.');
    }
  };

  // Summary counts
  const totalAppeals = appeals.length;
  const pendingCount = appeals.filter((a) => a.appeal_status === 'pending').length;
  const acceptedCount = appeals.filter((a) => a.appeal_status === 'accepted').length;
  const rejectedCount = appeals.filter((a) => a.appeal_status === 'rejected').length;

  return (
    <div className="main-content">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Senior Authority Panel — {user.name}</h2>
        <p className="dashboard-subtitle">
          Independent review authority: investigate employee appeals, examine complete work audit trails, request evidence, and issue final binding decisions.
        </p>
      </div>

      {/* Summary Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Appeals</div>
          <div className="stat-value">{totalAppeals}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Adjudication</div>
          <div className="stat-value" style={{ color: pendingCount > 0 ? 'var(--warning)' : 'inherit' }}>
            {pendingCount}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Appeals Upheld (Credit Restored)</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{acceptedCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Appeals Dismissed</div>
          <div className="stat-value" style={{ color: rejectedCount > 0 ? 'var(--danger)' : 'inherit' }}>
            {rejectedCount}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert alert-danger" onClick={() => setError('')} style={{ cursor: 'pointer' }}>
          {error} (Click to dismiss)
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" onClick={() => setSuccessMsg('')} style={{ cursor: 'pointer' }}>
          {successMsg} (Click to dismiss)
        </div>
      )}

      {/* Filter Tabs */}
      <div className="tabs-nav">
        <button
          className={`tab-btn ${filterStatus === 'all' ? 'active' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          All Appeals
        </button>
        <button
          className={`tab-btn ${filterStatus === 'pending' ? 'active' : ''}`}
          onClick={() => setFilterStatus('pending')}
        >
          Pending Review ({pendingCount})
        </button>
        <button
          className={`tab-btn ${filterStatus === 'accepted' ? 'active' : ''}`}
          onClick={() => setFilterStatus('accepted')}
        >
          Accepted (Upheld)
        </button>
        <button
          className={`tab-btn ${filterStatus === 'rejected' ? 'active' : ''}`}
          onClick={() => setFilterStatus('rejected')}
        >
          Rejected (Dismissed)
        </button>
      </div>

      {/* Appeals Queue Table */}
      <div className="card">
        <div className="card-title">Employee Appeals Docket</div>
        {loading ? (
          <p>Loading appeals from database...</p>
        ) : appeals.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No appeals found for current filter.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Appeal #</th>
                  <th>Work Assignment</th>
                  <th>Employee</th>
                  <th>Assigning Manager</th>
                  <th>Grounds for Appeal</th>
                  <th>Date Filed</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appeals.map((item) => (
                  <tr key={item.appeal_id}>
                    <td>#{item.appeal_id}</td>
                    <td>
                      <strong>{item.work_title}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Work #{item.work_id} • Status: {item.work_status}
                      </div>
                    </td>
                    <td>
                      <strong>{item.employee_name}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.employee_email}</div>
                    </td>
                    <td>
                      <strong>{item.manager_name}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.manager_email}</div>
                    </td>
                    <td style={{ maxWidth: '280px' }}>
                      <div style={{ fontSize: '13px' }}>{item.appeal_reason}</div>
                      {item.manager_rejection_reason && (
                        <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '4px' }}>
                          <strong>Manager note:</strong> {item.manager_rejection_reason}
                        </div>
                      )}
                    </td>
                    <td>{new Date(item.appeal_date).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-badge status-${item.appeal_status}`}>
                        {item.appeal_status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleOpenDossier(item.appeal_id)}
                      >
                        Inspect Dossier & Decide
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INVESTIGATION DOSSIER MODAL */}
      {dossierModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Investigation Dossier — Appeal #{selectedAppealId}</h3>
              <button className="btn-close" onClick={() => setDossierModalOpen(false)}>×</button>
            </div>

            <div className="modal-body">
              {dossierLoading ? (
                <p>Retrieving complete evidence records and database audit trail...</p>
              ) : !dossier ? (
                <p>Could not load dossier.</p>
              ) : (
                <>
                  {/* 1. Appeal Overview */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '4px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4>{dossier.work.title} (Work #{dossier.work.work_id})</h4>
                      <span className={`status-badge status-${dossier.appeal.status}`}>
                        {dossier.appeal.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px' }}>
                      <strong>Employee:</strong> {dossier.appeal.employee_name} ({dossier.appeal.employee_email}) &nbsp;|&nbsp;
                      <strong> Manager:</strong> {dossier.appeal.manager_name} ({dossier.appeal.manager_email})
                    </p>
                    <p style={{ fontSize: '13px', marginTop: '6px' }}>
                      <strong>Employee's Stated Appeal Reason:</strong> "{dossier.appeal.appeal_reason}"
                    </p>
                    {dossier.work.rejection_reason && (
                      <p style={{ fontSize: '13px', color: 'var(--danger)', marginTop: '4px' }}>
                        <strong>Manager's Rejection Reason:</strong> "{dossier.work.rejection_reason}"
                      </p>
                    )}
                    {dossier.appeal.decision_reason && (
                      <div className="alert alert-info" style={{ marginTop: '10px', marginBottom: 0 }}>
                        <strong>Final Decision ({dossier.appeal.status.toUpperCase()}):</strong> {dossier.appeal.decision_reason}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Decided on {new Date(dossier.appeal.decision_date).toLocaleString()} by {dossier.appeal.senior_name || 'Senior Authority'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Employee Daily Progress Updates */}
                  <div className="card-title" style={{ fontSize: '14px' }}>
                    Recorded Daily Progress Updates ({dossier.updates.length})
                  </div>
                  {dossier.updates.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No updates logged in WorkUpdate table.</p>
                  ) : (
                    <div className="updates-list" style={{ maxHeight: '160px', marginBottom: '16px' }}>
                      {dossier.updates.map((u) => (
                        <div key={u.update_id} className="update-item">
                          <div className="update-meta">
                            <span>Update #{u.update_id}</span>
                            <span>{new Date(u.update_date).toLocaleString()}</span>
                          </div>
                          <div className="update-text">{u.update_text}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 3. Complete Database Audit Trail */}
                  <div className="card-title" style={{ fontSize: '14px' }}>
                    Immutable Database Audit Log Trail ({dossier.auditTrail.length} events)
                  </div>
                  <div className="updates-list" style={{ maxHeight: '180px', marginBottom: '16px' }}>
                    {dossier.auditTrail.map((log) => (
                      <div key={log.log_id} className="update-item" style={{ borderLeftColor: '#7c3aed' }}>
                        <div className="update-meta">
                          <span>
                            <strong>{log.action_type}</strong> by {log.performed_by_name || 'System'} ({log.performed_by_role || 'User'})
                          </span>
                          <span>{new Date(log.action_date).toLocaleString()}</span>
                        </div>
                        <div className="update-text" style={{ fontSize: '13px' }}>{log.details}</div>
                      </div>
                    ))}
                  </div>

                  {/* 4. Request Additional Evidence / Clarification Form */}
                  {dossier.appeal.status === 'pending' && (
                    <div style={{ background: '#fdf4ff', border: '1px solid #f0abfc', padding: '12px', borderRadius: '4px', marginBottom: '18px' }}>
                      <strong style={{ color: 'var(--purple)', fontSize: '13px' }}>
                        Request Additional Information / Evidence
                      </strong>
                      <form onSubmit={handleRequestEvidence} style={{ marginTop: '8px' }}>
                        <div className="form-group" style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', gap: '14px', marginBottom: '6px' }}>
                            <label style={{ fontSize: '13px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="target"
                                value="employee"
                                checked={evidenceTarget === 'employee'}
                                onChange={() => setEvidenceTarget('employee')}
                              /> Ask Employee
                            </label>
                            <label style={{ fontSize: '13px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="target"
                                value="manager"
                                checked={evidenceTarget === 'manager'}
                                onChange={() => setEvidenceTarget('manager')}
                              /> Ask Manager
                            </label>
                          </div>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Type evidence or explanation request (e.g. Please supply commit logs)..."
                            value={evidenceRequestText}
                            onChange={(e) => setEvidenceRequestText(e.target.value)}
                            required
                          />
                        </div>
                        <button type="submit" className="btn btn-primary btn-sm">
                          Send Evidence Request to {evidenceTarget === 'employee' ? 'Employee' : 'Manager'}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* 5. Issue Final Binding Decision Form */}
                  {dossier.appeal.status === 'pending' ? (
                    <div style={{ borderTop: '2px solid var(--border)', paddingTop: '16px' }}>
                      <div className="card-title" style={{ fontSize: '15px' }}>
                        Issue Final Binding Decision
                      </div>
                      <form onSubmit={handleDecisionSubmit}>
                        <div className="form-group">
                          <label className="form-label">Adjudication Ruling</label>
                          <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="decision"
                                value="accepted"
                                checked={decisionChoice === 'accepted'}
                                onChange={() => setDecisionChoice('accepted')}
                              />
                              <strong style={{ color: 'var(--success)' }}>
                                Accept Appeal (Restore Credit & Approve Work)
                              </strong>
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="decision"
                                value="rejected"
                                checked={decisionChoice === 'rejected'}
                                onChange={() => setDecisionChoice('rejected')}
                              />
                              <strong style={{ color: 'var(--danger)' }}>
                                Reject Appeal (Uphold Manager's Rejection)
                              </strong>
                            </label>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label" htmlFor="decision_reason">
                            Formal Reason for Adjudication (Mandatory)
                          </label>
                          <textarea
                            id="decision_reason"
                            className="form-control"
                            placeholder="Detail why the evidence supports or contradicts the claim. This note is permanently stored in MySQL..."
                            value={decisionReason}
                            onChange={(e) => setDecisionReason(e.target.value)}
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          className={`btn ${decisionChoice === 'accepted' ? 'btn-success' : 'btn-danger'}`}
                          style={{ width: '100%', padding: '10px' }}
                        >
                          Confirm Final Decision: {decisionChoice === 'accepted' ? 'Accept & Award Credit' : 'Reject Appeal'}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="alert alert-info">
                      This appeal has already been decided. The database record is closed.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDossierModalOpen(false)}>
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
