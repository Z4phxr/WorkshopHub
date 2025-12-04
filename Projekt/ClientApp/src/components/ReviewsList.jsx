import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';

export default function ReviewsList({ workshopId, token, reloadSignal, allowWriteReview = true, onChange = null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reviewsPage, setReviewsPage] = useState({ total: 0, page: 1, pageSize: 20, items: [] });
  const [sort, setSort] = useState('recent');

  const [currentUserId, setCurrentUserId] = useState(null);
  const [userReview, setUserReview] = useState(null); // the review written by current user, if any
  const [formVisible, setFormVisible] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!workshopId) return;
    fetchReviews(1, sort);
    // include currentUserId so we re-evaluate whether the current user already has a review
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId, sort, reloadSignal, currentUserId]);

  useEffect(() => {
    async function fetchMe() {
      if (!token) { setCurrentUserId(null); return; }
      try {
        const me = await axios.get(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const id = me?.data?.userId ?? me?.data?.UserId ?? null;
        setCurrentUserId(id);
      } catch (e) {
        setCurrentUserId(null);
      }
    }
    fetchMe();
  }, [token]);

  async function fetchReviews(page = 1, sortBy = 'recent') {
    setLoading(true); setError('');
    try {
      const resp = await axios.get(`${API_URL}/api/workshops/${workshopId}/reviews?page=${page}&pageSize=${reviewsPage.pageSize}&sort=${encodeURIComponent(sortBy)}`);
      const data = resp.data || { total:0, page:1, pageSize:20, items:[] };
      setReviewsPage(data);
      // find user's review if we have user id
      if (currentUserId && Array.isArray(data.items)) {
        const found = data.items.find(r => (r.user && (r.user.Id == currentUserId || r.user.id == currentUserId)) || Number(r.user?.Id || r.user?.id) === Number(currentUserId));
        setUserReview(found || null);
      } else {
        setUserReview(null);
      }
    } catch (e) {
      console.debug('Failed to load reviews', e?.response?.data || e?.message);
      setError('Failed to load reviews');
    } finally { setLoading(false); }
  }

  function formatDate(d) {
    try { return new Date(d).toLocaleString(); } catch { return ''; }
  }

  function renderStars(rating) {
    const n = Math.max(0, Math.min(5, Number(rating) || 0));
    // use inline SVG stars to avoid font glyph issues
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill={i < n ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 16px' }}>
            <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.402 8.168L12 18.897l-7.336 3.854 1.402-8.168L.132 9.21l8.2-1.192z" />
          </svg>
        ))}
      </div>
    );
  }

  async function handleAddReview() {
    if (!token) { alert('Please sign in to add a review'); return; }
    if (!allowWriteReview) { alert('You can only leave a review after attending this workshop.'); return; }
    if (formRating < 1 || formRating > 5) { alert('Select rating 1-5'); return; }
    setSubmitting(true);
    try {
      const me = await axios.get(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const currentUserIdLocal = me?.data?.userId ?? me?.data?.UserId ?? null;
      if (!currentUserIdLocal) { alert('Please sign in again'); return; }
      const payload = { userId: Number(currentUserIdLocal), workshopId: Number(workshopId), rating: formRating, comment: formComment || '' };
      await axios.post(`${API_URL}/api/reviews`, payload, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      setFormVisible(false); setFormRating(0); setFormComment('');
      // refresh UI and notify parent that reviews changed (so parent can reload averages)
      await fetchReviews(1, sort);
      try { if (typeof onChange === 'function') onChange(); } catch { }
    } catch (e) {
      console.debug('Add review failed', e?.response?.data || e?.message);
      const status = e?.response?.status; const msg = e?.response?.data || e?.message || 'Failed to add review.';
      if (status === 403 || status === 400) alert(typeof msg === 'string' ? msg : 'Failed to add review.'); else alert('Failed to add review.');
    } finally { setSubmitting(false); }
  }

  async function handleUpdateReview(reviewId) {
    if (!token) { alert('Please sign in to update review'); return; }
    if (!allowWriteReview) { alert('You can only update a review after attending this workshop.'); return; }
    if (formRating < 1 || formRating > 5) { alert('Select rating 1-5'); return; }
    setSubmitting(true);
    try {
      const body = { id: reviewId, rating: formRating, comment: formComment || '' };
      await axios.put(`${API_URL}/api/reviews/${reviewId}`, body, { headers: { Authorization: `Bearer ${token}` } });
      setFormVisible(false); setFormRating(0); setFormComment('');
      const now = new Date().toISOString();
      setReviewsPage(prev => {
        const items = (prev.items || []).map(it => {
          const id = it.Id ?? it.id;
          if (String(id) === String(reviewId)) {
            return {
              ...it,
              Rating: body.rating,
              rating: body.rating,
              Comment: body.comment,
              comment: body.comment,
              CreatedAt: now,
              createdAt: now
            };
          }
          return it;
        });
        return { ...prev, items };
      });
      setUserReview(prev => prev && ((prev.Id ?? prev.id) === reviewId ? { ...prev, Rating: body.rating, rating: body.rating, Comment: body.comment, comment: body.comment, CreatedAt: new Date().toISOString(), createdAt: new Date().toISOString() } : prev));
      await fetchReviews(1, sort);
      try { if (typeof onChange === 'function') onChange(); } catch { }
    } catch (e) {
      console.debug('Update review failed', e?.response?.data || e?.message);
      alert('Failed to update review.');
    } finally { setSubmitting(false); }
  }

  async function handleDeleteReview(reviewId) {
    if (!token) { alert('Please sign in to delete review'); return; }
    if (!window.confirm('Delete this review permanently?')) return;
    try {
      await axios.delete(`${API_URL}/api/reviews/${reviewId}`, { headers: { Authorization: `Bearer ${token}` } });
      await fetchReviews(1, sort);
      try { if (typeof onChange === 'function') onChange(); } catch { }
    } catch (e) {
      console.debug('Delete review failed', e?.response?.data || e?.message);
      alert('Failed to delete review.');
    }
  }

  return (
    <div style={{ marginTop:32 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <h3 style={{ margin:0, fontSize:20 }}>Reviews ({reviewsPage.total})</h3>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <label style={{ color:'#6b7280', fontSize:13 }}>Sort:</label>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding:'6px 8px', borderRadius:8, border:'1px solid #e5e7eb' }}>
            <option value="recent">Most recent</option>
            <option value="rating">Top rated</option>
          </select>
          {/* show Leave review only if user is signed in, we know their id, and they haven't left one yet */}
          {token && currentUserId && !userReview && allowWriteReview && (
            <button onClick={() => setFormVisible(true)} style={{ padding:'8px 10px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#10b981,#059669)', color:'white', fontWeight:700 }}>Leave review</button>
          )}
        </div>
      </div>

      {formVisible && (
        <div style={{ marginBottom:12, padding:12, borderRadius:10, border:'1px solid #e5e7eb', background:'#f8fafc', maxWidth:720 }}>
          <div style={{ marginBottom:8, display:'flex', gap:6, alignItems:'center' }}>
            {[1,2,3,4,5].map(s => (
              <button key={s} onClick={() => setFormRating(s)} style={{ width:32, height:32, borderRadius:999, border:'1px solid #e5e7eb', background: (formRating >= s) ? '#fde68a' : 'white', cursor:'pointer', fontWeight:700 }}>{s}</button>
            ))}
            <span style={{ marginLeft:8, color:'#64748b', fontSize:12 }}>Select 1-5 stars</span>
          </div>
          <div>
            <textarea value={formComment} onChange={e => setFormComment(e.target.value)} placeholder="Optional comment" rows={3} style={{ width:'100%', padding:8, borderRadius:8, border:'1px solid #e5e7eb', resize:'vertical' }} />
          </div>
          <div style={{ marginTop:8, display:'flex', gap:8 }}>
            {!userReview && <button disabled={submitting} onClick={handleAddReview} style={{ padding:'8px 12px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#10b981,#22c55e)', color:'white', fontWeight:700 }}>{submitting ? 'Posting...' : 'Add review'}</button>}
            {userReview && <button disabled={submitting} onClick={() => handleUpdateReview(userReview.id)} style={{ padding:'8px 12px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#10b981,#22c55e)', color:'white', fontWeight:700 }}>{submitting ? 'Saving...' : 'Save'}</button>}
            <button onClick={() => { setFormVisible(false); setFormRating(0); setFormComment(''); }} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e5e7eb', background:'white' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading && <div style={{ color:'#6b7280' }}>Loading reviews...</div>}
      {error && <div style={{ padding:8, background:'#fee2e2', color:'#991b1b', borderRadius:8 }}>{String(error)}</div>}

      {!loading && !error && reviewsPage.items.length === 0 && (
        <div style={{ color:'#6b7280' }}>No reviews yet.</div>
      )}

      <div style={{ display:'grid', gap:12, marginTop:8 }}>
        {reviewsPage.items.map(r => (
          <div key={r.Id || r.id} style={{ background:'#ffffff', border:'1px solid #eef3f7', padding:12, borderRadius:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
              <div style={{ fontWeight:800 }}>{r.user ? `${r.user.FirstName || r.user.firstName || ''} ${r.user.LastName || r.user.lastName || ''}`.trim() : 'User'}</div>
              <div style={{ display: 'flex', alignItems: 'center' }} title={`${r.Rating ?? r.rating ?? 0} / 5`}>
                {renderStars(r.Rating ?? r.rating ?? 0)}
              </div>
            </div>
            {(r.Comment || r.comment) && (
              <div style={{ marginTop:8, color:'#374151', whiteSpace:'pre-wrap' }}>{r.Comment || r.comment}</div>
            )}
            <div style={{ marginTop:8, fontSize:12, color:'#6b7280' }}>{formatDate(r.CreatedAt || r.createdAt)}</div>

            {/* show edit/delete for current user's review */}
            {currentUserId && ((r.user && (String(r.user.Id) === String(currentUserId) || String(r.user.id) === String(currentUserId))) || false) && (
              <div style={{ marginTop:8, display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={() => { setFormVisible(true); setFormRating(r.Rating ?? r.rating ?? 0); setFormComment(r.Comment || r.comment || ''); setUserReview(r); }} style={{ padding:'6px 10px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#06b6d4,#3b82f6)', color:'white', fontWeight:600 }}>Edit</button>
                <button onClick={() => handleDeleteReview(r.Id ?? r.id)} style={{ padding:'6px 10px', borderRadius:8, border:'none', background:'linear-gradient(90deg,#dc2626,#ef4444)', color:'white', fontWeight:600 }}>Delete</button>
              </div>
            )}

          </div>
        ))}
      </div>

    </div>
  );
}
