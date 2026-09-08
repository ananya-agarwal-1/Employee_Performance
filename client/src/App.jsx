import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LoginPage from './components/LoginPage';
import EmployeeDashboard from './components/EmployeeDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import SeniorDashboard from './components/SeniorDashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Restore session from localStorage on initial page load
  useEffect(() => {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Verify with backend
        fetch('/api/auth/me', {
          headers: { 'x-user-id': parsed.user_id.toString() }
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.user) {
              setUser(data.user);
              localStorage.setItem('currentUser', JSON.stringify(data.user));
            } else {
              localStorage.removeItem('currentUser');
              setUser(null);
            }
          })
          .catch(() => {
            // Keep parsed user if offline/brief delay
            setUser(parsed);
          })
          .finally(() => setCheckingSession(false));
      } catch (e) {
        localStorage.removeItem('currentUser');
        setUser(null);
        setCheckingSession(false);
      }
    } else {
      setCheckingSession(false);
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('currentUser', JSON.stringify(userData));
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore network errors on logout
    }
    localStorage.removeItem('currentUser');
    setUser(null);
  };

  if (checkingSession) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading session...
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar user={user} onLogout={handleLogout} />

      {!user ? (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <>
          {user.role === 'employee' && <EmployeeDashboard user={user} />}
          {user.role === 'manager' && <ManagerDashboard user={user} />}
          {user.role === 'senior' && <SeniorDashboard user={user} />}
        </>
      )}

      <footer className="footer">
        Employee Performance & Work Management System • Department of Computer Science & Engineering
      </footer>
    </div>
  );
}
