/**
 * useAuth.js
 * Small hook to encapsulate JWT retrieval and role decoding used across admin pages.
 */
import { useMemo, useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Decode JWT payload safely
 * @param {string|null} token
 */
function decodeJwtPayload(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch { return null; }
}

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';

/**
 * Hook to provide roles, token and fetched user info
 */
export default function useAuth() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  const payload = useMemo(() => decodeJwtPayload(token), [token]);
  const roles = useMemo(() => {
    if (!payload) return [];
    const set = new Set();
    if (payload.role) {
      if (Array.isArray(payload.role)) payload.role.forEach(r => set.add(r)); else set.add(payload.role);
    }
    const uri = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
    if (payload[uri]) {
      const v = payload[uri];
      if (Array.isArray(v)) v.forEach(r => set.add(r)); else set.add(v);
    }
    return Array.from(set);
  }, [payload]);

  // derive initial user name from token claims so UI can show name immediately
  const deriveNameFromPayload = (pl) => {
    if (!pl) return null;
    const firstCandidates = ['given_name', 'givenName', 'firstName', 'firstname', 'first_name'];
    const lastCandidates = ['family_name', 'familyName', 'lastName', 'lastname', 'last_name'];
    const nameCandidates = ['name', 'unique_name', 'preferred_username', 'email'];

    let first = null, last = null;
    for (const k of firstCandidates) { if (pl[k]) { first = pl[k]; break; } }
    for (const k of lastCandidates) { if (pl[k]) { last = pl[k]; break; } }
    // fallback: try to split 'name' claim
    if ((!first || !last) && pl[nameCandidates.find(k => pl[k])]) {
      const n = pl[nameCandidates.find(k => pl[k])];
      if (typeof n === 'string') {
        const parts = n.trim().split(/\s+/);
        if (!first) first = parts[0] || null;
        if (!last && parts.length > 1) last = parts.slice(1).join(' ');
      }
    }

    if (!first && !last) return null;
    return { firstName: first || null, lastName: last || null };
  };

  const initialUser = deriveNameFromPayload(payload);
  const [user, setUser] = useState(initialUser);

  useEffect(() => {
    let cancelled = false;
    async function fetchMe() {
      if (!token) { setUser(initialUser ?? null); return; }
      try {
        const resp = await axios.get(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!cancelled) setUser(resp.data || initialUser || null);
      } catch {
        if (!cancelled) setUser(initialUser || null);
      }
    }
    fetchMe();
    return () => { cancelled = true; };
    // include initialUser so that when token->payload changes we reset correctly
  }, [token, initialUser]);

  return { token, roles, user };
}
