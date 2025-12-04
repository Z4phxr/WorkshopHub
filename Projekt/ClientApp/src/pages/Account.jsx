import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { formatSessionRange } from '../utils/formatDateRange.js';
import AdminNavbar from '../components/AdminNavbar';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';
const PLACEHOLDER = '/placeholder.svg';
const resolveImg = (u) => {
  if (!u) return PLACEHOLDER;
  if (/^https?:\/\//i.test(u)) return u;
  return `${API_URL}${u.startsWith('/') ? '' : '/'}${u}`;
};

function decodeToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    return payload;
  } catch { return null; }
}

// use a small middle dot as pause between dates
function formatDateRange(cycle) {
  if (!cycle) return '';
  const s = cycle.startDate ? new Date(cycle.startDate) : null;
  const e = cycle.endDate ? new Date(cycle.endDate) : null;
  const sep = ' · ';
  if (s && e) return `${s.toLocaleDateString()}${sep}${e.toLocaleDateString()}`;
  if (s) return s.toLocaleDateString();
  return '';
}

// sanitize text to remove replacement characters or other control chars that
// can render as the black diamond/question mark symbol in the browser
function sanitizeText(input) {
  if (!input && input !== 0) return '';
  let s = String(input);
  // remove the Unicode replacement character and other unlikely control chars
  s = s.replace(/\uFFFD/g, '');
  // remove common invisible/control characters
  s = s.replace(/[\x00-\x1F\x7F]/g, '');
  // trim extra whitespace
  return s.trim();
}

// pick instructor: check PascalCase and camelCase default instructor fields
function getInstructorName(enrollment) {
  try {
    const w = enrollment.workshop || enrollment.Workshop || {};
    // possible keys: defaultInstructor, DefaultInstructor
    const defaultInstr = w.defaultInstructor || w.DefaultInstructor || null;
    if (defaultInstr) {
      const first = defaultInstr.FirstName || defaultInstr.firstName || defaultInstr.First || defaultInstr.first || '';
      const last = defaultInstr.LastName || defaultInstr.lastName || defaultInstr.Last || defaultInstr.last || '';
      const full = `${first} ${last}`.trim();
      if (full) return full;
      if (defaultInstr.name) return defaultInstr.name;
    }

    // fallback to instructorName / InstructorName (string)
    if (w.instructorName) return w.instructorName;
    if (w.InstructorName) return w.InstructorName;

    // fallback to simple instructor field
    if (w.instructor) return typeof w.instructor === 'string' ? w.instructor : (w.instructor.name || `${w.instructor.FirstName || ''} ${w.instructor.LastName || ''}`.trim());
    if (w.Instructor) return typeof w.Instructor === 'string' ? w.Instructor : (w.Instructor.name || `${w.Instructor.FirstName || ''} ${w.Instructor.LastName || ''}`.trim());
  } catch (ex) {
    // ignore
  }
  return '';
}

function formatAddressObj(a) {
  if (!a) return '';
  // a may contain City/Street/BuildingNumber or city/street/buildingNumber
  const city = a.City || a.city || '';
  const street = a.Street || a.street || '';
  const building = a.BuildingNumber || a.buildingNumber || a.building || '';
  const room = a.Room || a.room || a.roomNumber || '';
  const parts = [];
  if (city) parts.push(city);
  if (street) parts.push(street + (building ? ' ' + building : ''));
  if (room) parts.push('room ' + room);
  return parts.join(', ');
}

// format countdown object { days, hours, minutes }
function formatCountdown(countdown) {
  if (!countdown) return '';
  const parts = [];
  if (typeof countdown.days === 'number') parts.push(`${countdown.days}d`);
  if (typeof countdown.hours === 'number') parts.push(`${countdown.hours}h`);
  if (typeof countdown.minutes === 'number') parts.push(`${countdown.minutes}m`);
  return parts.length > 0 ? `Starts in ${parts.join(' ')}` : '';
}

// compute countdown client-side from a Date (fallback when server didn't provide countdown)
function computeCountdownFromDate(dt) {
  if (!dt) return null;
  const now = new Date();
  const target = new Date(dt);
  let span = target - now;
  if (span <= 0) return { days: 0, hours: 0, minutes: 0 };
  const days = Math.floor(span / (24 * 3600 * 1000));
  span -= days * 24 * 3600 * 1000;
  const hours = Math.floor(span / (3600 * 1000));
  span -= hours * 3600 * 1000;
  const minutes = Math.floor(span / (60 * 1000));
  return { days, hours, minutes };
}

// Helper: determine effective start and end dates for an enrollment
// Priority: use session times (earliest start, latest end) if present; otherwise use cycle start/end
function getEffectiveStartEnd(enrollment) {
  try {
    const cycle = enrollment.cycle || enrollment.Cycle || null;
    const sessions = (cycle && (cycle.sessions || cycle.Sessions)) || [];
    let start = null;
    let end = null;
    if (Array.isArray(sessions) && sessions.length > 0) {
      const starts = sessions.map(s => s.startTime || s.StartTime).filter(x => x).map(d => new Date(d).getTime());
      const ends = sessions.map(s => s.endTime || s.EndTime).filter(x => x).map(d => new Date(d).getTime());
      if (starts.length > 0) start = new Date(Math.min(...starts));
      if (ends.length > 0) end = new Date(Math.max(...ends));
    }
    if (!start && cycle && (cycle.startDate || cycle.StartDate)) start = new Date(cycle.startDate || cycle.StartDate);
    if (!end && cycle && (cycle.endDate || cycle.EndDate)) end = new Date(cycle.endDate || cycle.EndDate);
    return { start, end };
  } catch (ex) {
    return { start: null, end: null };
  }
}

