import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getRiderRides, getDriverRides } from "../services/api";
import { getRideStatusBadgeClass } from "../constants/rideStatus";
import LocationName from "../components/LocationName";
import { formatRideId } from "../utils/formatId";
import { formatDateTime } from "../utils/formatDate";
import SupportPanel from "../components/SupportPanel";

import { useNavigate } from "react-router-dom";

export default function RidesPage(props) {
  const { toast } = props;
  const navigate = useNavigate();
  const { isDriver } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 8;

  const fetchRides = async (p) => {
    setLoading(true);
    try {
      const res = isDriver ? await getDriverRides(p, PAGE_SIZE) : await getRiderRides(p, PAGE_SIZE);
      setRides(res?.content || []);
      setTotalPages(res?.totalPages || 1);
    } catch (e) {
      toast.error('Could not load rides');
      setRides([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRides(page); }, [page, isDriver]);
  const getDisplayFare = (fare) => (typeof fare === "number" ? (isDriver ? fare * 0.85 : fare) : 0);
  const completedRides = rides.filter((ride) => String(ride.rideStatus).toUpperCase() === "ENDED").length;
  const activeRides = rides.filter((ride) => !["ENDED", "CANCELLED"].includes(String(ride.rideStatus).toUpperCase())).length;
  const totalFare = rides.reduce((sum, ride) => sum + getDisplayFare(ride.fare), 0);

  return (
    <div className="fade-in">
      <div className="premium-hero-panel" style={{ background: 'var(--chrome-bg)', padding: '2.5rem 1.5rem 4.5rem', position: 'relative', overflow: 'hidden' }}>
        <div className="animated-grid" />
        <div className="app-orb" style={{ bottom: -80, right: 0, width: 280, height: 280, background: 'var(--brand)' }} />
        <div className="app-orb alt" style={{ top: -50, left: '10%', width: 180, height: 180, background: '#fff' }} />
        <div className="page-wrap">
          <span className="badge badge-yellow" style={{ marginBottom: '0.75rem' }}>🕓 History</span>
          <h1 style={{ color: '#fff', fontSize: '2rem', letterSpacing: '-1px' }}>My rides</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            All your past and current trips
          </p>
        </div>
      </div>

      <div className="app-shell-content">
        <div className="page-wrap">
          <div className="info-grid overlap-stack" style={{ marginBottom: '1.5rem' }}>
            <div className="info-tile">
              <div className="info-tile-label">Trips on this page</div>
              <div className="info-tile-value">{rides.length}</div>
            </div>
            <div className="info-tile">
              <div className="info-tile-label">Active rides</div>
              <div className="info-tile-value">{activeRides}</div>
            </div>
            <div className="info-tile">
              <div className="info-tile-label">Completed rides</div>
              <div className="info-tile-value">{completedRides}</div>
            </div>
            <div className="info-tile">
              <div className="info-tile-label">{isDriver ? "Earnings shown" : "Fare shown"}</div>
              <div className="info-tile-value">₹{totalFare.toFixed(0)}</div>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              <RideCardSkeleton />
              <RideCardSkeleton />
              <RideCardSkeleton />
              <RideCardSkeleton />
            </div>
          ) : rides.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
              <p style={{ fontWeight: 600 }}>No rides found</p>
              <p style={{ fontSize: '0.88rem', marginTop: 4 }}>Your trips will appear here once you book or complete a ride</p>
            </div>
          ) : (
            <>
              <div className="section-heading">
                <div className="section-heading-copy">
                  <h3>Trip timeline</h3>
                  <p>{isDriver ? "Review recent jobs, rider details, and payouts." : "Revisit past rides and quickly book a similar trip again."}</p>
                </div>
                <span className="badge badge-gray">Page {page + 1} of {totalPages}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {rides.map((ride, idx) => (
                  <div key={ride.id} className="card ride-card-premium hover-lift animate-fade-up" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <span style={{ fontFamily: 'Clash Display', fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.3px' }}>{formatRideId(ride.id)}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>{formatDateTime(ride.createdTime)}</div>
                      </div>
                      <span className={`badge ${getRideStatusBadgeClass(ride.rideStatus)}`}>{ride.rideStatus}</span>
                    </div>

                    <div className="route-summary">
                      <div className="route-summary-row">
                        <div className="route-dot dot-pickup" />
                        <span className="route-summary-text">
                           <LocationName coords={ride.pickupLocation?.coordinates} />
                        </span>
                      </div>
                      <div className="route-line" style={{ marginLeft: 4 }} />
                      <div className="route-summary-row">
                        <div className="route-dot dot-drop" />
                        <span className="route-summary-text">
                           <LocationName coords={ride.dropOffLocation?.coordinates} />
                        </span>
                      </div>
                    </div>

                    <div className="divider" />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        {ride.paymentMethod && (
                          <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>{ride.paymentMethod}</span>
                        )}
                      </div>
                      {typeof ride.fare === "number" ? (
                        <span style={{ fontFamily: 'Clash Display', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
                          ₹{getDisplayFare(ride.fare).toFixed(0)}
                        </span>
                      ) : null}
                    </div>

                    {isDriver && ride.rider && (
                      <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--muted)' }}>
                        👤 Rider: {ride.rider?.user?.name || ride.rider?.id}
                      </div>
                    )}
                    {!isDriver && ride.driver && (
                      <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--muted)' }}>
                        🚗 Driver: {ride.driver?.user?.name || ride.driver?.id}
                      </div>
                    )}
                    {!isDriver && page === 0 && idx < 3 && (
                      <div style={{ marginTop: '1rem' }}>
                        <button 
                          className="btn btn-outline btn-full hover-lift"
                          style={{ borderColor: 'var(--surface-2)', color: 'var(--text-primary)' }}
                          onClick={() => {
                            sessionStorage.setItem("rebook_ride", JSON.stringify(ride));
                            navigate("/book", { state: { rebookRide: ride } });
                          }}
                        >
                          🔄 Rebook this trip
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: '2rem' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                  >
                    ← Prev
                  </button>
                  <span style={{ padding: '8px 16px', fontSize: '0.88rem', color: 'var(--muted)' }}>
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next →
                  </button>
                </div>
              )}

              <div style={{ marginTop: '1.5rem' }}>
                <SupportPanel
                  compact
                  contextLabel="a ride from my history"
                  title="Need help with a trip from this list?"
                  description="Use support for missing fares, payment disputes, cancelled trips, or anything that still needs follow-up."
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RideCardSkeleton() {
  return (
    <div className="card hover-shrink" style={{ padding: '1.25rem' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="skeleton-shimmer" style={{ width: 100, height: 18, borderRadius: 4, marginBottom: 6 }} />
            <div className="skeleton-shimmer" style={{ width: 140, height: 12, borderRadius: 4 }} />
          </div>
          <div className="skeleton-shimmer" style={{ width: 70, height: 24, borderRadius: 12 }} />
       </div>
       <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <div className="skeleton-shimmer" style={{ width: 8, height: 8, borderRadius: '50%' }} />
          <div className="skeleton-shimmer" style={{ width: '80%', height: 14, borderRadius: 4 }} />
       </div>
       <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <div className="skeleton-shimmer" style={{ width: 8, height: 8, borderRadius: '50%' }} />
          <div className="skeleton-shimmer" style={{ width: '60%', height: 14, borderRadius: 4 }} />
       </div>
       <div className="divider" />
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <div className="skeleton-shimmer" style={{ width: 50, height: 18, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ width: 60, height: 20, borderRadius: 4 }} />
       </div>
       <div style={{ marginTop: 14 }}>
          <div className="skeleton-shimmer" style={{ width: '100%', height: 36, borderRadius: 6 }} />
       </div>
    </div>
  );
}
