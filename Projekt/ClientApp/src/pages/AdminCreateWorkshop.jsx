import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AdminNavbar from '../components/AdminNavbar';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';
const PLACEHOLDER = '/placeholder.svg';
function decodeRoles(token){ try{const p=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));const uri='http://schemas.microsoft.com/ws/2008/06/identity/claims/role';let r=[];if(p.role)r=r.concat(Array.isArray(p.role)?p.role:[p.role]);if(p[uri])r=r.concat(Array.isArray(p[uri])?p[uri]:[p[uri]]);return r;}catch{return []}}

export default function AdminCreateWorkshop() {
  const navigate = useNavigate();
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  const roles = useMemo(()=> token? decodeRoles(token):[],[token]);
  const isAdmin = roles.includes('Admin');
  const [categories, setCategories] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false); // retained for future if needed
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [isSeries, setIsSeries] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if(!token || !isAdmin){ navigate('/'); return;} load(); }, [isAdmin]);
  async function load(){ setError(''); try { const [cats, addrs, instr] = await Promise.all([ axios.get(`${API_URL}/api/categories`), axios.get(`${API_URL}/api/addresses`), axios.get(`${API_URL}/api/users/instructors`, { headers:{ Authorization:`Bearer ${token}` } }) ]); setCategories(cats.data||[]); setAddresses(addrs.data||[]); setInstructors(instr.data||[]);} catch(e){ setError(e.response?.data || 'Failed to load'); } }

  function extractError(d){ if(!d) return 'Failed to create workshop'; if(d.errors){return (d.title? d.title+'\n':'')+Object.entries(d.errors).map(([k,v])=>k+': '+(Array.isArray(v)?v.join(', '):v)).join('\n');} if(typeof d==='string')return d; return d.title||d.message||JSON.stringify(d); }

  async function submit(e){
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true); setError(''); setLoading(true);
    const f = e.currentTarget;

    // Build multipart form data to match [FromForm] DTO server expects
    const formData = new FormData();
    formData.append('Title', f.title.value); // PascalCase to be explicit
    formData.append('Price', f.price.value || '0');
    formData.append('CategoryId', f.categoryId.value);
    formData.append('AddressId', f.addressId.value);
    formData.append('MaxParticipants', f.maxParticipants.value || '0');
    formData.append('Description', f.description.value || '');
    formData.append('IsSeries', isSeries ? 'true' : 'false');
    if (f.instructorId && f.instructorId.value) {
      formData.append('InstructorId', f.instructorId.value);
    }
    if (imageFile) {
      formData.append('ImageFile', imageFile);
    } else if (imageUrlInput.trim()) {
      formData.append('ImageUrl', imageUrlInput.trim());
    }

    try {
      const resp = await axios.post(`${API_URL}/api/workshops`, formData, { headers: { Authorization: `Bearer ${token}` } });
      const createdIdValue = resp.data?.id ?? resp.data?.Id;
      if (createdIdValue) navigate(`/admin/workshops/${createdIdValue}`);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 409) {
        setError(e.response?.data || 'A workshop with the same title and address already exists.');
      } else {
        setError(extractError(e.response?.data));
      }
    } finally { setLoading(false); setSubmitting(false); }
  }

  function handleFileChange(file){
    setImageFile(file || null);
    // clear URL input when a file is chosen (avoid ambiguity)
    if (file) setImageUrlInput('');
  }

  const previewSrc = imageFile ? URL.createObjectURL(imageFile) : (imageUrlInput || PLACEHOLDER);

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(to bottom,#f9fafb,#ffffff)' }}>
      <AdminNavbar showAdminPanel={true} />
      <div style={{ maxWidth:1200, margin:'32px auto', padding:'0 24px 80px 24px' }}>
        <h2 style={{ fontSize:32, fontWeight:800, color:'#1f2937', marginBottom:16 }}>Create workshop</h2>
        {error && <div style={{ marginBottom:16, padding:12, color:'#991b1b', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:10, whiteSpace:'pre-wrap' }}>{error}</div>}
        <form onSubmit={submit} style={{ background:'white', padding:20, border:'1px solid #e5e7eb', borderRadius:16, display:'grid', gap:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(220px,1fr))', gap:12 }}>
            <input name='title' placeholder='Title' required style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10 }} />
            <input type='number' step='0.01' name='price' placeholder='Base price' style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10 }} />
            <input type='number' name='maxParticipants' placeholder='Max participants' style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10 }} />

            <select name='categoryId' defaultValue='' required style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10 }}>
              <option value='' disabled>Category</option>
              {categories.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select name='addressId' defaultValue='' required style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10 }}>
              <option value='' disabled>Address</option>
              {addresses.map(a=> <option key={a.id} value={a.id}>{`${a.city}, ${a.street} ${a.buildingNumber}`}</option>)}
            </select>

            <select name='instructorId' defaultValue='' required style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10 }}>
              <option value='' disabled>Instructor</option>
              {instructors.map(u=> <option key={u.id} value={u.id}>{`${u.firstName} ${u.lastName}`}</option>)}
            </select>
          </div>
          <textarea name='description' placeholder='Description' rows={6} style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10, resize:'vertical' }} />

          <label style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', background:'#f3f4f6', borderRadius:12 }}>
            <input type='checkbox' checked={isSeries} onChange={e=> setIsSeries(e.target.checked)} />
            <span style={{ fontWeight:600 }}>Series</span>
          </label>

          {/* Image selection BEFORE creation */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, alignItems:'center' }}>
            <div>
              <div style={{ width:'100%', aspectRatio:'4/3', background:'#f3f4f6', borderRadius:8, overflow:'hidden', marginBottom:8 }}>
                <img src={previewSrc} alt='preview' onError={(e)=> e.currentTarget.src = PLACEHOLDER} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
              </div>
              <input type='text' value={imageUrlInput} onChange={e=> { setImageUrlInput(e.target.value); if (e.target.value) setImageFile(null); }} placeholder='Image URL' style={{ width:'100%', padding:10, border:'1px solid #d1d5db', borderRadius:8 }} />
            </div>
            <div>
              <label style={{ fontWeight:600, fontSize:14 }}>Upload image</label>
              <input type='file' accept='image/*' onChange={e=> e.target.files?.[0] && handleFileChange(e.target.files[0])} disabled={uploading} style={{ display:'block', marginTop:8 }} />
              <small style={{ display:'block', marginTop:8, color:'#6b7280' }}>You can either upload a file or provide an image URL.</small>
            </div>
          </div>

          <div style={{ textAlign:'center' }}>
            <button disabled={loading || submitting} type='submit' style={{ padding:'14px 28px', fontSize:16, border:'none', borderRadius:12, color:'white', background: loading || submitting ? '#9ca3af' : 'linear-gradient(135deg,#667eea,#764ba2)', cursor: loading || submitting ? 'not-allowed' : 'pointer', fontWeight:800, minWidth:260 }}>{loading || submitting ? 'Creating...' : 'Create workshop'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
