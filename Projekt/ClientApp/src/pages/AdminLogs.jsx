import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import AdminNavbar from '../components/AdminNavbar';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';

function useAuthAdmin() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  const isAdmin = useMemo(() => {
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const roleClaimUri = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
      const roles = [
        ...(payload.role ? (Array.isArray(payload.role) ? payload.role : [payload.role]) : []),
        ...(payload[roleClaimUri] ? (Array.isArray(payload[roleClaimUri]) ? payload[roleClaimUri] : [payload[roleClaimUri]]) : [])
      ];
      return roles.includes('Admin');
    } catch { return false; }
  }, [token]);
  return { token, isAdmin };
}

export default function AdminLogs() {
  const { token, isAdmin } = useAuthAdmin();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // gradients consistent with other admin pages
  const gradients = {
    category: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
    address: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    workshop: 'linear-gradient(135deg, #667eea, #764ba2)'
  };
  const btn = { padding: '8px 12px', borderRadius: 8, border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer' };

  const [filters, setFilters] = useState({
    from: '',
    to: '',
    userId: '',
    action: '',
    search: '',
    page: 1,
    pageSize: 50
  });

  const [data, setData] = useState({ total: 0, page: 1, pageSize: 50, items: [] });
  const [report, setReport] = useState(null);

  useEffect(() => {
    if (!token || !isAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.pageSize]);

  function buildParams(obj) {
    const params = new URLSearchParams();
    if (obj.from) params.set('from', new Date(obj.from).toISOString());
    if (obj.to) params.set('to', new Date(obj.to).toISOString());
    if (obj.userId) params.set('userId', obj.userId);
    if (obj.action) params.set('action', obj.action);
    if (obj.search) params.set('search', obj.search);
    params.set('page', String(obj.page || 1));
    params.set('pageSize', String(obj.pageSize || 50));
    return params;
  }

  async function load(customFilters) {
    setLoading(true); setError('');
    try {
      const useFilters = customFilters ?? filters;
      const params = buildParams(useFilters);
      const resp = await axios.get(`${API_URL}/api/logs?${params.toString()}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setData(resp.data);
    } catch (e) {
      setError(e?.response?.data ?? e?.message ?? 'Failed to load logs');
    } finally { setLoading(false); }
  }

  async function loadReport() {
    setLoading(true); setError('');
    try {
      const params = buildParams(filters);
      const resp = await axios.get(`${API_URL}/api/logs/report?${params.toString()}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setReport(resp.data);
    } catch (e) { setError(e?.response?.data ?? e?.message ?? 'Failed to load report'); }
    finally { setLoading(false); }
  }

  // export and report features removed - frontend now only supports browsing logs with filters

  function onChange(name, value) {
    setFilters(prev => ({ ...prev, [name]: value, page: name === 'page' ? value : 1 }));
  }

  if (!token || !isAdmin) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #f9fafb, #ffffff)' }}>
      <AdminNavbar showAdminPanel={true} />
      <div style={{ maxWidth: 1200, margin: '24px auto', padding: '0 24px 60px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <h2 style={{ margin:0 }}>Logs</h2>
          <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          </div>
        </div>

        <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:12, marginBottom:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
            <div>
              <div style={{ fontSize:12, color:'#6b7280' }}>From</div>
              <input type="datetime-local" value={filters.from} onChange={e=> onChange('from', e.target.value)} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
            </div>
            <div>
              <div style={{ fontSize:12, color:'#6b7280' }}>To</div>
              <input type="datetime-local" value={filters.to} onChange={e=> onChange('to', e.target.value)} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
            </div>
            <div>
              <div style={{ fontSize:12, color:'#6b7280' }}>User ID</div>
              <input value={filters.userId} onChange={e=> onChange('userId', e.target.value)} placeholder="e.g. 5" style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
            </div>
            <div>
              <div style={{ fontSize:12, color:'#6b7280' }}>Action</div>
              <select value={filters.action} onChange={e=> onChange('action', e.target.value)} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }}>
                <option value="">(any)</option>
                {/* Complete list of audit actions from AuditActions.cs */}
                {Array.from(new Set([
                  // User actions
                  'USER_REGISTERED','USER_LOGGED_IN','USER_LOGGED_OUT','USER_PASSWORD_CHANGED',
                  'USER_CREATED','USER_UPDATED','USER_DELETED',
                  // Role actions
                  'ROLE_ASSIGNED','ROLE_REMOVED',
                  // Enrollment actions
                  'ENROLLED_IN_CYCLE','ENROLLMENT_CREATED','ENROLLMENT_CANCELLED',
                  'MY_ENROLLMENT_CANCELLED','ENROLLMENT_DELETED',
                  // Payment actions
                  'PAYMENT_CREATED','PAYMENT_UPDATED','PAYMENT_MARKED_PAID','PAYMENT_DELETED',
                  // Workshop actions
                  'WORKSHOP_CREATED','WORKSHOP_UPDATED','WORKSHOP_DELETED',
                  'WORKSHOP_IMAGE_UPLOADED','PHOTO_EDITED',
                  // Cycle actions
                  'CYCLE_CREATED','CYCLE_UPDATED','CYCLE_DELETED','CYCLE_ENROLLMENTS_CANCELLED',
                  // Session actions
                  'SESSION_CREATED','SESSION_UPDATED','SESSION_DELETED',
                  // Address actions
                  'ADDRESS_CREATED','ADDRESS_UPDATED','ADDRESS_DELETED',
                  // Category actions
                  'CATEGORY_CREATED','CATEGORY_UPDATED','CATEGORY_DELETED',
                  // Review actions
                  'REVIEW_CREATED','REVIEW_UPDATED','REVIEW_DELETED',
                  // Error actions
                  'ERROR_UNHANDLED','ERROR_DATABASE','ERROR_VALIDATION'
                ])).sort().map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:12, color:'#6b7280' }}>Search</div>
              <input value={filters.search} onChange={e=> onChange('search', e.target.value)} placeholder="free text in details" style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
            </div>
            <div>
              <div style={{ fontSize:12, color:'#6b7280' }}>Page size</div>
              <select value={filters.pageSize} onChange={e=> onChange('pageSize', parseInt(e.target.value, 10))} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }}>
                {[25, 50, 100, 200, 500].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop:8, display:'flex', gap:8 }}>
            <button
              onClick={() => {
                const next = { ...filters, page: 1 };
                setFilters(next);
                load(next);
              }}
              style={{ ...btn, background: gradients.workshop }}
            >
              Apply
            </button>
            <button
              onClick={() => {
                const cleared = { from:'', to:'', userId:'', action:'', search:'', page:1, pageSize:50 };
                setFilters(cleared);
                load(cleared);
              }}
              style={{ ...btn, background: gradients.address }}
            >
              Clear
            </button>
          </div>
        </div>

        {error && <div style={{ marginBottom: 16, padding: '12px 16px', color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>{String(error)}</div>}

        <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12 }}>
          <div style={{ padding:8, borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center' }}>
            <div style={{ fontWeight:700 }}>Logs ({data.total})</div>
            <div style={{ marginLeft:'auto', fontSize:12, color:'#6b7280' }}>{loading ? 'Loading...' : ''}</div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #e5e7eb', background:'#f9fafb' }}>
                  <th style={{ textAlign:'left', padding:8 }}>Created (UTC)</th>
                  <th style={{ textAlign:'left', padding:8 }}>User</th>
                  <th style={{ textAlign:'left', padding:8 }}>Action</th>
                  <th style={{ textAlign:'left', padding:8 }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map(l => (
                  <tr key={l.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                    <td style={{ padding:8 }}>{new Date(l.createdAt).toISOString()}</td>
                    <td style={{ padding:8 }}>{l.user ? `${l.user.id} - ${l.user.email}` : '-'}</td>
                    <td style={{ padding:8 }}>{l.action}</td>
                    <td style={{ padding:8, maxWidth:600, whiteSpace:'pre-wrap' }}>{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:8 }}>
            <div>Page {data.page} of {Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || 50)))}</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))} disabled={filters.page <= 1} style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #e5e7eb' }}>Prev</button>
              <button onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))} disabled={(data.page * data.pageSize) >= data.total} style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #e5e7eb' }}>Next</button>
            </div>
          </div>
        </div>

        {/* report feature removed */}
       </div>
     </div>
   );
 }
