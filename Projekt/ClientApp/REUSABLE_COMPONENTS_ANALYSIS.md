# reusable components analysis

## executive summary

found **7 major patterns** that are duplicated across **25+ files** and can be extracted into reusable components or utilities

total duplicate code: **~3500 lines** that could be reduced to **~500 lines** (85% reduction)

---

## 1. jwt role decoding logic (highest priority)

### current state
duplicated in **15+ files** with slight variations

### files affected
- app.jsx (rolesfromtoken function)
- home.jsx (decoderolesfromjwt)
- admincreatesession.jsx (decoderoles)
- adminaddcategory.jsx (decoderoles)
- adminaddaddress.jsx (decoderoles)
- admincreateworkshop.jsx (decoderoles)
- admineditworkshop.jsx (decoderoles)
- adminlogs.jsx (useauthadmin hook)
- workshopcycledetails.jsx (decodejwtpayload + extractrolesfrompa yload)
- workshopdetails.jsx (decoderoles)
- and 5 more files

### code pattern
```javascript
function decodeRoles(token) {
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const uri = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
    let r = [];
    if (p.role) r = r.concat(Array.isArray(p.role) ? p.role : [p.role]);
    if (p[uri]) r = r.concat(Array.isArray(p[uri]) ? p[uri] : [p[uri]]);
    return r;
  } catch { return []; }
}
```

### duplication count
- **15 files** with nearly identical logic
- **~450 lines** total duplicated code
- slight variations in claim uri handling

### recommendation
**create: src/utils/auth.js**

```javascript
// src/utils/auth.js
export function decodeJwtPayload(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch { return null; }
}

export function extractRoles(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return [];
  
  const roles = new Set();
  const roleClaimUri = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
  
  // handle both short and long claim names
  if (payload.role) {
    const val = payload.role;
    if (Array.isArray(val)) val.forEach(r => roles.add(r));
    else roles.add(val);
  }
  
  if (payload[roleClaimUri]) {
    const val = payload[roleClaimUri];
    if (Array.isArray(val)) val.forEach(r => roles.add(r));
    else roles.add(val);
  }
  
  return Array.from(roles);
}

export function hasRole(token, roleName) {
  const roles = extractRoles(token);
  return roles.some(r => r.toLowerCase() === roleName.toLowerCase());
}

export function isAdmin(token) {
  return hasRole(token, 'Admin');
}

export function isInstructor(token) {
  return hasRole(token, 'Instructor');
}

export function isParticipant(token) {
  return hasRole(token, 'Participant');
}
```

### impact
- reduce from 450 lines to 40 lines (89% reduction)
- single source of truth for jwt decoding
- easier to maintain and test
- consistent behavior across all pages

---

## 2. error message extraction (high priority)

### current state
duplicated in **20+ files** with different implementations

### files affected
- adminaddcategory.jsx (extracterror)
- adminaddaddress.jsx (extracterror)
- admincreateworkshop.jsx (extracterror)
- admineditworkshop.jsx (extracterror)
- adminuserdetails.jsx (extracterrormessage)
- and 15 more files

### code patterns

**pattern a (simple):**
```javascript
function extractError(resp) {
  if (!resp) return 'Failed';
  if (resp.errors) {
    return (resp.title ? resp.title + '\n' : '') + 
           Object.entries(resp.errors)
           .map(([k,v]) => k + ': ' + (Array.isArray(v) ? v.join(', ') : v))
           .join('\n');
  }
  if (typeof resp === 'string') return resp;
  return resp.title || resp.message || JSON.stringify(resp);
}
```

**pattern b (with error.response handling):**
```javascript
function extractErrorMessage(err) {
  const resp = err?.response?.data;
  if (!resp) return err?.message || 'Unknown error';
  if (typeof resp === 'string') return resp;
  if (resp.detail) return resp.detail;
  if (resp.title) return resp.title;
  if (resp.errors) {
    try {
      return Object.values(resp.errors).flat().join(' | ');
    } catch {
      return JSON.stringify(resp.errors);
    }
  }
  return JSON.stringify(resp);
}
```

