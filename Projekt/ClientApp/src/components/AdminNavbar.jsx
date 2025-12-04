import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import axios from 'axios';
import useAuth from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';

export default function AdminNavbar({ showAdminPanel = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  const { token, roles, user } = useAuth();

  useEffect(() => {
    // route change hook
  }, [location.pathname]);

  const isAuthenticated = !!token;
  const hasAdmin = Array.isArray(roles) && roles.includes('Admin');
  const hasInstructor = Array.isArray(roles) && roles.includes('Instructor');
  const hasParticipant = Array.isArray(roles) && roles.includes('Participant');
  const isOnlyParticipant = hasParticipant && !hasAdmin && !hasInstructor;

  async function handleLogout() {
    try {
      const hdrs = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API_URL}/api/auth/logout`, null, { headers: hdrs });
    } catch { /* ignore */ }
    try { delete axios.defaults.headers.common['Authorization']; } catch {}
    localStorage.removeItem('jwt');
    navigate('/login');
  }

  const btnBase = {
    padding: '12px 20px',
    border: 'none',
    borderRadius: 10,
    color: 'white',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 14
  };

  const gradientsAdmin = {
    home: 'linear-gradient(135deg, #34d399, #14b8a6)',
    admin: 'linear-gradient(135deg, #14b8a6, #06b6d4)',
    reports: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
    logs: 'linear-gradient(135deg, #8b5cf6, #764ba2)',
    signout: 'linear-gradient(135deg, #764ba2, #B23AC8)'
  };

  const gradientsInstructor = {
    home: 'linear-gradient(135deg, #14b8a6, #06b6d4)',
    reports: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
    signout: 'linear-gradient(135deg, #8b5cf6, #764ba2)'
  };

  const gradientsCommon = {
    left: 'linear-gradient(135deg, #34d399, #06b6d4)',
    middle: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
    right: 'linear-gradient(135deg, #8b5cf6, #B23AC8)'
  };

  function initials(first, last) {
    try { return (first?.[0] || '').toUpperCase() + (last?.[0] || '').toUpperCase(); } catch { return '' }
  }

  const fullName = (user && (user.firstName || user.lastName)) ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : null;
  const displayName = fullName || (user && (user.email || user.name || user.emailAddress || user.userName)) || null;

  // build role buttons
  const roleButtons = [];

  if (hasAdmin && !hasInstructor) {
    roleButtons.push(
      <Link key="admin-panel" to='/admin'>
        <button style={{ ...btnBase, background: gradientsAdmin.admin }}>Admin panel</button>
      </Link>,
      <Link key="admin-reports" to='/admin/reports'>
        <button style={{ ...btnBase, background: gradientsAdmin.reports }}>Reports</button>
      </Link>,
      <Link key="admin-logs" to='/admin/logs'>
        <button style={{ ...btnBase, background: gradientsAdmin.logs }}>Logs</button>
      </Link>
    );
  }

  if (hasInstructor && !hasAdmin) {
    roleButtons.push(
      <Link key="instructor-workshops" to='/instructor/workshops'>
        <button style={{ ...btnBase, background: gradientsInstructor.home }}>Your Workshops</button>
      </Link>,
      <Link key="instructor-reports" to='/admin/reports'>
        <button style={{ ...btnBase, background: gradientsInstructor.reports }}>Reports</button>
      </Link>
    );
  }

  if (hasAdmin && hasInstructor) {
    roleButtons.push(
      <Link key="instructor-workshops" to='/instructor/workshops'>
        <button style={{ ...btnBase, background: gradientsInstructor.home }}>Your Workshops</button>
      </Link>,
      <Link key="admin-panel" to='/admin'>
        <button style={{ ...btnBase, background: gradientsAdmin.admin }}>Admin panel</button>
      </Link>,
      <Link key="admin-reports" to='/admin/reports'>
        <button style={{ ...btnBase, background: gradientsAdmin.reports }}>Reports</button>
      </Link>,
      <Link key="admin-logs" to='/admin/logs'>
        <button style={{ ...btnBase, background: gradientsAdmin.logs }}>Logs</button>
      </Link>
    );
  }

  const dedupedRoleButtons = Array.from(new Map(roleButtons.map(b => [b.key, b])).values());

  return (
    <nav style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', position: 'sticky', top: 0, zIndex: 100, width: '100%' }}>
      <div style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to='/' style={{ textDecoration: 'none', display:'flex', alignItems:'center', gap:12 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, background: 'linear-gradient(135deg, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              WorkshopHub
            </h1>
          </Link>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isAuthenticated && displayName && (
            isOnlyParticipant ? (
              <Link to='/account' style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none', marginRight: 8 }}>
                <div style={{ width:36, height:36, borderRadius:999, background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#3730a3' }}>
                  {initials(user?.firstName, user?.lastName) || (String(displayName).slice(0,2).toUpperCase())}
                </div>
                <div style={{ fontWeight:700, color:'#111827' }}>{fullName || displayName}</div>
              </Link>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginRight: 8 }}>
                <div style={{ width:36, height:36, borderRadius:999, background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#3730a3' }}>
                  {initials(user?.firstName, user?.lastName) || (String(displayName).slice(0,2).toUpperCase())}
                </div>
                <div style={{ fontWeight:700, color:'#111827' }}>{fullName || displayName}</div>
              </div>
            )
          )}

          <Link to='/'>
            <button style={{ ...btnBase, background: hasAdmin ? gradientsAdmin.home : hasInstructor ? gradientsInstructor.home : gradientsCommon.middle }}>
              Home
            </button>
          </Link>

          {isAuthenticated && dedupedRoleButtons}

          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              style={{
                ...btnBase,
                background: hasAdmin ? gradientsAdmin.signout : hasInstructor ? gradientsInstructor.signout : gradientsCommon.right,
                boxShadow: '0 4px 12px rgba(139,92,246,0.18)'
              }}
            >
              Sign out
            </button>
          ) : (
            <>
              <Link to='/login'>
                <button style={{ ...btnBase, background: 'linear-gradient(135deg, #14b8a6, #06b6d4)' }}>
                  Sign in
                </button>
              </Link>
              <Link to='/register'>
                <button style={{ ...btnBase, background: gradientsCommon.middle }}>
                  Get started
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
