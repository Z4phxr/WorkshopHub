/**
 * AdminPanel.jsx
 * Admin landing page listing workshops, categories and addresses with quick actions.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { authHeaders } from '../utils/api';
import AdminNavbar from '../components/AdminNavbar';
import UsersTable from '../components/UsersTable';

const PLACEHOLDER = '/placeholder.svg';
const resolveImg = (u) => { if (!u) return PLACEHOLDER; if (/^https?:\/\//i.test(u)) return u; return `${api.API_URL}${u.startsWith('/') ? '' : '/'}${u}`; };

export default function AdminPanel() {
  const navigate = useNavigate();
  const [workshops, setWorkshops] = useState([]);
  const [categories, setCategories] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => {
    if (!token || !isAdmin) { navigate('/'); return; }
    loadPage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function loadPage() {
    setLoading(true); setError('');
    try {
      const [ws, cats, addrs] = await Promise.all([
        api.get('/api/workshops'),
        api.get('/api/categories'),
        api.get('/api/addresses')
      ]);
      setWorkshops(ws.data || []);
      setCategories(cats.data || []);
      setAddresses(addrs.data || []);
    } catch (e) { setError(e.response?.data?.message || 'Failed to load data'); }
    finally { setLoading(false); }
  }

  const listContainer = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 };
  const itemStyle = { background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', transition: 'box-shadow .2s, transform .2s' };

  const createBtnBase = { padding: '12px 20px', border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontWeight: 700 };
  const gradients = {
    category: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
    address: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    workshop: 'linear-gradient(135deg, #667eea, #764ba2)'
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #f9fafb, #ffffff)' }}>
      <AdminNavbar showAdminPanel={false} />

      <div style={{ maxWidth: 1200, margin: '32px auto', padding: '0 24px 80px 24px' }}>
              <h2 style={{ fontSize: 32, fontWeight: 800, color: '#1f2937', marginBottom: 16 }}>Admin panel</h2>
        {error && <div style={{ marginBottom: 16, padding: '12px 16px', color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>{String(error)}</div>}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap:'wrap', marginBottom: 24 }}>
          <Link to='/admin/categories/new'>
            <button style={{ ...createBtnBase, background: gradients.category }}>Create category</button>
          </Link>
          <Link to='/admin/addresses/new'>
            <button style={{ ...createBtnBase, background: gradients.address }}>Create address</button>
          </Link>
          <Link to='/admin/workshops/new'>
            <button style={{ ...createBtnBase, background: gradients.workshop }}>Create workshop</button>
          </Link>
        </div>

        <section style={{ marginBottom:40 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>All workshops</h3>
          {loading ? <p>Loading...</p> : (
            <div style={listContainer}>
              {workshops.map(w => {
                const img = resolveImg(w.imageUrl);
                return (
                  <div key={w.id} style={itemStyle}
                     onClick={()=> navigate(`/admin/workshops/${w.id}`)}
                     onMouseOver={e=> { e.currentTarget.style.boxShadow='0 6px 18px rgba(0,0,0,0.12)'; e.currentTarget.style.transform='translateY(-4px)'; }}
                     onMouseOut={e=> { e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'; e.currentTarget.style.transform='translateY(0)'; }}>
                  <div style={{ width:'100%', aspectRatio:'4/3', background:'#f3f4f6', borderRadius:8, overflow:'hidden', marginBottom:8 }}>
                    <img src={img} alt={w.title} onError={(e)=> e.currentTarget.src = PLACEHOLDER} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                  </div>
                  <h4 style={{ margin:'0 0 6px', fontSize:18 }}>{w.title}</h4>
                  <p style={{ margin:0, color:'#6b7280', fontSize:13 }}>{w.category?.name || '?'}</p>
                  <p style={{ margin:'6px 0 0', fontSize:13, fontWeight:600 }}>{w.price === 0 ? 'Free' : `${w.price} PLN`}</p>
                  <p style={{ margin:'4px 0 0', fontSize:12, color:'#374151' }}>{w.address ? `${w.address.city}, ${w.address.street} ${w.address.buildingNumber}${w.address.room ? ', ' + w.address.room : ''}` : 'No address'}</p>
                </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={{ marginBottom:40 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>All categories</h3>
          <div style={listContainer}>
            {categories.map(c => (
              <div key={c.id} style={itemStyle}
                   onClick={()=> navigate(`/admin/categories/${c.id}`)}
                   onMouseOver={e=> { e.currentTarget.style.boxShadow='0 6px 18px rgba(0,0,0,0.12)'; e.currentTarget.style.transform='translateY(-4px)'; }}
                   onMouseOut={e=> { e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'; e.currentTarget.style.transform='translateY(0)'; }}>
                <h4 style={{ margin:'0 0 6px', fontSize:16 }}>{c.name}</h4>
                <p style={{ margin:0, fontSize:12, color:'#6b7280', maxHeight:48, overflow:'hidden' }}>{c.description || '?'}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>All addresses</h3>
          <div style={listContainer}>
            {addresses.map(a => (
              <div key={a.id} style={itemStyle}
                   onClick={()=> navigate(`/admin/addresses/${a.id}`)}
                   onMouseOver={e=> { e.currentTarget.style.boxShadow='0 6px 18px rgba(0,0,0,0.12)'; e.currentTarget.style.transform='translateY(-4px)'; }}
                   onMouseOut={e=> { e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'; e.currentTarget.style.transform='translateY(0)'; }}>
                <h4 style={{ margin:'0 0 4px', fontSize:16 }}>{a.city}</h4>
                <p style={{ margin:0, fontSize:12, color:'#6b7280' }}>{a.street} {a.buildingNumber}{a.room ? ', ' + a.room : ''}</p>
                {a.additionalInfo && <p style={{ margin:'4px 0 0', fontSize:11, color:'#9ca3af', maxHeight:32, overflow:'hidden' }}>{a.additionalInfo}</p>}
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom:40 }}>
          <UsersTable />
        </section>

      </div>
    </div>
  );
}