// Helper: compute time status for an enrollment
// Returns: { start, end, isUpcoming, isOngoing, isPast, countdown }
// - countdown: object {days,hours,minutes} when upcoming (time until start)
// - isOngoing true when now is between start and end
// - isPast true when end < now
function computeTimeStatus(enrollment) {
  const now = new Date();
  const { start, end } = getEffectiveStartEnd(enrollment);

  const hasStart = start instanceof Date && !isNaN(start);
  const hasEnd = end instanceof Date && !isNaN(end);

  if (hasStart && now < start) {
    // upcoming: show countdown to start
    return { start, end, isUpcoming: true, isOngoing: false, isPast: false, countdown: computeCountdownFromDate(start) };
  }

  if (hasStart && hasEnd && now >= start && now <= end) {
    // ongoing: no countdown, mark as happening
    return { start, end, isUpcoming: false, isOngoing: true, isPast: false, countdown: null };
  }

  if (hasEnd && now > end) {
    // past
    return { start, end, isUpcoming: false, isOngoing: false, isPast: true, countdown: null };
  }

  // fallback: if we have start that is in past but no end, consider past
  if (hasStart && now > start) return { start, end, isUpcoming: false, isOngoing: false, isPast: true, countdown: null };

  // unknown: no dates
  return { start, end, isUpcoming: false, isOngoing: false, isPast: false, countdown: null };
}

