import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminPanel from './pages/AdminPanel'
import AdminAddCategory from './pages/AdminAddCategory'
import AdminAddAddress from './pages/AdminAddAddress'
import AdminCreateWorkshop from './pages/AdminCreateWorkshop'
import WorkshopDetails from './pages/WorkshopDetails'
import AdminWorkshopDetails from './pages/AdminWorkshopDetails'
import AdminEditCategory from './pages/AdminEditCategory'
import AdminEditAddress from './pages/AdminEditAddress'
import AdminEditWorkshop from './pages/AdminEditWorkshop'
import AdminUserDetails from './pages/AdminUserDetails'
import AdminCreateSession from './pages/AdminCreateSession'
import AdminCycleDetails from './pages/AdminCycleDetails'
import AdminEditCycle from './pages/AdminEditCycle'
import AdminLogs from './pages/AdminLogs'
import './App.css'
import Account from './pages/Account'
import WorkshopCycleDetails from './pages/WorkshopCycleDetails'
import AdminReports from './pages/AdminReports'
import InstructorWorkshops from './pages/InstructorWorkshops'
import InstructorCycleDetails from './pages/InstructorCycleDetails'

function rolesFromToken() {
  try {
    const t = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    if (!t) return [];
    const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const uri = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
    let r = [];
    if (payload.role) r = r.concat(Array.isArray(payload.role) ? payload.role : [payload.role]);
    if (payload[uri]) r = r.concat(Array.isArray(payload[uri]) ? payload[uri] : [payload[uri]]);
    return r;
  } catch { return []; }
}

function AdminRoute({ children }) {
  const [allowed, setAllowed] = useState(null);
  useEffect(() => {
    // Only Admins allowed to access admin routes
    let r = rolesFromToken();
    if (!r || r.length === 0) {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('roles') : null;
        if (raw) r = JSON.parse(raw);
      } catch { r = []; }
    }
    const isAllowed = (r || []).includes('Admin');
    setAllowed(isAllowed);
  }, []);

  if (allowed === null) return null;
  if (!allowed) return <Navigate to="/login" replace />;
  return children
}

function InstructorRoute({ children }) {
  const [allowed, setAllowed] = useState(null);
  useEffect(() => {
    // Instructors and Admins can access instructor pages
    let r = rolesFromToken();
    if (!r || r.length === 0) {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('roles') : null;
        if (raw) r = JSON.parse(raw);
      } catch { r = []; }
    }
    const isAllowed = (r || []).includes('Instructor') || (r || []).includes('Admin');
    setAllowed(isAllowed);
  }, []);

  if (allowed === null) return null;
  if (!allowed) return <Navigate to="/login" replace />;
  return children
}

function App() {
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error?.response?.status === 401) {
          // Clear stale auth so client state updates, but do not perform a hard redirect here.
          try { localStorage.removeItem('jwt'); localStorage.removeItem('roles'); } catch {}
          console.warn('Unauthorized API response (401) — cleared local auth.');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        <Route path="/admin/categories/new" element={<AdminRoute><AdminAddCategory /></AdminRoute>} />
        <Route path="/admin/addresses/new" element={<AdminRoute><AdminAddAddress /></AdminRoute>} />
        <Route path="/admin/workshops/new" element={<AdminRoute><AdminCreateWorkshop /></AdminRoute>} />
        <Route path="/admin/categories/:id" element={<AdminRoute><AdminEditCategory /></AdminRoute>} />
        <Route path="/admin/addresses/:id" element={<AdminRoute><AdminEditAddress /></AdminRoute>} />
        {/* allow instructors (owners) to view/manage specific workshop pages */}
        <Route path="/admin/workshops/:id" element={<InstructorRoute><AdminWorkshopDetails /></InstructorRoute>} />
        <Route path="/admin/cycles/:id" element={<InstructorRoute><AdminCycleDetails /></InstructorRoute>} />
        <Route path="/admin/cycles/:id/edit" element={<InstructorRoute><AdminEditCycle /></InstructorRoute>} />
        <Route path="/admin/workshops/:id/edit" element={<InstructorRoute><AdminEditWorkshop /></InstructorRoute>} />
        <Route path="/admin/sessions/new" element={<InstructorRoute><AdminCreateSession /></InstructorRoute>} />
        <Route path="/admin/users/:id" element={<AdminRoute><AdminUserDetails /></AdminRoute>} />
        <Route path="/admin/logs" element={<AdminRoute><AdminLogs /></AdminRoute>} />
        <Route path="/admin/reports" element={<InstructorRoute><AdminReports /></InstructorRoute>} />
        <Route path="/workshop/:id" element={<WorkshopDetails />} />
        <Route path="/workshops/:id" element={<WorkshopDetails />} />
        <Route path="/account" element={<Account />} />
        <Route path="/cycles/:id" element={<WorkshopCycleDetails />} />
        <Route path="/instructor/workshops" element={<InstructorRoute><InstructorWorkshops /></InstructorRoute>} />
        <Route path="/instructor/cycles/:id" element={<InstructorRoute><InstructorCycleDetails /></InstructorRoute>} />
      </Routes>
    </Router>
  )
}

export default App
