import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import AdminNavbar from '../components/AdminNavbar';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';
const PLACEHOLDER = '/placeholder.svg';
const resolveImg = (u) => { if (!u) return PLACEHOLDER; if (/^https?:\/\//i.test(u)) return u; return `${API_URL}${u.startsWith('/') ? '' : '/'}${u}`; };

function decodeRoles(token){ try{const p=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));const uri='http://schemas.microsoft.com/ws/2008/06/identity/claims/role';let r=[];if(p.role)r=r.concat(Array.isArray(p.role)?p.role:[p.role]);if(p[uri])r=r.concat(Array.isArray(p[uri])?p[uri]:[p[uri]]);return r;}catch{return []}}

export default function AdminEditWorkshop() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  const roles = useMemo(()=> token? decodeRoles(token):[],[token]);
  const isAdmin = roles.includes('Admin');
  const [model, setModel] = useState(null);
  const [categories, setCategories] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (!token || !isAdmin) navigate('/'); else load(); }, [id, isAdmin]);

  async function load() {
    try {
      const [w, cats, addrs, instr] = await Promise.all([
        axios.get(`${API_URL}/api/workshops/${id}`),
        axios.get(`${API_URL}/api/categories`),
        axios.get(`${API_URL}/api/addresses`),
        axios.get(`${API_URL}/api/users/instructors`, { headers:{ Authorization:`Bearer ${token}` } })
      ]);
      setModel({
        id: Number(w.data.id),
        title: w.data.title || '',
        description: w.data.description || '',
        isSeries: !!w.data.isSeries,
        price: Number(w.data.price || 0),
        maxParticipants: Number(w.data.maxParticipants || 0),
        categoryId: Number(w.data.categoryId ?? 0),
        addressId: Number(w.data.addressId ?? 0),
        imageUrl: w.data.imageUrl || '',
        instructorId: Number(w.data.defaultInstructor?.id ?? w.data.defaultInstructorId ?? w.data.instructorId ?? 0) || null
      });
      setCategories(cats.data || []);
      setAddresses(addrs.data || []);
      setInstructors(instr.data || []);
    } catch (e) { setError(e.response?.data || 'Failed to load'); }
  }

  // Auto-select first available ids when current is invalid (0/null)
  useEffect(() => {
    if (!model) return;
    let changed = false;
    let next = { ...model };
    if ((!next.categoryId || next.categoryId <= 0) && categories.length > 0) { next.categoryId = categories[0].id; changed = true; }
    if ((!next.addressId || next.addressId <= 0) && addresses.length > 0) { next.addressId = addresses[0].id; changed = true; }
    if ((!next.instructorId || next.instructorId <= 0) && instructors.length > 0) { next.instructorId = instructors[0].id; changed = true; }
    if (changed) setModel(next);
  }, [model, categories, addresses, instructors]);

  function extractError(e){
    const d = e?.response?.data;
    if (!d) return e?.message || 'Request failed';
    if (typeof d === 'string') return d;
    if (d.errors && typeof d.errors === 'object'){
      const msgs = Object.values(d.errors).flat().map(x=>String(x));
      if (msgs.length) return msgs.join('\n');
    }
    if (d.detail) return d.detail;
    if (d.message) return d.message;
    return JSON.stringify(d);
  }

  async function save(e) {
    e.preventDefault(); setError(''); setOk('');
    try {
      const parsedId = Number(id);
      const categoryId = Number(model.categoryId);
      const addressId = Number(model.addressId);
      const instructorId = model.instructorId ? Number(model.instructorId) : null;
      if (!categoryId || categoryId <= 0) { setError('Please select a category.'); return; }
      if (!addressId || addressId <= 0) { setError('Please select an address.'); return; }
      if (!instructorId || instructorId <= 0) { setError('Please select an instructor.'); return; }
      const payload = {
        id: parsedId,
        title: (model.title || '').trim(),
        description: (model.description || '').trim(),
        isSeries: !!model.isSeries,
        price: Number(model.price || 0),
        maxParticipants: Number(model.maxParticipants || 0),
        categoryId,
        addressId,
        instructorId,
        imageUrl: null
      };
      if (model.imageUrl && /^https?:\/\//i.test(model.imageUrl)) {
        payload.imageUrl = model.imageUrl.trim();
      }
      const resp = await axios.put(`${API_URL}/api/workshops/${parsedId}`, payload, { headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' } });
      setOk(resp?.data?.message || 'Saved');
      navigate(`/admin/workshops/${id}`);
    } catch (e) {
      setError(extractError(e));
    }
  }

  async function remove() {
    if (!confirm('Delete this workshop?')) return;
    try { await axios.delete(`${API_URL}/api/workshops/${id}`, { headers:{ Authorization:`Bearer ${token}` }}); navigate('/admin'); }
    catch(e){ setError(extractError(e)); }
  }

  async function uploadImage(file){
    setUploading(true); setError('');
    try{
      const form = new FormData();
      form.append('file', file);
      const resp = await axios.post(`${API_URL}/api/workshops/${id}/image`, form, { headers:{ Authorization:`Bearer ${token}` } });
      setModel(s=> ({ ...s, imageUrl: resp.data?.imageUrl || s.imageUrl }));
      setOk('Image uploaded');
    }catch(e){ setError(extractError(e)); }
    finally{ setUploading(false); }
  }

  if (!model) return <div style={{ maxWidth: 1200, margin: '24px auto', padding: '0 24px' }}>{error ? <p style={{ color: 'red' }}>{String(error)}</p> : <p>Loading...</p>}</div>;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom,#f9fafb,#ffffff)'}}>
      <AdminNavbar showAdminPanel={true} />
      <div style={{ maxWidth:1200, margin:'24px auto', padding:'0 24px 80px 24px' }}>
        <h2 style={{ fontSize:28, fontWeight:800, color:'#1f2937', marginBottom:16 }}>Edit workshop</h2>
        {error && <div style={{ marginBottom:12, padding:12, color:'#991b1b', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, whiteSpace:'pre-line' }}>{String(error)}</div>}
        {ok && <div style={{ marginBottom:12, padding:12, color:'#065f46', background:'#ecfdf5', border:'1px solid #a7f3d0', borderRadius:8 }}>{ok}</div>}
        <form onSubmit={save} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:16, display:'grid', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(220px,1fr))', gap:12 }}>
            <input value={model.title} onChange={e=> setModel(s=> ({...s, title: e.target.value}))} name='title' placeholder='Title' required style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10 }} />
            <input type='number' step='0.01' value={model.price} onChange={e=> setModel(s=> ({...s, price: parseFloat(e.target.value||'0')}))} name='price' placeholder='Base price' style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10 }} />
            <input type='number' value={model.maxParticipants} onChange={e=> setModel(s=> ({...s, maxParticipants: parseInt(e.target.value||'0',10)}))} name='maxParticipants' placeholder='Max participants' style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10 }} />

            <select value={model.categoryId} onChange={e=> setModel(s=> ({...s, categoryId: parseInt(e.target.value,10)}))} name='categoryId' required style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10 }}>
              <option value='' disabled>Category</option>
              {categories.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select value={model.addressId} onChange={e=> setModel(s=> ({...s, addressId: parseInt(e.target.value,10)}))} name='addressId' required style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10 }}>
              <option value='' disabled>Address</option>
              {addresses.map(a=> <option key={a.id} value={a.id}>{`${a.city}, ${a.street} ${a.buildingNumber}`}</option>)}
            </select>

            <select value={model.instructorId ?? ''} onChange={e=> setModel(s=> ({...s, instructorId: e.target.value ? parseInt(e.target.value,10) : null}))} name='instructorId' required style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10 }}>
              <option value='' disabled>Instructor</option>
              {instructors.map(u=> <option key={u.id} value={u.id}>{`${u.firstName} ${u.lastName}`}</option>)}
            </select>
          </div>

          <textarea value={model.description} onChange={e=> setModel(s=> ({...s, description: e.target.value}))} name='description' rows={6} placeholder='Description' style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10, resize:'vertical' }} />

          <label style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', background:'#f3f4f6', borderRadius:12 }}>
            <input type='checkbox' checked={!!model.isSeries} onChange={e=> setModel(s=> ({...s, isSeries: e.target.checked}))} />
            <span style={{ fontWeight:600 }}>Series</span>
          </label>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, alignItems:'center' }}>
            <div>
              <div style={{ width:'100%', aspectRatio:'4/3', background:'#f3f4f6', borderRadius:8, overflow:'hidden', marginBottom:8 }}>
                <img src={resolveImg(model.imageUrl)} alt={model.title} onError={(e)=> e.currentTarget.src = PLACEHOLDER} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
              </div>
              <input type='text' value={model.imageUrl || ''} onChange={e=> setModel(s=> ({...s, imageUrl: e.target.value}))} placeholder='Image URL' style={{ width:'100%', padding:10, border:'1px solid #d1d5db', borderRadius:8 }} />
            </div>
            <div>
              <label style={{ fontWeight:600, fontSize:14 }}>Upload image</label>
              <input type='file' accept='image/*' onChange={(e)=> e.target.files?.[0] && uploadImage(e.target.files[0])} disabled={uploading} style={{ display:'block', marginTop:8 }} />
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
            <button type='button' onClick={remove} style={{ padding:'10px 16px', border:'1px solid #fecaca', color:'#991b1b', background:'#fee2e2', borderRadius:8, cursor:'pointer' }}>Delete</button>
            <button type='submit' style={{ padding:'10px 16px', border:'none', borderRadius:8, color:'white', background:'linear-gradient(135deg,#667eea,#764ba2)', cursor:'pointer' }}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
