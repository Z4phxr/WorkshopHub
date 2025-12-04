// resolveImg.js
// Shared, safe utility to resolve workshop image URLs without changing behavior.
const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';
const PLACEHOLDER = '/placeholder.svg';

export { PLACEHOLDER };

export default function resolveImg(u) {
  if (!u) return PLACEHOLDER;
  if (/^https?:\/\//i.test(u)) return u;
  return `${API_URL}${u.startsWith('/') ? '' : '/'}${u}`;
}
