import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getRiderProfile, getDriverProfile, getRiderRides, getDriverRides } from "../services/api";
import { getRideStatusBadgeClass } from "../constants/rideStatus";
import { formatRideId } from "../utils/formatId";
import LocationName from "../components/LocationName";
import { FiCompass, FiMap, FiTrendingUp, FiUser } from "react-icons/fi";
import SupportPanel from "../components/SupportPanel";

import { useNavigate } from "react-router-dom";

export default function DashboardPage({ toast }) {
  const navigate = useNavigate();
  const { user, isDriver, isRider } = useAuth();
  const [profile, setProfile] = useState(null);
  const [recentRides, setRecentRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [prof, rides] = await Promise.all([
          isDriver ? getDriverProfile() : getRiderProfile(),
          isDriver ? getDriverRides(0, 5) : getRiderRides(0, 5),
        ]);
        setProfile(prof);
        setRecentRides(rides?.content || []);
      } catch (e) {
        // Demo mode — just show the user info
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isDriver]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="animate-page-enter">
      {/* Hero */}
      <div style={{ background: 'var(--chrome-bg)', padding: '3rem 1.5rem 5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, background: 'var(--brand)', borderRadius: '50%', opacity: 0.06 }} />
        <div className="page-wrap">
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            {greeting()},
          </p>
          <h1 style={{ color: '#fff', fontSize: '2.2rem', letterSpacing: '-1px', marginBottom: '0.5rem' }}>
            {user?.name || 'Welcome back'} 👋
          </h1>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: '0.75rem' }}>
            {user?.roles?.map(r => (
              <span key={r} className="badge badge-yellow">{r}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', marginTop: -32, borderRadius: '32px 32px 0 0', padding: '2.5rem 1.5rem 3rem' }}>
        <div className="page-wrap">

          {/* Quick actions */}
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', letterSpacing: '-0.3px' }}>Quick actions</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: '2.5rem' }}>
            {isRider && (
              <ActionCard icon={FiCompass} label="Book a Ride" sub="Find a driver now" onClick={() => navigate('/book')} accent />
            )}
            {isDriver && (
              <ActionCard icon={FiTrendingUp} label="Driver Panel" sub="Manage rides" onClick={() => navigate('/driver')} accent />
            )}
            <ActionCard icon={FiMap} label="Ride History" sub="Past trips" onClick={() => navigate('/rides')} />
            <ActionCard icon={FiUser} label="My Profile" sub="View & edit" onClick={() => navigate('/profile')} />
          </div>

          {/* Profile stats */}
          {(profile || loading) && (
            <div style={{ marginBottom: '2.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', letterSpacing: '-0.3px' }}>Your stats</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
                {loading ? (
                  <>
                    {isDriver ? (
                      <>
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                      </>
                    ) : (
                      <StatCardSkeleton />
                    )}
                  </>
                ) : (
                  <>
                    {isDriver && (
                      <>
                        <StatCard label="Rating" value={profile?.rating?.toFixed(1) || '—'} icon="⭐" />
                        <StatCard label="Vehicle" value={profile?.vehicleId || '—'} icon="🚘" />
                        <StatCard label="Status" value={profile?.available ? 'Available' : 'Busy'} icon="🟢" />
                      </>
                    )}
                    {isRider && (
                      <StatCard label="Rating" value={profile?.rating?.toFixed(1) || '—'} icon="⭐" />
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Recent rides */}
          {(recentRides.length > 0 || loading) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '-0.3px' }}>Recent rides</h3>
                <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.88rem' }} onClick={() => navigate('/rides')}>
                  View all →
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {loading ? (
                  <>
                    <RideSummaryCardSkeleton />
                    <RideSummaryCardSkeleton />
                  </>
                ) : (
                  recentRides.slice(0, 3).map(ride => (
                    <RideSummaryCard key={ride.id} ride={ride} />
                  ))
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: '2rem' }}>
            <SupportPanel
              compact
              contextLabel={isDriver ? "my driver dashboard" : "my rider dashboard"}
              title="Support is one tap away"
              description="Use the same BookCar support line for live trips, booking issues, wallet questions, or profile help."
            />
          </div>

          {!loading && recentRides.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚗</div>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No rides yet</p>
              <p style={{ fontSize: '0.88rem', marginBottom: '1.5rem' }}>Your trips will show up here</p>
              {isRider && (
                <button className="btn btn-dark" onClick={() => navigate('/book')}>Book your first ride</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, label, sub, onClick, accent }) {
  return (
    <div
      onClick={onClick}
      className={`hover-lift animate-fade-up premium-card action-card ${accent ? 'accent' : ''}`}
      style={{
        background: accent ? 'var(--chrome-bg)' : 'var(--white)',
        color: accent ? 'var(--chrome-fg)' : 'var(--text-primary)',
        borderRadius: 'var(--radius)',
        padding: '1.25rem',
        cursor: 'pointer',
      }}
    >
      <div className="feature-icon" style={{ marginBottom: '0.75rem' }}>
        <Icon />
      </div>
      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '0.78rem', opacity: 0.5 }}>{sub}</div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="card hover-shrink animate-fade-up delay-200" style={{ padding: '1rem' }}>
      <div style={{ fontSize: '1.3rem', marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'Clash Display', letterSpacing: '-0.5px' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function RideSummaryCard({ ride }) {
  return (
    <div className="card hover-shrink animate-fade-up delay-300" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{formatRideId(ride.id)}</div>
        <span className={`badge ${getRideStatusBadgeClass(ride.rideStatus)}`}>{ride.rideStatus}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', overflow: 'hidden' }}>
        <div className="route-dot dot-pickup" />
        <span style={{ fontSize: '0.88rem', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
           <LocationName coords={ride.pickupLocation?.coordinates} />
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', overflow: 'hidden' }}>
        <div className="route-dot dot-drop" />
        <span style={{ fontSize: '0.88rem', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
           <LocationName coords={ride.dropOffLocation?.coordinates} />
        </span>
      </div>
      {typeof ride.fare === 'number' && (
        <div style={{ marginTop: 10, fontWeight: 700, fontFamily: 'Clash Display', letterSpacing: '-0.3px' }}>
          ₹{ride.fare?.toFixed(0)}
        </div>
      )}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="card hover-shrink" style={{ padding: '1rem' }}>
      <div className="skeleton-shimmer" style={{ width: 24, height: 24, borderRadius: '50%', marginBottom: 6 }} />
      <div className="skeleton-shimmer" style={{ width: '60%', height: 28, borderRadius: 4, marginBottom: 4 }} />
      <div className="skeleton-shimmer" style={{ width: '40%', height: 12, borderRadius: 4 }} />
    </div>
  );
}

function RideSummaryCardSkeleton() {
  return (
    <div className="card hover-shrink" style={{ padding: '1rem' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="skeleton-shimmer" style={{ width: 80, height: 14, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ width: 60, height: 20, borderRadius: 12 }} />
       </div>
       <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <div className="skeleton-shimmer" style={{ width: 8, height: 8, borderRadius: '50%' }} />
          <div className="skeleton-shimmer" style={{ width: '80%', height: 14, borderRadius: 4 }} />
       </div>
       <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <div className="skeleton-shimmer" style={{ width: 8, height: 8, borderRadius: '50%' }} />
          <div className="skeleton-shimmer" style={{ width: '60%', height: 14, borderRadius: 4 }} />
       </div>
       <div style={{ marginTop: 10 }}>
          <div className="skeleton-shimmer" style={{ width: 40, height: 18, borderRadius: 4 }} />
       </div>
    </div>
  );
}
