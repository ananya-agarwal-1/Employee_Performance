import React, { useState, useEffect } from 'react';

export default function EmployeeDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('work'); // 'work' | 'appeals'
  const [assignments, setAssignments] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [selectedWork, setSelectedWork] = useState(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateText, setUpdateText] = useState('');

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [workUpdates, setWorkUpdates] = useState([]);

  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [appealReason, setAppealReason] = useState('');

  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [evidenceText, setEvidenceText] = useState('');

  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': user.user_id.toString()
  };

  // Fetch Work Assignments
  const fetchWork = async () => {
    try {
      const res = await fetch('/api/employee/work', { headers });
      const data = await res.json();
      if (res.ok) {
        setAssignments(data.assignments || []);
      } else {
        setError(data.message || 'Failed to load work assignments.');
      }
    } catch (err) {
      console.error(err);
      setError('Error fetching work assignments from server.');
    }
  };

  // Fetch Appeals
  const fetchAppeals = async () => {
    try {
      const res = await fetch('/api/employee/appeals', { headers });
      const data = await res.json();
      if (res.ok) {
        setAppeals(data.appeals || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setError('');
    await Promise.all([fetchWork(), fetchAppeals()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [user.user_id]);

  // Handle Post Daily Update
  const handleAddUpdate = async (e) => {
    e.preventDefault();
    if (!updateText.trim()) return;

    try {
      const res = await fetch(`/api/employee/work/${selectedWork.work_id}/update`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ update_text: updateText.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Progress update recorded successfully.');
        setUpdateModalOpen(false);
        setUpdateText('');
        fetchWork();
      } else {
        setError(data.message || 'Failed to record update.');
      }
    } catch (err) {
      setError('Server error submitting update.');
    }
  };

  // Handle Submit Completed Work
  const handleSubmitWork = async (workId, title) => {
    if (!window.confirm(`Are you ready to submit '${title}' for manager review?`)) return;

    try {
      const res = await fetch(`/api/employee/work/${workId}/submit`, {
        method: 'PUT',
        headers
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Work '${title}' submitted for manager review.`);
        fetchWork();
      } else {
        setError(data.message || 'Failed to submit work.');
      }
    } catch (err) {
      setError('Server error submitting work.');
    }
  };

  // Handle View Updates & History
  const handleOpenHistory = async (work) => {
    setSelectedWork(work);
    try {
      const res = await fetch(`/api/employee/work/${work.work_id}`, { headers });
      const data = await res.json();
      if (res.ok) {
        setWorkUpdates(data.updates || []);
        setHistoryModalOpen(true);
      }
    } catch (err) {
      setError('Failed to fetch update history.');
    }
  };

  // Handle Submit Appeal
  const handleOpenAppealModal = (work) => {
    setSelectedWork(work);
    setAppealReason('');
    setAppealModalOpen(true);
  };

  const handleSubmitAppeal = async (e) => {
    e.preventDefault();
    if (!appealReason.trim()) return;

    try {
      const res = await fetch('/api/employee/appeal', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          work_id: selectedWork.work_id,
          appeal_reason: appealReason.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Appeal submitted successfully to Senior Authority.');
        setAppealModalOpen(false);
        setAppealReason('');
        loadAll();
      } else {
        setError(data.message || 'Failed to submit appeal.');
      }
    } catch (err) {
      setError('Server error submitting appeal.');
    }
  };

  // Handle Provide Evidence
  const handleOpenEvidenceModal = (appeal) => {
    setSelectedAppeal(appeal);
    setEvidenceText('');
    setEvidenceModalOpen(true);
  };

  const handleSubmitEvidence = async (e) => {
    e.preventDefault();
    if (!evidenceText.trim()) return;

    try {
      const res = await fetch(`/api/employee/appeals/${selectedAppeal.appeal_id}/evidence`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ evidence_text: evidenceText.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Evidence submitted successfully.');
        setEvidenceModalOpen(false);
        setEvidenceText('');
      } else {
        setError(data.message || 'Failed to submit evidence.');
      }
    } catch (err) {
      setError('Server error submitting evidence.');
    }
  };

  // Stats calculation
  const totalTasks = assignments.length;
  const inProgressCount = assignments.filter((a) => a.status === 'in_progress').length;
  const approvedCount = assignments.filter((a) => a.status === 'approved').length;
  const creditsEarned = assignments.filter((a) => a.credit_awarded === 1 || a.credit_awarded === true).length;
  const pendingAppeals = appeals.filter((a) => a.status === 'pending').length;

  return (
    <div className="main-content">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Employee Portal — {user.name}</h2>
        <p className="dashboard-subtitle">
          Track your assigned work, submit daily progress, confirm credit status, and appeal unfair decisions.
        </p>
      </div>

      {/* Summary Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Assigned Work</div>
          <div className="stat-value">{totalTasks}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In Progress</div>
          <div className="stat-value">{inProgressCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved Tasks</div>
          <div className="stat-value">{approvedCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Credits Earned</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{creditsEarned}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Appeals</div>
          <div className="stat-value" style={{ color: pendingAppeals > 0 ? 'var(--warning)' : 'inherit' }}>
            {pendingAppeals}
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

      {/* Navigation Tabs */}
      <div className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'work' ? 'active' : ''}`}
          onClick={() => setActiveTab('work')}
        >
          My Assigned Work ({assignments.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'appeals' ? 'active' : ''}`}
          onClick={() => setActiveTab('appeals')}
        >
          My Appeals ({appeals.length})
        </button>
      </div>

      {/* TAB 1: MY WORK */}
      {activeTab === 'work' && (
        <div className="card">
          <div className="card-title">Assigned Work Record</div>
          {loading ? (
            <p>Loading work assignments...</p>
          ) : assignments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No work assignments currently assigned to you.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title & Description</th>
                    <th>Manager</th>
                    <th>Due Date</th>
                    <th>Daily Updates</th>
                    <th>Status</th>
                    <th>Credit</th>
                    <th>Manager Feedback</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((item) => (
                    <tr key={item.work_id}>
                      <td>#{item.work_id}</td>
                      <td>
                        <strong>{item.title}</strong>
                        {item.description && (
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td>{item.manager_name}</td>
                      <td>{item.due_date ? new Date(item.due_date).toLocaleDateString() : 'N/A'}</td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenHistory(item)}
                        >
                          View Updates ({item.total_updates})
                        </button>
                      </td>
                      <td>
                        <span className={`status-badge status-${item.status}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {item.credit_awarded ? (
                          <span className="credit-yes">✓ Awarded</span>
                        ) : (
                          <span className="credit-no">No Credit</span>
                        )}
                      </td>
                      <td>
                        {item.rejection_reason ? (
                          <span style={{ color: 'var(--danger)', fontSize: '13px' }}>
                            {item.rejection_reason}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div className="btn-group">
                          {/* Add Daily Update (if not approved) */}
                          {item.status !== 'approved' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setSelectedWork(item);
                                setUpdateText('');
                                setUpdateModalOpen(true);
                              }}
                            >
                              + Update
                            </button>
                          )}

                          {/* Submit for Review */}
                          {(item.status === 'assigned' || item.status === 'in_progress') && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleSubmitWork(item.work_id, item.title)}
                            >
                              Submit
                            </button>
                          )}

                          {/* Appeal Button (if rejected or uncredited approved work) */}
                          {item.status === 'rejected' && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleOpenAppealModal(item)}
                            >
                              Appeal
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY APPEALS */}
      {activeTab === 'appeals' && (
        <div className="card">
          <div className="card-title">Submitted Appeals & Decisions</div>
          {appeals.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>You have not submitted any appeals yet.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Appeal #</th>
                    <th>Work Assignment</th>
                    <th>My Appeal Reason</th>
                    <th>Submission Date</th>
                    <th>Status</th>
                    <th>Senior Authority Decision</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appeals.map((app) => (
                    <tr key={app.appeal_id}>
                      <td>#{app.appeal_id}</td>
                      <td>
                        <strong>{app.work_title}</strong>
                        {app.manager_rejection_reason && (
                          <div style={{ fontSize: '12px', color: 'var(--danger)' }}>
                            Rejection: {app.manager_rejection_reason}
                          </div>
                        )}
                      </td>
                      <td>{app.appeal_reason}</td>
                      <td>{new Date(app.appeal_date).toLocaleString()}</td>
                      <td>
                        <span className={`status-badge status-${app.status}`}>
                          {app.status}
                        </span>
                      </td>
                      <td>
                        {app.decision_reason ? (
                          <div>
                            <strong>{app.senior_name || 'Senior Authority'}:</strong> {app.decision_reason}
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Date: {new Date(app.decision_date).toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Pending Senior Review</span>
                        )}
                      </td>
                      <td>
                        {app.status === 'pending' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEvidenceModal(app)}
                          >
                            Add Evidence
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD PROGRESS UPDATE */}
      {updateModalOpen && selectedWork && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Record Daily Progress Update</h3>
              <button className="btn-close" onClick={() => setUpdateModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleAddUpdate}>
              <div className="modal-body">
                <div style={{ marginBottom: '12px' }}>
                  <strong>Work:</strong> #{selectedWork.work_id} — {selectedWork.title}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="update_text">Today's Progress / Activity Description</label>
                  <textarea
                    id="update_text"
                    className="form-control"
                    placeholder="Describe what tasks or modules you worked on today..."
                    value={updateText}
                    onChange={(e) => setUpdateText(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setUpdateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VIEW UPDATE HISTORY */}
      {historyModalOpen && selectedWork && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Work Updates History — #{selectedWork.work_id}</h3>
              <button className="btn-close" onClick={() => setHistoryModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '14px' }}>
                <h4>{selectedWork.title}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Assigned by {selectedWork.manager_name} on {new Date(selectedWork.assigned_date).toLocaleDateString()}
                </p>
              </div>

              <div className="card-title" style={{ fontSize: '14px' }}>Progress Updates ({workUpdates.length})</div>
              {workUpdates.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No updates submitted yet.</p>
              ) : (
                <div className="updates-list">
                  {workUpdates.map((u) => (
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
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setHistoryModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SUBMIT APPEAL */}
      {appealModalOpen && selectedWork && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 style={{ color: 'var(--danger)' }}>Submit Appeal to Senior Authority</h3>
              <button className="btn-close" onClick={() => setAppealModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmitAppeal}>
              <div className="modal-body">
                <div style={{ marginBottom: '12px' }}>
                  <strong>Work Assignment:</strong> #{selectedWork.work_id} — {selectedWork.title}
                </div>
                {selectedWork.rejection_reason && (
                  <div className="alert alert-danger" style={{ marginBottom: '14px' }}>
                    <strong>Manager Rejection Reason:</strong> {selectedWork.rejection_reason}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label" htmlFor="appeal_reason">
                    Appeal Justification / Ground for Reconsideration
                  </label>
                  <textarea
                    id="appeal_reason"
                    className="form-control"
                    placeholder="Explain why you believe the work deserves credit or was improperly rejected..."
                    value={appealReason}
                    onChange={(e) => setAppealReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAppealModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Submit Appeal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: SUBMIT EVIDENCE */}
      {evidenceModalOpen && selectedAppeal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Submit Additional Evidence for Appeal #{selectedAppeal.appeal_id}</h3>
              <button className="btn-close" onClick={() => setEvidenceModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmitEvidence}>
              <div className="modal-body">
                <div style={{ marginBottom: '12px' }}>
                  <strong>Work:</strong> {selectedAppeal.work_title}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="evidence_text">
                    Evidence / Proof Details (commit hashes, test results, notes)
                  </label>
                  <textarea
                    id="evidence_text"
                    className="form-control"
                    placeholder="Provide additional evidence requested by Senior Authority..."
                    value={evidenceText}
                    onChange={(e) => setEvidenceText(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEvidenceModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Evidence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