export default function Account() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  const navigate = useNavigate();
  const [payingIds, setPayingIds] = useState([]);
  const [data, setData] = useState({ upcoming: [], past: [], payments: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // review form visibility and content per enrollment
  const [reviewForms, setReviewForms] = useState({}); // { [enrollmentId]: { visible: boolean, rating: number, comment: string } }
  // store recently added review results to show on-page feedback
  const [reviewSuccess, setReviewSuccess] = useState({});
  // map workshopId -> existing review by this user (fetched from API)
  const [userReviews, setUserReviews] = useState({});
  // track which enrollmentId is in edit mode
  const [editingReviews, setEditingReviews] = useState({});

  // gradients and styles (moved here so they are defined before any render logic)
  const gradients = {
    category: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
    address: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    workshop: 'linear-gradient(135deg, #667eea, #764ba2)'
  };

  const infoTextStyle = { color: '#64748b', fontSize: 13, paddingTop: 4, lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  const titleStyle = { fontWeight: 800, fontSize: 18, paddingBottom: 6, lineHeight: '1.15', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' };
  const smallMuted = { color:'#6b7280', fontSize:13 };
  const pricePillStyle = (price) => ({ padding:'4px 10px', borderRadius:999, background: price === 0 ? '#ecfdf5' : '#fff7ed', color: price === 0 ? '#065f46' : '#92400e', border: price === 0 ? '1px solid #bbf7d0' : '1px solid #fcd34d', fontWeight:800, fontSize:13 });
  const countdownBadgeStyle = { padding:'6px 12px', borderRadius:999, background:'linear-gradient(90deg,#06b6d4,#3b82f6)', color:'white', fontWeight:700, fontSize:13 };

  // consistent heading style for sections to keep equal spacing to cards below
  const sectionHeadingStyle = { marginTop: 0, marginBottom: 16 };

  // card styles
  const cardStyle = { padding:12, borderRadius:14, border:'1px solid #eef3f7', background:'#ffffff', boxShadow:'0 4px 18px rgba(16,24,40,0.04)', transition:'transform .12s ease, box-shadow .12s ease', display:'flex', alignItems:'stretch', gap:16, minHeight:150, position:'relative', overflow:'hidden' };
  const DEFAULT_CARD_STYLE = cardStyle;
  const imgStyle = { width:220, height:150, objectFit:'cover', borderRadius:10, flex:'0 0 220px', boxShadow:'0 6px 18px rgba(99,102,241,0.06)' };
  const contentStyle = { flex:1, display:'flex', flexDirection:'column', gap:6, minWidth:0, justifyContent:'flex-start' };
  const actionsStyle = { display:'flex', flexDirection:'column', gap:10, alignItems:'flex-end', justifyContent:'flex-end', minWidth:120, height: '100%' };

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    load();
  }, []);

  // keep countdowns fresh client-side (update every 60s)
  useEffect(() => {
    const tick = () => {
      setData(prev => {
        if (!prev || !prev.upcoming) return prev;
        const nextUpcoming = prev.upcoming.map(u => {
          const ts = computeTimeStatus(u);
          // attach both countdown and a simple status flag for renders
          return { ...u, __countdown: ts.countdown, __isOngoing: ts.isOngoing, __timeStatus: ts };
        });
        return { ...prev, upcoming: nextUpcoming };
      });
    };
    tick();
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      // fetch current user (needed to filter reviews)
      let currentUserId = null;
      try {
        const meResp = await axios.get(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        currentUserId = meResp?.data?.userId ?? meResp?.data?.UserId ?? null;
      } catch { /* ignore, will fail later if needed */ }
      const resp = await axios.get(`${API_URL}/api/enrollments/mine`, { headers: { Authorization: `Bearer ${token}` } });
      const rows = resp.data || [];

      // DEBUG: log enrollments for diagnosis
      console.debug('Account.load: enrollments count=', rows.length, rows.slice(0,3));

      // collect unique workshop ids to ensure we have full workshop info
      const needFetch = new Set();
      for (const r of rows) {
        const w = r.workshop || r.Workshop || {};
        const id = w.id || w.Id || r.workshopId || r.WorkshopId;
        if (id) needFetch.add(id);
      }

      // fetch workshop details for all relevant ids (so we always have default instructor/address)
      const workshopById = {};
      if (needFetch.size > 0) {
        const promises = Array.from(needFetch).map(id =>
          axios.get(`${API_URL}/api/workshops/${id}`).then(r => ({ id, data: r.data })).catch(err => {
            console.debug('Account.load: failed fetch workshop', id, err?.response?.data || err?.message);
            return ({ id, data: null });
          })
        );
        const results = await Promise.all(promises);
        for (const res of results) {
          if (res.data) workshopById[res.id] = res.data;
        }
        console.debug('Account.load: fetched workshops', Object.keys(workshopById));
      }

      // merge fetched workshop info into enrollments so getInstructorName and address can read defaultInstructor
      for (const r of rows) {
        const id = (r.workshop && (r.workshop.id || r.workshop.Id)) || r.workshopId || r.WorkshopId;
        if (id && workshopById[id]) {
          // ensure r.workshop exists and copy missing fields
          r.workshop = r.workshop || {};
          const src = workshopById[id];
          // copy common fields if missing
          if (!r.workshop.defaultInstructor && src.defaultInstructor) r.workshop.defaultInstructor = src.defaultInstructor;
          if (!r.workshop.DefaultInstructor && src.DefaultInstructor) r.workshop.DefaultInstructor = src.DefaultInstructor;
          if (!r.workshop.instructorName && src.instructorName) r.workshop.instructorName = src.instructorName;
          if (!r.workshop.InstructorName && src.InstructorName) r.workshop.InstructorName = src.InstructorName;
          if (!r.workshop.address && src.address) r.workshop.address = src.address;
          if (!r.workshop.Address && src.Address) r.workshop.Address = src.Address;
          if (!r.workshop.title && src.title) r.workshop.title = src.title;
          if (!r.workshop.Title && src.Title) r.workshop.Title = src.Title;
        }
      }

      const now = new Date();
      const upcoming = [];
      const past = [];
      const payments = [];
      for (const r of rows) {
          const ts = computeTimeStatus(r);
          const statusVal = (r.status ?? r.Status ?? '').toString().toLowerCase();
          const isCancelled = statusVal === 'cancelled' || statusVal === 'canceled' || !!(r.cancelledAt ?? r.CancelledAt);
          if (ts.isPast) {
            past.push(r);
          } else {
            // only include non-cancelled future enrollments in upcoming
            if (!isCancelled) upcoming.push(r);
          }
          if (r.payments && r.payments.length) payments.push(...r.payments.map(p=> ({ ...p, workshop: r.workshop ? (r.workshop.title || r.workshop.Title) : null, enrollmentId: r.enrollmentId })));
      }

      console.debug('Account.load: upcoming/past counts', upcoming.length, past.length);

      // fetch countdowns from API stored-procedure backed endpoint
      if (upcoming.length > 0) {
          try {
              const resp2 = await axios.get(`${API_URL}/api/enrollments/mine/upcoming-with-countdown`, { headers: { Authorization: `Bearer ${token}` } });
              const cd = resp2.data || [];
              console.debug('Account.load: countdowns', cd);
              // map countdowns by enrollmentId
              const byId = new Map();
              for (const c of cd) {
                  if (c.enrollmentId != null) byId.set(String(c.enrollmentId), c.countdown || null);
              }
              for (const u of upcoming) {
                  const cid = u.enrollmentId || u.enrollmentId || u.Id || u.id;
                  const countdown = byId.get(String(cid)) ?? null;
                  u.__countdown = countdown;
              }
          } catch (ex) { console.debug('Account.load: failed to fetch countdowns', ex?.response?.data || ex?.message); }
      }

      setData({ upcoming, past, payments });

      // fetch reviews and build map for this user
      if (currentUserId) {
        try {
          const revResp = await axios.get(`${API_URL}/api/reviews`); // AllowAnonymous
          const allReviews = revResp.data || [];
          const map = {};
          for (const r of allReviews) {
            if (Number(r.userId) === Number(currentUserId)) {
              map[r.workshopId] = r; // one per workshop enforced by API logic
            }
          }
          setUserReviews(map);
        } catch (ex) { console.debug('Failed to fetch reviews', ex?.response?.data || ex?.message); }
      }
    } catch (e) { setError(e?.response?.data ?? e?.message ?? 'Failed to load account'); }
    finally { setLoading(false); }
  }

  function handleSignOut() {
    // notify server (attempt best-effort) and then clear local token
    try {
      if (token) {
        axios.post(`${API_URL}/api/auth/logout`, null, { headers: { Authorization: `Bearer ${token}` } }).catch(err => { console.debug('Logout notify failed', err?.response?.data || err?.message); });
      }
    } catch (e) {
      console.debug('Logout notify threw', e);
    }
    localStorage.removeItem('jwt');
    navigate('/login');
  }

  async function handleDeleteAccount() {
    if (!window.confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) return;
    setDeleting(true); setError('');
    try {
      const cfg = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`${API_URL}/api/users/me`, cfg);
      // sign out and navigate away
      try { localStorage.removeItem('jwt'); localStorage.removeItem('roles'); } catch {}
      alert('Your account has been deleted.');
      navigate('/');
    } catch (e) {
      setError(e?.response?.data ?? e?.message ?? 'Failed to delete account');
    } finally { setDeleting(false); }
  }

  // helper to determine payment status for an enrollment
  function getPaymentStatus(enrollment) {
    const payments = enrollment.payments ?? enrollment.Payments ?? [];
    if (!payments || payments.length === 0) return { status: 'none', payment: null };
    // prefer any Paid
    const paid = payments.find(p => (p.Status || p.status || '').toString().toLowerCase() === 'paid');
    if (paid) return { status: 'paid', payment: paid };
    const pending = payments.find(p => (p.Status || p.status || '').toString().toLowerCase() === 'pending');
    if (pending) return { status: 'pending', payment: pending };
    return { status: 'other', payment: payments[0] };
  }

  async function handleMarkPaidForEnrollment(enrollment) {
    const eid = enrollment.enrollmentId ?? enrollment.Id ?? enrollment.id;
    if (!eid) return;
    if (!token) { navigate('/login'); return; }
    // avoid double clicks
    setPayingIds(prev => Array.from(new Set([...prev, String(eid)])));
    try {
      const cfg = { headers: { Authorization: `Bearer ${token}` } };
      const resp = await axios.put(`${API_URL}/api/payments/my-payment/enrollment/${eid}/mark-paid`, {}, cfg);
      const paid = resp?.data?.payment ?? resp?.data;
      // merge payment into enrollment in state (upcoming or past) and into payments list
      setData(prev => {
        const mapEnroll = (arr) => arr.map(e => {
          const id = e.enrollmentId ?? e.Id ?? e.id;
          if (String(id) === String(eid)) {
            const payments = Array.isArray(e.payments) ? [...e.payments] : (Array.isArray(e.Payments) ? [...e.Payments] : []);
            // replace pending if exists, else push
            const idx = payments.findIndex(p => (p.Status || p.status || '')?.toString().toLowerCase() === 'pending');
            if (idx >= 0) payments[idx] = paid; else payments.push(paid);
            return { ...e, payments };
          }
          return e;
        });

        const workshopTitle = enrollment.workshop ? (enrollment.workshop.title || enrollment.workshop.Title) : null;
        const normalizedPaid = { ...(paid || {}), workshop: workshopTitle, enrollmentId: eid };

        const existingPayments = Array.isArray(prev.payments) ? prev.payments.filter(p => String(p.enrollmentId) !== String(eid)) : [];
        const newPayments = [...existingPayments, normalizedPaid];

        return { ...prev, upcoming: mapEnroll(prev.upcoming), past: mapEnroll(prev.past), payments: newPayments };
      });
    } catch (ex) {
      console.debug('Payment mark failed', ex?.response?.data || ex?.message || ex);
      alert('Failed to mark payment as paid.');
    } finally {
      setPayingIds(prev => prev.filter(x => String(x) !== String(eid)));
    }
  }

  // review form helpers
  function toggleReviewForm(enrollmentId) {
    setReviewForms(prev => {
      const current = prev[enrollmentId] || { visible: false, rating: 0, comment: '' };
      return { ...prev, [enrollmentId]: { ...current, visible: !current.visible } };
    });
  }
  function setReviewRating(enrollmentId, rating) {
    setReviewForms(prev => {
      const current = prev[enrollmentId] || { visible: true, rating: 0, comment: '' };
      return { ...prev, [enrollmentId]: { ...current, rating } };
    });
  }
  function setReviewComment(enrollmentId, comment) {
    setReviewForms(prev => {
      const current = prev[enrollmentId] || { visible: true, rating: 0, comment: '' };
      return { ...prev, [enrollmentId]: { ...current, comment } };
    });
  }
  async function submitReview(enrollment) {
    const eid = enrollment.enrollmentId ?? enrollment.Id ?? enrollment.id;
    const wid = enrollment.workshop?.id ?? enrollment.workshop?.Id ?? null;
    const form = reviewForms[eid];

    const start = enrollment.cycle && enrollment.cycle.startDate ? new Date(enrollment.cycle.startDate) : (enrollment.cycle && enrollment.cycle.sessions && enrollment.cycle.sessions.length>0 ? new Date(enrollment.cycle.sessions[0].startTime) : null);
    // use effective end time (last session end or cycle end) to decide if workshop finished
    let end = null;
    try {
      const sessions = (enrollment.cycle && (enrollment.cycle.sessions || enrollment.cycle.Sessions)) || [];
      if (Array.isArray(sessions) && sessions.length > 0) {
        const endTimes = sessions
          .map(s => s.endTime || s.EndTime)
          .filter(x => x)
          .map(d => new Date(d).getTime());
        if (endTimes.length > 0) end = new Date(Math.max(...endTimes));
      }
      if (!end && enrollment.cycle && (enrollment.cycle.endDate || enrollment.cycle.EndDate)) end = new Date(enrollment.cycle.endDate || enrollment.cycle.EndDate);
      if (!end && enrollment.cycle && (enrollment.cycle.startDate || enrollment.cycle.StartDate)) end = new Date(enrollment.cycle.startDate || enrollment.cycle.StartDate);
    } catch (ex) { end = null; }

    const isPast = end ? (end < new Date()) : true;
    if (!isPast) { alert('You can leave a review after the workshop date.'); return; }
    if (!form || form.rating < 1 || form.rating > 5) { alert('Please select a rating from 1 to 5 stars.'); return; }

    try {
      // The API requires UserId to match the authenticated user
      const me = await axios.get(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const currentUserId = me?.data?.userId ?? me?.data?.UserId ?? null;
      if (!currentUserId) { alert('Please sign in again.'); return; }

      const payload = {
        userId: Number(currentUserId),
        workshopId: wid,
        rating: form.rating,
        comment: form.comment || ''
      };
      const cfg = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };

      await axios.post(`${API_URL}/api/reviews`, payload, cfg);

      // show success on page under the enrollment instead of alert
      setReviewForms(prev => ({ ...prev, [eid]: { visible: false, rating: 0, comment: '' } }));
      setReviewSuccess(prev => ({ ...prev, [eid]: { rating: form.rating, comment: form.comment || '' } }));
      // refetch reviews to obtain real review id and update map
      try {
        const revResp = await axios.get(`${API_URL}/api/reviews`);
        const allReviews = revResp.data || [];
        const map = {};
        for (const r of allReviews) {
          if (Number(r.userId) === Number(payload.userId)) map[r.workshopId] = r;
        }
        setUserReviews(map);
      } catch (ex2) { console.debug('Refetch reviews after submit failed', ex2?.response?.data || ex2?.message); }
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data || e?.message || 'Failed to add review.';
      console.debug('submitReview failed', status, msg);
      if (status === 403) {
        alert('You are not authorized to leave a review. Ensure you are signed in, this enrollment is yours, and the workshop has already occurred.');
      } else if (status === 401) {
        alert('Your session may have expired. Please sign in again.');
      } else if (status === 400) {
        alert(typeof msg === 'string' ? msg : 'Invalid review.');
      } else {
        alert('Failed to add review.');
      }
    }
  }

  async function updateReview(enrollment) {
    const eid = enrollment.enrollmentId ?? enrollment.Id ?? enrollment.id;
    const wid = enrollment.workshop?.id ?? enrollment.workshop?.Id ?? null;
    const existing = userReviews[wid];
    const form = reviewForms[eid];
    if (!existing) { return; }
    if (!form || form.rating < 1 || form.rating > 5) { alert('Select a rating 1-5.'); return; }
    try {
      const body = { id: existing.id, userId: existing.userId, workshopId: existing.workshopId, rating: form.rating, comment: form.comment || '' };
      await axios.put(`${API_URL}/api/reviews/${existing.id}`, body, { headers: { Authorization: `Bearer ${token}` } });
      // update local state
      setUserReviews(prev => ({ ...prev, [wid]: { ...existing, rating: form.rating, comment: form.comment || '' } }));
      setEditingReviews(prev => ({ ...prev, [eid]: false }));
      setReviewForms(prev => ({ ...prev, [eid]: { visible: false, rating: 0, comment: '' } }));
      setReviewSuccess(prev => ({ ...prev, [eid]: { rating: form.rating, comment: form.comment || '' } }));
    } catch (e) {
      console.debug('updateReview failed', e?.response?.data || e?.message);
      alert('Failed to update review.');
    }
  }

  async function deleteReview(enrollment) {
    const wid = enrollment.workshop?.id ?? enrollment.workshop?.Id ?? null;
    if (!wid) return;
    const review = userReviews[wid];
    if (!review) return;
    if (!window.confirm('Delete this review permanently?')) return;
    try {
      await axios.delete(`${API_URL}/api/reviews/${review.id}`, { headers: { Authorization: `Bearer ${token}` } });
      // remove from maps
      setUserReviews(prev => { const copy = { ...prev }; delete copy[wid]; return copy; });
      const eid = enrollment.enrollmentId ?? enrollment.Id ?? enrollment.id;
      setReviewSuccess(prev => { const copy = { ...prev }; delete copy[eid]; return copy; });
      setReviewForms(prev => ({ ...prev, [eid]: { visible: false, rating: 0, comment: '' } }));
    } catch (ex) {
      console.debug('deleteReview failed', ex?.response?.data || ex?.message);
      alert('Failed to delete review.');
    }
  }

  if (!token) return null;

  return (
    <div style={{ minHeight:'100vh', background:'#ffffff' }}>
      {/* Navbar */}
      <AdminNavbar />

      <div style={{ maxWidth:1000, margin:'32px auto', padding:'0 24px 80px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:16 }}>
          <h2 style={{ margin:0 }}>Your account</h2>
          <div style={{ display:'flex', gap:8 }}>
            {/* moved delete button to bottom */}
          </div>
        </div>

        {error && <div style={{ padding:12, background:'#fee2e2', border:'1px solid #fecaca', color:'#991b1b', borderRadius:8 }}>{String(error)}</div>}

        <div style={{ display:'grid', gap:16 }}>
          <div style={{ background:'white', padding:16, borderRadius:12, border:'1px solid #e5e7eb' }}>
            <h3 style={sectionHeadingStyle}>Upcoming workshops ({data.upcoming.length})</h3>
            {data.upcoming.length === 0 ? <p style={{ color:'#6b7280' }}>No upcoming enrollments.</p> : (
              <div style={{ display:'grid', gap:20 }}>
                {data.upcoming.map(u => {
                  const instr = sanitizeText(getInstructorName(u));
                  const defaultAddr = formatAddressObj((u.cycle && (u.cycle.address || u.cycle.Address)) || (u.workshop && (u.workshop.address || u.workshop.Address)));
                  // determine date for countdown (session start or cycle start)
                  const ts = u.__timeStatus ?? computeTimeStatus(u);
                  let countdownText = '';
                  if (ts.isOngoing) countdownText = 'Happening now';
                  else if (ts.countdown) countdownText = formatCountdown(ts.countdown);

                  const paymentStatus = getPaymentStatus(u);
                  const isPaid = paymentStatus.status === 'paid';
                  const isPending = paymentStatus.status === 'pending';
                  const isAdmin = false; // TODO: detect admin role
                  const priceVal = u.cycle?.priceOverride ?? u.workshop?.price ?? u.workshop?.Price ?? null;

                  return (
                    <div key={u.enrollmentId} style={cardStyle || DEFAULT_CARD_STYLE}>
                      {/* countdown in top-right corner */}
                      {countdownText && <div style={{ position:'absolute', top:12, right:12 }}>{/* keep visual badge */}<div style={countdownBadgeStyle}>{countdownText.replace(/^Starts in /,'')}</div></div>}
                      <div style={{ display:'flex', gap:16, alignItems:'stretch', width:'100%' }}>
                        <img src={resolveImg(u.workshop?.imageUrl || u.workshop?.ImageUrl)} alt={sanitizeText(u.workshop?.title || u.workshop?.Title || 'Workshop')} style={imgStyle} onError={(e)=>e.currentTarget.src=PLACEHOLDER} />
                        <div style={contentStyle}>
                          <div>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={titleStyle} title={sanitizeText(u.workshop?.title || u.workshop?.Title)}>{sanitizeText(u.workshop?.title || u.workshop?.Title)}</div>
                              {priceVal != null && (<div style={pricePillStyle(priceVal)}>{priceVal === 0 ? 'Free' : `${priceVal} PLN`}</div>)}
                            </div>
                            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                              <div style={{ ...infoTextStyle, fontWeight:600 }}>{sanitizeText(formatSessionRange(u.cycle && u.cycle.sessions && u.cycle.sessions.length>0 ? u.cycle.sessions[0] : null, u.cycle))}</div>
                            </div>
                            <div style={{ ...infoTextStyle, whiteSpace:'normal', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{sanitizeText(defaultAddr)}</div>
                            {instr ? <div style={{ ...infoTextStyle, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>Instructor: {instr}</div> : <div style={infoTextStyle}>Instructor: —</div>}
                          </div>
                          <div style={{ marginTop:8 }}>
                            {paymentStatus.status === 'paid' ? (
                              <div style={{ padding:'6px 10px', borderRadius:999, background:'linear-gradient(90deg,#10b981,#059669)', color:'white', fontWeight:700, fontSize:12, display:'inline-block' }}>Paid</div>
                            ) : paymentStatus.status === 'pending' ? (
                              <div>
                                <button
                                  disabled={payingIds.includes(String(u.enrollmentId))}
                                  onClick={() => {
                                    handleMarkPaidForEnrollment(u);
                                  }}
                                  style={{ padding:'8px 12px', borderRadius:8, border:'none', background:gradients.category, color:'white', fontWeight:700 }}
                                >
                                  {payingIds.includes(String(u.enrollmentId)) ? 'Processing...' : 'Complete payment'}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div style={actionsStyle}>
                          {(() => {
                            const cycleId = u.cycle?.id ?? u.cycle?.Id ?? u.cycleId ?? u.CycleId ?? null;
                            if (cycleId) return (<Link to={`/cycles/${cycleId}`}><button style={{ padding:'8px 12px', borderRadius:8, border:'none', background:gradients.workshop, color:'white' }}>View</button></Link>);
                            return (<Link to={`/workshops/${u.workshop?.id || u.workshop?.Id}`}><button style={{ padding:'8px 12px', borderRadius:8, border:'none', background:gradients.workshop, color:'white' }}>View</button></Link>);
                          })()}
                        </div>
                      </div>
                    </div>
                   );
                 })}
               </div>
             )}
           </div>

          <div style={{ background:'white', padding:16, borderRadius:12, border:'1px solid #e5e7eb' }}>
            <h3 style={sectionHeadingStyle}>Past workshops ({data.past.length})</h3>
            {data.past.length === 0 ? <p style={{ color:'#6b7280' }}>No past enrollments.</p> : (
              <div style={{ display:'grid', gap:12 }}>
                {data.past.map(u => {
                  const instr = sanitizeText(getInstructorName(u));
                  const defaultAddr = formatAddressObj((u.cycle && (u.cycle.address || u.cycle.Address)) || (u.workshop && (u.workshop.address || u.workshop.Address)));
                  const priceVal = u.cycle?.priceOverride ?? u.workshop?.price ?? u.workshop?.Price ?? null;
                  const eid = u.enrollmentId ?? u.Id ?? u.id;
                  const form = reviewForms[eid] || { visible: false, rating: 0, comment: '' };
                  const wid = u.workshop?.id ?? u.workshop?.Id;
                  const existingReview = wid ? userReviews[wid] : null;
                  const editing = editingReviews[eid];

                  return (
                    <div key={u.enrollmentId} style={cardStyle || DEFAULT_CARD_STYLE}>
                      <div style={{ display:'flex', gap:16, alignItems:'stretch', width:'100%' }}>
                        <img src={resolveImg(u.workshop?.imageUrl || u.workshop?.ImageUrl)} alt={sanitizeText(u.workshop?.title || u.workshop?.Title || 'Workshop')} style={imgStyle} onError={(e)=>e.currentTarget.src=PLACEHOLDER} />
                        <div style={contentStyle}>
                          <div>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={titleStyle} title={sanitizeText(u.workshop?.title || u.workshop?.Title)}>{sanitizeText(u.workshop?.title || u.workshop?.Title)}</div>
                              {priceVal != null && (<div style={pricePillStyle(priceVal)}>{priceVal === 0 ? 'Free' : `${priceVal} PLN`}</div>)}
                            </div>
                            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                              <div style={{ ...infoTextStyle, fontWeight:600 }}>{sanitizeText(formatSessionRange(u.cycle && u.cycle.sessions && u.cycle.sessions.length>0 ? u.cycle.sessions[0] : null, u.cycle))}</div>
                            </div>
                            <div style={{ ...infoTextStyle, whiteSpace:'normal', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{sanitizeText(defaultAddr)}</div>
                            {instr ? <div style={{ ...infoTextStyle, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>Instructor: {instr}</div> : <div style={infoTextStyle}>Instructor: —</div>}

                            {/* Review section logic */}
                            {!existingReview && !editing && (
                              <div style={{ marginTop:8 }}>
                                <button onClick={() => toggleReviewForm(eid)} style={{ padding:'8px 12px', borderRadius:8, border:'none', background:gradients.category, color:'white' }}>Leave review</button>
                              </div>
                            )}

                            {/* Inline form for new or editing review */}
                            {form.visible && (!existingReview || editing) && (
                              <div style={{ marginTop:10, padding:10, border:'1px solid #e5e7eb', borderRadius:10, background:'#f8fafc' }}>
                                <div style={{ marginBottom:8, display:'flex', gap:6, alignItems:'center' }}>
                                  {[1,2,3,4,5].map(star => (
                                    <button key={star} onClick={() => setReviewRating(eid, star)} style={{
                                      width:32, height:32, borderRadius:999, border:'1px solid #e5e7eb', background: (form.rating >= star) ? '#fde68a' : 'white',
                                      cursor:'pointer', fontWeight:700
                                    }}>
                                      {star}
                                    </button>
                                  ))}
                                  <span style={{ marginLeft:8, color:'#64748b', fontSize:12 }}>Select 1-5 stars</span>
                                </div>
                                <div>
                                  <textarea
                                    value={form.comment}
                                    onChange={(e) => setReviewComment(eid, e.target.value)}
                                    placeholder="Optional comment"
                                    rows={3}
                                    style={{ width:'100%', padding:8, borderRadius:8, border:'1px solid #e5e7eb', resize:'vertical' }}
                                  />
                                </div>
                                <div style={{ marginTop:8, display:'flex', gap:8 }}>
                                  {!existingReview && <button onClick={() => submitReview(u)} style={{ padding:'8px 12px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#10b981,#22c55e)', color:'white', fontWeight:700 }}>Add review</button>}
                                  {existingReview && editing && <button onClick={() => updateReview(u)} style={{ padding:'8px 12px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#10b981,#22c55e)', color:'white', fontWeight:700 }}>Save</button>}
                                  <button onClick={() => { toggleReviewForm(eid); setEditingReviews(prev => ({ ...prev, [eid]: false })); }} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', color:'#111827' }}>Cancel</button>
                                </div>
                              </div>
                            )}

                            {/* Existing review display */}
                            {existingReview && !editing && (
                              <div style={{ marginTop:10, padding:10, borderRadius:8, background:'#f5f3ff', border:'1px solid #e0e7ff', color:'#1e3a8a', maxWidth:720 }}>
                                <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontWeight:700 }}>Your review: {existingReview.rating} / 5</div>
                                    {existingReview.comment && <div style={{ fontSize:13, marginTop:6 }}>{sanitizeText(existingReview.comment)}</div>}
                                  </div>
                                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                    <button
                                      onClick={() => {
                                        setReviewForms(prev => ({ ...prev, [eid]: { visible: true, rating: existingReview.rating, comment: existingReview.comment || '' } }));
                                        setEditingReviews(prev => ({ ...prev, [eid]: true }));
                                      }}
                                      style={{ padding:'6px 12px', borderRadius:8, border:'none', background:gradients.category, color:'white', fontWeight:600, fontSize:12 }}
                                    >Edit</button>
                                    <button
                                      onClick={() => deleteReview(u)}
                                      style={{ padding:'6px 12px', borderRadius:8, border:'none', background:'linear-gradient(90deg,#dc2626,#ef4444)', color:'white', fontWeight:600, fontSize:12 }}
                                    >Delete</button>
                                  </div>
                               </div>
                             </div>
                            )}

                            {reviewSuccess[eid] && !editing && (
                              <div style={{ marginTop:8, padding:6, borderRadius:6, background:'#f0fdf4', border:'1px solid #dcfce7', color:'#065f46', fontSize:12, maxWidth:360 }}>
                                <div style={{ fontWeight:700 }}>Review added</div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={actionsStyle}>
                          <div style={{ marginTop: 'auto' }}>
                            {(() => {
                              const cycleId = u.cycle?.id ?? u.cycle?.Id ?? u.cycleId ?? u.CycleId ?? null;
                              if (cycleId)
                                return (
                                  <Link to={`/cycles/${cycleId}`}>
                                    <button style={{ padding:'8px 12px', borderRadius:8, border:'none', background:gradients.workshop, color:'white' }}>View</button>
                                  </Link>
                                );
                              return (
                                <Link to={`/workshops/${u.workshop?.id || u.workshop?.Id}`}>
                                  <button style={{ padding:'8px 12px', borderRadius:8, border:'none', background:gradients.workshop, color:'white' }}>View</button>
                                </Link>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                   );
                 })}
               </div>
             )}
           </div>

          <div style={{ background:'white', padding:14, borderRadius:12, border:'1px solid #e5e7eb' }}>
            <h3 style={sectionHeadingStyle}>Payments ({data.payments.length})</h3>
            {data.payments.length === 0 ? (
              <p style={{ color:'#6b7280', marginBottom:6 }}>No payments found.</p>
            ) : (
              <div style={{ display:'grid', gap:8 }}>
                {data.payments.map(p => {
                  const enrollment = p.enrollmentId ? (data.upcoming.find(u => (u.enrollmentId ?? u.Id ?? u.id) === p.enrollmentId) || data.past.find(u => (u.enrollmentId ?? u.Id ?? u.id) === p.enrollmentId)) : null;
                  const workshop = enrollment ? (enrollment.workshop || enrollment.Workshop) : null;
                  const cycle = enrollment ? (enrollment.cycle || enrollment.Cycle) : null;
                  const cycleId = cycle?.id ?? cycle?.Id ?? enrollment?.cycleId ?? enrollment?.workshopCycleId ?? null;
                  const paidAt = p.paidAt || p.PaidAt || null;
                  const paidDate = paidAt ? new Date(p.paidAt || p.PaidAt).toLocaleString() : null;

                  const numericAmount = Number(p.amount ?? p.Amount ?? p.AmountString ?? 0);
                  const amountText = Number.isFinite(numericAmount) ? numericAmount.toFixed(0) : (p.amount ?? p.Amount ?? '');
                  const targetUrl = cycleId ? `/cycles/${cycleId}` : `/workshops/${workshop?.id || workshop?.Id || p.workshopId}`;

                  return (
                    <div key={p.id} style={{ padding:8, borderRadius:8, background:'#f8fafc', border:'1px solid #e5e7eb' }}>
                      <Link to={targetUrl} style={{ display:'flex', width:'100%', justifyContent:'space-between', alignItems:'center', textDecoration:'none', color:'inherit' }}>
                        <div style={{ minWidth:0, marginRight:12 }}>
                          <div style={{ fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:520 }}>{sanitizeText(p.workshop || workshop?.title || workshop?.Title || 'Payment')}</div>
                          <div style={{ ...smallMuted }}>{(p.currency ?? p.Currency) ? `${p.currency ?? p.Currency}` : ''}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontWeight:800 }}>{amountText ? `${amountText} PLN` : ''}</div>
                          <div style={{ fontSize:12, color:'#64748b' }}>{paidDate ?? 'Not paid'}</div>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
           </div>

          <div style={{ display:'flex', justifyContent:'center', marginTop:18 }}>
            <button onClick={handleDeleteAccount} disabled={deleting} style={{ padding:'10px 14px', borderRadius:8, border:'none', background: deleting ? '#fca5a5' : '#ef4444', color:'white', fontWeight:700 }}>{deleting ? 'Deleting...' : 'Delete account'}</button>
          </div>

        </div>
      </div>
    </div>
  );
}
