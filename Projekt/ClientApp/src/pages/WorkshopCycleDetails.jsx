import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import AdminNavbar from '../components/AdminNavbar';
import { formatSessionRange } from '../utils/formatDateRange.js';
import normalizeCycles from '../utils/normalizeCycles';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';
const createBtnBase = { padding: '8px 14px', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', fontWeight: 700 };
const gradients = {
  category: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
  address: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  workshop: 'linear-gradient(135deg, #667eea, #764ba2)'
};

function decodeJwtPayload(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

function extractRolesFromPayload(payload) {
  if (!payload) return [];
  const roles = new Set();
  // common claim names for roles
  const candidates = ['role', 'roles', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role', 'roles[]', 'roles'];
  for (const key of Object.keys(payload)) {
    const lower = key.toLowerCase();
    if (lower.endsWith('role') || lower.includes('roles')) {
      const val = payload[key];
      if (Array.isArray(val)) val.forEach(v => roles.add(String(v)));
      else if (typeof val === 'string') {
        // some tokens send roles as a single comma-separated string
        try {
          const maybe = JSON.parse(val);
          if (Array.isArray(maybe)) maybe.forEach(v => roles.add(String(v)));
          else roles.add(val);
        } catch {
          val.split(',').map(v => v.trim()).filter(Boolean).forEach(v => roles.add(v));
        }
      }
    }
  }
  // also check common short keys
  if (payload.role) {
    if (Array.isArray(payload.role)) payload.role.forEach(r => roles.add(r)); else roles.add(payload.role);
  }
  if (payload.roles) {
    if (Array.isArray(payload.roles)) payload.roles.forEach(r => roles.add(r)); else roles.add(payload.roles);
  }
  return Array.from(roles);
}

export default function WorkshopCycleDetails(){
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location && location.state ? location.state : null;
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;

  const [data, setData] = useState(null);
  const [workshopInfo, setWorkshopInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // compute roles from token once
  const roles = useMemo(() => {
    const p = decodeJwtPayload(token);
    return extractRolesFromPayload(p);
  }, [token]);

  const isAdminOrInstructor = useMemo(() => {
    const lower = roles.map(r => String(r).toLowerCase());
    return lower.includes('admin') || lower.includes('instructor');
  }, [roles]);

  useEffect(()=>{ 
    // Do NOT force-login here; allow anonymous users to view cycle details.
    // Prefer live data from API. If navState provides workshopId we can prefetch workshop info,
    // but avoid setting cycle data from navState to prevent stale counts being shown.
    const wkIdFromNav = navState && (navState.cycle?.workshopId ?? navState.cycle?.WorkshopId ?? navState.workshopId);
    if (wkIdFromNav) {
      (async () => {
        try{
          const cfg = token ? { headers:{ Authorization:`Bearer ${token}` } } : {};
          const wresp = await axios.get(`${API_URL}/api/workshops/${wkIdFromNav}`, cfg);
          setWorkshopInfo(wresp.data);
        }catch(e){
          setWorkshopInfo(null);
        }
      })();
    }
    // Always fetch latest cycle data from server
    fetchCycle();
  }, [id]);

  async function fetchCycle(){
    setLoading(true); setError('');
    try{
      const cfg = token ? { headers:{ Authorization:`Bearer ${token}` } } : {};
      const resp = await axios.get(`${API_URL}/api/workshopcycles/${id}`, cfg);
      if (!resp?.data) {
        setError('Empty response from server');
        setData(null);
      } else {
        // normalize incoming payload for consistent access
        const normalized = normalizeCycles(resp.data.cycle ?? resp.data, resp.data.cycle?.workshop ?? resp.data.workshop ?? {});
        const cycleObj = normalized && normalized.length > 0 ? normalized[0] : (resp.data.cycle || resp.data);
        setData({ cycle: cycleObj, enrollments: resp.data.enrollments ?? [] });
        const wkId = cycleObj?.workshopId ?? cycleObj?.workshop?.Id ?? cycleObj?.workshop?.id;
        if (wkId) {
          try {
            const cfg2 = token ? { headers:{ Authorization:`Bearer ${token}` } } : {};
            const wresp = await axios.get(`${API_URL}/api/workshops/${wkId}`, cfg2);
            setWorkshopInfo(wresp.data);
          } catch (we){
            setWorkshopInfo(null);
          }
        }
      }
    }catch(e){
      const status = e?.response?.status;
      if (status === 404 && navState && navState.workshopId) {
        try{
          const cfg3 = token ? { headers:{ Authorization:`Bearer ${token}` } } : {};
          const listResp = await axios.get(`${API_URL}/api/workshopcycles/workshop/${navState.workshopId}`, cfg3);
          const arr = listResp.data || [];
          const found = (Array.isArray(arr) ? arr : []).find(c => (c.id ?? c.Id ?? String(c.id)) == id || String(c.Id) === String(id));
          if (found) {
            const normalized = { cycle: { id: found.id ?? found.Id, displayName: found.displayName ?? found.DisplayName ?? '', workshopId: found.workshopId ?? found.WorkshopId ?? navState.workshopId, startDate: found.startDate ?? found.StartDate, endDate: found.endDate ?? found.EndDate, isOpenForEnrollment: found.isOpenForEnrollment ?? found.IsOpenForEnrollment ?? false, maxParticipants: found.maxParticipants ?? found.MaxParticipants ?? null, priceOverride: found.priceOverride ?? found.PriceOverride ?? null, address: found.address ?? null, sessions: found.sessions ?? found.Sessions ?? [] }, enrollments: [] };
            setData(normalized);
            try{ const cfg4 = token ? { headers:{ Authorization:`Bearer ${token}` } } : {}; const wresp = await axios.get(`${API_URL}/api/workshops/${navState.workshopId}`, cfg4); setWorkshopInfo(wresp.data); } catch(_) { setWorkshopInfo(null); }
            setError('');
            setLoading(false);
            return;
          }
        }catch(listErr){ }
      }
      const msg = e?.response?.data?.message ?? e?.response?.data ?? e?.message ?? String(e);
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setData(null);
    }finally{ setLoading(false); }
  }

  if(loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}><p>Loading...</p></div>;
  if(error && !data) return <div style={{ minHeight:'100vh', padding:24 }}><div style={{ maxWidth:800, margin:'0 auto' }}><div style={{ padding:12, background:'#fee2e2', border:'1px solid #fecaca', color:'#991b1b', borderRadius:8 }}>{String(error)}</div><Link to="/"><button style={{ padding:'10px 20px', marginTop:12 }}>Back</button></Link></div></div>;
  if (!data || !data.cycle) return <div style={{ minHeight:'100vh', padding:24 }}><div style={{ maxWidth:800, margin:'0 auto' }}><div style={{ padding:12, background:'#fff7ed', border:'1px solid #fcd34d', color:'#92400e', borderRadius:8 }}>Cycle data is not available.</div><Link to="/"><button style={{ padding:'10px 20px', marginTop:12 }}>Back</button></Link></div></div>;

  const cycle = data.cycle;
  const sessions = cycle.sessions || [];
  let dateDisplay = '-';
  try{
    if (sessions.length > 0) {
      const starts = sessions.map(s => new Date(s.startTime ?? s.DepartureTime));
      const ends = sessions.map(s => new Date(s.endTime ?? s.ArrivalTime));
      const min = new Date(Math.min(...starts.map(d=>d.getTime())));
      const max = new Date(Math.max(...ends.map(d=>d.getTime())));
      const minStr = min.toLocaleDateString();
      const maxStr = max.toLocaleDateString();
      dateDisplay = minStr === maxStr ? minStr : `${minStr} - ${maxStr}`;
    } else if (cycle.startDate) {
      const sd = new Date(cycle.startDate);
      const ed = cycle.endDate ? new Date(cycle.endDate) : sd;
      dateDisplay = sd.toLocaleDateString() === ed.toLocaleDateString() ? sd.toLocaleDateString() : `${sd.toLocaleDateString()} - ${ed.toLocaleDateString()}`;
    }
  }catch(ex){ }

  const workshop = workshopInfo ?? data?.cycle?.workshop ?? null;
  const workshopIdSafe = cycle.workshopId ?? cycle.workshop?.id ?? cycle.workshop?.Id ?? data?.cycle?.workshop?.id ?? data?.cycle?.workshop?.Id ?? workshop?.id ?? workshop?.Id ?? navState?.workshopId ?? null;
  const isSeries = (workshop?.isSeries ?? workshop?.IsSeries) ?? true;
  const isSingleEvent = !isSeries;
  // use numeric activeEnrollmentsCount provided by API (available to all callers)
  // accept either server-sent `activeEnrollmentsCount` or normalized `activeEnrollments` to avoid 0 display
  const activeEnrollmentsCount = (typeof data?.cycle?.activeEnrollmentsCount === 'number' ? data.cycle.activeEnrollmentsCount : (typeof data?.cycle?.activeEnrollments === 'number' ? data.cycle.activeEnrollments : 0));
   const totalCapacity = cycle.maxParticipants ?? cycle.maxParticipantsOverride ?? cycle.effectiveMaxParticipants ?? workshop?.maxParticipants ?? workshop?.MaxParticipants ?? null;
   const seatsLeft = totalCapacity != null ? Math.max(0, totalCapacity - activeEnrollmentsCount) : null;
   const availabilityDisplay = totalCapacity != null ? `${seatsLeft}/${totalCapacity}` : '-';
   const priceValue = cycle.priceOverride != null ? cycle.priceOverride : workshop?.price ?? workshop?.Price ?? null;
   const priceDisplay = priceValue != null ? `${priceValue} PLN` : '-';
   const addressObj = cycle.address ?? workshop?.address ?? workshop?.Address ?? null;
   const addressDisplay = addressObj ? `${addressObj.city ?? addressObj.City ?? ''}${(addressObj.city || addressObj.City) ? ', ' : ''}${addressObj.street ?? addressObj.Street ?? ''} ${addressObj.buildingNumber ?? addressObj.BuildingNumber ?? ''}${(addressObj.room ?? addressObj.Room) ? ', ' + (addressObj.room ?? addressObj.Room) : ''}`.trim() : '-';

  let instructorDisplay = '-';
  try{
    if (cycle.instructorOverride) {
      const io = cycle.instructorOverride;
      instructorDisplay = `${io.firstName ?? io.FirstName ?? ''} ${io.lastName ?? io.LastName ?? ''}`.trim();
    } else if (workshop?.defaultInstructor) {
      const di = workshop.defaultInstructor;
      instructorDisplay = `${di.firstName ?? di.FirstName ?? ''} ${di.lastName ?? di.LastName ?? ''}`.trim();
    } else if (data?.cycle?.workshop?.defaultInstructor) {
      const di = data.cycle.workshop.defaultInstructor;
      instructorDisplay = `${di.firstName ?? di.FirstName ?? ''} ${di.lastName ?? di.LastName ?? ''}`.trim();
    } else {
      for (const s of sessions) {
        const ins = s.instructors ?? s.Instructors ?? [];
        if (ins && ins.length > 0) {
          const lead = ins.find(i=> i.isLead || i.IsLead) ?? ins[0];
          const instObj = lead.Instructor ?? lead.instructor ?? lead;
          const fn = instObj?.FirstName ?? instObj?.firstName ?? null;
          const ln = instObj?.LastName ?? instObj?.lastName ?? null;
          if (fn || ln) { instructorDisplay = `${fn || ''} ${ln || ''}`.trim(); break; }
        }
      }
    }
  }catch(e){ }

  const firstSession = (sessions && sessions.length > 0) ? sessions[0] : null;
  let timeRangeDisplay = '';
  if (isSingleEvent && firstSession) {
    try{
      timeRangeDisplay = formatSessionRange(firstSession, cycle).split(',')[1]?.trim() ?? '';
    }catch(_) { timeRangeDisplay = ''; }
  }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(to bottom,#f9fafb,#ffffff)' }}>
      <AdminNavbar />
      <div style={{ maxWidth:1200, margin:'32px auto', padding:'0 24px 80px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ margin:0 }}>{cycle.displayName || 'Cycle'}</h2>
          <div style={{ display:'flex', gap:8 }}>
            <Link to={workshopIdSafe ? `/workshops/${workshopIdSafe}` : '/'}><button style={{ ...createBtnBase, background: gradients.category }}>Back to workshop</button></Link>
          </div>
        </div>

        <div style={{ background:'white', padding:20, borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.05)', marginBottom:24 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12 }}>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:'1 1 220px', background:'#f3f4f6', padding:16, borderRadius:10, minHeight:96, display:'flex', flexDirection:'column', justifyContent:'flex-start' }}>
                <div style={{ fontSize:12, color:'#6b7280', fontWeight:700 }}>Date</div>
                <div style={{ marginTop:6, fontSize:16, fontWeight:600 }}>{dateDisplay}{isSingleEvent && timeRangeDisplay ? `, ${timeRangeDisplay}` : ''}</div>
              </div>

              <div style={{ flex:'1 1 220px', background:'#f3f4f6', padding:16, borderRadius:10, minHeight:96, display:'flex', flexDirection:'column', justifyContent:'flex-start' }}>
                <div style={{ fontSize:12, color:'#6b7280', fontWeight:700 }}>Availability</div>
                <div style={{ marginTop:6, fontSize:16, fontWeight:600 }}>{availabilityDisplay} <span style={{ marginLeft:8, width:10, height:10, display:'inline-block', borderRadius:999, background: (seatsLeft === null ? '#9ca3af' : (seatsLeft > 0 ? '#10b981' : '#ef4444')) }} /></div>
                <div style={{ marginTop:6, fontSize:12, color:'#6b7280' }}>{totalCapacity != null ? `${activeEnrollmentsCount} enrolled` : ''}</div>
              </div>

              <div style={{ flex:'1 1 220px', background:'#f3f4f6', padding:16, borderRadius:10, minHeight:96, display:'flex', flexDirection:'column', justifyContent:'flex-start' }}>
                <div style={{ fontSize:12, color:'#6b7280', fontWeight:700 }}>Address</div>
                <div style={{ marginTop:6, fontSize:16 }}>{addressDisplay}</div>
              </div>
            </div>

            <div style={{ display:'flex', gap:12, marginTop:4, flexWrap:'wrap' }}>
              <div style={{ flex:'1 1 220px', background:'#f3f4f6', padding:16, borderRadius:10, minHeight:96, display:'flex', flexDirection:'column', justifyContent:'flex-start' }}>
                <div style={{ fontSize:12, color:'#6b7280', fontWeight:700 }}>Price</div>
                <div style={{ marginTop:6, fontSize:16, fontWeight:600 }}>{priceDisplay}</div>
              </div>

              <div style={{ flex:'1 1 220px', background:'#f3f4f6', padding:16, borderRadius:10, minHeight:96, display:'flex', flexDirection:'column', justifyContent:'flex-start' }}>
                <div style={{ fontSize:12, color:'#6b7280', fontWeight:700 }}>Instructor</div>
                <div style={{ marginTop:6, fontSize:16 }}>{instructorDisplay}</div>
              </div>

              <div style={{ flex:'1 1 220px', background:'#f3f4f6', padding:16, borderRadius:10, minHeight:96, display:'flex', flexDirection:'column', justifyContent:'flex-start' }}>
                <div style={{ fontSize:12, color:'#6b7280', fontWeight:700 }}>Status</div>
                <div style={{ marginTop:6, fontSize:16 }}>{cycle.isOpenForEnrollment ? 'Open' : 'Closed'}</div>
              </div>
            </div>
          </div>
        </div>

        {isSeries && (
        <div style={{ background:'white', padding:20, borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.05)', marginBottom:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div>
              <h3 style={{ margin:0 }}>Sessions ({sessions.length})</h3>
            </div>
          </div>

          {sessions.length === 0 ? (
            <p style={{ color:'#6b7280' }}>No sessions in this cycle.</p>
          ) : (
            <div style={{ display:'grid', gap:12 }}>
              {sessions.map(s => {
                 const sid = s.id ?? s.Id;
                 // safe date/time parsing
                 let dateStr = '';
                 let startTime = '';
                 let endTime = '';
                 try {
                   const st = new Date(s.startTime ?? s.StartTime);
                   const en = new Date(s.endTime ?? s.EndTime);
                   if (!isNaN(st)) {
                     dateStr = st.toLocaleDateString();
                     startTime = st.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                   }
                   if (!isNaN(en)) {
                     endTime = en.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                   }
                 } catch (ex) { }

                 // resolve address for the session (fallback to cycle/workshop)
                 const a = s.address ?? s.Address ?? cycle.address ?? cycle.Address ?? workshop?.address ?? workshop?.Address ?? null;
                 const city = a?.city ?? a?.City ?? '';
                 const street = a?.street ?? a?.Street ?? '';
                 const building = a?.buildingNumber ?? a?.BuildingNumber ?? a?.building ?? '';
                 const room = a?.room ?? a?.Room ?? a?.roomNumber ?? '';
                 const addrParts = [];
                 if (city) addrParts.push(city);
                 if (street) addrParts.push(street + (building ? ' ' + building : ''));
                 if (room) addrParts.push('room ' + room);
                 const addrStr = addrParts.join(', ');

                 return (
                   <div key={sid} style={{ padding:12, border:'1px solid #e5e7eb', borderRadius:8, background:'white' }}>
                     <div>
                       <div style={{ fontWeight:700 }}>{s.topic ?? s.Topic ?? 'Session'}</div>
                       {(dateStr || startTime || endTime) && (
                         <div style={{ color:'#6b7280', marginTop:6 }}>{formatSessionRange(s, cycle)}</div>
                       )}
                       {addrStr && <div style={{ color:'#6b7280', marginTop:6 }}>{addrStr}</div>}
                     </div>
                   </div>
                 );
               })}
            </div>
          )}
        </div>
        )}

        {isAdminOrInstructor && data?.enrollments && data.enrollments.length > 0 && (
          <div style={{ background:'white', padding:20, borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.05)', marginTop:24 }}>
            <h3 style={{ marginTop:0 }}>Enrollments ({data.enrollments.length})</h3>
            <div style={{ display:'grid', gap:12 }}>
              {data.enrollments.map(e => (
                <div key={e.id || e.Id} style={{ padding:12, borderRadius:8, border:'1px solid #e5e7eb', background:'#fff' }}>
                  <div style={{ fontWeight:700 }}>{e.user?.firstName || e.user?.FirstName} {e.user?.lastName || e.user?.LastName}</div>
                  <div style={{ color:'#64748b', fontSize:13 }}>{new Date(e.enrolledAt || e.EnrolledAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
