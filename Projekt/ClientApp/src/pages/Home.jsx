import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AdminNavbar from '../components/AdminNavbar';
import WorkshopsList from './WorkshopsList';
import resolveImg, { PLACEHOLDER } from '../utils/resolveImg';
import axios from 'axios';

function decodeRolesFromJwt(token) {
    try {
        const payload = token.split('.')[1];
        const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        // Roles can be under 'role' (string or array) or WS-claim URI
        const roleClaimUri = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
        let roles = [];
        if (json.role) roles = Array.isArray(json.role) ? json.role : [json.role];
        if (json[roleClaimUri]) {
            const extra = Array.isArray(json[roleClaimUri]) ? json[roleClaimUri] : [json[roleClaimUri]];
            roles = roles.concat(extra);
        }
        return roles;
    } catch {
        return [];
    }
}

function Home() {
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    // NEW: popular workshops state
    const [popular, setPopular] = useState([]);
    const [popularLoading, setPopularLoading] = useState(false);
    const [popularError, setPopularError] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('jwt');
        const logged = !!token;
        setIsLoggedIn(logged);
        if (logged && token) {
            const roles = decodeRolesFromJwt(token);
            setIsAdmin(roles?.some(r => r === 'Admin'));
        } else {
            setIsAdmin(false);
        }
    }, []);

    useEffect(() => {
        // load popular workshops
        async function loadPopular() {
            setPopularLoading(true); setPopularError('');
            try {
                const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';
                // Request only 3 popular workshops
                const res = await axios.get(`${API_URL}/api/workshops/popular?count=3`);
                setPopular(res.data || []);
            } catch (e) {
                setPopularError('Failed to load popular workshops');
                setPopular([]);
            } finally { setPopularLoading(false); }
        }
        loadPopular();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('jwt');
        setIsLoggedIn(false);
        setIsAdmin(false);
        navigate('/login');
    };

    const features = [
        {
            title: 'Real instructors',
            description: 'Learn directly from people who actually run workshops in your city.',
            color: '#667eea',
        },
        {
            title: 'Hands-on sessions',
            description: 'Pottery, drawing, guitar, photography - focused on practice, not slides.',
            color: '#10b981',
        },
        {
            title: 'Small groups',
            description: 'Limited seats so everyone gets attention. Book early to reserve your spot.',
            color: '#f59e0b',
        },
    ];

    const HeroSection = () => (
        <div
            style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '80px 20px',
                borderRadius: '16px',
                color: 'white',
                textAlign: 'center',
                marginBottom: '60px',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    width: '300px',
                    height: '300px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    top: '-100px',
                    right: '-100px',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    width: '200px',
                    height: '200px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    bottom: '-50px',
                    left: '-50px',
                }}
            />

            <div style={{ position: 'relative', zIndex: 1 }}>
                <h1
                    style={{
                        fontSize: '48px',
                        fontWeight: '800',
                        marginBottom: '20px',
                        textShadow: '0 2px 10px rgba(0,0,0,0.2)',
                    }}
                >
                    Create, learn and meet others
                </h1>
                <p
                    style={{
                        fontSize: '20px',
                        marginBottom: '40px',
                        opacity: 0.95,
                        maxWidth: '600px',
                        margin: '0 auto 40px',
                    }}
                >
                    Join local art, music and craft workshops. Real people, real sessions, just pick a date and sign up.
                </p>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link to="/register">
                        <button
                            style={{
                                padding: '16px 40px',
                                backgroundColor: 'white',
                                color: '#667eea',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontWeight: '700',
                                fontSize: '18px',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                                transition: 'all 0.3s',
                            }}
                            onMouseOver={(e) => {
                                e.target.style.transform = 'translateY(-3px)';
                                e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
                            }}
                            onMouseOut={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
                            }}
                        >
                            Join now
                        </button>
                    </Link>
                    <Link to="/login">
                        <button
                            style={{
                                padding: '16px 40px',
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                color: 'white',
                                border: '2px solid white',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontWeight: '700',
                                fontSize: '18px',
                                backdropFilter: 'blur(10px)',
                                transition: 'all 0.3s',
                            }}
                            onMouseOver={(e) => {
                                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                                e.target.style.transform = 'translateY(-3px)';
                            }}
                            onMouseOut={(e) => {
                                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                                e.target.style.transform = 'translateY(0)';
                            }}
                        >
                            Sign in
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );

    const FeaturesSection = () => (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '30px',
                marginBottom: '60px',
            }}
        >
            {features.map((feature, index) => (
                <div
                    key={index}
                    style={{
                        padding: '40px 30px',
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                        textAlign: 'center',
                        transition: 'all 0.3s',
                        border: '1px solid #f3f4f6',
                        cursor: 'pointer'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-8px)';
                        e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';
                        e.currentTarget.style.borderColor = feature.color;
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.08)';
                        e.currentTarget.style.borderColor = '#f3f4f6';
                    }}
                >
                    <div
                        style={{
                            width: '60px',
                            height: '60px',
                            margin: '0 auto 20px',
                            backgroundColor: feature.color,
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '28px',
                            color: 'white',
                            fontWeight: 'bold'
                        }}
                    >
                        {index + 1}
                    </div>
                    <h3
                        style={{
                            fontSize: '22px',
                            fontWeight: '700',
                            color: '#1a202c',
                            marginBottom: '12px'
                        }}
                    >
                        {feature.title}
                    </h3>
                    <p
                        style={{
                            color: '#6b7280',
                            fontSize: '15px',
                            lineHeight: '1.6'
                        }}
                    >
                        {feature.description}
                    </p>
                </div>
            ))}
        </div>
    );

    return (
        <div
            style={{
                minHeight: '100vh',
                background: 'linear-gradient(to bottom, #f9fafb 0%, #ffffff 100%)',
            }}
        >
            {/* Replace inline navbar with shared AdminNavbar */}
            <AdminNavbar />

            {isLoggedIn && (
                <div style={{ width: '100%', overflow: 'hidden' }}>
                    <img
                        src="/images/welcome-banner.png"
                        alt="Welcome banner"
                        style={{ display: 'block', width: '100%', height: 'auto', maxHeight: '650px', objectFit: 'cover' }}
                    />
                </div>
            )}

            <div
                style={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    padding: '40px 30px 80px 30px',
                }}
            >
                {!isLoggedIn && <HeroSection />}
                {!isLoggedIn && <FeaturesSection />}

                <div style={{ marginTop: isLoggedIn ? '40px' : '0' }}>
                    {/* NEW: Popular workshops section above the existing list */}
                    <h2 style={{ fontSize: 50, fontWeight: 800, color: '#1a202c', marginBottom: 18, textAlign: 'center' }}>Most Popular Workshops</h2>
                    {popularLoading && <div style={{ textAlign: 'center', color: '#6b7280' }}>Loading popular workshops...</div>}
                    {popularError && <div style={{ textAlign: 'center', color: '#991b1b' }}>{popularError}</div>}
                    {!popularLoading && !popularError && popular.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#6b7280', marginBottom: 24 }}>No popular workshops yet.</div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, marginBottom: 40 }}>
                        {popular.map(w => (
                            <div key={w.id} onClick={() => navigate(`/workshop/${w.id}`)}
                                style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', transition: 'box-shadow .2s, transform .2s' }}
                                onMouseOver={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                                onMouseOut={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                                <div style={{ width: '100%', aspectRatio: '4/3', background: '#f3f4f6' }}>
                                    <img src={resolveImg(w.imageUrl)} alt={w.title} onError={(e)=> e.currentTarget.src = PLACEHOLDER} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                </div>
                                <div style={{ padding: 12 }}>
                                    <h4 style={{ margin: 0, fontWeight: 800 }}>{w.title}</h4>
                                    <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 13 }}>{w.category?.name || '�'}</p>
                                    <p style={{ margin: '6px 0 0', fontWeight: 700, fontSize: 13 }}>{w.price === 0 ? 'Free' : `${w.price} PLN`}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <h2
                        style={{
                            fontSize: '50px',
                            fontWeight: '800',
                            color: '#1a202c',
                            marginTop: '80px',
                            textAlign: 'center',
                        }}
                    >
                        {isLoggedIn ? 'All available workshops' : 'Popular workshops'}
                    </h2>
                    <WorkshopsList />
                </div>
            </div>
        </div>
    );
}

export default Home;
