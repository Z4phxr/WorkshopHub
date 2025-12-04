import { useEffect, useState } from 'react';
import AdminNavbar from '../components/AdminNavbar';
import api from '../utils/api';
import { getInstructorPerformance, getTopPayingStudents, getOutstandingPayments, getPaymentTimeline, getWorkshopEnrollmentRoster } from '../utils/reportsApi';

const createBtnBase = {
  padding: '12px 20px',
  border: 'none',
  borderRadius: 10,
  color: 'white',
  cursor: 'pointer',
  fontWeight: 700,
  marginRight: 8
};

// global flag for PDF font registration status
let pdfFontRegistered = false;
const FONT_NAME = 'CustomPDFFont';
const FONT_FILE_PATH = '/fonts/DejaVuSans.ttf';
const FONT_FILE_NAME = FONT_FILE_PATH.split('/').pop();

// Inline SVG sort arrow component
function SortArrow({ dir }) {
  const common = { display: 'inline-block', verticalAlign: 'middle', marginLeft: 6 };
  if (dir === 'asc') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" style={common} aria-hidden="true" focusable="false">
        <path d="M7 14l5-5 5 5z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" style={common} aria-hidden="true" focusable="false">
      <path d="M7 10l5 5 5-5z" fill="currentColor" />
    </svg>
  );
}

