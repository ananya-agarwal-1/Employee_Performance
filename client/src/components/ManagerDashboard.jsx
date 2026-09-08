import React, { useState, useEffect } from 'react';

export default function ManagerDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('assigned'); // 'assigned' | 'assign-new' | 'appeals'
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Assign Work Form State
  const [formData, setFormData] = useState({
    employee_id: '',
    title: '',
    description: '',
    due_date: ''
  });

  // Review Modal State
  const [selectedWork, setSelectedWork] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [workUpdates, setWorkUpdates] = useState([]);
  const [reviewAction, setReviewAction] = useState('approve'); // 'approve' | 'reject'
  const [creditAwarded, setCreditAwarded] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');

  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': user.user_id.toString()
  };

  // Fetch Manager Assignments
  const fetchWork = async () => {
    try {
      const res = await fetch('/api/manager/work', { headers });
      const data = await res.json();
      if (res.ok) {
        setAssignments(data.assignments || []);
      } else {
        setError(data.message || 'Failed to load manager work.');
      }
    } catch (err) {
      console.error(err);
      setError('Error fetching work assignments from server.');
    }
  };

  // Fetch Available Employees for Dropdown
  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/manager/employees', { headers });
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.employees || []);
        if (data.employees && data.employees.length > 0 && !formData.employee_id) {
          setFormData((prev) => ({ ...prev, employee_id: data.employees[0].user_id }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Appeals
  const fetchAppeals = async () => {
    try {
      const res = await fetch('/api/manager/appeals', { headers });
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
    await Promise.all([fetchWork(), fetchEmployees(), fetchAppeals()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [user.user_id]);

  // Handle Assign Work Submission
  const handleAssignWork = async (e) => {
    e.preventDefault();
    if (!formData.employee_id || !formData.title || !formData.due_date) {
      setError('Please fill in employee, title, and due date.');
      return;
    }

    try {
      const res = await fetch('/api/manager/assign', {
        method: 'POST',
        headers,
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(`Work '${formData.title}' assigned successfully (Work ID #${data.work_id}).`);
        setFormData({
          employee_id: employees.length > 0 ? employees[0].user_id : '',
          title: '',
          description: '',
          due_date: ''
        });
        setActiveTab('assigned');
        fetchWork();
      } else {
        setError(data.message || 'Failed to assign work.');
      }
    } catch (err) {
      setError('Server error during work assignment.');
    }
  };

  // Open Review Dialog
  const handleOpenReview = async (work) => {
    setSelectedWork(work);
    setReviewAction('approve');
    setCreditAwarded(true);
    setRejectionReason('');

    try {
      const res = await fetch(`/api/manager/work/${work.work_id}`, { headers });
      const data = await res.json();
      if (res.ok) {
        setWorkUpdates(data.updates || []);
        setReviewModalOpen(true);
      }
    } catch (err) {
      setError('Failed to fetch work details.');
    }
  };

  // Submit Review Decision
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (reviewAction === 'reject' && !rejectionReason.trim()) {
      setError('Rejection reason is mandatory when rejecting work.');
      return;
    }

    try {
      const res = await fetch(`/api/manager/work/${selectedWork.work_id}/review`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          action: reviewAction,
          credit_awarded: reviewAction === 'approve' ? creditAwarded : false,
          rejection_reason: reviewAction === 'reject' ? rejectionReason.trim() : null
        })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(data.message);
        setReviewModalOpen(false);
        fetchWork();
      } else {
        setError(data.message || 'Failed to submit review.');
      }
    } catch (err) {
      setError('Server error submitting review decision.');
    }
  };

  // Stats calculation
  const totalAssigned = assignments.length;
  const pendingReviewCount = assignments.filter((a) => a.status === 'submitted').length;
  const approvedCount = assignments.filter((a) => a.status === 'approved').length;
  const rejectedCount = assignments.filter((a) => a.status === 'rejected').length;
  const activeAppealsCount = appeals.filter((a) => a.appeal_status === 'pending').length;

  return (
    <div className="main-content">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Manager Workspace — {user.name}</h2>
        <p className="dashboard-subtitle">
          Assign work, track employee updates, review submissions, award credit, and monitor dispute appeals.
        </p>
      </div>

      {/* Summary Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Assigned</div>
          <div className="stat-value">{totalAssigned}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Review</div>
          <div className="stat-value" style={{ color: pendingReviewCount > 0 ? 'var(--purple)' : 'inherit' }}>
            {pendingReviewCount}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{approvedCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Rejected</div>
          <div className="stat-value" style={{ color: rejectedCount > 0 ? 'var(--danger)' : 'inherit' }}>
            {rejectedCount}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Team Appeals</div>
          <div className="stat-value" style={{ color: activeAppealsCount > 0 ? 'var(--warning)' : 'inherit' }}>
            {activeAppealsCount}
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
          className={`tab-btn ${activeTab === 'assigned' ? 'active' : ''}`}
          onClick={() => setActiveTab('assigned')}
        >
          Assigned Work & Review ({assignments.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'assign-new' ? 'active' : ''}`}
          onClick={() => setActiveTab('assign-new')}
        >
          + Assign New Work
        </button>
        <button
          className={`tab-btn ${activeTab === 'appeals' ? 'active' : ''}`}
          onClick={() => setActiveTab('appeals')}
        >
          Team Appeals ({appeals.length})
        </button>
      </div>

      {/* TAB 1: ASSIGNED WORK & REVIEWS */}
      {activeTab === 'assigned' && (
        <div className="card">
          <div className="card-title">Assigned Tasks Overview</div>
          {loading ? (
            <p>Loading records...</p>
          ) : assignments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>You have not assigned any work yet. Use the 'Assign New Work' tab to begin.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Task Title & Details</th>
                    <th>Assigned Employee</th>
                    <th>Assigned Date</th>
                    <th>Due Date</th>
                    <th>Daily Updates</th>
                    <th>Status</th>
                    <th>Credit</th>
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
                        {item.rejection_reason && (
                          <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '4px' }}>
                            <strong>Rejection reason:</strong> {item.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td>
                        <strong>{item.employee_name}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.employee_email}</div>
                      </td>
                      <td>{new Date(item.assigned_date).toLocaleDateString()}</td>
                      <td>{item.due_date ? new Date(item.due_date).toLocaleDateString() : 'N/A'}</td>
                      <td>{item.total_updates} update(s)</td>
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
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenReview(item)}
                        >
                          Review & Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ASSIGN NEW WORK */}
      {activeTab === 'assign-new' && (
        <div className="card" style={{ maxWidth: '700px' }}>
          <div className="card-title">Assign New Work Assignment</div>
          <form onSubmit={handleAssignWork}>
            <div className="form-group">
              <label className="form-label" htmlFor="employee_id">Select Employee</label>
              <select
                id="employee_id"
                className="form-control"
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                required
              >
                {employees.map((emp) => (
                  <option key={emp.user_id} value={emp.user_id}>
                    {emp.name} ({emp.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="title">Work Title</label>
              <input
                id="title"
                type="text"
                className="form-control"
                placeholder="e.g. Implement Student Registration API"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="description">Work Description & Scope</label>
              <textarea
                id="description"
                className="form-control"
                placeholder="Specify requirements, constraints, expected deliverables..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="due_date">Due Date</label>
              <input
                id="due_date"
                type="date"
                className="form-control"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
              Assign Work to Employee
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: TEAM APPEALS */}
      {activeTab === 'appeals' && (
        <div className="card">
          <div className="card-title">Employee Appeals on Your Work Assignments</div>
          {appeals.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No appeals have been submitted by employees under your assignments.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Appeal #</th>
                    <th>Work Assignment</th>
                    <th>Employee</th>
                    <th>Appeal Reason</th>
                    <th>Date Filed</th>
                    <th>Status</th>
                    <th>Senior Authority Decision</th>
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
                            Your rejection note: {app.manager_rejection_reason}
                          </div>
                        )}
                      </td>
                      <td>{app.employee_name}</td>
                      <td>{app.appeal_reason}</td>
                      <td>{new Date(app.appeal_date).toLocaleDateString()}</td>
                      <td>
                        <span className={`status-badge status-${app.appeal_status}`}>
                          {app.appeal_status}
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
                          <span style={{ color: 'var(--text-muted)' }}>Under Review by Senior Authority</span>
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

      {/* MODAL: REVIEW WORK & INSPECT UPDATES */}
      {reviewModalOpen && selectedWork && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Review Work Assignment #{selectedWork.work_id}</h3>
              <button className="btn-close" onClick={() => setReviewModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleReviewSubmit}>
              <div className="modal-body">
                <div style={{ marginBottom: '14px' }}>
                  <h4>{selectedWork.title}</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Performed by: <strong>{selectedWork.employee_name}</strong> | Current Status: <strong>{selectedWork.status}</strong>
                  </p>
                  {selectedWork.description && (
                    <p style={{ fontSize: '13px', marginTop: '6px' }}>{selectedWork.description}</p>
                  )}
                </div>

                <div className="card-title" style={{ fontSize: '14px', marginTop: '16px' }}>
                  Employee Daily Progress Updates ({workUpdates.length})
                </div>
                {workUpdates.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    No daily updates recorded by employee for this work.
                  </p>
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

                <div className="card-title" style={{ fontSize: '14px', marginTop: '20px' }}>
                  Manager Review Decision
                </div>

                <div className="form-group">
                  <label className="form-label">Review Action</label>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="action"
                        value="approve"
                        checked={reviewAction === 'approve'}
                        onChange={() => setReviewAction('approve')}
                      />
                      <strong style={{ color: 'var(--success)' }}>Approve Work</strong>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="action"
                        value="reject"
                        checked={reviewAction === 'reject'}
                        onChange={() => setReviewAction('reject')}
                      />
                      <strong style={{ color: 'var(--danger)' }}>Reject Work</strong>
                    </label>
                  </div>
                </div>

                {reviewAction === 'approve' && (
                  <div className="form-group" style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={creditAwarded}
                        onChange={(e) => setCreditAwarded(e.target.checked)}
                      />
                      <span><strong>Award Credit to Employee</strong> (Confirmed performance record)</span>
                    </label>
                  </div>
                )}

                {reviewAction === 'reject' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="rejection_reason">
                      Mandatory Reason for Rejection
                    </label>
                    <textarea
                      id="rejection_reason"
                      className="form-control"
                      placeholder="Clearly state what criteria were not met or required revisions..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setReviewModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${reviewAction === 'approve' ? 'btn-success' : 'btn-danger'}`}
                >
                  Confirm {reviewAction === 'approve' ? 'Approval' : 'Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
