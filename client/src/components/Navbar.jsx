import React from 'react';

export default function Navbar({ user, onLogout }) {
  return (
    <header className="navbar">
      <div className="navbar-brand">
        <h1>Employee Performance Management System</h1>
        <p>College DBMS Project • Transparent Work & Credit Tracking</p>
      </div>
      {user && (
        <div className="navbar-user">
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <span className={`role-badge role-${user.role}`}>{user.role}</span>
          </div>
          <button className="btn-logout" onClick={onLogout}>
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