export default function AdminReports() {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  // currentReport is the report currently displayed. pendingReport is selection on cards.
  const [currentReport, setCurrentReport] = useState('workshops');
  const [pendingReport, setPendingReport] = useState('workshops');

  // Date range for reports (ISO yyyy-mm-dd)
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // extra filters for payments pending
  const [olderThanDays, setOlderThanDays] = useState(0);
  const [minAmount, setMinAmount] = useState('');

  // add state for all-time toggle
  const [allTime, setAllTime] = useState(false);

  // NEW: Workshop selector for enrollments report
  const [selectedWorkshopId, setSelectedWorkshopId] = useState('');
  const [workshops, setWorkshops] = useState([]);

  useEffect(() => {
    // default last 30 days
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 30);
    const fmt = (d) => d.toISOString().slice(0,10);
    setFromDate(fmt(from));
    setToDate(fmt(to));
    
    // Load workshops for enrollment report selector
    loadWorkshops();
  }, []);

  async function loadWorkshops() {
    try {
      const headers = api.authHeaders();
      const resp = await api.get('/api/workshops', { headers });
      setWorkshops(resp.data || []);
    } catch (e) {
      console.debug('Failed to load workshops', e);
    }
  }

  const availableReports = [
    { id: 'workshops', title: 'Workshops summary' },
    { id: 'instructors', title: 'Instructors' },
    { id: 'participants-activity', title: 'Participants activity' },
    { id: 'payments-pending', title: 'Outstanding payments' },
    { id: 'payments-timeline', title: 'Payment Timeline' }, // NEW
    { id: 'workshop-enrollments', title: 'Workshop Enrollments' } // NEW
  ];

  async function fetchServerReport(reportType = currentReport, p = page, ps = pageSize, sort = sortBy, dir = sortDir) {
    const headers = api.authHeaders();
    try {
      if (reportType === 'instructors') {
        const data = await getInstructorPerformance({ fromDate: allTime ? undefined : (fromDate || undefined), toDate: allTime ? undefined : (toDate || undefined), page: p, pageSize: ps, sortBy: sort, sortDir: dir });
        const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : data.items ?? []);
        setReport(items);
        setTotal(Number(data.total ?? (Array.isArray(items) ? items.length : 0)));
        return true;
      }
      if (reportType === 'participants-activity') {
        const data = await getTopPayingStudents({ fromDate: allTime ? undefined : (fromDate || undefined), toDate: allTime ? undefined : (toDate || undefined), page: p, pageSize: ps, sortBy: sort, sortDir: dir });
        const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : data.items ?? []);
        setReport(items);
        setTotal(Number(data.total ?? (Array.isArray(items) ? items.length : 0)));
        return true;
      }
      if (reportType === 'payments-pending') {
        const data = await getOutstandingPayments({ olderThanDays, minAmount: minAmount ? Number(minAmount) : undefined, page: p, pageSize: ps, sortBy: sort, sortDir: dir });
        const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : data.items ?? []);
        setReport(items);
        setTotal(Number(data.total ?? (Array.isArray(items) ? items.length : 0)));
        return true;
      }
      // NEW: Report #5 - Payment Timeline
      if (reportType === 'payments-timeline') {
        const data = await getPaymentTimeline({ 
          fromDate: allTime ? undefined : (fromDate || undefined), 
          toDate: allTime ? undefined : (toDate || undefined), 
          page: p, 
          pageSize: ps, 
          sortBy: sort, 
          sortDir: dir 
        });
        const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : data.items ?? []);
        setReport(items);
        setTotal(Number(data.summary?.total ?? (Array.isArray(items) ? items.length : 0)));
        return true;
      }

      // NEW: Report #6 - Workshop Enrollment Roster
      if (reportType === 'workshop-enrollments') {
        if (!selectedWorkshopId) {
          setError('Please select a workshop for the enrollment roster report');
          return false;
        }
        const data = await getWorkshopEnrollmentRoster(selectedWorkshopId, { 
          page: p, 
          pageSize: ps, 
          sortBy: sort, 
          sortDir: dir 
        });
        const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : data.items ?? []);
        setReport(items);
        setTotal(Number(data.summary?.totalEnrollments ?? (Array.isArray(items) ? items.length : 0)));
        return true;
      }

      const resp = await api.get(`/api/reports/workshops/summary?page=${p}&pageSize=${ps}&sortBy=${encodeURIComponent(sort)}&sortDir=${encodeURIComponent(dir)}`, { headers });
      const data = resp?.data ?? resp;
      if (data) {
        const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : data.items ?? []);
        setReport(items);
        setTotal(Number(data.total ?? (Array.isArray(items) ? items.length : 0)));
        return true;
      }
    } catch (e) {
      console.debug('Server report fetch failed', e);
    }
    return false;
  }

  function toCSV(rows, reportType) {
    if (!rows || !Array.isArray(rows) || rows.length === 0) return '';
    
    let normalized = [];
    if (reportType === 'instructors') {
      normalized = rows.map(r => ({
        Name: r.name ?? r.Name ?? '',
        Cycles: r.cyclesCount ?? r.CyclesCount ?? 0,
        Revenue: r.revenue ?? r.Revenue ?? 0,
        AverageRating: r.averageRating ?? r.AverageRating ?? 0
      }));
    } else if (reportType === 'participants-activity') {
      normalized = rows.map(r => ({
        Name: r.name ?? r.Name ?? '',
        Email: r.email ?? r.Email ?? '',
        Enrollments: r.enrollmentsCount ?? r.EnrollmentsCount ?? 0,
        TotalPaid: r.totalPaid ?? r.TotalPaid ?? 0
      }));
    } else if (reportType === 'payments-pending') {
      normalized = rows.map(r => ({
        Name: r.name ?? r.Name ?? '',
        Email: r.email ?? r.Email ?? '',
        Amount: r.amount ?? r.Amount ?? 0,
        Created: r.createdAt ?? r.CreatedAt ?? '',
        DaysPending: r.daysPending ?? r.DaysPending ?? 0
      }));
    } else if (reportType === 'payments-timeline') {
      normalized = rows.map(r => ({
        User: r.userName ?? '',
        Workshop: r.workshopTitle ?? '',
        Amount: r.amount ?? 0,
        Status: r.status ?? '',
        Created: r.createdAt ?? '',
        PaidAt: r.paidAt ?? ''
      }));
    } else if (reportType === 'workshop-enrollments') {
      normalized = rows.map(r => ({
        User: r.userName ?? '',
        Email: r.email ?? '',
        Cycle: r.cycleDisplayName ?? '',
        Enrolled: r.enrolledAt ?? '',
        Payment: r.paymentStatus ?? '',
        Status: r.status ?? ''
      }));
    } else {
      normalized = rows.map(r => ({
        Name: r.name ?? r.Name ?? '',
        Instructor: r.instructor ?? r.Instructor ?? '',
        Price: r.price ?? r.Price ?? '',
        PastCycles: r.pastCycles ?? r.PastCycles ?? '',
        FutureCycles: r.futureCycles ?? r.FutureCycles ?? '',
        PaymentsSum: r.paymentsSum ?? r.PaymentsSum ?? '',
        AverageRating: r.averageRating ?? r.AverageRating ?? ''
      }));
    }
    
    const cols = Object.keys(normalized[0]);
    const esc = (v) => `"${String(v ?? '').replace(/\"/g, '""')}"`;
    const header = cols.map(esc).join(',');
    const lines = normalized.map(r => cols.map(c => esc(r[c])).join(','));
    return [header, ...lines].join('\n');
  }

  async function loadReport(p = 1, ps = pageSize, sort = sortBy, dir = sortDir, reportType = currentReport) {
    setError('');
    setLoading(true);
    try {
      const ok = await fetchServerReport(reportType, p, ps, sort, dir);
      if (!ok) {
        setError('Server report endpoint not available.');
        setReport([]);
        setTotal(0);
      }
      setPage(p);
      setPageSize(ps);
      setSortBy(sort);
      setSortDir(dir);
    } catch (e) {
      console.error(e);
      setError(e.response?.data || e.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    // Validate workshop-enrollments requires selection
    if (pendingReport === 'workshop-enrollments' && !selectedWorkshopId) {
      setError('Please select a workshop for the enrollment roster report');
      return;
    }
    
    // Clear error and apply pending selection
    setError('');
    setCurrentReport(pendingReport);
    // load using the newly selected report type
    await loadReport(1, pageSize, sortBy, sortDir, pendingReport);
  }

  function changeSort(column) {
    const dir = (sortBy === column) ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    setSortBy(column);
    setSortDir(dir);
    loadReport(1, pageSize, column, dir, currentReport);
  }

  function goToPage(p) {
    if (p < 1) return;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    if (p > maxPage) return;
    loadReport(p, pageSize, sortBy, sortDir, currentReport);
  }

  function downloadCSV() {
    const csv = toCSV(report, currentReport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentReport}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadJSON() {
    const data = JSON.stringify(report, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentReport}_summary_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadPDF() {
    try {
      const jsPDFModule = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const jsPDF = jsPDFModule.jsPDF ?? jsPDFModule.default ?? jsPDFModule;
      const autoTable = autoTableModule.default ?? autoTableModule;
      if (!jsPDF) throw new Error('jspdf import failed');
      if (!autoTable) throw new Error('jspdf-autotable import failed');

      async function ensureFontRegistered(doc) {
        try {
          const resp = await fetch(FONT_FILE_PATH);
          if (!resp.ok) throw new Error('Font fetch failed: ' + resp.status);
          const arrayBuffer = await resp.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          const fontFileName = FONT_FILE_NAME;
          const fontBaseName = FONT_FILE_NAME.replace(/\.[^/.]+$/, '');
          try {
            if (typeof doc.addFileToVFS === 'function' && typeof doc.addFont === 'function') {
              doc.addFileToVFS(fontFileName, base64);
              try { doc.addFileToVFS(fontBaseName, base64); } catch {}
              doc.addFont(fontFileName, FONT_NAME, 'normal');
              try { doc.addFont(fontBaseName, FONT_NAME, 'normal'); } catch {}
              pdfFontRegistered = true;
              return true;
            }
          } catch {}
          try {
            if (typeof window !== 'undefined' && window.jspdf && window.jspdf.API) {
              window.jspdf.API.addFileToVFS(fontFileName, base64);
              try { window.jspdf.API.addFileToVFS(fontBaseName, base64); } catch {}
              window.jspdf.API.addFont(fontFileName, FONT_NAME, 'normal');
              try { window.jspdf.API.addFont(fontBaseName, FONT_NAME, 'normal'); } catch {}
              pdfFontRegistered = true;
              return true;
            }
          } catch {}
          try {
            if (doc && doc.constructor && doc.constructor.API) {
              doc.constructor.API.addFileToVFS(fontFileName, base64);
              try { doc.constructor.API.addFileToVFS(fontBaseName, base64); } catch {}
              doc.constructor.API.addFont(fontFileName, FONT_NAME, 'normal');
              try { doc.constructor.API.addFont(fontBaseName, FONT_NAME, 'normal'); } catch {}
              pdfFontRegistered = true;
              return true;
            }
          } catch {}
        } catch (e) {
          console.warn('Failed to load/register PDF font:', e);
        }
        pdfFontRegistered = false;
        return false;
      }

      const doc = new jsPDF({ orientation: 'landscape' });
      const fontOk = await ensureFontRegistered(doc);
      try { if (fontOk) { doc.setFont(FONT_NAME); doc.setFontSize(12); } else { doc.setFontSize(12); } } catch {}

      if (currentReport === 'instructors') {
        const columns = ['Name', 'Cycles', 'Revenue', 'Avg. rating'];
        const rows = report.map(r => [
          String(r.name ?? r.Name ?? r.instructorName ?? r.InstructorName ?? ''),
          (r.cyclesCount ?? r.CyclesCount ?? 0),
          (r.revenue ?? r.Revenue) != null ? Number(r.revenue ?? r.Revenue).toFixed(2) : '0.00',
          (r.averageRating ?? r.AverageRating) != null ? Number(r.averageRating ?? r.AverageRating).toFixed(1) : '0.0'
        ]);
        doc.text('Instructors performance', 14, 10);
        autoTable(doc, {
          head: [columns],
          body: rows,
          styles: { fontSize: 8, font: fontOk ? FONT_NAME : undefined, fontStyle: 'normal' },
          headStyles: { fillColor: [102, 126, 234], font: fontOk ? FONT_NAME : undefined, fontStyle: 'normal' },
          bodyStyles: { font: fontOk ? FONT_NAME : undefined },
          startY: 14,
          margin: { left: 12, right: 12 },
          didDrawCell: function () { if (fontOk) try { doc.setFont(FONT_NAME); } catch {} }
        });
        doc.save(`${currentReport}_performance_${new Date().toISOString().slice(0,10)}.pdf`);
        return;
      }
      if (currentReport === 'participants-activity') {
        const columns = ['Name','Email','Enrollments','Total paid'];
        const rows = report.map(r => [
          String(r.name ?? r.Name ?? ''),
          String(r.email ?? r.Email ?? ''),
          Number(r.enrollmentsCount ?? r.EnrollmentsCount ?? 0),
          (Number.isFinite(Number(r.totalPaid ?? r.TotalPaid)) ? Number(r.totalPaid ?? r.TotalPaid).toFixed(2) : '0.00')
        ]);
        doc.text('Participants activity', 14, 10);
        autoTable(doc, { head: [columns], body: rows, styles: { fontSize: 8, font: fontOk ? FONT_NAME : undefined }, headStyles: { fillColor: [102,126,234], font: fontOk ? FONT_NAME : undefined }, startY: 14 });
        doc.save(`${currentReport}_${new Date().toISOString().slice(0,10)}.pdf`);
        return;
      }
      if (currentReport === 'payments-pending') {
        const columns = ['Name','Email','Amount','Created','Days pending'];
        const rows = report.map(r => [
          String(r.name ?? r.Name ?? ''),
          String(r.email ?? r.Email ?? ''),
          Number(r.amount ?? r.Amount ?? 0).toFixed(2),
          new Date(r.createdAt ?? r.CreatedAt).toLocaleDateString(),
          Number(r.daysPending ?? r.DaysPending ?? 0)
        ]);
        doc.text('Outstanding payments', 14, 10);
        autoTable(doc, { head: [columns], body: rows, styles: { fontSize: 8, font: fontOk ? FONT_NAME : undefined }, headStyles: { fillColor: [102,126,234], font: fontOk ? FONT_NAME : undefined }, startY: 14 });
        doc.save(`${currentReport}_${new Date().toISOString().slice(0,10)}.pdf`);
        return;
      }
      if (currentReport === 'payments-timeline') {
        const columns = ['User', 'Workshop', 'Amount', 'Status', 'Created', 'Paid At'];
        const rows = report.map(r => [
          String(r.userName ?? ''),
          String(r.workshopTitle ?? ''),
          Number(r.amount ?? 0).toFixed(2),
          String(r.status ?? ''),
          r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-',
          r.paidAt ? new Date(r.paidAt).toLocaleDateString() : '-'
        ]);
        doc.text('Payment Timeline', 14, 10);
        autoTable(doc, {
          head: [columns],
          body: rows,
          styles: { fontSize: 8, font: fontOk ? FONT_NAME : undefined, fontStyle: 'normal' },
          headStyles: { fillColor: [102, 126, 234], font: fontOk ? FONT_NAME : undefined, fontStyle: 'normal' },
          bodyStyles: { font: fontOk ? FONT_NAME : undefined },
          startY: 14,
          margin: { left: 12, right: 12 },
          didDrawCell: function () { if (fontOk) try { doc.setFont(FONT_NAME); } catch {} }
        });
        doc.save(`${currentReport}_${new Date().toISOString().slice(0,10)}.pdf`);
        return;
      }
      if (currentReport === 'workshop-enrollments') {
        const columns = ['User', 'Email', 'Cycle', 'Enrolled', 'Payment', 'Status'];
        const rows = report.map(r => [
          String(r.userName ?? ''),
          String(r.email ?? ''),
          String(r.cycleDisplayName ?? ''),
          r.enrolledAt ? new Date(r.enrolledAt).toLocaleDateString() : '-',
          String(r.paymentStatus ?? '-'),
          String(r.status ?? '')
        ]);
        doc.text('Workshop Enrollment Roster', 14, 10);
        autoTable(doc, {
          head: [columns],
          body: rows,
          styles: { fontSize: 8, font: fontOk ? FONT_NAME : undefined, fontStyle: 'normal' },
          headStyles: { fillColor: [102, 126, 234], font: fontOk ? FONT_NAME : undefined, fontStyle: 'normal' },
          bodyStyles: { font: fontOk ? FONT_NAME : undefined },
          startY: 14,
          margin: { left: 12, right: 12 },
          didDrawCell: function () { if (fontOk) try { doc.setFont(FONT_NAME); } catch {} }
        });
        doc.save(`${currentReport}_${new Date().toISOString().slice(0,10)}.pdf`);
        return;
      }

      const columns = [
        { header: 'Name', dataKey: 'name' },
        { header: 'Instructor', dataKey: 'instructor' },
        { header: 'Price', dataKey: 'price' },
        { header: 'Past cycles', dataKey: 'pastCycles' },
        { header: 'Future cycles', dataKey: 'futureCycles' },
        { header: 'Payments sum', dataKey: 'paymentsSum' },
        { header: 'Avg. rating', dataKey: 'averageRating' }
      ];
      const rows = report.map(r => ({
        name: String(r.name ?? r.Name ?? ''),
        instructor: String(r.instructor ?? r.Instructor ?? ''),
        price: String(r.price ?? r.Price ?? ''),
        pastCycles: String(r.pastCycles ?? r.PastCycles ?? ''),
        futureCycles: String(r.futureCycles ?? r.FutureCycles ?? ''),
        paymentsSum: (r.paymentsSum ?? r.PaymentsSum),
        averageRating: (r.averageRating ?? r.AverageRating)
      }));
      doc.text('Workshops summary', 14, 10);
      autoTable(doc, {
        head: [columns.map(c => c.header)],
        body: rows.map(r => columns.map(c => r[c.dataKey])),
        styles: { fontSize: 8, fontStyle: 'normal', font: fontOk ? FONT_NAME : undefined },
        headStyles: { fillColor: [102, 126, 234], fontStyle: 'normal', font: fontOk ? FONT_NAME : undefined },
        bodyStyles: { font: fontOk ? FONT_NAME : undefined },
        startY: 14,
        didDrawCell: function () { if (fontOk) try { doc.setFont(FONT_NAME); } catch {} }
      });
      doc.save(`${currentReport}_summary_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      console.error('PDF export failed', e);
      setError('PDF export failed. Make sure jspdf and jspdf-autotable are installed and available to the frontend. ' + (e.message || ''));
    }
  }

  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  // show up / down arrows for sort direction
  const arrow = sortDir === 'asc' ? '▲' : '▼';

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      <AdminNavbar />
      <div style={{ maxWidth: 1200, margin: '24px auto', padding: '24px', background: 'white', borderRadius: 10 }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Reports</h2>

        {/* Report selector: 6 cards in 3x2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {availableReports.map(r => (
            <div
              key={r.id}
              onClick={() => setPendingReport(r.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setPendingReport(r.id); }}
              style={{
                padding: 12,
                borderRadius: 8,
                background: pendingReport === r.id ? 'linear-gradient(135deg,#eef2ff,#e0e7ff)' : '#fafafa',
                border: pendingReport === r.id ? '2px solid #6366f1' : '1px solid #e5e7eb',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{r.title}</div>
            </div>
          ))}
        </div>

        <div style={{ height: 24 }} />

        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          {/* Date range controls - show only for instructors report */}
          {(pendingReport === 'instructors' || pendingReport === 'participants-activity' || pendingReport === 'payments-timeline') && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 13, color: '#374151' }}>From:&nbsp;</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} disabled={allTime} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />
              <label style={{ fontSize: 13, color: '#374151' }}>To:&nbsp;</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} disabled={allTime} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />
              <label style={{ fontSize: 13, color: '#374151', marginLeft: 12 }}>
                <input type="checkbox" checked={allTime} onChange={e => setAllTime(e.target.checked)} style={{ marginRight: 6 }} /> All time
              </label>
            </div>
          )}

          {/* Workshop selector for enrollment roster */}
          {pendingReport === 'workshop-enrollments' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 13, color: '#374151' }}>Workshop:&nbsp;</label>
              <select value={selectedWorkshopId} onChange={e => setSelectedWorkshopId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', minWidth: 300 }}>
                <option value="">Select a workshop</option>
                {workshops.map(w => (
                  <option key={w.id} value={w.id}>{w.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Outstanding payments filters */}
          {pendingReport === 'payments-pending' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 13, color: '#374151' }}>Older than days:&nbsp;</label>
              <input type="number" value={olderThanDays} onChange={e => setOlderThanDays(Number(e.target.value) || 0)} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', width: 120 }} />
              <label style={{ fontSize: 13, color: '#374151' }}>Min amount:&nbsp;</label>
              <input type="number" step="0.01" value={minAmount} onChange={e => setMinAmount(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', width: 140 }} />
            </div>
          )}

          <div>
            <button onClick={handleGenerate} style={{ ...createBtnBase, background: 'linear-gradient(135deg,#667eea,#764ba2)' }}>
              Generate selected report
            </button>
          </div>

          {/* Export buttons */}
          <div>
            {report.length > 0 && (
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={downloadCSV} style={{ ...createBtnBase, background: 'linear-gradient(135deg,#667eea,#764ba2)', padding: '10px 18px' }}>
                  Export CSV
                </button>
                <button onClick={downloadJSON} style={{ ...createBtnBase, background: 'linear-gradient(135deg,#764ba2,#8b5cf6)', padding: '10px 18px' }}>
                  Export JSON
                </button>
                <button onClick={downloadPDF} style={{ ...createBtnBase, background: 'linear-gradient(135deg,#764ba2,#8b5cf6)', padding: '10px 18px' }}>
                  Export PDF
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {loading && <div>Generating report...</div>}
          {error && <div style={{ color: '#991b1b', background: '#fef2f2', padding: 8, borderRadius: 6 }}>{String(error)}</div>}
          {report.length === 0 && !loading && !error && <div style={{ color: '#6b7280' }}>No report generated yet.</div>}
          
          {report.length > 0 && (
            <div>
              <div style={{ marginBottom: 8, fontWeight: 700 }}>{availableReports.find(x => x.id === currentReport)?.title ?? currentReport}</div>
              <div style={{ overflow: 'auto', marginTop: 12 }}>
                {currentReport === 'instructors' ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }} onClick={() => changeSort('name')}>Name {sortBy === 'name' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #e5e7eb' }} onClick={() => changeSort('cycles')}>Cycles {sortBy === 'cycles' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #e5e7eb' }} onClick={() => changeSort('revenue')}>Revenue {sortBy === 'revenue' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #e5e7eb' }} onClick={() => changeSort('rating')}>Avg. rating {sortBy === 'rating' ? <SortArrow dir={sortDir} /> : null}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.map((r, idx) => (
                        <tr key={r.id ?? r.Id ?? idx}>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.name ?? r.Name ?? r.instructorName ?? r.InstructorName}</td>
                          <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{r.cyclesCount ?? r.CyclesCount ?? (r.CyclesCount !== undefined ? r.CyclesCount : '')}</td>
                          <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{(r.revenue ?? r.Revenue) != null ? Number(r.revenue ?? r.Revenue).toFixed(2) : ''}</td>
                          <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{(r.averageRating ?? r.AverageRating) != null ? Number(r.averageRating ?? r.AverageRating).toFixed(1) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : currentReport === 'participants-activity' ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid #e5e7eb', width: '25%' }} onClick={() => changeSort('name')}>Name {sortBy === 'name' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid #e5e7eb', width: '25%' }}>Email</th>
                        <th style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid #e5e7eb', width: '25%' }} onClick={() => changeSort('enrollments')}>Enrollments {sortBy === 'enrollments' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid #e5e7eb', width: '25%' }} onClick={() => changeSort('totalPaid')}>Total paid {sortBy === 'totalPaid' ? <SortArrow dir={sortDir} /> : null}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.map((r, idx) => (
                        <tr key={r.id ?? r.Id ?? idx}>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{r.name ?? r.Name}</td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{r.email ?? r.Email ?? ''}</td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{r.enrollmentsCount ?? r.EnrollmentsCount ?? 0}</td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{Number.isFinite(Number(r.totalPaid ?? r.TotalPaid)) ? Number(r.totalPaid ?? r.TotalPaid).toFixed(2) : '0.00'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : currentReport === 'payments-pending' ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid #e5e7eb', width: '20%' }} onClick={() => changeSort('name')}>Name {sortBy === 'name' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid #e5e7eb', width: '20%' }}>Email</th>
                        <th style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid #e5e7eb', width: '20%' }} onClick={() => changeSort('amount')}>Amount {sortBy === 'amount' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid #e5e7eb', width: '20%' }} onClick={() => changeSort('created')}>Created {sortBy === 'created' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid #e5e7eb', width: '20%' }} onClick={() => changeSort('daysPending')}>Days pending {sortBy === 'daysPending' ? <SortArrow dir={sortDir} /> : null}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.map((r, idx) => (
                        <tr key={r.id ?? r.Id ?? idx}>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{r.name ?? r.Name}</td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{r.email ?? r.Email ?? ''}</td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{Number(r.amount ?? r.Amount ?? 0).toFixed(2)}</td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{new Date(r.createdAt ?? r.CreatedAt).toLocaleDateString()}</td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{r.daysPending ?? r.DaysPending ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : currentReport === 'payments-timeline' ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }} onClick={() => changeSort('userName')}>User {sortBy === 'userName' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }} onClick={() => changeSort('workshop')}>Workshop {sortBy === 'workshop' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'right' }} onClick={() => changeSort('amount')}>Amount {sortBy === 'amount' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'center' }} onClick={() => changeSort('status')}>Status {sortBy === 'status' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'center' }} onClick={() => changeSort('createdAt')}>Created {sortBy === 'createdAt' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>Paid At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.map((r, idx) => (
                        <tr key={r.paymentId ?? idx}>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.userName}</td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.workshopTitle}</td>
                          <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{r.amount?.toFixed(2)}</td>
                          <td style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>{r.status}</td>
                          <td style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-'}</td>
                          <td style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>{r.paidAt ? new Date(r.paidAt).toLocaleDateString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : currentReport === 'workshop-enrollments' ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }} onClick={() => changeSort('userName')}>User {sortBy === 'userName' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>Email</th>
                        <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>Cycle</th>
                        <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'center' }} onClick={() => changeSort('enrolledAt')}>Enrolled {sortBy === 'enrolledAt' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'center' }} onClick={() => changeSort('paymentStatus')}>Payment {sortBy === 'paymentStatus' ? <SortArrow dir={sortDir} /> : null}</th>
                        <th style={{ padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.map((r, idx) => (
                        <tr key={r.enrollmentId ?? idx}>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.userName}</td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.email}</td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.cycleDisplayName}</td>
                          <td style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>{r.enrolledAt ? new Date(r.enrolledAt).toLocaleDateString() : '-'}</td>
                          <td style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>{r.paymentStatus ?? '-'}</td>
                          <td style={{ padding: 8, textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th onClick={() => changeSort('name')} style={{ cursor: 'pointer', textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                          Name {sortBy === 'name' ? <SortArrow dir={sortDir} /> : null}
                        </th>
                        <th onClick={() => changeSort('instructor')} style={{ cursor: 'pointer', textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                          Instructor {sortBy === 'instructor' ? <SortArrow dir={sortDir} /> : null}
                        </th>
                        <th onClick={() => changeSort('price')} style={{ cursor: 'pointer', textAlign: 'right', padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                          Price {sortBy === 'price' ? <SortArrow dir={sortDir} /> : null}
                        </th>
                        <th onClick={() => changeSort('pastCycles')} style={{ cursor: 'pointer', textAlign: 'right', padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                          Past cycles {sortBy === 'pastCycles' ? <SortArrow dir={sortDir} /> : null}
                        </th>
                        <th onClick={() => changeSort('futureCycles')} style={{ cursor: 'pointer', textAlign: 'right', padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                          Future cycles {sortBy === 'futureCycles' ? <SortArrow dir={sortDir} /> : null}
                        </th>
                        <th onClick={() => changeSort('paymentsSum')} style={{ cursor: 'pointer', textAlign: 'right', padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                          Payments sum {sortBy === 'paymentsSum' ? <SortArrow dir={sortDir} /> : null}
                        </th>
                        <th onClick={() => changeSort('averageRating')} style={{ cursor: 'pointer', textAlign: 'right', padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                          Avg. rating {sortBy === 'averageRating' ? <SortArrow dir={sortDir} /> : null}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.map((r, idx) => (
                        <tr key={r.id ?? r.Id ?? idx}>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.name ?? r.Name}</td>
                          <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.instructor ?? r.Instructor}</td>
                          <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{r.price ?? r.Price}</td>
                          <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{r.pastCycles ?? r.PastCycles}</td>
                          <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{r.futureCycles ?? r.FutureCycles}</td>
                          <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{(r.paymentsSum ?? r.PaymentsSum)?.toFixed ? (r.paymentsSum ?? r.PaymentsSum).toFixed(2) : (r.paymentsSum ?? r.PaymentsSum)}</td>
                          <td style={{ padding: 8, textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{(r.averageRating ?? r.AverageRating)?.toFixed ? (r.averageRating ?? r.AverageRating).toFixed(1) : (r.averageRating ?? r.AverageRating)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', marginTop: 12 }}>
                <button onClick={() => goToPage(page - 1)} disabled={page <= 1} style={{ padding: '8px 12px' }}>Prev</button>
                <span>Page {page} of {maxPage}</span>
                <button onClick={() => goToPage(page + 1)} disabled={page >= maxPage} style={{ padding: '8px 12px' }}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
