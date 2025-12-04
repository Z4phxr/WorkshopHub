import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import AdminNavbar from '../components/AdminNavbar';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';

function decodeRoles(token){ try{const p=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));const uri='http://schemas.microsoft.com/ws/2008/06/identity/claims/role';let r=[];if(p.role)r=r.concat(Array.isArray(p.role)?p.role:[p.role]);if(p[uri])r=r.concat(Array.isArray(p[uri])?p[uri]:[p[uri]]);return r;}catch{return []}}

export default function AdminEditAddress() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  const roles = useMemo(()=> token? decodeRoles(token):[],[token]);
  const isAdmin = roles.includes('Admin');
  const [model, setModel] = useState({ id:0, city:'', street:'', buildingNumber:'', room:'', additionalInfo:'' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => { if (!token || !isAdmin) navigate('/'); else load(); }, [id, isAdmin]);

  async function load() {
    try { const res = await axios.get(`${API_URL}/api/addresses/${id}`); setModel({
      id: res.data.id, city: res.data.city||'', street: res.data.street||'', buildingNumber: res.data.buildingNumber||'', room: res.data.room||'', additionalInfo: res.data.additionalInfo||''
    }); } catch (e) { setError(e.response?.data || 'Failed to load'); }
  }

  async function save(e) {
    e.preventDefault(); setError(''); setOk('');
    try { await axios.put(`${API_URL}/api/addresses/${id}`, { id: parseInt(id,10), city:model.city, street:model.street, buildingNumber:model.buildingNumber, room:model.room||null, additionalInfo:model.additionalInfo||null }, { headers: { Authorization:`Bearer ${token}` } }); setOk('Saved'); }
    catch (e) { setError(e.response?.data || 'Save failed'); }
  }

  async function remove(){ if(!confirm('Delete this address?')) return; try{ await axios.delete(`${API_URL}/api/addresses/${id}`, { headers:{ Authorization:`Bearer ${token}` }}); navigate('/admin'); } catch(e){ setError(e.response?.data || 'Delete failed'); } }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(to bottom,#f9fafb,#ffffff)' }}>
      <AdminNavbar showAdminPanel={true} />

      <div style={{ maxWidth:1200, margin:'24px auto', padding:'0 24px 80px 24px' }}>
        <h2 style={{ fontSize:28, fontWeight:800, color:'#1f2937', marginBottom:16 }}>Edit address</h2>
        {error && <div style={{ marginBottom:12, padding:12, color:'#991b1b', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8 }}>{String(error)}</div>}
        {ok && <div style={{ marginBottom:12, padding:12, color:'#065f46', background:'#ecfdf5', border:'1px solid #a7f3d0', borderRadius:8 }}>{ok}</div>}
        <form onSubmit={save} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:16, display:'grid', gap:12 }}>
          <input value={model.city} onChange={e=> setModel(s=> ({...s, city: e.target.value}))} placeholder='City' required style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8 }} />
          <input value={model.street} onChange={e=> setModel(s=> ({...s, street: e.target.value}))} placeholder='Street' required style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8 }} />
          <input value={model.buildingNumber} onChange={e=> setModel(s=> ({...s, buildingNumber: e.target.value}))} placeholder='Building number' required style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8 }} />
          <input value={model.room} onChange={e=> setModel(s=> ({...s, room: e.target.value}))} placeholder='Room (optional)' style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8 }} />
          <textarea value={model.additionalInfo} onChange={e=> setModel(s=> ({...s, additionalInfo: e.target.value}))} placeholder='Additional info (optional)' rows={3} style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8, resize:'vertical' }} />
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
            <button type='button' onClick={remove} style={{ padding:'10px 16px', border:'1px solid #fecaca', color:'#991b1b', background:'#fee2e2', borderRadius:8, cursor:'pointer' }}>Delete</button>
            <button type='submit' style={{ padding:'10px 16px', border:'none', borderRadius:8, color:'white', background:'linear-gradient(135deg,#667eea,#764ba2)', cursor:'pointer' }}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