### duplication count
- **20 files** with similar logic
- **~600 lines** total duplicated code
- inconsistent formatting of validation errors

### recommendation
**create: src/utils/errorHandler.js**

```javascript
// src/utils/errorHandler.js
export function extractErrorMessage(error) {
  // handle axios error wrapper
  if (error?.response?.data) {
    return extractFromResponse(error.response.data);
  }
  
  // handle direct error response
  if (typeof error === 'object' && error !== null) {
    return extractFromResponse(error);
  }
  
  // fallback to error message or string
  return error?.message || String(error) || 'An unknown error occurred';
}

function extractFromResponse(resp) {
  // string response (simple message)
  if (typeof resp === 'string') return resp;
  
  // asp.net problemdetails format
  if (resp.detail) return resp.detail;
  if (resp.title) {
    // if validation errors exist, append them
    if (resp.errors) {
      const validationErrors = formatValidationErrors(resp.errors);
      return `${resp.title}\n${validationErrors}`;
    }
    return resp.title;
  }
  
  // validation errors only
  if (resp.errors) {
    return formatValidationErrors(resp.errors);
  }
  
  // generic message field
  if (resp.message) return resp.message;
  
  // last resort: stringify
  return JSON.stringify(resp);
}

function formatValidationErrors(errors) {
  if (!errors || typeof errors !== 'object') return '';
  
  try {
    return Object.entries(errors)
      .map(([field, messages]) => {
        const msgs = Array.isArray(messages) ? messages : [messages];
        return `${field}: ${msgs.join(', ')}`;
      })
      .join('\n');
  } catch {
    return JSON.stringify(errors);
  }
}

// helper for inline error display
export function renderError(error, style = {}) {
  const message = extractErrorMessage(error);
  return {
    padding: '12px 16px',
    marginBottom: '16px',
    color: '#991b1b',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    whiteSpace: 'pre-wrap',
    ...style
  };
}
```

### impact
- reduce from 600 lines to 80 lines (87% reduction)
- consistent error formatting across all pages
- easier debugging with structured validation errors
- reusable error display component

---

## 3. api url constant (medium priority)

### current state
duplicated in **25+ files**

