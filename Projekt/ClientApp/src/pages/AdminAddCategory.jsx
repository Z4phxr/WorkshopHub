import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AdminNavbar from '../components/AdminNavbar';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';

function decodeRoles(token){
  try{const p=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));const uri='http://schemas.microsoft.com/ws/2008/06/identity/claims/role';let r=[];if(p.role)r=r.concat(Array.isArray(p.role)?p.role:[p.role]);if(p[uri])r=r.concat(Array.isArray(p[uri])?p[uri]:[p[uri]]);return r;}catch{return []}}

export default function AdminAddCategory() {
  const navigate = useNavigate();
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  const roles = useMemo(()=> token? decodeRoles(token):[],[token]);
  const isAdmin = roles.includes('Admin');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(()=> { if(!token || !isAdmin) navigate('/'); }, [isAdmin]);

  function extractError(resp){ if(!resp) return 'Failed'; if(resp.errors){ return (resp.title? resp.title+'\n':'')+Object.entries(resp.errors).map(([k,v])=>k+': '+(Array.isArray(v)?v.join(', '):v)).join('\n'); } if(typeof resp==='string') return resp; return resp.title||resp.message||JSON.stringify(resp); }

  async function submit(e){
      e.preventDefault(); setError(''); setOk('');
      try { await axios.post(`${API_URL}/api/categories`, { name, description: description || null }, { headers: { Authorization: `Bearer ${token}` } }); setOk('Category added'); setName(''); setDescription(''); navigate('/admin') }
    catch(e){ setError(extractError(e.response?.data)); }
  }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(to bottom,#f9fafb,#ffffff)' }}>
      <AdminNavbar showAdminPanel={true} />

      <div style={{ maxWidth:1200, margin:'32px auto', padding:'0 24px 80px 24px' }}>
        <h2 style={{ fontSize:32, fontWeight:800, color:'#1f2937', marginBottom:16 }}>Create category</h2>
        {error && <div style={{ marginBottom:16, padding:12, color:'#991b1b', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:10, whiteSpace:'pre-wrap' }}>{error}</div>}
        {ok && <div style={{ marginBottom:16, padding:12, color:'#065f46', background:'#ecfdf5', border:'1px solid #a7f3d0', borderRadius:10 }}>{ok}</div>}
        <form onSubmit={submit} style={{ background:'white', padding:20, border:'1px solid #e5e7eb', borderRadius:16, display:'grid', gap:16 }}>
          <input value={name} onChange={e=> setName(e.target.value)} placeholder='Name' required style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10 }} />
          <textarea value={description} onChange={e=> setDescription(e.target.value)} placeholder='Description' rows={5} style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10, resize:'vertical' }} />
          <div style={{ textAlign:'center' }}>
            <button type='submit' style={{ padding:'14px 28px', fontSize:16, border:'none', borderRadius:12, color:'white', background:'linear-gradient(135deg,#667eea,#764ba2)', cursor:'pointer', fontWeight:800, minWidth:260 }}>Add category</button>
          </div>
        </form>
      </div>
    </div>
  );
}
