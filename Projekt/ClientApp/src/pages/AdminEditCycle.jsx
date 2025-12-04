import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AdminNavbar from '../components/AdminNavbar';
import EnrollmentList from '../components/EnrollmentList';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';

const createBtnBase = { padding: '8px 14px', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', fontWeight: 700 };
const gradients = {
  category: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
  address: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  workshop: 'linear-gradient(135deg, #667eea, #764ba2)'
};

function toLocalDatetimeInput(value) {
  if (!value) return '';
  const d = new Date(value);
  const tzOffset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - tzOffset);
  return local.toISOString().slice(0, 16);
}
function fromLocalDatetimeInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return d.toISOString();
}

export default function AdminEditCycle(){
  const { id } = useParams();
  const navigate = useNavigate();
  const locationState = (typeof window !== 'undefined' && window.history && window.history.state) ? window.history.state.state : null;
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [instructors, setInstructors] = useState([]);

  const [cycle, setCycle] = useState(null);
  const [workshop, setWorkshop] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [enrollments, setEnrollments] = useState([]);

  const [savingCycle, setSavingCycle] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [addressChanged, setAddressChanged] = useState(false);
  const [instructorChanged, setInstructorChanged] = useState(false);

  const [cancellingIds, setCancellingIds] = useState([]);
  const [deletingEnrollmentIds, setDeletingEnrollmentIds] = useState([]);
  const [bulkCancelling, setBulkCancelling] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  function showSuccess(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  useEffect(()=>{ if(!token){ navigate('/login'); return; } fetchData(); fetchAddresses(); fetchInstructors(); }, [id]);

  async function fetchAddresses(){ try{ const r = await axios.get(`${API_URL}/api/addresses`); setAddresses(r.data||[]); }catch(e){ console.error(e); } }
  async function fetchInstructors(){ try{ const r = await axios.get(`${API_URL}/api/users/instructors`, { headers:{ Authorization:`Bearer ${token}` } }); setInstructors(r.data||[]); }catch(e){ console.error(e); } }

  async function fetchData(){
    setLoading(true); setError('');
    try{
      const resp = await axios.get(`${API_URL}/api/workshopcycles/${id}`, { headers:{ Authorization:`Bearer ${token}` } });
      const data = resp.data;
      setCycle({ ...data.cycle });
      const respWorkshop = data.cycle?.workshop ?? null;
      if (respWorkshop) {
        setWorkshop(respWorkshop);
      } else if (data.cycle?.workshopId) {
        try {
          const w = await axios.get(`${API_URL}/api/workshops/${data.cycle.workshopId}`, { headers:{ Authorization:`Bearer ${token}` } });
          setWorkshop(w.data || null);
        } catch(werr){ console.warn('Failed to fetch workshop defaults', werr); setWorkshop(null); }
      } else {
        setWorkshop(null);
      }
      setAddressChanged(!!(data.cycle && (data.cycle.addressOverrideId !== null && data.cycle.addressOverrideId !== undefined)));
      setInstructorChanged(!!(data.cycle && (data.cycle.instructorOverrideId !== null && data.cycle.instructorOverrideId !== undefined)));
      const s = (data.cycle?.sessions || []).map(session => ({
        id: session.id ?? session.Id,
        topic: session.topic ?? session.Topic ?? '',
        start: toLocalDatetimeInput(session.startTime ?? session.StartTime),
        end: toLocalDatetimeInput(session.endTime ?? session.EndTime),
        addressOverrideId: session.addressOverrideId ?? session.AddressOverrideId ?? (session.address && (session.address.id ?? session.address.Id)),
        raw: session
      }));
      setSessions(s);
      setEnrollments(data.enrollments || []);
    }catch(e){
      console.error('fetchData error', e);
      const status = e?.response?.status;
      if (status === 404) {
        setError('Cycle not found');
        const wk = (locationState && locationState.workshopId) || cycle?.workshopId || workshop?.id;
        if (wk) {
          navigate(`/admin/workshops/${wk}`);
        } else {
          navigate('/admin');
        }
      } else {
        setError(e?.response?.data ?? 'Failed to load');
      }
    }
    finally{ setLoading(false); }
  }

  function updateCycleField(field, value){ setCycle(c => ({ ...(c||{}), [field]: value })); }

  async function saveCycle(){
    if (!cycle) return;
    setSavingCycle(true); setError('');
    try{
      const payload = {
        id: cycle.id,
        workshopId: cycle.workshopId,
        displayName: cycle.displayName ?? null,
        startDate: cycle.startDate ?? null,
        endDate: cycle.endDate ?? null,
        isOpenForEnrollment: !!cycle.isOpenForEnrollment,
        maxParticipants: cycle.maxParticipantsOverride ?? null,
        addressId: cycle.addressOverrideId ?? null,
        instructorOverrideId: cycle.instructorOverrideId ?? null
      };
      const resp = await axios.put(`${API_URL}/api/workshopcycles/${cycle.id}`, payload, { headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` } });
      await fetchData();
      showSuccess('Cycle saved');
    }catch(e){ console.error('saveCycle error', e); setError(e?.response?.data ?? 'Failed to save cycle'); }
    finally{ setSavingCycle(false); }
  }

  async function saveAll(){
    if (!cycle) return;
    setSavingAll(true);
    setError('');
    try{
      for (const s of sessions) {
        if (!s.start || !s.end) throw new Error('All sessions must have start and end times');
        const start = new Date(s.start);
        const end = new Date(s.end);
        if (isNaN(start) || isNaN(end) || end <= start) throw new Error('Each session end time must be after its start time');
      }

      await saveCycle();

      for (const s of sessions) {
        if (!s.id) continue;
        const payload = {
          id: s.id,
          topic: s.topic || null,
          startTime: fromLocalDatetimeInput(s.start),
          endTime: fromLocalDatetimeInput(s.end),
          addressId: s.addressOverrideId ? parseInt(s.addressOverrideId,10) : null
        };
        await axios.put(`${API_URL}/api/workshopsessions/${s.id}`, payload, { headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` } });
      }

      await fetchData();
      showSuccess('Cycle and sessions saved');
    }catch(e){
      console.error('saveAll error', e);
      const msg = e?.response?.data ?? e?.message ?? String(e);
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally{
      setSavingAll(false);
    }
  }

  async function handleDeleteCycle(){
    if (!confirm('Delete this cycle? This will remove all sessions.')) return;
    setDeleting(true); setError('');
    try{
      await axios.delete(`${API_URL}/api/workshopcycles/${id}`, { headers:{ Authorization:`Bearer ${token}` } });
      const wk = cycle?.workshopId ?? workshop?.id;
      navigate(`/admin/workshops/${wk}`);
    }catch(e){ console.error('delete error', e); setError(e?.response?.data ?? 'Failed to delete cycle'); }
    finally{ setDeleting(false); }
  }

  function updateSessionField(index, field, value){ setSessions(s => s.map((it,i) => i===index? ({ ...it, [field]: value }): it)); }

  async function deleteSession(index){
    const s = sessions[index]; if (!s) return; if (!confirm('Delete this session?')) return;
    setError('');
    try{
      await axios.delete(`${API_URL}/api/workshopsessions/${s.id}`, { headers:{ Authorization:`Bearer ${token}` } });
      await fetchData();
    }catch(e){ console.error('deleteSession error', e); setError(e?.response?.data ?? 'Failed to delete session'); }
  }

  async function addSession(){
    if (!cycle) return;
    const start = cycle.startDate ? new Date(cycle.startDate) : new Date();
    const isoStart = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 9,0).toISOString();
    const isoEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 11,0).toISOString();
    const payload = { workshopCycleId: cycle.id, topic: null, startTime: isoStart, endTime: isoEnd, addressId: cycle.addressOverrideId ?? null };
    setError('');
    try{
      await axios.post(`${API_URL}/api/workshopsessions`, payload, { headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` } });
      await fetchData();
    }catch(e){ console.error('addSession error', e); setError(e?.response?.data ?? 'Failed to add session'); }
  }

  async function cancelEnrollmentById(enrollmentId){
    if (!confirm('Cancel this enrollment? This will free the seat.')) return;
    setCancellingIds(s => [...s, enrollmentId]); setError('');
    try{
      await axios.put(`${API_URL}/api/enrollments/${enrollmentId}/cancel`, null, { headers:{ Authorization:`Bearer ${token}` } });
      await fetchData();
    }catch(e){ console.error('cancelEnrollment error', e); setError(e?.response?.data ?? 'Failed to cancel enrollment'); }
    finally{ setCancellingIds(s => s.filter(x => x !== enrollmentId)); }
  }

  async function deleteEnrollmentById(enrollmentId){
    if (!confirm('Delete this enrollment? This will remove it permanently.')) return;
    setDeletingEnrollmentIds(s => [...s, enrollmentId]); setError('');
    try{
      await axios.delete(`${API_URL}/api/enrollments/${enrollmentId}`, { headers:{ Authorization:`Bearer ${token}` } });
      await fetchData();
    }catch(e){ console.error('deleteEnrollment error', e); setError(e?.response?.data ?? 'Failed to delete enrollment'); }
    finally{ setDeletingEnrollmentIds(s => s.filter(x => x !== enrollmentId)); }
  }

  async function cancelAllEnrollments(){
    if (!confirm('Cancel ALL enrollments for this cycle? This cannot be undone.')) return;
    setBulkCancelling(true); setBulkProgress({ done: 0, total: enrollments.length }); setError('');
    try{
      const resp = await axios.put(`${API_URL}/api/workshopcycles/${id}/cancel-enrollments`, null, { headers:{ Authorization:`Bearer ${token}` } });
      const cancelled = resp?.data?.cancelled ?? null;
      await fetchData();
      if (cancelled !== null) {
        setBulkProgress({ done: cancelled, total: enrollments.length });
        showSuccess(`Cancelled ${cancelled} enrollments`);
      } else {
        showSuccess('Cancel request completed');
      }
    }catch(e){
      console.error('cancelAllEnrollments error', e);
      setError(e?.response?.data ?? 'Failed to cancel enrollments');
    }finally{
      setBulkCancelling(false);
      setTimeout(()=> setBulkProgress({ done:0, total:0 }), 800);
    }
  }

  function getActiveEnrollmentsCount() {
    try {
      return (enrollments || []).filter(en => ((en.status ?? en.Status ?? '')).toString().toLowerCase() === 'active').length || 0;
    } catch { return 0; }
  }

  if (loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}><p>Loading...</p></div>;
  if (error && !cycle) return <div style={{ minHeight:'100vh', padding:24 }}><div style={{ maxWidth:800, margin:'0 auto' }}><div style={{ padding:12, background:'#fee2e2', border:'1px solid #fecaca', color:'#991b1b', borderRadius:8 }}>{String(error)}</div><Link to="/admin"><button style={{ padding:'10px 20px' }}>Back</button></Link></div></div>;

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(to bottom,#f9fafb,#ffffff)' }}>
      <AdminNavbar showAdminPanel={true} />
      <div style={{ maxWidth:1200, margin:'32px auto', padding:'0 24px 80px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ margin:0 }}>{cycle?.displayName || 'Edit cycle'}</h2>
          <div style={{ display:'flex', gap:8 }}>
            <Link to={`/admin/workshops/${cycle?.workshopId}`}><button style={{ ...createBtnBase, background: gradients.category }}>Back to workshop</button></Link>
            <button onClick={saveAll} disabled={savingAll} style={{ ...createBtnBase, background: gradients.workshop }}>{savingAll ? 'Saving...' : 'Save changes'}</button>
          </div>
        </div>

        {successMsg && <div style={{ padding:12, background:'#d1fae5', border:'1px solid #10b981', color:'#065f46', borderRadius:8, marginBottom:16 }}>{successMsg}</div>}

        {!(workshop && !workshop.isSeries) && (
        <div style={{ background:'white', padding:20, borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.05)', marginBottom:24 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12 }}>
            <div>
              <label style={{ display:'block', fontWeight:700 }}>Cycle name</label>
              <input value={cycle?.displayName || ''} onChange={e=> updateCycleField('displayName', e.target.value)} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
            </div>

            {!workshop?.isSeries && (
            <>
            <div>
              <label style={{ display:'block', fontWeight:700 }}>Start date</label>
              <input type='date' value={cycle?.startDate ? new Date(cycle.startDate).toISOString().slice(0,10) : ''} onChange={e=> updateCycleField('startDate', e.target.value ? e.target.value + 'T00:00:00' : null)} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
            </div>

            <div>
              <label style={{ display:'block', fontWeight:700 }}>End date</label>
              <input type='date' value={cycle?.endDate ? new Date(cycle.endDate).toISOString().slice(0,10) : ''} onChange={e=> updateCycleField('endDate', e.target.value ? e.target.value + 'T00:00:00' : null)} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
            </div>
            </>
            )}

            <div>
              <label style={{ display:'block', fontWeight:700 }}>Max participants</label>
              <input type='number' value={cycle?.maxParticipantsOverride ?? ''} onChange={e=> {
                const newVal = e.target.value ? parseInt(e.target.value,10) : null;
                const active = getActiveEnrollmentsCount();
                if (newVal !== null && newVal < active) {
                  window.alert(`Cannot set max participants below current active enrollments (${active}).`);
                  return;
                }
                updateCycleField('maxParticipantsOverride', newVal);
              }} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
            </div>

            <div>
              <label style={{ display:'block', fontWeight:700 }}>Address override</label>
              <select value={cycle?.addressOverrideId ?? ''} onChange={e=> updateCycleField('addressOverrideId', e.target.value ? parseInt(e.target.value,10) : null)} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }}>
                <option value=''>Use workshop default</option>
                {addresses.map(a => <option key={a.id} value={a.id}>{`${a.city}, ${a.street} ${a.buildingNumber}`}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display:'block', fontWeight:700 }}>Instructor override</label>
              <select value={cycle?.instructorOverrideId ?? ''} onChange={e=> updateCycleField('instructorOverrideId', e.target.value ? parseInt(e.target.value,10) : null)} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }}>
                <option value=''>Use workshop default</option>
                {instructors.map(u => <option key={u.id} value={u.id}>{`${u.firstName} ${u.lastName}`}</option>)}
              </select>
            </div>

            <div style={{ display:'flex', alignItems:'center' }}>
              <label style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type='checkbox' checked={!!cycle?.isOpenForEnrollment} onChange={e=> updateCycleField('isOpenForEnrollment', e.target.checked)} /> <span style={{ fontWeight:700 }}>Open for enrollment</span>
              </label>
            </div>

          </div>
        </div>
        )}

        {workshop && !workshop.isSeries ? (
          <div style={{ background:'white', padding:20, borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.05)', marginBottom:24 }}>
            <h3 style={{ marginTop:0 }}>Event details</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12, marginTop:12 }}>
              <div>
                <label style={{ display:'block', fontWeight:700 }}>Display name</label>
                <input value={cycle?.displayName || ''} onChange={e=> {
                  updateCycleField('displayName', e.target.value);
                  setSessions(s => s.map((it,i) => i===0? ({ ...it, topic: e.target.value }): it));
                }} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
              </div>

              <div>
                <label style={{ display:'block', fontWeight:700 }}>Date</label>
                <input type='date' value={cycle?.startDate ? new Date(cycle.startDate).toISOString().slice(0,10) : ''} onChange={e=> {
                  const date = e.target.value;
                  if (!date) { updateCycleField('startDate', null); updateCycleField('endDate', null); return; }
                  updateCycleField('startDate', date + 'T00:00:00');
                  updateCycleField('endDate', date + 'T00:00:00');
                  setSessions(s => s.map((it,i) => {
                    if (i!==0) return it;
                    const startTime = (it.start || '').split('T')[1] || '09:00:00';
                    const endTime = (it.end || '').split('T')[1] || '11:00:00';
                    const newStart = new Date(date + 'T' + (startTime.length===8? startTime : startTime + ':00')).toISOString();
                    const newEnd = new Date(date + 'T' + (endTime.length===8? endTime : endTime + ':00')).toISOString();
                    return { ...it, start: toLocalDatetimeInput(newStart), end: toLocalDatetimeInput(newEnd) };
                  }));
                }} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
              </div>

              <div>
                <label style={{ display:'block', fontWeight:700 }}>Start time</label>
                <input type="time" value={sessions[0]?.start ? sessions[0].start.slice(11,16) : '09:00'} onChange={e=> {
                  const t = e.target.value;
                  setSessions(s => s.map((it,i) => {
                    if (i!==0) return it;
                    const date = (it.start || '').slice(0,10) || (cycle?.startDate ? new Date(cycle.startDate).toISOString().slice(0,10) : new Date().toISOString().slice(0,10));
                    const iso = new Date(date + 'T' + t).toISOString();
                    return { ...it, start: toLocalDatetimeInput(iso) };
                  }));
                }} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
              </div>

              <div>
                <label style={{ display:'block', fontWeight:700 }}>End time</label>
                <input type='time' value={sessions[0]?.end ? sessions[0].end.slice(11,16) : '11:00'} onChange={e=> {
                  const t = e.target.value;
                  setSessions(s => s.map((it,i) => {
                    if (i!==0) return it;
                    const date = (it.end || '').slice(0,10) || (cycle?.endDate ? new Date(cycle.endDate).toISOString().slice(0,10) : new Date().toISOString().slice(0,10));
                    const iso = new Date(date + 'T' + t).toISOString();
                    return { ...it, end: toLocalDatetimeInput(iso) };
                  }));
                }} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
              </div>

              <div>
                <label style={{ display:'block', fontWeight:700 }}>Address override</label>
                <select value={addressChanged ? (cycle?.addressOverrideId ?? '') : ''} onChange={e=> {
                  const raw = e.target.value;
                  if (raw === '') {
                    updateCycleField('addressId', null);
                    setAddressChanged(false);
                    setSessions(s => s.map((it,i) => i===0? ({ ...it, addressId: null }): it));
                  } else {
                    const val = parseInt(raw,10);
                    updateCycleField('addressOverrideId', val);
                    setAddressChanged(true);
                    setSessions(s => s.map((it,i) => i===0? ({ ...it, addressId: val }): it));
                  }
                }} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }}>
                  <option value=''>Use workshop default</option>
                  {addresses.map(a => <option key={a.id} value={a.id}>{`${a.city}, ${a.street} ${a.buildingNumber}`}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display:'block', fontWeight:700 }}>Instructor override</label>
                <select value={instructorChanged ? (cycle?.instructorOverrideId ?? '') : ''} onChange={e=> {
                  const raw = e.target.value;
                  if (raw === '') { updateCycleField('instructorOverrideId', null); setInstructorChanged(false); }
                  else { updateCycleField('instructorOverrideId', parseInt(raw,10)); setInstructorChanged(true); }
                }} style={{ width:'100%', padding:8, border:'1px solid #d1d5db', borderRadius:6 }}>
                  <option value=''>Use workshop default</option>
                  {instructors.map(u => <option key={u.id} value={u.id}>{`${u.firstName} ${u.lastName}`}</option>)}
                </select>
              </div>

              <div style={{ display:'flex', alignItems:'center' }}>
                <label style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type='checkbox' checked={!!cycle?.isOpenForEnrollment} onChange={e=> updateCycleField('isOpenForEnrollment', e.target.checked)} /> <span style={{ fontWeight:700 }}>Open for enrollment</span>
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background:'white', padding:20, borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.05)', marginBottom:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h3 style={{ margin:0 }}>Sessions ({sessions.length})</h3>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={addSession} style={{ ...createBtnBase, padding:'8px 12px', background: gradients.category, borderRadius:8 }}>Add session</button>
              </div>
            </div>

            {sessions.length === 0 ? (
              <p style={{ color:'#6b7280' }}>No sessions in this cycle.</p>
            ) : (
              <div style={{ display:'grid', gap:12 }}>
                {sessions.map((s, idx) => {
                  return (
                    <div key={s.id} style={{ padding:12, border:'1px solid #e5e7eb', borderRadius:8, background:'white', display:'grid', gap:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                        <div style={{ flex:1 }}>
                          <label style={{ display:'block', fontSize:12, color:'#374151', marginBottom:6 }}>Topic</label>
                          <input value={s.topic} onChange={e=> updateSessionField(idx, 'topic', e.target.value)} placeholder='Topic (optional)' style={{ padding:8, border:'1px solid #d1d5db', borderRadius:6, width:'100%' }} />
                        </div>
                        <button onClick={async ()=> await deleteSession(idx)} style={{ marginLeft:8, padding:'8px 12px', background:'#ef4444', color:'white', border:'none', borderRadius:6, height:40, boxSizing:'border-box', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>Delete</button>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:8 }}>
                        <div>
                          <label style={{ display:'block', fontSize:12, color:'#374151' }}>Start</label>
                          <input type='datetime-local' value={s.start} onChange={e=> updateSessionField(idx, 'start', e.target.value)} style={{ padding:8, border:'1px solid #d1d5db', borderRadius:6, width:'100%' }} />
                        </div>
                        <div>
                          <label style={{ display:'block', fontSize:12, color:'#374151' }}>End</label>
                          <input type='datetime-local' value={s.end} onChange={e=> updateSessionField(idx, 'end', e.target.value)} style={{ padding:8, border:'1px solid #d1d5db', borderRadius:6, width:'100%' }} />
                        </div>
                        <div>
                          <label style={{ display:'block', fontSize:12, color:'#374151' }}>Address</label>
                          <select value={s.addressOverrideId ?? ''} onChange={e=> updateSessionField(idx, 'addressOverrideId', e.target.value ? parseInt(e.target.value,10) : null)} style={{ padding:8, border:'1px solid #d1d5db', borderRadius:6, width:'100%' }}>
                            <option value=''>Use cycle/workshop default</option>
                            {addresses.map(a => <option key={a.id} value={a.id}>{`${a.city}, ${a.street} ${a.buildingNumber}`}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div style={{ background:'white', padding:20, borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
          <EnrollmentList
            enrollments={enrollments}
            onCancel={cancelEnrollmentById}
            showCancelAll={Array.isArray(enrollments) && enrollments.length > 0}
            onCancelAll={cancelAllEnrollments}
            bulkCancelling={bulkCancelling}
            bulkProgress={bulkProgress}
          />
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
          <button onClick={handleDeleteCycle} disabled={deleting} style={{ padding:'10px 16px', background:'#ef4444', color:'white', border:'none', borderRadius:8, cursor: deleting? 'not-allowed':'pointer' }}>{deleting? 'Deleting...':'Delete cycle'}</button>
        </div>
       </div>
     </div>
   );
 }
