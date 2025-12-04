import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import resolveImg, { PLACEHOLDER } from '../utils/resolveImg';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';

export default function WorkshopsList() {
  const [workshops, setWorkshops] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(''); // '' means all
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function loadCategories(){
    try {
      const res = await fetch(`${API_URL}/api/categories`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      // non-fatal for page; keep categories empty (no filter UI)
      setCategories([]);
    }
  }

  async function loadWorkshops(categoryId) {
    setLoading(true);
    try {
      const url = new URL(`${API_URL}/api/workshops`);
      if (categoryId) url.searchParams.set('categoryId', categoryId);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setWorkshops(data);
      setError('');
    } catch (err) {
      setError(String(err.message || err));
      setWorkshops([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadWorkshops(selectedCategory); }, [selectedCategory]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!workshops || workshops.length === 0) return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        {categories.length > 0 && (
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                  style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }}>
            <option value=''>All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>
      <p>No workshops yet.</p>
    </div>
  );

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        {categories.length > 0 && (
          <>
            <label style={{ fontWeight:700 }}>Category:</label>
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                    style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8 }}>
              <option value=''>All</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {selectedCategory && (
              <button onClick={() => setSelectedCategory('')} style={{ padding:'8px 12px', border:'none', borderRadius:8, background:'#e5e7eb', cursor:'pointer' }}>Reset</button>
            )}
          </>
        )}
      </div>

      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Workshops</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
        {workshops.map(w => (
          <div key={w.id} onClick={() => navigate(`/workshop/${w.id}`)}
               style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', transition: 'box-shadow .2s, transform .2s' }}
               onMouseOver={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
               onMouseOut={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
            <div style={{ width: '100%', aspectRatio: '4/3', background: '#f3f4f6' }}>
              <img src={resolveImg(w.imageUrl)} alt={w.title} onError={(e)=> e.currentTarget.src = PLACEHOLDER} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <div style={{ padding: 12 }}>
              <h4 style={{ margin: 0, fontWeight: 800 }}>{w.title}</h4>
              <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 13 }}>{w.category?.name || '—'}</p>
              <p style={{ margin: '6px 0 0', fontWeight: 700, fontSize: 13 }}>{w.price === 0 ? 'Free' : `${w.price} PLN`}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
