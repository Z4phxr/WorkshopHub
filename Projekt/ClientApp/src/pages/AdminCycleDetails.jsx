import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import AdminNavbar from '../components/AdminNavbar';
import EnrollmentList from '../components/EnrollmentList';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';
const PLACEHOLDER = '/placeholder.svg';

const createBtnBase = { padding: '8px 14px', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', fontWeight: 700 };
const gradients = {
  category: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
  address: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  workshop: 'linear-gradient(135deg, #667eea, #764ba2)'
};

export default function AdminCycleDetails(){
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location && location.state ? location.state : null;
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;

  const [data, setData] = useState(null);
  const [workshopInfo, setWorkshopInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(()=>{ 
    if(!token){ navigate('/login'); return; }
    if (navState && navState.cycle) {
      setData({ cycle: navState.cycle, enrollments: [] });
      const wkId = navState.cycle.workshopId ?? navState.cycle.WorkshopId ?? navState.workshopId;
      if (wkId) {
        (async () => {
          try{
            const wresp = await axios.get(`${API_URL}/api/workshops/${wkId}`, { headers:{ Authorization:`Bearer ${token}` } });
            setWorkshopInfo(wresp.data);
          }catch(e){
            console.warn('Failed to fetch workshop defaults from navState', e);
            setWorkshopInfo(null);
          }
        })();
      }
      fetchCycle();
    } else fetchCycle();
  }, [id]);

  async function fetchCycle(){
    setLoading(true); setError('');
    try{
      const resp = await axios.get(`${API_URL}/api/workshopcycles/${id}`, { headers:{ Authorization:`Bearer ${token}` } });
      if (!resp?.data) {
        setError('Empty response from server');
        setData(null);
      } else {
        setData(resp.data);
        const wkId = resp.data?.cycle?.workshop?.Id ?? resp.data?.cycle?.workshop?.id;
        if (wkId) {
          try {
            const wresp = await axios.get(`${API_URL}/api/workshops/${wkId}`, { headers:{ Authorization:`Bearer ${token}` } });
            setWorkshopInfo(wresp.data);
          } catch (we){
            console.error('Failed to fetch workshop defaults', we);
            setWorkshopInfo(null);
          }
        }
      }
    }catch(e){
      console.error('fetchCycle error', e);
      const status = e?.response?.status;
      if (status === 404 && navState && navState.workshopId) {
        try{
          const listResp = await axios.get(`${API_URL}/api/workshopcycles/workshop/${navState.workshopId}`);
          const arr = listResp.data || [];
          const found = (Array.isArray(arr) ? arr : []).find(c => (c.id ?? c.Id ?? String(c.id)) == id || String(c.Id) === String(id));
          if (found) {
            const normalized = { cycle: { id: found.id ?? found.Id, displayName: found.displayName ?? found.DisplayName ?? '', workshopId: found.workshopId ?? found.WorkshopId ?? navState.workshopId, startDate: found.startDate ?? found.StartDate, endDate: found.endDate ?? found.EndDate, isOpenForEnrollment: found.isOpenForEnrollment ?? found.IsOpenForEnrollment ?? false, maxParticipants: found.maxParticipants ?? found.MaxParticipants ?? null, priceOverride: found.priceOverride ?? found.PriceOverride ?? null, address: found.address ?? null, sessions: found.sessions ?? found.Sessions ?? [] }, enrollments: [] };
            setData(normalized);
            try{ const wresp = await axios.get(`${API_URL}/api/workshops/${navState.workshopId}`, { headers:{ Authorization:`Bearer ${token}` } }); setWorkshopInfo(wresp.data); } catch(_) { setWorkshopInfo(null); }
            setError('');
            setLoading(false);
            return;
          }
        }catch(listErr){ console.warn('Fallback list fetch failed', listErr); }
      }
      const msg = e?.response?.data?.message ?? e?.response?.data ?? e?.message ?? String(e);
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setData(null);
    }finally{ setLoading(false); }
  }

  if(loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}><p>Loading...</p></div>;
  if(error && !data) return <div style={{ minHeight:'100vh', padding:24 }}><div style={{ maxWidth:800, margin:'0 auto' }}><div style={{ padding:12, background:'#fee2e2', border:'1px solid #fecaca', color:'#991b1b', borderRadius:8 }}>{String(error)}</div><Link to="/admin"><button style={{ padding:'10px 20px' }}>Back</button></Link></div></div>;
  if (!data || !data.cycle) return <div style={{ minHeight:'100vh', padding:24 }}><div style={{ maxWidth:800, margin:'0 auto' }}><div style={{ padding:12, background:'#fff7ed', border:'1px solid #fcd34d', color:'#92400e', borderRadius:8 }}>Cycle data is not available.</div><Link to="/admin"><button style={{ padding:'10px 20px', marginTop:12 }}>Back</button></Link></div></div>;

  const enrollments = data.enrollments || [];

  const cycle = data.cycle;

  // compute date range from sessions
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
  }catch(ex){ console.error('Date compute error', ex); }

  const workshop = workshopInfo ?? data?.cycle?.workshop ?? null;

  // safe workshop id for navigation: prefer cycle.workshopId or nested workshop/object fallbacks
  const workshopIdSafe = cycle.workshopId ?? cycle.workshop?.id ?? cycle.workshop?.Id ?? data?.cycle?.workshop?.id ?? data?.cycle?.workshop?.Id ?? workshop?.id ?? workshop?.Id ?? navState?.workshopId ?? null;

  // determine series vs single-event
  const isSeries = (workshop?.isSeries ?? workshop?.IsSeries) ?? true;
  const isSingleEvent = !isSeries;

  // availability: seats left / capacity
  const activeEnrollmentsCount = (enrollments || []).filter(en => ((en.status ?? en.Status ?? '')).toString().toLowerCase() === 'active').length || 0;
  const totalCapacity = cycle.maxParticipants ?? cycle.maxParticipantsOverride ?? cycle.effectiveMaxParticipants ?? workshop?.maxParticipants ?? workshop?.MaxParticipants ?? null;
  const seatsLeft = totalCapacity != null ? Math.max(0, totalCapacity - activeEnrollmentsCount) : null;
  const availabilityDisplay = totalCapacity != null ? `${seatsLeft}/${totalCapacity}` : '-';

  // price display
  const priceValue = cycle.priceOverride != null ? cycle.priceOverride : workshop?.price ?? workshop?.Price ?? null;
  const priceDisplay = priceValue != null ? `${priceValue} PLN` : '-';

  // address display
  const addressObj = cycle.address ?? workshop?.address ?? workshop?.Address ?? null;
  const addressDisplay = addressObj ? `${addressObj.city ?? addressObj.City ?? ''}${(addressObj.city || addressObj.City) ? ', ' : ''}${addressObj.street ?? addressObj.Street ?? ''} ${addressObj.buildingNumber ?? addressObj.BuildingNumber ?? ''}${(addressObj.room ?? addressObj.Room) ? ', ' + (addressObj.room ?? addressObj.Room) : ''}`.trim() : '-';

  // instructor display
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
        const ins = s.instructors ?? s.Instructors ?? s.instructors ?? [];
        if (ins && ins.length > 0) {
          const lead = ins.find(i=> i.isLead || i.IsLead) ?? ins[0];
          const instObj = lead.Instructor ?? lead.instructor ?? lead;
          const fn = instObj?.FirstName ?? instObj?.firstName ?? null;
          const ln = instObj?.LastName ?? instObj?.lastName ?? null;
          if (fn || ln) { instructorDisplay = `${fn || ''} ${ln || ''}`.trim(); break; }
        }
      }
    }
  }catch(e){ console.error('Instructor parse error', e); }

  // for single-event show times from first session
  const firstSession = (sessions && sessions.length > 0) ? sessions[0] : null;
  let timeRangeDisplay = '';
  if (isSingleEvent && firstSession) {
    try{
      const s = new Date(firstSession.startTime ?? firstSession.StartTime);
      const e = new Date(firstSession.endTime ?? firstSession.EndTime);
      const sTime = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const eTime = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      timeRangeDisplay = `${sTime} - ${eTime}`;
    }catch(_) { timeRangeDisplay = ''; }
  }

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(to bottom,#f9fafb,#ffffff)' }}>
      <AdminNavbar showAdminPanel={true} />
      <div style={{ maxWidth:1200, margin:'32px auto', padding:'0 24px 80px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 style={{ margin:0 }}>{cycle.displayName || 'Cycle'}</h2>
          <div style={{ display:'flex', gap:8 }}>
            <Link to={workshopIdSafe ? `/admin/workshops/${workshopIdSafe}` : '/admin'}><button style={{ ...createBtnBase, background: gradients.category }}>Back to workshop</button></Link>
            <Link to={`/admin/cycles/${id}/edit`}><button style={{ ...createBtnBase, background: gradients.workshop }}>Edit cycle</button></Link>
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
                 const start = new Date(s.startTime ?? s.StartTime).toLocaleString();
                 const end = new Date(s.endTime ?? s.EndTime).toLocaleString();
                 return (
                   <div key={sid} style={{ padding:12, border:'1px solid #e5e7eb', borderRadius:8, background:'white', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                     <div>
                       <div style={{ fontWeight:700 }}>{s.topic ?? s.Topic ?? 'Session'}</div>
                       <div style={{ color:'#6b7280' }}>{start} - {end}</div>
                     </div>
                     <div style={{ display:'flex', gap:8 }}>
                      {/* Edit button removed - sessions are read-only in details view per request */}
                    </div>
                   </div>
                 );
               })}
            </div>
          )}
        </div>
        )}

        <div style={{ background:'white', padding:20, borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ margin:0 }}>Enrolled users ({enrollments.length})</h3>
          </div>
          <EnrollmentList enrollments={enrollments} showHeader={false} />
        </div>
      </div>
    </div>
  );
}
