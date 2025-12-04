import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

// Align with backend default dev URL
const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';

function Register() {
  const navigate = useNavigate();
  const [registerData, setRegisterData] = useState({ 
    firstName: '', 
    lastName: '', 
    email: '', 
    password: '' 
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      await axios.post(`${API_URL}/api/auth/register`, registerData, {
        headers: { 'Content-Type': 'application/json' }
      });
      setMessage('Account created successfully! Redirecting to login...');
      setRegisterData({ firstName: '', lastName: '', email: '', password: '' });
      setTimeout(() => { navigate('/login'); }, 2000);
    } catch (error) {
      let errorMsg = 'Something went wrong. Please try again.';
      if (error?.response) {
        const data = error.response.data;
        if (data?.message) errorMsg = data.message;
        else if (data?.errors) {
          const errs = Object.values(data.errors).flat().join(' ');
          errorMsg = errs || errorMsg;
        }
      }
      setMessage(errorMsg);
      console.error('Register error:', error);
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
      onMouseOver={(e) => {
        e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
      }}
      onMouseOut={(e) => {
        e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
      }}>
        Home
      </Link>

      <div style={{
        maxWidth: '420px',
        width: '100%',
        padding: '48px 40px',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '28px', 
            color: '#1a202c',
            marginBottom: '8px',
            fontWeight: '700'
          }}>
            Create Account
          </h1>
          <p style={{ color: '#718096', fontSize: '15px' }}>
            Join us today - it's free!
          </p>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '24px',
            backgroundColor: message.toLowerCase().includes('success') ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${message.toLowerCase().includes('success') ? '#86efac' : '#fca5a5'}`,
            borderRadius: '8px',
            color: message.toLowerCase().includes('success') ? '#166534' : '#991b1b',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontWeight: '500', fontSize: '14px' }}>
              First Name
            </label>
            <input
              type="text"
              placeholder="John"
              value={registerData.firstName}
              onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
              style={{
                width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box', backgroundColor: '#f9fafb'
              }}
              required
              minLength={2}
              disabled={loading}
              onFocus={(e) => { e.target.style.borderColor = '#10b981'; e.target.style.backgroundColor = 'white'; }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.backgroundColor = '#f9fafb'; }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontWeight: '500', fontSize: '14px' }}>
              Last Name
            </label>
            <input
              type="text"
              placeholder="Doe"
              value={registerData.lastName}
              onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
              style={{
                width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box', backgroundColor: '#f9fafb'
              }}
              required
              minLength={2}
              disabled={loading}
              onFocus={(e) => { e.target.style.borderColor = '#10b981'; e.target.style.backgroundColor = 'white'; }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.backgroundColor = '#f9fafb'; }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              color: '#374151',
              fontWeight: '500',
              fontSize: '14px'
            }}>
              Email Address
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={registerData.email}
              onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '15px',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
                backgroundColor: '#f9fafb'
              }}
              required
              disabled={loading}
              onFocus={(e) => {
                e.target.style.borderColor = '#10b981';
                e.target.style.backgroundColor = 'white';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.backgroundColor = '#f9fafb';
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              color: '#374151',
              fontWeight: '500',
              fontSize: '14px'
            }}>
              Password
            </label>
            <input
              type="password"
              placeholder="Create a strong password"
              value={registerData.password}
              onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '15px',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
                backgroundColor: '#f9fafb'
              }}
              required
              minLength={6}
              disabled={loading}
              onFocus={(e) => {
                e.target.style.borderColor = '#10b981';
                e.target.style.backgroundColor = 'white';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.backgroundColor = '#f9fafb';
              }}
            />
            <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              Minimum 6 characters
            </small>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginBottom: '16px'
            }}
            onMouseOver={(e) => !loading && (e.target.style.transform = 'translateY(-1px)')}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ 
          textAlign: 'center',
          paddingTop: '24px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Already have an account?{' '}
            <Link 
              to="/login" 
              style={{ color: '#10b981', textDecoration: 'none', fontWeight: '600' }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
