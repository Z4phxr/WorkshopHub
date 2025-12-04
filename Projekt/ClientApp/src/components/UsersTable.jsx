import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';

export default function UsersTable() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('jwt');
      const resp = await axios.get(`${API_URL}/api/users`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setUsers(resp.data || []);
    } catch (e) { setError(e.response?.data || 'Failed to load users'); }
    finally { setLoading(false); }
  }

  const filtered = users.filter(u => {
    const roles = (u.roles || u.Roles || []).map(String);
    if (filter === 'All') return true;
    if (filter === 'Admin') return roles.includes('Admin') || roles.includes('Administrator');
    if (filter === 'Instructor') return roles.includes('Instructor');
    if (filter === 'Participant') return !(roles.includes('Admin') || roles.includes('Instructor'));
    return true;
  });

  function rowStyle() {
    return { cursor:'pointer' };
  }

  return (
    <div>
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:16 }}>
        <h3 style={{ margin:0 }}>All users</h3>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <select value={filter} onChange={e=> setFilter(e.target.value)} style={{ padding:8, borderRadius:8 }}>
            <option value='All'>All</option>
            <option value='Admin'>Admin</option>
            <option value='Instructor'>Instructor</option>
            <option value='Participant'>Participant</option>
          </select>
          <button onClick={load} style={{ padding:'8px 12px', borderRadius:8, background:'#667eea', color:'white', border:'none' }}>Refresh</button>
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {error && <div style={{ color:'#991b1b', marginBottom:12 }}>{String(error)}</div>}

      <table style={{ width:'100%', borderCollapse:'collapse', background:'white', boxShadow:'0 2px 8px rgba(0,0,0,0.05)', borderRadius:8, overflow:'hidden' }}>
        <thead style={{ background:'#f9fafb' }}>
          <tr>
            <th style={{ textAlign:'left', padding:12 }}>ID</th>
            <th style={{ textAlign:'left', padding:12 }}>Name</th>
            <th style={{ textAlign:'left', padding:12 }}>Email</th>
            <th style={{ textAlign:'left', padding:12 }}>Joined</th>
            <th style={{ textAlign:'left', padding:12 }}>Roles</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(u => {
            const roles = (u.roles || u.Roles || []).join(', ');
            const created = u.createdAt || u.CreatedAt || null;
            const createdStr = created ? new Date(created).toLocaleString() : '-';
            return (
              <tr key={u.id}
                  style={{ borderTop:'1px solid #eef2f7', transition:'background .15s', ...rowStyle() }}
                  onClick={()=> navigate(`/admin/users/${u.id}`)}
                  onMouseOver={e=> e.currentTarget.style.background='#f3f4f6'}
                  onMouseOut={e=> e.currentTarget.style.background='transparent'}>
                <td style={{ padding:12 }}>{u.id}</td>
                <td style={{ padding:12 }}>{u.firstName} {u.lastName}</td>
                <td style={{ padding:12 }}>{u.email}</td>
                <td style={{ padding:12 }}>{createdStr}</td>
                <td style={{ padding:12 }}>{roles || 'Participant'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
