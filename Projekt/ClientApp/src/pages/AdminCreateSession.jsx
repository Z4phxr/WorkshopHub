import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import normalizeCycles from '../utils/normalizeCycles';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';

function decodeRoles(token) {
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const uri = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
    let r = [];
    if (p.role) r = r.concat(Array.isArray(p.role) ? p.role : [p.role]);
    if (p[uri]) r = r.concat(Array.isArray(p[uri]) ? p[uri] : [p[uri]]);
    return r;
  } catch {
    return [];
  }
}

export default function AdminCreateSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  const roles = useMemo(() => token ? decodeRoles(token) : [], [token]);
  const isAdmin = roles.includes('Admin');

  const [cycleId, setCycleId] = useState(null);
  const [cycle, setCycle] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [topic, setTopic] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [addressId, setAddressId] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(''); // removed use; keep state to avoid runtime errors but not sent
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !isAdmin) { navigate('/'); return; }
    const qp = new URLSearchParams(location.search);
    const cid = qp.get('cycleId');
    if (cid) setCycleId(parseInt(cid, 10));
    fetchAddresses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    if (cycleId) fetchCycle();
  }, [cycleId]);

  async function fetchAddresses() {
    try { const resp = await axios.get(`${API_URL}/api/addresses`); setAddresses(resp.data || []); } catch { }
  }

  async function fetchCycle() {
    try {
      const resp = await axios.get(`${API_URL}/api/workshopcycles/${cycleId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      // normalize cycle payload so UI can rely on consistent field names
      const normalized = normalizeCycles(resp.data.cycle ?? resp.data, resp.data.cycle?.workshop ?? resp.data.workshop ?? {});
      const c = normalized && normalized.length > 0 ? normalized[0] : (resp.data.cycle || resp.data);
      setCycle(c);
      // prefill date from cycle.startDate
      const sd = c?.startDate ?? resp.data.cycle?.startDate ?? resp.data.startDate;
      if (sd) {
        const d = new Date(sd);
        setDate(d.toISOString().split('T')[0]);
      }
      // default address (use normalized cycle.addressId if present)
      const addrId = c?.addressId ?? c?.address?.id ?? resp.data.cycle?.address?.id ?? resp.data.addressId ?? '';
      setAddressId(addrId || '');
    } catch (e) {
      setError('Failed to load cycle info');
    }
  }

  async function submit(e) {
    e.preventDefault(); setError(''); setOk(''); setLoading(true);
    try {
      if (!cycleId) throw new Error('Missing cycleId');
      if (!date || !startTime || !endTime) throw new Error('Date and start/end times are required');
      const payload = {
        workshopCycleId: parseInt(cycleId, 10),
        topic: topic || null,
        startTime: `${date}T${startTime}:00`,
        endTime: `${date}T${endTime}:00`,
        // backend expects JsonPropertyName("addressId") mapping to AddressOverrideId
        addressId: addressId ? parseInt(addressId, 10) : null
        // capacity handled at cycle level; do NOT send maxParticipants here
      };
      await axios.post(`${API_URL}/api/workshopsessions`, payload, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      setOk('Session created');
      // navigate back to workshop details
      const workshopId = cycle?.workshop?.id || cycle?.workshopId;
      setTimeout(() => navigate(`/admin/workshops/${workshopId}`), 800);
    } catch (err) {
      setError(err.response?.data || err.message || 'Failed to create session');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 24px' }}>
      <h2 style={{ fontSize: 28, fontWeight: 800 }}>Create Session</h2>
      {error && <div style={{ padding: 12, background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 8, marginBottom: 12 }}>{String(error)}</div>}
      {ok && <div style={{ padding: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 8, marginBottom: 12 }}>{ok}</div>}

      <form onSubmit={submit} style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #e5e7eb', display: 'grid', gap: 12 }}>
        <div>
          <label style={{ fontWeight: 700 }}>Cycle</label>
          <div>{cycle ? (cycle.displayName || `Cycle ${cycle.id}`) : `Cycle ${cycleId || ''}`}</div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6 }}>Topic (optional)</label>
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder='Session topic' style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          <div>
            <label>Date *</label>
            <input type='date' value={date} onChange={e => setDate(e.target.value)} required style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }} />
          </div>
          <div>
            <label>Start Time *</label>
            <input type='time' value={startTime} onChange={e => setStartTime(e.target.value)} required style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }} />
          </div>
          <div>
            <label>End Time *</label>
            <input type='time' value={endTime} onChange={e => setEndTime(e.target.value)} required style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label>Address (optional)</label>
            <select value={addressId} onChange={e => setAddressId(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }}>
              <option value=''>Use cycle/workshop address</option>
              {addresses.map(a => <option key={a.id} value={a.id}>{`${a.city}, ${a.street} ${a.buildingNumber}`}</option>)}
            </select>
          </div>
          <div>
            <label>Max Participants (optional)</label>
            <input disabled value={maxParticipants} onChange={e => setMaxParticipants(e.target.value)} placeholder='(set at cycle)' style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, background:'#f3f4f6', color:'#6b7280' }} />
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <Link to={`/admin/workshops/${cycle?.workshop?.id || cycle?.workshopId || ''}`}><button type='button' style={{ marginRight: 8, padding: '8px 14px', borderRadius: 8 }}>Cancel</button></Link>
          <button type='submit' disabled={loading} style={{ padding: '8px 16px', borderRadius: 8, background: '#10b981', color: 'white', border: 'none' }}>{loading ? 'Creating...' : 'Create session'}</button>
        </div>
      </form>
    </div>
  );
}
