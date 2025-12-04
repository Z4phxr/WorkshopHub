/** 
 * WorkshopDetails.jsx
 * Page responsible for rendering public workshop details and upcoming cycles.
 * Handles joining enrollments and displays availability using normalized cycle data.
 */

import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReviewsList from '../components/ReviewsList.jsx';
import { formatSessionRange } from '../utils/formatDateRange.js';
import normalizeCycles from '../utils/normalizeCycles';
import api from '../utils/api';
import AdminNavbar from '../components/AdminNavbar';
import resolveImg, { PLACEHOLDER } from '../utils/resolveImg';

const API_URL = api.API_URL;

function getCategoryName(cat) {
  if (!cat) return 'N/A';
  if (typeof cat === 'string') return cat;
  return cat.name ?? cat.Name ?? 'N/A';
}

function decodeRoles(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    const uri = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
    let roles = [];
    if (payload.role) roles = roles.concat(Array.isArray(payload.role)?payload.role:[payload.role]);
    if (payload[uri]) roles = roles.concat(Array.isArray(payload[uri])?payload[uri]:[payload[uri]]);
    return roles;
  } catch { return []; }
}

function formatAddress(a) {
  if (!a) return '';
  const parts = [];
  if (a.city) parts.push(a.city);
  if (a.street) parts.push(a.street + (a.buildingNumber ? ' ' + a.buildingNumber : ''));
  if (a.room) parts.push('room ' + a.room);
  return parts.join(', ');
}

