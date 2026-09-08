import React, { useState } from 'react';

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Login failed. Please check your credentials.');
      } else {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Cannot connect to backend server. Make sure the server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <h2>User Login</h2>
          <p>Enter your account credentials to access your dashboard</p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="e.g. amit.employee@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="demo-box">
          <div className="demo-title">Quick Demo Logins (Viva Presentation)</div>
          <div className="demo-buttons">
            <button
              type="button"
              className="btn-demo"
              onClick={() => handleQuickLogin('amit.employee@company.com', 'employee123')}
            >
              <span><strong>Amit Kumar</strong> (Employee)</span>
              <span className="badge">Fill Demo</span>
            </button>
            <button
              type="button"
              className="btn-demo"
              onClick={() => handleQuickLogin('rahul.manager@company.com', 'manager123')}
            >
              <span><strong>Rahul Sharma</strong> (Manager)</span>
              <span className="badge">Fill Demo</span>
            </button>
            <button
              type="button"
              className="btn-demo"
              onClick={() => handleQuickLogin('anjali.senior@company.com', 'senior123')}
            >
              <span><strong>Anjali Gupta</strong> (Senior Authority)</span>
              <span className="badge">Fill Demo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