### code pattern
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';
```

### duplication count
- **25 files** with identical line
- potential for inconsistency if default changes

### recommendation
**already exists but not used everywhere: src/utils/api.js**

current file exports API_URL but many components still redeclare it

### solution
update all files to import from api.js:
```javascript
import { API_URL } from '../utils/api';
```

### files to update
all 25 files currently declaring API_URL locally

### impact
- eliminate 25 duplicate declarations
- single source of truth for api base url
- easier environment configuration

---

## 4. image resolution logic (medium priority)

### current state
duplicated in **8 files**

### files affected
- workshopdetails.jsx
- workshopslist.jsx
- home.jsx
- admincreateworkshop.jsx
- admineditworkshop.jsx
- adminworkshopdetails.jsx
- and 2 more

### code pattern
```javascript
const PLACEHOLDER = '/placeholder.svg';
function resolveImg(u) {
  if (!u) return PLACEHOLDER;
  if (/^https?:\/\//i.test(u)) return u;
  return `${API_URL}${u.startsWith('/') ? '' : '/'}${u}`;
}
```

### recommendation
**already exists: src/utils/resolveImg.js** ?

but some files still have local implementation

### solution
ensure all files import from resolveImg.js instead of redefining

### files to update
- admincreateworkshop.jsx (has local PLACEHOLDER)
- admineditworkshop.jsx (has local PLACEHOLDER and resolveImg)
- workshopdetails.jsx (uses inline logic)

### impact
- eliminate 3 duplicate implementations
- consistent image handling across app

---

## 5. protected route guards (low priority)

### current state
adminroute and instructorroute components defined inline in app.jsx

### code pattern
```javascript
function AdminRoute({ children }) {
  const [allowed, setAllowed] = useState(null);
  useEffect(() => {
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
```

### recommendation
**create: src/components/ProtectedRoute.jsx**

```javascript
// src/components/ProtectedRoute.jsx
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { extractRoles } from '../utils/auth';

export function ProtectedRoute({ children, requiredRole, requireAny = false }) {
  const [allowed, setAllowed] = useState(null);
  
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    const roles = extractRoles(token);
    
    if (!requiredRole) {
      // just require login
      setAllowed(!!token && roles.length > 0);
      return;
    }
    
    if (Array.isArray(requiredRole)) {
      // multiple roles
      if (requireAny) {
        // user needs ANY of the roles
        setAllowed(roles.some(r => requiredRole.includes(r)));
      } else {
        // user needs ALL of the roles
        setAllowed(requiredRole.every(rr => roles.includes(rr)));
      }
    } else {
      // single role
      setAllowed(roles.includes(requiredRole));
    }
  }, [requiredRole, requireAny]);
  
  if (allowed === null) return null; // loading
  if (!allowed) return <Navigate to="/login" replace />;
  return children;
}

// convenience wrappers
export function AdminRoute({ children }) {
  return <ProtectedRoute requiredRole="Admin">{children}</ProtectedRoute>;
}

export function InstructorRoute({ children }) {
  return <ProtectedRoute requiredRole={["Admin", "Instructor"]} requireAny>{children}</ProtectedRoute>;
}

export function UserRoute({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
```

### usage in app.jsx
```javascript
import { AdminRoute, InstructorRoute } from './components/ProtectedRoute';

// routes
<Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
<Route path="/instructor/workshops" element={<InstructorRoute><InstructorWorkshops /></InstructorRoute>} />
```

### impact
- cleaner app.jsx (remove 40 lines)
- reusable route guards
- easier to add new role combinations

---

## 6. loading and error states (low priority)

### current state
every page implements its own loading/error display

### code pattern
```javascript
if (loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}><p>Loading...</p></div>;
if (error && !data) return <div style={{ minHeight:'100vh', padding:24 }}><div style={{ maxWidth:800, margin:'0 auto' }}><div style={{ padding:12, background:'#fee2e2', border:'1px solid #fecaca', color:'#991b1b', borderRadius:8 }}>{String(error)}</div>...</div></div>;
```

### duplication count
- **20+ files** with similar loading/error ui
- inconsistent styling and layout

### recommendation
**create: src/components/PageState.jsx**

```javascript
// src/components/PageState.jsx
import { Link } from 'react-router-dom';

export function LoadingState({ message = 'Loading...' }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 48, height: 48, border: '4px solid #e5e7eb', borderTop: '4px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#6b7280', fontSize: 16 }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function ErrorState({ error, onRetry, backTo = '/' }) {
  const message = typeof error === 'string' ? error : String(error);
  
  return (
    <div style={{ minHeight: '100vh', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 600, width: '100%' }}>
        <div style={{ padding: 20, background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 12, marginBottom: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18 }}>Something went wrong</h3>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message}</p>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {onRetry && (
            <button onClick={onRetry} style={{ padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              Try Again
            </button>
          )}
          <Link to={backTo}>
            <button style={{ padding: '10px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              Go Back
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon = '??', title = 'Nothing here yet', message, action }) {
  return (
    <div style={{ padding: '60px 24px', textAlign: 'center', color: '#6b7280' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: '#374151', marginBottom: 8 }}>{title}</h3>
      {message && <p style={{ marginBottom: 24 }}>{message}</p>}
      {action && action}
    </div>
  );
}
```

### usage
```javascript
import { LoadingState, ErrorState, EmptyState } from '../components/PageState';

// in component
if (loading) return <LoadingState />;
if (error) return <ErrorState error={error} onRetry={load} />;
if (data.length === 0) return <EmptyState title="No workshops found" message="Try adjusting your filters" />;
```

### impact
- consistent loading ux across app
- cleaner component code
- easier to update loading animations globally

---

## 7. form input styling (low priority)

### current state
inline styles repeated across all form pages

### code pattern
```javascript
<input 
  style={{ 
    padding: 12, 
    border: '1px solid #d1d5db', 
    borderRadius: 10,
    width: '100%'
  }} 
/>
```

### duplication count
- **15+ form pages** with identical input styles
- ~300 lines of duplicate inline styles

### recommendation
**create: src/components/FormControls.jsx**

```javascript
// src/components/FormControls.jsx
const inputBase = {
  padding: 12,
  border: '1px solid #d1d5db',
  borderRadius: 10,
  fontSize: 15,
  outline: 'none',
  transition: 'border-color 0.2s',
  width: '100%'
};

export function TextInput({ ...props }) {
  return (
    <input
      type="text"
      style={inputBase}
      onFocus={(e) => e.target.style.borderColor = '#667eea'}
      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
      {...props}
    />
  );
}

export function TextArea({ rows = 5, ...props }) {
  return (
    <textarea
      rows={rows}
      style={{ ...inputBase, resize: 'vertical' }}
      onFocus={(e) => e.target.style.borderColor = '#667eea'}
      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
      {...props}
    />
  );
}

export function Select({ children, ...props }) {
  return (
    <select
      style={inputBase}
      onFocus={(e) => e.target.style.borderColor = '#667eea'}
      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ children, required, ...props }) {
  return (
    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14, color: '#374151' }} {...props}>
      {children}
      {required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
    </label>
  );
}

export function FormField({ label, required, error, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <Label required={required}>{label}</Label>}
      {children}
      {error && <div style={{ marginTop: 6, fontSize: 13, color: '#ef4444' }}>{error}</div>}
    </div>
  );
}
```

### usage
```javascript
import { FormField, TextInput, Select } from '../components/FormControls';

<FormField label="Workshop Title" required>
  <TextInput 
    value={title} 
    onChange={e => setTitle(e.target.value)} 
    placeholder="Enter title"
    required
  />
</FormField>

<FormField label="Category" required>
  <Select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
    <option value="">Select category</option>
    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
  </Select>
</FormField>
```

### impact
- reduce form code by ~30%
- consistent form styling
- focus states handled automatically
- easier to add form validation ui

---

## implementation priority

### phase 1 (immediate - high impact)
1. **jwt role decoding** (auth.js)
   - impact: 15 files, 450 lines saved
   - effort: 2 hours
   - breaks: none (pure refactor)

2. **error message extraction** (errorHandler.js)
   - impact: 20 files, 600 lines saved
   - effort: 3 hours
   - breaks: none

### phase 2 (next sprint - medium impact)
3. **api url consolidation**
   - impact: 25 files, 25 lines saved
   - effort: 1 hour
   - breaks: none

4. **image resolution cleanup**
   - impact: 3 files, 60 lines saved
   - effort: 30 minutes
   - breaks: none

### phase 3 (future - low impact but nice to have)
5. **protected route components**
   - impact: cleaner app.jsx
   - effort: 2 hours
   - breaks: none

6. **page state components**
   - impact: 20 files, consistent ux
   - effort: 3 hours
   - breaks: none (optional adoption)

7. **form controls**
   - impact: 15 files, 300 lines saved
   - effort: 4 hours
   - breaks: none (optional adoption)

---

## total impact summary

### if all phases implemented

**code reduction:**
- before: ~3500 lines of duplicate code
- after: ~500 lines of reusable utilities
- saved: **3000 lines (85% reduction)**

**files affected:**
- 25+ files would be simplified
- 7 new utility/component files created

**maintenance benefits:**
- single source of truth for common patterns
- easier bug fixes (fix once, apply everywhere)
- consistent ux and behavior
- better testability

**developer experience:**
- less boilerplate to write
- faster feature development
- clearer code intent

---

## estimated effort

- phase 1: **5 hours** (highest roi)
- phase 2: **1.5 hours** (quick wins)
- phase 3: **9 hours** (polish)

**total: ~15 hours of refactoring**

**payback:** will save 2-3 hours per new feature page going forward

---

## recommendation

**start with phase 1** (jwt decoding + error handling)

these two utilities will immediately:
- reduce duplication by 1050 lines
- fix inconsistencies in role checking
- improve error messages for users
- make all existing pages cleaner

then adopt phase 2 when convenient (low effort, good cleanup)

phase 3 can be done gradually as new features are added