export default function WorkshopDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState([]);
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  const isLogged = !!token;
  const roles = useMemo(() => token ? decodeRoles(token) : [], [token]);
  const isAdmin = roles.includes('Admin');
  const isParticipant = roles.includes('Participant') || roles.includes('Participants');

  const [workshop, setWorkshop] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState('');
  const [enrollmentStatus, setEnrollmentStatus] = useState(null);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [reviewsReload, setReviewsReload] = useState(0);

  useEffect(() => { load(); }, [id, isLogged]);

  async function load() {
    setError('');
    try {
      if (!id) return;
      // Prefer availability endpoint so public view uses same aggregated stats as admin
      const availRes = await api.get(`/api/workshops/${id}/availability`);
      // availability returns { workshop: {...}, stats: {...} }
      const workshopPayload = (availRes.data && availRes.data.workshop) ? availRes.data.workshop : availRes.data;
      setWorkshop(workshopPayload);
      try {
        // Try the dedicated cycles endpoint first
        try {
          const cyclesResp = await api.get(`/api/workshopcycles/workshop/${id}`);
          setCycles(normalizeCycles(cyclesResp.data, workshopPayload));
        } catch (e) {
          // If cycles endpoint fails, try to fetch full workshop which contains cycles with activeEnrollments
          try {
            const fullWorkshopResp = await api.get(`/api/workshops/${id}`);
            const cyclesFromWorkshop = (fullWorkshopResp.data && (fullWorkshopResp.data.Cycles || fullWorkshopResp.data.cycles)) ? (fullWorkshopResp.data.Cycles ?? fullWorkshopResp.data.cycles) : [];
            setCycles(normalizeCycles(cyclesFromWorkshop, workshopPayload));
          } catch (inner) {
            console.warn('Failed cycles endpoint and full workshop fallback, fallback to availability payload', inner);
            setCycles(normalizeCycles(workshopPayload, workshopPayload));
          }
        }
      } catch (e) {
        console.warn('Failed cycles endpoint, fallback to availability payload', e);
        // availability endpoint keeps a legacy sessions field but not full cycles; normalize using workshop payload
        setCycles(normalizeCycles(workshopPayload, workshopPayload));
      }
      try { const addrResp = await api.get(`/api/addresses`); setAddresses(addrResp.data || []); } catch {}
      if (token) {
        setEnrollmentLoading(true);
        try {
          const statusRes = await api.get(`/api/enrollments/my-status/${id}`, { headers: { Authorization: `Bearer ${token}` } });
          setEnrollmentStatus(statusRes.data);
        } catch {
          setEnrollmentStatus({ isEnrolled: false });
        } finally {
          setEnrollmentLoading(false);
        }
      }
    } catch (e) {
      const serverMsg = e?.response?.data;
      const msg = serverMsg ? (typeof serverMsg === 'string' ? serverMsg : (serverMsg.message ?? JSON.stringify(serverMsg))) : 'Failed to load workshop from server.';
      setError(msg);
    }
  }

  function handleLogout() { localStorage.removeItem('jwt'); navigate('/login'); }

  async function join(cycleId) {
    const currentToken = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    if (!currentToken) { navigate('/login'); return; }
    setJoining(true); setJoinMsg(''); setError('');
    try {
      if (!isParticipant) { setError('Tylko u¿ytkownicy z rol¹ Participants mog¹ zapisywaæ siê na warsztaty.'); return; }
      const payload = { workshopCycleId: parseInt(cycleId, 10) };
      const resp = await axios.post(`${API_URL}/api/enrollments/join`, payload, { headers: { 'Content-Type':'application/json', Authorization: `Bearer ${currentToken}` } });
      setJoinMsg('Successfully enrolled!');
      try {
        const cycleResp = await axios.get(`${API_URL}/api/workshopcycles/${cycleId}`);
        const serverActive = cycleResp.data?.cycle?.activeEnrollments ?? cycleResp.data?.cycle?.activeEnrollmentsCount ?? null;
        setCycles(prev => prev.map(c => (c.id === parseInt(cycleId,10) ? { ...c, activeEnrollments: serverActive ?? ((c.activeEnrollments ?? 0)+1) } : c)));
      } catch {
        setCycles(prev => prev.map(c => (c.id === parseInt(cycleId,10) ? { ...c, activeEnrollments: (c.activeEnrollments ?? 0)+1 } : c)));
      }
      try {
        const newEnrollment = resp?.data ?? { workshopCycleId: parseInt(cycleId, 10) };
        setEnrollmentStatus(prev => {
          if (!prev) return { enrollment: newEnrollment };
            if (prev.enrollment) return { ...prev, enrollment: newEnrollment };
            if (Array.isArray(prev.enrollments)) return { ...prev, enrollments: [...prev.enrollments, newEnrollment] };
            return prev;
        });
      } catch {}
      setTimeout(() => { setJoinMsg(''); load(); }, 1500);
    } catch (e) {
      const server = e?.response?.data;
      let errorMsg = 'Failed to enroll';
      if (server) {
        if (typeof server === 'string') errorMsg = server;
        else if (server.detail) errorMsg = server.detail;
        else if (server.title) errorMsg = server.title;
        else if (server.errors) {
          try { errorMsg = Object.values(server.errors).flat().join(' | '); } catch { errorMsg = JSON.stringify(server.errors); }
        } else errorMsg = JSON.stringify(server);
      } else errorMsg = e.message || errorMsg;
      if (e?.response?.status === 401) { setError('Session expired or unauthorized. Please sign in again.'); setTimeout(()=> navigate('/login'), 800); }
      setError(String(errorMsg));
    } finally { setJoining(false); }
  }

  function userFinishedWorkshop() {
    if (!enrollmentStatus) return false;
    const enrollments = enrollmentStatus.enrollments ? enrollmentStatus.enrollments : (enrollmentStatus.enrollment ? [enrollmentStatus.enrollment] : []);
    if (!Array.isArray(enrollments) || enrollments.length === 0) return false;
    const now = new Date();
    for (const en of enrollments) {
      const cid = en.workshopCycleId ?? en.WorkshopCycleId ?? en.cycleId ?? en.CycleId;
      if (!cid) continue;
      const cycle = (cycles || []).find(c => (c.id ?? c.Id) === cid);
      if (!cycle) continue;
      const ses = (cycle.sessions || []).slice().sort((a,b)=> new Date(a.endTime) - new Date(b.endTime));
      if (ses.length === 0) continue;
      const lastEnd = new Date(ses[ses.length-1].endTime || ses[ses.length-1].EndTime);
      if (lastEnd <= now) return true;
    }
    return false;
  }

  function resolveAddress(a) {
    if (!a) return null;
    if (typeof a === 'object') {
      if (a.city || a.street) return a;
      const refId = a.id ?? a.addressId ?? a.AddressId ?? null;
      if (refId) {
        const idNum = parseInt(refId, 10);
        if (!isNaN(idNum)) return addresses.find(ad => (ad.id ?? ad.Id) === idNum) || null;
      }
      return null;
    }
    const idNum = parseInt(a, 10);
    if (!isNaN(idNum)) return addresses.find(ad => (ad.id ?? ad.Id) === idNum) || null;
    return null;
  }

  function getAddressForSession(s, c) {
    const candidates = [s?.address, s?.addressId ?? s?.AddressId, c?.address, c?.addressId ?? c?.AddressId, workshop?.address, workshop?.addressId ?? workshop?.AddressId];
    for (const cand of candidates) {
      const resolved = resolveAddress(cand);
      if (resolved) return resolved;
    }
    return null;
  }

  // Always show navbar; ensure loading and content containers have white background
  if (!workshop) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <AdminNavbar />
        <div style={{ maxWidth: 1200, margin: '24px auto', padding: '0 24px', background: 'white', borderRadius: 10 }}>
          {error && <div style={{ padding:12, background:'#fee2e2', border:'1px solid #fecaca', color:'#991b1b', borderRadius:8 }}>{String(error)}</div>}
          {!error && <p>Loading...</p>}
        </div>
      </div>
    );
  }

  const img = resolveImg(workshop.imageUrl);
  return (
    <div style={{ minHeight: '100vh' }}>
      <AdminNavbar />

      <div style={{ maxWidth:1200, margin:'32px auto', padding:'0 24px 80px 24px', background: 'white', borderRadius: 10 }}>
        {error && <div style={{ marginBottom:16, padding:12, background:'#fee2e2', border:'1px solid #fecaca', color:'#991b1b', borderRadius:10 }}>{String(error)}</div>}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))', gap:32 }}>
          <div>
            <div style={{ width:'100%', aspectRatio:'16/9', background:'#f3f4f6', borderRadius:16, overflow:'hidden', boxShadow:'0 4px 14px rgba(0,0,0,0.1)', marginBottom: 20 }}>
              <img src={img} alt={workshop.title} onError={(e)=> e.currentTarget.src=PLACEHOLDER} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize:36, margin:'0 0 16px', fontWeight:800, color:'#111827' }}>{workshop.title}</h2>
            <p style={{ fontSize:16, lineHeight:1.6, color:'#374151', whiteSpace:'pre-wrap' }}>{workshop.description || 'No description.'}</p>
            <div style={{ marginTop:16, display:'grid', gap:8 }}>
              <div><strong>Category:</strong> {getCategoryName(workshop.category || workshop.Category || null)}</div>
              <div><strong>Price:</strong> {workshop.price === 0 ? 'Free' : `${workshop.price} PLN`}</div>
              <div><strong>Average rating:</strong> {workshop.averageRating > 0 ? workshop.averageRating.toFixed(1) : 'No reviews yet'}</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop:48 }}>
          <h3 style={{ fontSize:24, fontWeight:800, margin:'0 0 24px' }}>Upcoming events</h3>
          {cycles.length === 0 ? (
            <p style={{ color:'#6b7280' }}>No upcoming events.</p>
          ) : (
            (() => {
              const upcoming = cycles
                .map(c => ({ ...c, sessions: (c.sessions || []).filter(s => new Date(s.startTime) > new Date()) }))
                .filter(c => c.sessions && c.sessions.length > 0);
              const singleCycles = upcoming.filter(c => !workshop.isSeries && (c.sessions || []).length === 1);
              const multiCycles = upcoming.filter(c => !( !workshop.isSeries && (c.sessions || []).length === 1 ));
              return (
                <div style={{ display:'grid', gap:16 }}>
                  {singleCycles.length > 0 && (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:16 }}>
                      {singleCycles.map(c => {
                        const s = c.sessions[0];
                        const capacity = (c.effectiveMaxParticipants ?? c.maxParticipants ?? workshop.maxParticipants) ?? 0;
                        const active = c.activeEnrollments ?? 0;
                        const seatsLeft = capacity > 0 ? Math.max(capacity - active, 0) : null;
                        return (
                          <div key={c.id} style={{ background:'white', border:'1px solid #e8edf3', borderRadius:14, padding:16, boxShadow:'0 6px 18px rgba(15,23,42,0.04)', display:'flex', flexDirection:'column', gap:8 }}>
                            <div style={{ fontWeight:800, fontSize:16, color:'#0f172a', textAlign:'center' }}>{c.displayName || 'Event'}</div>
                            <div style={{ fontSize:13, color:'#475569', textAlign:'center' }}>{formatSessionRange(s, c)}</div>
                            <div style={{ fontSize:12, color:'#64748b', textAlign:'center' }}>{formatAddress(getAddressForSession(s,c))}</div>
                            <div style={{ marginTop:6, textAlign:'center', fontWeight:700 }}>
                              {capacity > 0 ? (
                                <span>Availability: <span style={{ color: (seatsLeft > 0 ? '#059669' : '#dc2626'), padding:'4px 8px', borderRadius:8, background: (seatsLeft > 0 ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.06)'), fontWeight:800 }}>{seatsLeft}/{capacity}</span></span>
                              ) : <span style={{ color:'#374151', fontWeight:700 }}>Seats: Unlimited</span>}
                            </div>
                            <div style={{ display:'flex', justifyContent:'center', marginTop:8 }}>
                              {!isLogged ? (
                                <Link to='/login'><button style={{ padding:'8px 12px', border:'none', borderRadius:8, background:'linear-gradient(135deg,#667eea,#764ba2)', color:'white', fontWeight:700 }}>Sign in to enroll</button></Link>
                              ) : (
                                (() => {
                                  const findEnrollmentForCycle = (cycleId) => {
                                    if (!enrollmentStatus) return null;
                                    if (enrollmentStatus.enrollment && enrollmentStatus.enrollment.workshopCycleId === cycleId) return enrollmentStatus.enrollment;
                                    if (Array.isArray(enrollmentStatus.enrollments)) return enrollmentStatus.enrollments.find(e => e.workshopCycleId === cycleId) || null;
                                    return null;
                                  };
                                  const myEn = findEnrollmentForCycle(c.id);
                                  const enrolled = !!myEn;
                                  const hasPaid = myEn?.hasPaidPayment;
                                  const hasPending = myEn?.hasPendingPayment;
                                  if (enrollmentLoading) return <div>Loading...</div>;
                                  if (enrolled) {
                                    if (hasPaid) return <div style={{ padding:8, borderRadius:8, background:'#d1fae5', color:'#065f46', fontWeight:700 }}>Enrolled and paid</div>;
                                    if (!hasPending) return <div style={{ padding:8, borderRadius:8, background:'#d1fae5', color:'#065f46', fontWeight:700 }}>Enrolled</div>;
                                    return (
                                      <div style={{ display:'flex', gap:8 }}>
                                        <button onClick={async () => {
                                          try {
                                            setError('');
                                            if (!myEn?.hasPendingPayment) { setError('No pending payment found for this workshop cycle.'); return; }
                                            if (myEn?.id) await axios.put(`${API_URL}/api/payments/my-payment/enrollment/${myEn.id}/mark-paid`, null, { headers: { Authorization: `Bearer ${token}` } });
                                            else if (myEn?.payment?.id) await axios.put(`${API_URL}/api/payments/${myEn.payment.id}/mark-paid`, null, { headers: { Authorization: `Bearer ${token}` } });
                                            else await axios.put(`${API_URL}/api/payments/my-payment/${workshop.id}/mark-paid`, null, { headers: { Authorization: `Bearer ${token}` } });
                                            setEnrollmentStatus(prev => {
                                              if (!prev) return prev;
                                              if (prev.enrollment) return { ...prev, enrollment: { ...prev.enrollment, hasPaidPayment: true, hasPendingPayment: false, payment: null } };
                                              if (Array.isArray(prev.enrollments)) return { ...prev, enrollments: prev.enrollments.map(en => en.workshopCycleId === c.id ? { ...en, hasPaidPayment: true, hasPendingPayment: false, payment: null } : en) };
                                              return prev;
                                            });
                                            setJoinMsg('Enrolled and paid successfully');
                                            setTimeout(()=> load(), 500);
                                          } catch (err) { setError(err?.response?.data || 'Failed to complete payment'); }
                                        }} style={{ padding:'8px 10px', border:'none', borderRadius:8, background:'#059669', color:'white', fontWeight:700 }}>Complete payment</button>
                                        <button onClick={async () => { try { setError('');
                                            // call cancel using centralized auth headers
                                            await axios.put(`${API_URL}/api/enrollments/my-enrollment/${c.id}/cancel`, null, { headers: api.authHeaders() });
                                            // update local cycles state immediately to reflect cancellation
                                            setCycles(prev => prev.map(item => item.id === c.id ? { ...item, activeEnrollments: Math.max(((item.activeEnrollments ?? item.activeEnrollmentsCount ?? 0) - 1), 0) } : item));
                                            // refresh enrollment status and cycles
                                            await load();
                                          } catch (e) { setError(e.response?.data || 'Failed to leave course'); } }} style={{ padding:'8px 10px', border:'none', borderRadius:8, background:'#ef4444', color:'white', fontWeight:700 }}>Leave course</button>
                                      </div>
                                    );
                                  }
                                  const disableJoin = joining || !c.isOpenForEnrollment || (seatsLeft !== null && seatsLeft <= 0);
                                  if (!isParticipant) {
                                    return (
                                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                                        <button disabled style={{ padding:'12px 20px', minWidth:140, fontSize:16, border:'none', borderRadius:10, background:'#9ca3af', color:'white', fontWeight:800, cursor:'not-allowed', opacity:0.8 }}>Join</button>
                                        <div style={{ fontSize:12, color:'#6b7280', textAlign:'center', maxWidth:200 }}>Only users with the <strong>Participants</strong> role can enroll.</div>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div>
                                      <button disabled={disableJoin} onClick={() => join(c.id)} style={{ padding:'12px 20px', minWidth:120, fontSize:16, border:'none', borderRadius:10, background: disableJoin? '#9ca3af':'linear-gradient(135deg,#10b981,#059669)', color:'white', fontWeight:800 }}>{joining? 'Joining...' : 'Join'}</button>
                                    </div>
                                  );
                                })()
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {multiCycles.length > 0 && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:16 }}>
                      {multiCycles.map(c => {
                        const capacity = (c.effectiveMaxParticipants ?? c.maxParticipants ?? workshop.maxParticipants) ?? 0;
                        const active = c.activeEnrollments ?? 0;
                        const seatsLeft = capacity > 0 ? Math.max(capacity - active, 0) : null;
                        return (
                          <div key={c.id} style={{ background:'white', border:'1px solid #e8edf3', borderRadius:14, padding:18, boxShadow:'0 6px 18px rgba(15,23,42,0.04)', display:'flex', flexDirection:'column', gap:10 }}>
                            <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:12 }}>
                              <div style={{ fontWeight:800, textAlign:'center', fontSize:18, color:'#0f172a' }}>{c.displayName || 'Event'}</div>
                            </div>
                            <div style={{ fontSize:15, marginTop:6, textAlign:'center', fontWeight:700 }}>
                              {capacity > 0 ? (
                                <span>Availability: <span style={{ color: (seatsLeft > 0 ? '#059669' : '#dc2626'), padding:'4px 8px', borderRadius:8, background: (seatsLeft > 0 ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.06)'), fontWeight:800 }}>{seatsLeft}/{capacity}</span></span>
                              ) : <span style={{ color:'#374151', fontWeight:700 }}>Seats: Unlimited</span>}
                            </div>
                            {c.sessions && c.sessions.length > 0 && (
                              <div style={{ marginTop:12 }}>
                                <div style={{ display:'flex', flexWrap:'wrap', gap:12, justifyContent:'center' }}>
                                  {c.sessions.map(s => (
                                    <div key={s.id} style={{ background:'#f8fafc', padding:12, borderRadius:10, flex:'0 0 calc(25% - 12px)', boxSizing:'border-box', minWidth:170, cursor:'default', border:'1px solid rgba(15,23,42,0.03)' }}>
                                      <div style={{ fontWeight:800, color:'#0f172a', marginBottom:6, textAlign:'center' }}>{s.topic || (c.displayName || 'Session')}</div>
                                      <div style={{ fontSize:13, color:'#475569', textAlign:'center' }}>{formatSessionRange(s, c)}</div>
                                      <div style={{ fontSize:12, color:'#64748b', marginTop:6, textAlign:'center' }}>{formatAddress(getAddressForSession(s,c))}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div style={{ marginTop:14, display:'flex', justifyContent:'center' }}>
                              {!isLogged ? (
                                <Link to='/login'><button style={{ padding:'10px 16px', border:'none', borderRadius:8, background:'linear-gradient(135deg, #667eea, #764ba2)', color:'white', fontWeight:700 }}>Sign in to enroll</button></Link>
                              ) : (
                                (() => {
                                  const findEnrollmentForCycle = (cycleId) => {
                                    if (!enrollmentStatus) return null;
                                    if (enrollmentStatus.enrollment && enrollmentStatus.enrollment.workshopCycleId === cycleId) return enrollmentStatus.enrollment;
                                    if (Array.isArray(enrollmentStatus.enrollments)) return enrollmentStatus.enrollments.find(e => e.workshopCycleId === cycleId) || null;
                                    return null;
                                  };
                                  const myEn = findEnrollmentForCycle(c.id);
                                  const enrolled = !!myEn;
                                  const hasPaid = myEn?.hasPaidPayment;
                                  const hasPending = myEn?.hasPendingPayment;
                                  if (enrollmentLoading) return <div style={{ marginTop:10 }}>Loading...</div>;
                                  if (enrolled) {
                                    if (hasPaid) return <div style={{ marginTop:10, padding:10, borderRadius:8, background:'#d1fae5', color:'#065f46', fontWeight:700 }}>Enrolled and paid</div>;
                                    if (!hasPending) return <div style={{ marginTop:10, padding:10, borderRadius:8, background:'#d1fae5', color:'#065f46', fontWeight:700 }}>Enrolled</div>;
                                    return (
                                      <div style={{ display:'flex', gap:8, marginTop:10 }}>
                                        <button onClick={async () => {
                                          try {
                                            setError('');
                                            if (!myEn?.hasPendingPayment) { setError('No pending payment found for this workshop cycle.'); return; }
                                            if (myEn?.id) await axios.put(`${API_URL}/api/payments/my-payment/enrollment/${myEn.id}/mark-paid`, null, { headers: { Authorization: `Bearer ${token}` } });
                                            else if (myEn?.payment?.id) await axios.put(`${API_URL}/api/payments/${myEn.payment.id}/mark-paid`, null, { headers: { Authorization: `Bearer ${token}` } });
                                            else await axios.put(`${API_URL}/api/payments/my-payment/${workshop.id}/mark-paid`, null, { headers: { Authorization: `Bearer ${token}` } });
                                            setEnrollmentStatus(prev => {
                                              if (!prev) return prev;
                                              if (prev.enrollment) return { ...prev, enrollment: { ...prev.enrollment, hasPaidPayment: true, hasPendingPayment: false, payment: null } };
                                              if (Array.isArray(prev.enrollments)) return { ...prev, enrollments: prev.enrollments.map(en => en.workshopCycleId === c.id ? { ...en, hasPaidPayment: true, hasPendingPayment: false, payment: null } : en) };
                                              return prev;
                                            });
                                            setJoinMsg('Enrolled and paid successfully');
                                            setTimeout(()=> load(), 500);
                                          } catch (err) { setError(err?.response?.data || 'Failed to complete payment'); }
                                        }} style={{ padding:'10px 12px', border:'none', borderRadius:8, background:'#059669', color:'white', fontWeight:700 }}>Complete payment</button>
                                        <button onClick={async () => { try { setError('');
                                            await axios.put(`${API_URL}/api/enrollments/my-enrollment/${c.id}/cancel`, null, { headers: api.authHeaders() });
                                            setCycles(prev => prev.map(item => item.id === c.id ? { ...item, activeEnrollments: Math.max(((item.activeEnrollments ?? item.activeEnrollmentsCount ?? 0) - 1), 0) } : item));
                                            await load();
                                          } catch (e) { setError(e.response?.data || 'Failed to leave course'); } }} style={{ padding:'10px 12px', border:'none', borderRadius:8, background:'#ef4444', color:'white', fontWeight:700 }}>Leave course</button>
                                      </div>
                                    );
                                  }
                                  const disableJoin = joining || !c.isOpenForEnrollment || (seatsLeft !== null && seatsLeft <= 0);
                                  if (!isParticipant) {
                                    return (
                                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                                        <button disabled style={{ padding:'12px 20px', minWidth:160, fontSize:16, border:'none', borderRadius:10, background:'#9ca3af', color:'white', fontWeight:800, cursor:'not-allowed', opacity:0.8 }}>Join this event</button>
                                        <div style={{ fontSize:12, color:'#6b7280', textAlign:'center', maxWidth:220 }}>Only users with the <strong>Participants</strong> role can enroll.</div>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div>
                                      <button disabled={disableJoin} onClick={() => join(c.id)} style={{ padding:'12px 20px', minWidth:140, fontSize:16, border:'none', borderRadius:10, background: disableJoin? '#9ca3af':'linear-gradient(135deg,#10b981,#059669)', color:'white', fontWeight:800 }}>{joining? 'Joining...' : 'Join this event'}</button>
                                    </div>
                                  );
                                })()
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()
          )}
          {joinMsg && <p style={{ marginTop:12, color:'#059669', fontWeight:600 }}>{joinMsg}</p>}
          <ReviewsList workshopId={workshop.id ?? workshop.Id} token={token} reloadSignal={reviewsReload} allowWriteReview={isLogged && userFinishedWorkshop()} onChange={() => load()} />
        </div>
      </div>
    </div>
  );
}
