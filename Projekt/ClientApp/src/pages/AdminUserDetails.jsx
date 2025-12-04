import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import AdminNavbar from '../components/AdminNavbar';
import Toast from '../components/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';

// Role name -> id mapping (matches seeded roles in AppDbContext)
const ROLE_MAP = { Admin: 1, Instructor: 2, Participant: 3 };

export default function AdminUserDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // multi-select roles
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState('');

  const [toast, setToast] = useState(null);

  // NEW: user reviews state
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [userReviewsPage, setUserReviewsPage] = useState({ total: 0, page: 1, pageSize: 20, items: [] });

  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  const isAdmin = useMemo(() => {
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const roleClaimUri = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
      const roles = [
        ...(payload.role ? (Array.isArray(payload.role) ? payload.role : [payload.role]) : []),
        ...(payload[roleClaimUri] ? (Array.isArray(payload[roleClaimUri]) ? payload[roleClaimUri] : [payload[roleClaimUri]]) : [])
      ];
      return roles.includes('Admin');
    } catch { return false; }
  }, [token]);

  useEffect(() => {
    if (!token || !isAdmin) { navigate('/'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAdmin]);

  function extractErrorMessage(err) {
    // prefer structured ASP.NET ProblemDetails fields if present
    const resp = err?.response?.data;
    if (!resp) return err?.message || 'Unknown error';
    if (typeof resp === 'string') return resp;
    if (resp.detail) return resp.detail;
    if (resp.title) return resp.title;
    if (resp.errors) {
      try {
        // join validation errors
        return Object.values(resp.errors).flat().join(' | ');
      } catch {
        return JSON.stringify(resp.errors);
      }
    }
    return JSON.stringify(resp);
  }

  async function load() {
    setLoading(true); setError('');
    try {
      const resp = await axios.get(`${API_URL}/api/users/${id}/details`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setData(resp.data);
      const roles = (resp.data?.roles || []).map(String);
      setSelectedRoles(roles);
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally { setLoading(false); }

    // Load reviews authored by this user
    await loadUserReviews();
  }

  async function loadUserReviews() {
    setReviewsLoading(true); setReviewsError('');
    try {
      const resp = await axios.get(`${API_URL}/api/reviews/user/${id}?page=1&pageSize=20&sort=recent`);
      const data = resp.data || { total:0, page:1, pageSize:20, items:[] };
      setUserReviewsPage(data);
    } catch (e) {
      setReviewsError(extractErrorMessage(e));
    } finally { setReviewsLoading(false); }
  }

  async function deleteUser() {
    if (!confirm('Delete this user? This action cannot be undone.')) return;
    try {
      setDeleting(true);
      await axios.delete(`${API_URL}/api/users/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setToast({ message: 'User deleted', type: 'success' });
      // small delay to show toast then navigate
      setTimeout(() => navigate('/admin'), 800);
    } catch (err) {
      setToast({ message: extractErrorMessage(err), type: 'error' });
    } finally {
      setDeleting(false);
    }
  }

  async function toggleRole(roleName) {
    if (!ROLE_MAP[roleName]) return;
    setRoleError('');
    setRoleSaving(true);
    try {
      const hasRole = selectedRoles.includes(roleName);
      const roleId = ROLE_MAP[roleName];
      if (!hasRole) {
        // assign role
        await axios.post(`${API_URL}/api/userroles`, { userId: Number(id), roleId }, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        setToast({ message: `Assigned ${roleName}`, type: 'success' });
      } else {
        // remove role
        try {
          await axios.delete(`${API_URL}/api/userroles/user/${id}/role/${roleId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          setToast({ message: `Removed ${roleName}`, type: 'success' });
        } catch (delErr) {
          const msg = extractErrorMessage(delErr);
          setRoleError(msg);
          setToast({ message: msg, type: 'error' });
          return;
        }
      }
      await load();
    } catch (err) {
      const msg = extractErrorMessage(err);
      setRoleError(msg);
      setToast({ message: msg, type: 'error' });
    } finally {
      setRoleSaving(false);
    }
  }

  if (!token || !isAdmin) return null;

  // helper copied from ReviewsList to render identical stars
  function renderStars(rating) {
    const n = Math.max(0, Math.min(5, Number(rating) || 0));
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

  function formatDate(d) {
    try { return new Date(d).toLocaleString(); } catch { return ''; }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #f9fafb, #ffffff)' }}>
      <AdminNavbar showAdminPanel={true} />
      <div style={{ maxWidth: 1000, margin: '24px auto', padding: '0 24px 80px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: '#1f2937', margin: 0 }}>User details</h2>
          <div style={{ marginLeft:'auto' }}>
            <button onClick={deleteUser} disabled={deleting} style={{ padding:'8px 12px', borderRadius:10, border:'none', background:'#ef4444', color:'white', cursor:'pointer', fontWeight:700 }}>
              {deleting ? 'Deleting...' : 'Delete user'}
            </button>
          </div>
        </div>

        {loading && <p>Loading...</p>}
        {error && <div style={{ marginBottom: 16, padding: '12px 16px', color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>{String(error)}</div>}

        {data && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:20 }}>
            {/* Profile card */}
            <section style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:16, boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop:0, marginBottom:12, fontSize:20 }}>Profile</h3>
              <div style={{ display:'grid', gridTemplateColumns: '1fr 1fr auto', gap:12, alignItems:'center' }}>
                {/* First row: First name, Last name, Registered (right aligned) */}
                <div>
                  <div style={{ fontSize:12, color:'#6b7280' }}>First name</div>
                  <div style={{ fontWeight:700, fontSize:16 }}>{data.firstName}</div>
                </div>
                <div>
                  <div style={{ fontSize:12, color:'#6b7280' }}>Last name</div>
                  <div style={{ fontWeight:700, fontSize:16 }}>{data.lastName}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:12, color:'#6b7280' }}>Registered</div>
                  <div style={{ fontWeight:600 }}>{new Date(data.createdAt).toLocaleDateString()}</div>
                </div>

                {/* Second row: email full width */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize:12, color:'#6b7280' }}>Email</div>
                  <div style={{ fontWeight:600, overflowWrap: 'anywhere', wordBreak: 'break-all' }}>{data.email}</div>
                </div>

                {/* Third row: role controls full width */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', padding:5 }}>Roles</div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <button onClick={() => toggleRole('Participant')} disabled={roleSaving} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e5e7eb', background: selectedRoles.includes('Participant') ? '#f3f4f6' : 'white', cursor:'pointer' }}>
                      User
                    </button>
                    <button onClick={() => toggleRole('Instructor')} disabled={roleSaving} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e5e7eb', background: selectedRoles.includes('Instructor') ? '#f3f4f6' : 'white', cursor:'pointer' }}>
                      Instructor
                    </button>
                    <button onClick={() => toggleRole('Admin')} disabled={roleSaving} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e5e7eb', background: selectedRoles.includes('Admin') ? '#f3f4f6' : 'white', cursor:'pointer' }}>
                      Admin
                    </button>
                  </div>
                  {roleError && <div style={{ color:'#991b1b', fontSize:13, marginTop:8 }}>{String(roleError)}</div>}
                </div>
              </div>
            </section>

            {/* Enrollment history */}
            <section style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:16, boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop:0, marginBottom:12, fontSize:20 }}>Workshop registrations</h3>
              {(data.enrollments && data.enrollments.length > 0) ? (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead style={{ background:'#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign:'left', padding:10 }}>Workshop</th>
                      <th style={{ textAlign:'left', padding:10 }}>Enrolled</th>
                      <th style={{ textAlign:'left', padding:10 }}>Status</th>
                      <th style={{ textAlign:'left', padding:10 }}>Payments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.enrollments.map(e => (
                      <tr key={e.id} style={{ borderTop:'1px solid #eef2f7' }}>
                        <td style={{ padding:10 }}>
                          {(() => {
                            // prefer workshop cycle link because server may not include workshopId in the enrollment DTO
                            const cycleId = e.workshopCycleId ?? e.workshopCycleId ?? e.WorkshopCycleId ?? e.workshopCycleId ?? e.workshopCycleId ?? null;
                            if (cycleId) {
                              return <Link to={`/admin/cycles/${cycleId}`} style={{ color:'#3b82f6', textDecoration:'none', fontWeight:600 }}>{e.workshopTitle}</Link>;
                            }
                            // fallback: if workshopId exists, link to workshop
                            const wid = e.workshopId ?? e.workshopId ?? e.WorkshopId ?? null;
                            if (wid) return <Link to={`/admin/workshops/${wid}`} style={{ color:'#3b82f6', textDecoration:'none', fontWeight:600 }}>{e.workshopTitle}</Link>;
                            return <span style={{ fontWeight:600 }}>{e.workshopTitle}</span>;
                          })()}
                        </td>
                        <td style={{ padding:10 }}>{new Date(e.enrolledAt).toLocaleString()}</td>
                        <td style={{ padding:10 }}>{e.status}</td>
                        <td style={{ padding:10 }}>
                          {(e.payments && e.payments.length > 0) ? (
                            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                              {e.payments.map(p => (
                                <div key={p.id} style={{ display:'flex', gap:8, fontSize:12 }}>
                                  <span style={{ padding:'2px 8px', borderRadius:999, background: p.status === 'Paid' ? '#dcfce7' : '#fef9c3', color:'#065f46' }}>{p.status}</span>
                                  <span>{p.amount} PLN</span>
                                  {p.paidAt && <span>paid: {new Date(p.paidAt).toLocaleString()}</span>}
                                </div>
                              ))}
                            </div>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color:'#6b7280' }}>No registrations.</div>
              )}
            </section>

            {/* Payment history (flat) */}
            <section style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:16, boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop:0, marginBottom:12, fontSize:20 }}>Payment history</h3>
              {data.enrollments?.some(e => e.payments?.length) ? (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead style={{ background:'#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign:'left', padding:10 }}>Workshop</th>
                      <th style={{ textAlign:'left', padding:10 }}>Amount</th>
                      <th style={{ textAlign:'left', padding:10 }}>Status</th>
                      <th style={{ textAlign:'left', padding:10 }}>Paid at</th>
                      <th style={{ textAlign:'left', padding:10 }}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.enrollments.flatMap(e => (e.payments || []).map(p => ({
                      ...p,
                      workshopTitle: e.workshopTitle,
                      cycleId: e.workshopCycleId ?? e.WorkshopCycleId ?? e.cycleId ?? e.CycleId ?? null,
                      workshopId: e.workshopId ?? e.WorkshopId ?? null
                    }))).map(p => (
                      <tr key={p.id} style={{ borderTop:'1px solid #eef2f7' }}>
                        <td style={{ padding:10 }}>
                          {(() => {
                            const cycleId = p.cycleId;
                            if (cycleId) {
                              return <Link to={`/admin/cycles/${cycleId}`} style={{ color:'#3b82f6', textDecoration:'none', fontWeight:600 }}>{p.workshopTitle}</Link>;
                            }
                            const wid = p.workshopId;
                            if (wid) {
                              return <Link to={`/admin/workshops/${wid}`} style={{ color:'#3b82f6', textDecoration:'none', fontWeight:600 }}>{p.workshopTitle}</Link>;
                            }
                            return <span style={{ fontWeight:600 }}>{p.workshopTitle}</span>;
                          })()}
                        </td>
                        <td style={{ padding:10 }}>{p.amount} PLN</td>
                        <td style={{ padding:10 }}>{p.status}</td>
                        <td style={{ padding:10 }}>{p.paidAt ? new Date(p.paidAt).toLocaleString() : '-'}</td>
                        <td style={{ padding:10 }}>{p.createdAt ? new Date(p.createdAt).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color:'#6b7280' }}>No payments.</div>
              )}
            </section>

            {/* NEW: Review history */}
            <section style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:16, boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <h3 style={{ marginTop:0, marginBottom:0, fontSize:20 }}>Review history</h3>
                <div style={{ color:'#6b7280', fontSize:13 }}>Total: {userReviewsPage.total}</div>
              </div>
              {reviewsLoading && <div style={{ color:'#6b7280' }}>Loading reviews...</div>}
              {reviewsError && <div style={{ padding:8, background:'#fee2e2', color:'#991b1b', borderRadius:8 }}>{String(reviewsError)}</div>}

              {!reviewsLoading && !reviewsError && userReviewsPage.items.length === 0 && (
                <div style={{ color:'#6b7280' }}>No reviews.</div>
              )}

              <div style={{ display:'grid', gap:12, marginTop:8 }}>
                {userReviewsPage.items.map(r => (
                  <div key={r.id} style={{ background:'#ffffff', border:'1px solid #eef3f7', padding:12, borderRadius:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ fontWeight:800 }}>{r.workshop?.title || 'Workshop'}</div>
                        {r.workshop?.id && (
                          <a href={`http://localhost:5173/workshop/${r.workshop.id}`} target="_blank" rel="noopener noreferrer" style={{ color:'#3b82f6', fontSize:12 }}>View</a>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }} title={`${r.rating ?? 0} / 5`}>
                        {renderStars(r.rating ?? 0)}
                      </div>
                    </div>
                    {r.comment && (
                      <div style={{ marginTop:8, color:'#374151', whiteSpace:'pre-wrap' }}>{r.comment}</div>
                    )}
                    <div style={{ marginTop:8, fontSize:12, color:'#6b7280' }}>{formatDate(r.createdAt)}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}