import { useEffect, useState } from 'react';
import axios from 'axios';
import AdminNavbar from '../components/AdminNavbar';
import resolveImg, { PLACEHOLDER } from '../utils/resolveImg';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';

// button style utilities (match other pages)
const createBtnBase = { padding: '6px 12px', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 12 };
const gradients = {
  category: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
  address: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  workshop: 'linear-gradient(135deg, #667eea, #764ba2)'
};

export default function InstructorWorkshops() {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [cycles, setCycles] = useState([]);
  const [cyclesLoading, setCyclesLoading] = useState(false);
  const [cyclesError, setCyclesError] = useState('');

  const navigate = useNavigate();

  useEffect(() => { load(); loadCycles(); }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('jwt');
      const resp = await axios.get(`${API_URL}/api/workshops/mine`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setWorkshops(resp.data || []);
    } catch (e) {
      setError(e.response?.data || e.message || 'Failed to load workshops');
      setWorkshops([]);
    } finally { setLoading(false); }
  }

  async function loadCycles() {
    setCyclesLoading(true); setCyclesError('');
    try {
      const token = localStorage.getItem('jwt');
      const resp = await axios.get(`${API_URL}/api/workshopcycles/mine`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setCycles(Array.isArray(resp.data) ? resp.data : (resp.data ? [resp.data] : []));
    } catch (e) {
      setCyclesError(e.response?.data || e.message || 'Failed to load cycles');
      setCycles([]);
    } finally { setCyclesLoading(false); }
  }

  function formatRange(startDate, endDate) {
    try {
      if (!startDate && !endDate) return '-';
      const s = startDate ? new Date(startDate) : null;
      const e = endDate ? new Date(endDate) : null;
      if (s && e) {
        const sStr = s.toLocaleDateString();
        const eStr = e.toLocaleDateString();
        return sStr === eStr ? sStr : `${sStr} - ${eStr}`;
      }
      if (s) return new Date(s).toLocaleDateString();
      if (e) return new Date(e).toLocaleDateString();
      return '-';
    } catch { return '-'; }
  }

  function isPast(endDate) {
    if (!endDate) return false;
    try { return new Date(endDate) < new Date(); } catch { return false; }
  }

  // New: client-side PDF export using jspdf + autotable (attempt) then server fallback
  async function downloadEnrollmentsPdfClient(cycleId, displayName) {
    try {
      const token = localStorage.getItem('jwt');
      const cfg = { headers: token ? { Authorization: `Bearer ${token}` } : {} };
      const resp = await axios.get(`${API_URL}/api/workshopcycles/${cycleId}`, cfg);
      const enrollments = resp.data?.enrollments ?? [];
      if (!enrollments || enrollments.length === 0) { alert('No enrollments to export'); return; }

      const jsPDFModule = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const jsPDF = jsPDFModule.jsPDF ?? jsPDFModule.default ?? jsPDFModule;
      const autoTable = autoTableModule.default ?? autoTableModule;
      if (!jsPDF || !autoTable) throw new Error('PDF libraries not available');

      const rows = enrollments.map(e => {
        const user = e.user ?? e.User ?? {};
        const first = (user.firstName ?? user.FirstName ?? e.firstName ?? e.FirstName ?? '').toString().trim();
        const last = (user.lastName ?? user.LastName ?? e.lastName ?? e.LastName ?? '').toString().trim();
        const name = `${first} ${last}`.trim() || (user.email ?? user.Email ?? e.email ?? e.Email ?? '');
        const email = (user.email ?? user.Email ?? e.email ?? e.Email ?? '').toString();
        const paid = (e.payments || e.Payments || []).some(p => p.status === 'Paid' || p.Status === 'Paid') ? 'Yes' : 'No';
        const status = e.status ?? e.Status ?? '';
        const enrolledAt = e.enrolledAt ?? e.EnrolledAt ?? e.EnrolledAtUtc ?? '';
        const cancelledAt = e.cancelledAt ?? e.CancelledAt ?? '';
        return [name, email, paid, status, enrolledAt, cancelledAt];
      });

      const doc = new jsPDF({ orientation: 'landscape' });
      const title = `Enrollment list for cycle: ${displayName || resp.data?.cycle?.displayName || resp.data?.cycle?.DisplayName || ('Cycle ' + cycleId)}`;
      doc.setFontSize(14);
      doc.text(title, 14, 12);
      const columns = ['Name', 'Email', 'Paid', 'Status', 'EnrolledAt', 'CancelledAt'];
      autoTable(doc, {
        head: [columns],
        body: rows,
        startY: 18,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [102,126,234] },
        margin: { left: 12, right: 12 }
      });
      const safeName = (displayName || resp.data?.cycle?.displayName || `cycle_${cycleId}`).replace(/[^a-z0-9\-_\.]/gi, '_').toLowerCase();
      doc.save(`enrollments_${safeName}_${cycleId}.pdf`);
    } catch (err) {
      console.error('Client PDF export failed', err);
      // fallback: try server-side PDF
      try {
        const token = localStorage.getItem('jwt');
        const resp = await axios.get(`${API_URL}/api/workshopcycles/${cycleId}/enrollments/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, responseType: 'blob' });
        const blob = new Blob([resp.data], { type: resp.headers['content-type'] || 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = (displayName || `cycle_${cycleId}`).replace(/[^a-z0-9\-_\.]/gi, '_').toLowerCase();
        a.download = `enrollments_${safeName}_${cycleId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 3000);
      } catch (e2) {
        alert('PDF export failed. Install jspdf/jspdf-autotable or ensure server PDF endpoint works.');
      }
    }
  }

  if (loading) return <div style={{ minHeight: '100vh' }}><AdminNavbar /><p>Loading...</p></div>;
  if (error) return <div style={{ minHeight: '100vh' }}><AdminNavbar /><p style={{ color: 'red' }}>{String(error)}</p></div>;

  const currentCycles = cycles.filter(c => !isPast(c.endDate));
  const pastCycles = cycles.filter(c => isPast(c.endDate));

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom,#f9fafb,#ffffff)' }}>
      <AdminNavbar />
      <div style={{ maxWidth: 1200, margin: '24px auto', padding: '24px', background: 'white', borderRadius: 10 }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 20 }}>Your workshops</h2>
        {workshops.length === 0 ? (
          <div style={{ color: '#6b7280' }}>You have no workshops yet.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}>
              {workshops.map(w => (
                <div key={w.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }} onClick={() => navigate(`/admin/workshops/${w.id}`)}>
                  <div style={{ width: '100%', aspectRatio: '4/3', background: '#f3f4f6' }}>
                    <img src={resolveImg(w.imageUrl)} alt={w.title} onError={(e) => e.currentTarget.src = PLACEHOLDER} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontWeight: 800 }}>{w.title}</div>
                    <div style={{ color: '#6b7280', marginTop: 6 }}>{w.category?.name || ''}</div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>{w.price === 0 ? 'Free' : `${w.price} PLN`}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* larger spacing below workshops */}
            <div style={{ height: 48 }} />
          </>
        )}

        {/* Your Cycles section */}
        <div style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Your Cycles</h3>

          {cyclesLoading && <div style={{ color: '#6b7280' }}>Loading cycles...</div>}
          {cyclesError && <div style={{ color: '#991b1b' }}>{String(cyclesError)}</div>}

          {!cyclesLoading && cycles.length === 0 && <div style={{ color: '#6b7280' }}>You have no cycles.</div>}

          {!cyclesLoading && cycles.length > 0 && (
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <h4 style={{ margin: '6px 0 8px', fontSize: 18, fontWeight: 700 }}>Your Current Cycles</h4>
                {currentCycles.length === 0 ? <div style={{ color: '#6b7280' }}>No current cycles.</div> : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: 10, textAlign: 'left' }}>Cycle</th>
                          <th style={{ padding: 10, textAlign: 'left' }}>Workshop</th>
                          <th style={{ padding: 10, textAlign: 'left' }}>Date</th>
                          <th style={{ padding: 10, textAlign: 'left' }}>Enrolled</th>
                          <th style={{ padding: 10 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentCycles.map(c => (
                          <tr
                            key={c.id}
                            onClick={() => navigate(`/instructor/cycles/${c.id}`)}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = ''; }}
                            style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                          >
                            <td style={{ padding: 10, fontWeight: 600 }}>{c.displayName || 'Cycle'}</td>
                            <td style={{ padding: 10 }}>{c.workshopTitle || '-'}</td>
                            <td style={{ padding: 10 }}>{formatRange(c.startDate, c.endDate)}</td>
                            <td style={{ padding: 10 }}>{c.activeEnrollmentsCount ?? 0}</td>
                            <td style={{ padding: 10, display: 'flex', gap: 8 }}>
                              <button onClick={(ev) => { ev.stopPropagation(); navigate(`/instructor/cycles/${c.id}`); }} style={{ ...createBtnBase, background: gradients.category }}>Details</button>
                              <button onClick={(ev) => { ev.stopPropagation(); downloadEnrollmentsPdfClient(c.id, c.displayName || c.workshopTitle); }} style={{ ...createBtnBase, background: gradients.workshop }}>Download PDF</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ margin: '6px 0 8px', fontSize: 18, fontWeight: 700 }}>Past Cycles</h4>
                {pastCycles.length === 0 ? <div style={{ color: '#6b7280' }}>No past cycles.</div> : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: 10, textAlign: 'left' }}>Cycle</th>
                          <th style={{ padding: 10, textAlign: 'left' }}>Workshop</th>
                          <th style={{ padding: 10, textAlign: 'left' }}>Date</th>
                          <th style={{ padding: 10, textAlign: 'left' }}>Enrolled</th>
                          <th style={{ padding: 10 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pastCycles.map(c => (
                          <tr
                            key={c.id}
                            onClick={() => navigate(`/instructor/cycles/${c.id}`)}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = ''; }}
                            style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                          >
                            <td style={{ padding: 10, fontWeight: 600 }}>{c.displayName || 'Cycle'}</td>
                            <td style={{ padding: 10 }}>{c.workshopTitle || '-'}</td>
                            <td style={{ padding: 10 }}>{formatRange(c.startDate, c.endDate)}</td>
                            <td style={{ padding: 10 }}>{c.activeEnrollmentsCount ?? 0}</td>
                            <td style={{ padding: 10, display: 'flex', gap: 8 }}>
                              <button onClick={(ev) => { ev.stopPropagation(); navigate(`/instructor/cycles/${c.id}`); }} style={{ ...createBtnBase, background: gradients.category }}>Details</button>
                              <button onClick={(ev) => { ev.stopPropagation(); downloadEnrollmentsPdfClient(c.id, c.displayName || c.workshopTitle); }} style={{ ...createBtnBase, background: gradients.workshop }}>Download PDF</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
