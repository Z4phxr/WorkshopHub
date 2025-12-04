import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';

function Login() {
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Ensure no stale Authorization header is sent with the login request
      try { delete axios.defaults.headers.common['Authorization']; } catch {}

      const response = await axios.post(
        `${API_URL}/api/auth/login`,
        loginData,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const jwtToken = response.data.token;
      if (!jwtToken) throw new Error('No token in response');

      localStorage.setItem('jwt', jwtToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${jwtToken}`;

      // store roles returned by the API for client-side route guards (handle both casing)
      const roles = response.data.roles || response.data.Roles || [];
      try { localStorage.setItem('roles', JSON.stringify(roles)); } catch { }
      setMessage('Successfully logged in!');

      setTimeout(() => navigate('/'), 1000);
    } catch (error) {
      // Prefer server-provided message; default to Invalid email or password on 401
      let errorMsg = 'Something went wrong. Please try again.';
      if (error && error.response) {
        const status = error.response.status;
        const data = error.response.data;
        if (data && typeof data === 'object' && data.message) {
          errorMsg = data.message;
        } else if (status === 401) {
          errorMsg = 'Invalid email or password.';
        }
      }
      setMessage(errorMsg);
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      // image background with semi-transparent overlay to keep text readable
      backgroundImage: "linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('/images/auth-bg.png')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      position: 'relative'
    }}>
      {/* Home Button */}
      <Link to="/" style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        padding: '10px 20px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '14px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        transition: 'all 0.2s'
      }}
      onMouseOver={(e) => { e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'; }}
      onMouseOut={(e) => { e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'; }}>
        Home
      </Link>

      <div style={{
        maxWidth: '420px',
        width: '100%',
        padding: '48px 40px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', color: '#1a202c', marginBottom: '8px', fontWeight: '700' }}>
            Welcome Back
          </h1>
          <p style={{ color: '#718096', fontSize: '15px' }}>
            Sign in to your account
          </p>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '24px',
            backgroundColor: message.includes('Successfully') ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${message.includes('Successfully') ? '#86efac' : '#fca5a5'}`,
            borderRadius: '8px',
            color: message.includes('Successfully') ? '#166534' : '#991b1b',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontWeight: '500', fontSize: '14px' }}>
              Email Address
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={loginData.email}
              onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
              style={{
                width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px',
                outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box', backgroundColor: '#f9fafb'
              }}
              required
              disabled={loading}
              onFocus={(e) => { e.target.style.borderColor = '#667eea'; e.target.style.backgroundColor = 'white'; }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.backgroundColor = '#f9fafb'; }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ color: '#374151', fontWeight: '500', fontSize: '14px' }}>
                Password
              </label>
            </div>
            <input
              type="password"
              placeholder="Enter your password"
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              style={{
                width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px',
                outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box', backgroundColor: '#f9fafb'
              }}
              required
              disabled={loading}
              onFocus={(e) => { e.target.style.borderColor = '#667eea'; e.target.style.backgroundColor = 'white'; }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.backgroundColor = '#f9fafb'; }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', background: loading ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', marginBottom: '16px'
            }}
            onMouseOver={(e) => !loading && (e.target.style.transform = 'translateY(-1px)')}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ textAlign: 'center', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#667eea', textDecoration: 'none', fontWeight: '600' }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
