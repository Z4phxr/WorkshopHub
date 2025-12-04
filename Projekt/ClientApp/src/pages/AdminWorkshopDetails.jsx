/**
 * AdminWorkshopDetails.jsx
 * Admin page responsible for viewing a single workshop template and managing its cycles/events.
 * Provides creation forms for single-event and series cycles, lists cycles, and navigates to details/edit.
 */
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import EnrollmentList from '../components/EnrollmentList';
import normalizeCycles from '../utils/normalizeCycles';
import { formatSessionRange } from '../utils/formatDateRange.js';
import AdminNavbar from '../components/AdminNavbar';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';
const PLACEHOLDER = '/placeholder.svg';
const resolveImg = (u) => { if (!u) return PLACEHOLDER; if (/^https?:\/\//i.test(u)) return u; return `${API_URL}${u.startsWith('/') ? '' : '/'}${u}`; };

// Helper to safely get category name (api may return string or object)
function getCategoryName(cat) {
  if (!cat) return 'N/A';
  if (typeof cat === 'string') return cat;
  return cat.name ?? cat.Name ?? 'N/A';
}

function decodeJwt(token) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch { return null; }
}

const createBtnBase = { padding: '10px 20px', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', fontWeight: 600 };
const gradients = {
  category: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
  address: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  workshop: 'linear-gradient(135deg, #667eea, #764ba2)'
};

export default function AdminWorkshopDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isAdminClient, setIsAdminClient] = useState(false);
  const [isOwnerClient, setIsOwnerClient] = useState(false);

  const [cycles, setCycles] = useState([]);
  const [cycleFormOpen, setCycleFormOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [addressId, setAddressId] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [seriesSessions, setSeriesSessions] = useState([]);
  const [creatingCycle, setCreatingCycle] = useState(false);
  const [cycleFormError, setCycleFormError] = useState('');
  const [seriesInstructorOverrideId, setSeriesInstructorOverrideId] = useState('');

  const [singleDisplayName, setSingleDisplayName] = useState('');
  const [singleDate, setSingleDate] = useState('');
  const [singleStartTime, setSingleStartTime] = useState('09:00');
  const [singleEndTime, setSingleEndTime] = useState('11:00');
  const [singleIsOpen, setSingleIsOpen] = useState(true);
  const [singleMaxParticipants, setSingleMaxParticipants] = useState('');
  const [singleAddressId, setSingleAddressId] = useState('');
  const [singleInstructorOverrideId, setSingleInstructorOverrideId] = useState('');
  const [creatingSingle, setCreatingSingle] = useState(false);
  const [singleError, setSingleError] = useState('');

  const [cyclesError, setCyclesError] = useState('');
  const [selectedDefaultInstructorId, setSelectedDefaultInstructorId] = useState('');
  const [savingDefaultInstructor, setSavingDefaultInstructor] = useState(false);
  const [defaultInstructorMsg, setDefaultInstructorMsg] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    const p = decodeJwt(token);
    try { const idClaim = p?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/nameidentifier"] ?? p?.sub ?? p?.nameid ?? p?.NameIdentifier; if (idClaim) setCurrentUserId(Number(idClaim)); else if (p && p.name) { /* no id */ } } catch {}
    const roles = [];
    try {
      if (p) {
        if (p.role) { if (Array.isArray(p.role)) p.role.forEach(r=> roles.push(r)); else roles.push(p.role); }
        const uri = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
        if (p[uri]) { if (Array.isArray(p[uri])) p[uri].forEach(r=> roles.push(r)); else roles.push(p[uri]); }
      }
    } catch {}
    setIsAdminClient(roles.includes('Admin'));

    (async () => { await fetchDetails(); await fetchCycles(); fetchAddresses(); fetchInstructors(); })();
  }, [id]);

  useEffect(() => {
    if (data && currentUserId != null) {
      const def = data.defaultInstructor || data.DefaultInstructor || null;
      const defId = def?.id ?? def?.Id ?? def?.ID ?? null;
      let owner = false;
      if (isAdminClient) owner = true;
      if (defId && Number(defId) === Number(currentUserId)) owner = true;
      const assigns = data.instructors || data.Instructors || [];
      try {
        for (const a of assigns) {
          const inst = a.instructor || a.Instructor || null;
          const aid = inst?.id ?? inst?.Id ?? a.instructorId ?? a.InstructorId ?? null;
          if (aid && Number(aid) === Number(currentUserId)) { owner = true; break; }
        }
      } catch {}
      setIsOwnerClient(owner);
      if (!owner && !isAdminClient) {
        navigate(`/workshops/${id}`);
      }
    }
  }, [data, currentUserId, isAdminClient]);

  async function fetchDetails() {
    setLoading(true); setError('');
    try { const response = await axios.get(`${API_URL}/api/workshops/${id}`, { headers:{ Authorization:`Bearer ${token}` }}); setData(response.data); }
    catch (e) { const msg = e.response?.data || 'Failed to load workshop'; setError(typeof msg === 'string' ? msg : JSON.stringify(msg)); }
    finally { setLoading(false); }
  }
  async function fetchCycles() {
    setCyclesError('');
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const resp = await axios.get(`${API_URL}/api/workshopcycles/workshop/${id}`, { headers });
      let dataArr = Array.isArray(resp.data) ? resp.data : (resp.data ? [resp.data] : []);
      const normalized = normalizeCycles(dataArr, data || {});
      setCycles(normalized);
    } catch (err) {
      console.warn('fetchCycles error', err);
      if (data && (data.cycles || data.Cycles)) {
        try {
          const fallbackArr = data.cycles || data.Cycles || [];
            const normalizedFallback = normalizeCycles(fallbackArr, data);
            setCycles(normalizedFallback);
            setCyclesError('B³¹d pobierania cykli (500) – pokazano dane z widoku warsztatu.');
            return;
        } catch (e2) {
          console.warn('Fallback normalization failed', e2);
        }
      }
      setCycles([]);
      setCyclesError('Nie uda³o siê pobraæ cykli (500).');
    }
  }
  async function fetchAddresses(){ try { const resp = await axios.get(`${API_URL}/api/addresses`); setAddresses(resp.data||[]); } catch { } }
  async function fetchInstructors(){ try { const resp = await axios.get(`${API_URL}/api/users/instructors`, { headers:{ Authorization:`Bearer ${token}` } }); setInstructors(resp.data||[]); } catch { } }

  /**
   * Format server error payload into user-friendly text.
   * @param {any} err server response or Error
   * @returns {string} message ready for display
   */
  function formatServerError(err) {
    if (!err) return 'Unknown error';
    try {
      if (typeof err === 'string') return err;
      if (err.title || err.detail) return `${err.title || ''}${err.detail ? ' - ' + err.detail : ''}`.trim();
      if (err.errors) return Object.entries(err.errors).map(([k,v]) => `${k}: ${Array.isArray(v)? v.join(', '): v}`).join('\n');
      return JSON.stringify(err);
    } catch (e) { return String(err); }
  }

  /**
   * Submit handler to create cycles/events.
   * Keeps backend payload shape aligned with override fields.
   * @param {import('react').FormEvent} e
   */
  async function createCycle(e){
    e.preventDefault(); setCycleFormError(''); setCreatingCycle(true);
    try {
      if (!workshop.isSeries) {
        if (!singleDate || !singleStartTime || !singleEndTime) { setSingleError('Date and start/end time are required'); setCreatingSingle(false); return; }
        const start = new Date(singleDate + 'T' + singleStartTime);
        const end = new Date(singleDate + 'T' + singleEndTime);
        if (end <= start) { setSingleError('End time must be after start time'); setCreatingSingle(false); return; }
        const payload = {
          workshopId: parseInt(id,10),
          displayName: singleDisplayName || null,
          // backend uses StartDate only for validation; date part enough
          startDate: singleDate + 'T00:00:00',
          endDate: null,
          startTime: singleDate + 'T' + singleStartTime,
          endTime: singleDate + 'T' + singleEndTime,
          isOpenForEnrollment: singleIsOpen,
          maxParticipants: singleMaxParticipants ? parseInt(singleMaxParticipants,10) : null,
          addressId: singleAddressId ? parseInt(singleAddressId,10) : null,
          instructorOverrideId: singleInstructorOverrideId ? parseInt(singleInstructorOverrideId,10) : null
        };
        const headers = token ? { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' } : { 'Content-Type':'application/json' };
        await axios.post(`${API_URL}/api/workshopcycles/single`, payload, { headers });
        setCycleFormOpen(false);
        setSingleDisplayName(''); setSingleDate(''); setSingleStartTime('09:00'); setSingleEndTime('11:00'); setSingleMaxParticipants(''); setSingleAddressId(''); setSingleInstructorOverrideId('');
        await fetchCycles();
      } else {
        if (!seriesSessions || seriesSessions.length === 0) { setCycleFormError('Add at least one session for a series cycle.'); setCreatingCycle(false); return; }
        const resolvedAddressId = addressId ? parseInt(addressId,10) : null;
        const resolvedMaxParticipants = maxParticipants ? parseInt(maxParticipants,10) : null;
        const cyclePayload = {
          workshopId: parseInt(id,10),
            displayName: displayName || null,
            startDate: null,
            endDate: null,
            isOpenForEnrollment: isOpen,
            maxParticipants: resolvedMaxParticipants,
            addressId: resolvedAddressId,
            instructorOverrideId: seriesInstructorOverrideId ? parseInt(seriesInstructorOverrideId,10) : null
        };
        const cycleResp = await axios.post(`${API_URL}/api/workshopcycles`, cyclePayload, { headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }});
        const createdCycleId = cycleResp.data?.id ?? cycleResp.data?.Id ?? cycleResp.data?.cycle?.id ?? cycleResp.data?.cycle?.Id;
        for (const s of seriesSessions) {
          if (!s.date || !s.startTime || !s.endTime) continue;
          const sessionPayload = {
            workshopCycleId: createdCycleId,
            topic: s.topic || null,
            startTime: `${s.date}T${s.startTime}:00`,
            endTime: `${s.date}T${s.endTime}:00`,
            addressId: s.addressId ? parseInt(s.addressId,10) : (resolvedAddressId ?? null)
          };
          try { await axios.post(`${API_URL}/api/workshopsessions`, sessionPayload, { headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }}); } catch (e) { console.warn('Failed to create session', e); }
        }
        setCycleFormOpen(false); resetCycleForm(); setSeriesSessions([]); await fetchCycles();
      }
    } catch (e){
      const serverErr = e?.response?.data ?? e?.message ?? e;
      setCycleFormError(formatServerError(serverErr));
    } finally { setCreatingCycle(false); }
  }
  /**
   * Reset cycle creation form state to defaults.
   */
  function resetCycleForm(){ setDisplayName(''); setStartDate(''); setEndDate(''); setIsOpen(true); setMaxParticipants(''); setAddressId(''); setSingleInstructorOverrideId(''); setSeriesInstructorOverrideId(''); }

  async function setDefaultInstructor() {
    if (!selectedDefaultInstructorId) { setDefaultInstructorMsg('Select an instructor first'); return; }
    setSavingDefaultInstructor(true); setDefaultInstructorMsg('');
    try {
      const dto = {
        id: parseInt(id,10),
        title: data.title ?? data.Title ?? '',
        description: data.description ?? data.Description ?? null,
        isSeries: data.isSeries ?? data.IsSeries ?? false,
        price: data.price ?? data.Price ?? 0,
        maxParticipants: data.maxParticipants ?? data.MaxParticipants ?? 0,
        categoryId: data.category?.id ?? data.Category?.Id ?? data.categoryId ?? data.CategoryId ?? 0,
        addressId: data.address?.id ?? data.Address?.Id ?? data.addressId ?? data.AddressId ?? 0,
        imageUrl: data.imageUrl ?? data.ImageUrl ?? null,
        instructorId: parseInt(selectedDefaultInstructorId, 10)
      };
      const headers = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
      await axios.put(`${API_URL}/api/workshops/${id}`, dto, { headers });
      setDefaultInstructorMsg('Default instructor updated');
      await fetchDetails();
    } catch (e) {
      console.error('Failed to set default instructor', e);
      const serverErr = e?.response?.data ?? e?.message ?? e;
      setDefaultInstructorMsg(typeof serverErr === 'string' ? serverErr : JSON.stringify(serverErr));
    } finally { setSavingDefaultInstructor(false); setTimeout(()=> setDefaultInstructorMsg(''), 3000); }
  }

  if (loading) return (
    <div style={{ minHeight:'100vh' }}>
      <AdminNavbar />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}><p style={{ fontSize:18 }}>Loading...</p></div>
    </div>
  );
  if (error && !data) return (
    <div style={{ minHeight:'100vh' }}>
      <AdminNavbar />
      <div style={{ padding:'24px' }}><div style={{ maxWidth:800, margin:'0 auto' }}><div style={{ padding:'16px', background:'#fef2f2', border:'1px solid #fecaca', color:'#991b1b', borderRadius:8, marginBottom:16 }}>{error}</div><Link to="/admin"><button style={{ padding:'10px 20px', background:'#6366f1', color:'white', border:'none', borderRadius:8, cursor:'pointer' }}>Back to Admin Panel</button></Link></div></div>
    </div>
  );
  if (!data) return (
    <div style={{ minHeight:'100vh' }}>
      <AdminNavbar />
      <div style={{ padding:'24px', display:'flex', alignItems:'center', justifyContent:'center' }}><p>Workshop not found</p></div>
    </div>
  );

  const workshop = { ...data, isSeries: data.isSeries };
  const workshopInstructors = (() => {
    const list = [];
    // default instructor
    if (workshop.defaultInstructor) {
      list.push(`${workshop.defaultInstructor.firstName} ${workshop.defaultInstructor.lastName}`.trim());
    }
    // assignments from workshop-level (in workshop.instructors) preserving lead flag
    (Array.isArray(workshop.instructors) ? workshop.instructors : []).forEach(a => {
      const inst = a.instructor || a.Instructor;
      if (inst && inst.firstName) {
        const label = `${inst.firstName} ${inst.lastName}${a.isLead ? ' (Lead)' : ''}`.trim();
        if (!list.includes(label)) list.push(label);
      }
    });
    return list;
  })();
  const img = resolveImg(workshop.imageUrl);

  const canManage = isAdminClient || isOwnerClient;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #f9fafb, #ffffff)' }}>
      <AdminNavbar />
      <div style={{ maxWidth: 1200, margin: '32px auto', padding: '0 24px 80px 24px' }}>
        {error && <div style={{ padding:'12px 16px', background:'#fef2e2', border:'1px solid #fecaca', color:'#991b1b', borderRadius:8, marginBottom:16 }}>{error}</div>}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ fontSize:32, fontWeight:800, margin:0 }}>{workshop.title}</h2>
                  <div style={{ display: 'flex', gap: 8 }}>
                      {canManage ? <Link to={`/admin/workshops/${id}/edit`}><button style={{ ...createBtnBase, background: gradients.address }}>Edit Template</button></Link> : null}
            <Link to={`/workshops/${id}`}><button style={{ ...createBtnBase, background: gradients.workshop }}>Public Page</button></Link>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))', gap:24, marginBottom:32 }}>
          <div><div style={{ width:'100%', aspectRatio:'16/9', background:'#f3f4f6', borderRadius:12, overflow:'hidden', boxShadow:'0 4px 12px rgba(0,0,0,0.1)' }}><img src={img} alt={workshop.title} onError={(e)=> e.currentTarget.src = PLACEHOLDER} style={{ width:'100%', height:'100%', objectFit:'cover' }} /></div></div>
          <div style={{ background:'white', padding:24, borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize:20, fontWeight:700, marginBottom:16 }}>Workshop Template Info</h3>
            <div style={{ display:'grid', gap:12 }}>
              <div><strong>Description:</strong><p style={{ margin:'4px 0 0', color:'#374151' }}>{workshop.description || 'No description'}</p></div>
              <div><strong>Category:</strong> {getCategoryName(workshop.category || workshop.Category || null)}</div>
              <div><strong>Base Price:</strong> {workshop.price === 0 ? 'Free' : `${workshop.price} PLN`}</div>
              <div><strong>Default Max Participants:</strong> {workshop.maxParticipants || 'Unlimited'}</div>
              <div><strong>Type:</strong> {workshop.isSeries ? 'Series' : 'Single Event'}</div>
              <div><strong>Instructors:</strong> {workshopInstructors.length === 0 ? 'None' : workshopInstructors.join(', ')}</div>
            </div>
          </div>
        </div>

        <div style={{ background:'white', padding:24, borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.05)', marginBottom:32 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ fontSize:20, fontWeight:700, margin:0 }}>{workshop.isSeries ? 'Workshop Cycles' : 'Events'}</h3>
            <div>
              {canManage ? <button onClick={()=> setCycleFormOpen(v => !v)} style={{ padding:'10px 16px', background: cycleFormOpen ? '#6b7280' : '#10b981', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600 }}>{cycleFormOpen ? 'Cancel' : 'Add new cycle'}</button> : null}
            </div>
          </div>

          {cycleFormOpen && !workshop.isSeries && (
            // single-event compact form
            <form onSubmit={async (e)=> { e.preventDefault(); setSingleError(''); setCreatingSingle(true);
                try {
                  if (!singleDate || !singleStartTime || !singleEndTime) { setSingleError('Date and start/end time are required'); setCreatingSingle(false); return; }
                  const start = new Date(singleDate + 'T' + singleStartTime);
                  const end = new Date(singleDate + 'T' + singleEndTime);
                  if (end <= start) { setSingleError('End time must be after start time'); setCreatingSingle(false); return; }
                  const payload = { workshopId: parseInt(id,10), displayName: singleDisplayName || null, startDate: singleDate + 'T00:00:00', endDate: null, startTime: singleDate + 'T' + singleStartTime, endTime: singleDate + 'T' + singleEndTime, isOpenForEnrollment: singleIsOpen, maxParticipants: singleMaxParticipants ? parseInt(singleMaxParticipants,10) : null, addressId: singleAddressId ? parseInt(singleAddressId,10) : null };
                  // only send instructorOverrideId if explicitly selected by admin
                  if (singleInstructorOverrideId) {
                    const instrIdExplicit = parseInt(singleInstructorOverrideId,10);
                    if (!isNaN(instrIdExplicit) && instrIdExplicit > 0) payload.instructorOverrideId = instrIdExplicit;
                  }
                  const resp = await axios.post(`${API_URL}/api/workshopcycles/single`, payload, { headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }});
                  console.log('Create single response', resp && resp.data);
                  setCycleFormOpen(false);
                  setSingleDisplayName(''); setSingleDate(''); setSingleStartTime('09:00'); setSingleEndTime('11:00'); setSingleMaxParticipants(''); setSingleAddressId(''); setSingleInstructorOverrideId('');
                  fetchCycles();
                } catch (e) {
                  console.error('Create single event error', e);
                  console.error('Axios response:', e?.response);
                  const serverErr = e?.response?.data ?? e?.message ?? e;
                  const msg = typeof serverErr === 'string' ? serverErr : (serverErr && serverErr.errors) ? Object.entries(serverErr.errors).map(([k,v])=> `${k}: ${Array.isArray(v)? v.join(', '): v}`).join('\n') : JSON.stringify(serverErr);
                  setSingleError(msg);
                 } finally { setCreatingSingle(false); }
            }} style={{ marginBottom:24, padding:16, border:'2px solid #d1d5db', borderRadius:12, display:'grid', gap:12, background:'#f9fafb' }}>
              {singleError && <div style={{ padding:8, background:'#fee2e2', border:'1px solid #fecaca', color:'#991b1b', borderRadius:6 }}>{String(singleError)}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(160px,1fr))', gap:12 }}>
                <input type='text' value={singleDisplayName} onChange={e=> setSingleDisplayName(e.target.value)} placeholder='Display name (optional)' style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8 }} />
                <input type='date' value={singleDate} onChange={e=> setSingleDate(e.target.value)} required style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8 }} />
                <input type='time' value={singleStartTime} onChange={e=> setSingleStartTime(e.target.value)} required style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8 }} />
                <input type='time' value={singleEndTime} onChange={e=> setSingleEndTime(e.target.value)} required style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8 }} />
                <select value={singleAddressId} onChange={e=> setSingleAddressId(e.target.value)} style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8 }}>
                  <option value=''>Use workshop default address</option>
                  {addresses.map(a=> <option key={a.id} value={a.id}>{`${a.city}, ${a.street} ${a.buildingNumber}`}</option>)}
                </select>
                <input type='number' value={singleMaxParticipants} onChange={e=> setSingleMaxParticipants(e.target.value)} placeholder='Max participants (optional)' style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8 }} />
                <select value={singleInstructorOverrideId} onChange={e=> setSingleInstructorOverrideId(e.target.value)} style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8 }}>
                  <option value=''>Use workshop default instructor</option>
                  {instructors.map(u=> <option key={u.id} value={u.id}>{`${u.firstName} ${u.lastName}`}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', alignItems:'center' }}>
                <label style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type='checkbox' checked={singleIsOpen} onChange={e=> setSingleIsOpen(e.target.checked)} /> <span style={{ fontWeight:600 }}>Open for enrollment</span>
                </label>
              </div>
              <div style={{ textAlign:'center' }}>
                <button disabled={creatingSingle} type='submit' style={{ padding:'12px 24px', border:'none', borderRadius:10, background: creatingSingle? '#9ca3af':'linear-gradient(135deg,#10b981,#059669)', color:'white', fontWeight:700, cursor: creatingSingle? 'not-allowed':'pointer' }}>{creatingSingle? 'Creating...' : 'Create single event'}</button>
              </div>
            </form>
          )}

          {cycleFormOpen && workshop.isSeries && (
            // series cycle creation with multi-session editor
            <form onSubmit={createCycle} style={{ marginBottom:24, padding:16, border:'2px solid #d1d5db', borderRadius:12, display:'grid', gap:12, background:'#f9fafb' }}>
              {cycleFormError && <div style={{ padding:8, background:'#fee2e2', border:'1px solid #fecaca', color:'#991b1b', borderRadius:6 }}>{String(cycleFormError)}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(160px,1fr))', gap:12 }}>
                <input type='text' value={displayName} onChange={e=> setDisplayName(e.target.value)} placeholder='Cycle name (optional)' style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8 }} />
                <select value={addressId} onChange={e=> setAddressId(e.target.value)} style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8 }}>
                  <option value=''>Use workshop default address</option>
                  {addresses.map(a=> <option key={a.id} value={a.id}>{`${a.city}, ${a.street} ${a.buildingNumber}`}</option>)}
                </select>
                <input type='number' value={maxParticipants} onChange={e=> setMaxParticipants(e.target.value)} placeholder='Max participants (optional)' style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8 }} />
                <div>
                  <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                    <select value={seriesInstructorOverrideId} onChange={e=> setSeriesInstructorOverrideId(e.target.value)} style={{ padding:10, border:'1px solid #d1d5db', borderRadius:8, flex:1 }}>
                      <option value=''>Use workshop default instructor</option>
                      {instructors.map(u=> <option key={u.id} value={u.id}>{`${u.firstName} ${u.lastName}`}</option>)}
                    </select>
                    <label style={{ display:'flex', alignItems:'center', gap:8, whiteSpace:'nowrap' }}>
                      <input type='checkbox' checked={isOpen} onChange={e=> setIsOpen(e.target.checked)} /> <span style={{ fontWeight:600 }}>Open for enrollment</span>
                    </label>
                  </div>
                </div>
              </div>
              <div style={{ marginTop:8 }}>
                <h4 style={{ margin:'8px 0', fontSize:16, fontWeight:700 }}>Sessions</h4>
                {seriesSessions.length === 0 && <p style={{ color:'#6b7280' }}>No sessions added yet. Click "Add session" to add one.</p>}
                {seriesSessions.map((s, idx) => (
                  <div key={idx} style={{ padding:12, border:'1px solid #e5e7eb', borderRadius:8, marginBottom:8, background:'white', display:'grid', gap:8 }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <input type='text' value={s.topic || ''} onChange={e=> setSeriesSessions(ss => ss.map((it,i) => i===idx? {...it, topic: e.target.value}:it))} placeholder='Topic (optional)' style={{ padding:'8px 12px', border:'1px solid #d1d5db', borderRadius:6, flex:1, height:40, boxSizing:'border-box' }} />
                      <button type='button' onClick={()=> setSeriesSessions(ss => ss.filter((_,i)=> i!==idx))} style={{ padding:'8px 12px', background:'#ef4444', color:'white', border:'none', borderRadius:6, display:'inline-flex', alignItems:'center', justifyContent:'center', height:40, boxSizing:'border-box' }}>Remove</button>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(140px,1fr))', gap:8 }}>
                      <input type='date' value={s.date || ''} onChange={e=> setSeriesSessions(ss => ss.map((it,i) => i===idx? {...it, date: e.target.value}:it))} style={{ padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
                      <input type='time' value={s.startTime || '09:00'} onChange={e=> setSeriesSessions(ss => ss.map((it,i) => i===idx? {...it, startTime: e.target.value}:it))} style={{ padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
                      <input type='time' value={s.endTime || '11:00'} onChange={e=> setSeriesSessions(ss => ss.map((it,i) => i===idx? {...it, endTime: e.target.value}:it))} style={{ padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
                      <select value={s.addressId || ''} onChange={e=> setSeriesSessions(ss => ss.map((it,i) => i===idx? {...it, addressId: e.target.value}:it))} style={{ padding:8, border:'1px solid #d1d5db', borderRadius:6 }}>
                        <option value=''>Use cycle/workshop address</option>
                        {addresses.map(a=> <option key={a.id} value={a.id}>{`${a.city}, ${a.street} ${a.buildingNumber}`}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop:8 }}>
                  <button type='button' onClick={()=> setSeriesSessions(ss => [...ss, { topic:'', date:'', startTime:'09:00', endTime:'11:00', addressId:'' } ])} style={{ ...createBtnBase, padding:'8px 12px', background: gradients.category, borderRadius:8 }}>Add session</button>
                </div>
              </div>
              <div style={{ textAlign:'center' }}>
                <button disabled={creatingCycle} type='submit' style={{ padding:'12px 24px', border:'none', borderRadius:10, background: creatingCycle? '#9ca3af':'linear-gradient(135deg,#10b981,#059669)', color:'white', fontWeight:700, cursor: creatingCycle? 'not-allowed':'pointer' }}>{creatingCycle? 'Creating...' : 'Create cycle with sessions'}</button>
              </div>
                </form>
           )}
          {cycles.length === 0 ? <p style={{ color:'#6b7280' }}>No cycles yet.</p> : (
             <div style={{ overflowX:'auto' }}>
               <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ borderBottom:'2px solid #e5e7eb' }}><th style={{ padding:10, textAlign:'left' }}>{workshop.isSeries ? 'Name' : 'Event'}</th><th style={{ padding:10, textAlign:'left' }}>Time / Date</th><th style={{ padding:10, textAlign:'left' }}>Open</th><th style={{ padding:10, textAlign:'left' }}>Max</th><th style={{ padding:10 }}></th></tr></thead>
                 <tbody>
                   {cycles.map((c, idx) => {
                     const rowKey = c.id ?? c.Id ?? `cycle-row-${idx}`;
                     const firstSession = (c.sessions && c.sessions.length > 0) ? c.sessions[0] : null;
                     const startRange = formatSessionRange(firstSession, c) || '-';
                     // compute max participants effective
                     const maxCap = c.maxParticipants ?? c.maxParticipantsOverride ?? workshop.maxParticipants ?? '?';
                     return (
                       <tr key={rowKey} style={{ borderBottom:'1px solid #f3f4f6' }}>
                        <td style={{ padding:10, fontWeight:600 }}>{c.displayName || 'Cycle'}</td>
                        <td style={{ padding:10 }}>{startRange}</td>
                        <td style={{ padding:10 }}><span style={{ padding:'4px 10px', borderRadius:12, fontSize:12, fontWeight:600, background: c.isOpenForEnrollment ? '#d1fae5':'#fee2e2', color: c.isOpenForEnrollment ? '#065f46':'#991b1b' }}>{c.isOpenForEnrollment ? 'Open' : 'Closed'}</span></td>
                        <td style={{ padding:10 }}>{maxCap}</td>
                        <td style={{ padding:10, display:'flex', gap:8 }}>
                          <button type='button' onClick={(e)=> { e.stopPropagation(); navigate(`/admin/cycles/${c.id}`, { state: { workshopId: parseInt(id,10), cycle: c } }); }} style={{ padding:'6px 12px', background: gradients.category, color:'white', border:'none', borderRadius:6, cursor:'pointer', fontSize:12 }}>Details</button>
                          {canManage ? <button type='button' onClick={(e)=> { e.stopPropagation(); navigate(`/admin/cycles/${c.id}/edit`, { state: { workshopId: parseInt(id,10), cycle: c } }); }} style={{ padding:'6px 12px', background: gradients.workshop, color:'white', border:'none', borderRadius:6, cursor:'pointer', fontSize:12 }}>Edit</button> : null}
                        </td>
                      </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
