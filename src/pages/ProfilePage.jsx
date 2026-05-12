import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  addMoneyToRiderWallet,
  getDriverProfile,
  getDriverWallet,
  getRiderProfile,
  getRiderWallet,
  onboardDriver,
  withdrawMoneyFromDriverWallet,
  getRiderRides,
  getDriverRides,
} from "../services/api";
import SupportPanel from "../components/SupportPanel";

import { formatRideId, formatDriverId, formatRiderId } from "../utils/formatId";
import { formatDateTime } from "../utils/formatDate";
import { formatPhoneNumber } from "../utils/phone";
import { getWalletBalance, normalizeWallet } from "../utils/wallet";
import { notifyRiderWalletUpdated } from "../utils/walletEvents";
import { cachePhoneNumber, getCachedPhoneNumber } from "../utils/userContactCache";

const formatCurrency = (amount) => `₹${Number(amount || 0).toFixed(2)}`;

const getTransactionLabel = (transaction) => {
  if (transaction?.transactionMethod === "CASH_HANDOVER") {
    return `${formatRideId(transaction.ride?.id)} (CASH)`;
  }
  if (transaction?.ride?.id) {
    return formatRideId(transaction.ride.id);
  }

  return transaction?.transactionMethod === "BANKING" ? "Banking" : "Wallet";
};

import { useNavigate } from "react-router-dom";

export default function ProfilePage({ toast }) {
  const navigate = useNavigate();
  const { user, isDriver, isRider, logout, login, token } = useAuth();
  const canUseRiderWallet = isRider;
  const canUseDriverWallet = isDriver;
  const [walletView, setWalletView] = useState(() => {
    if (isRider) return "rider";
    if (isDriver) return "driver";
    return "rider";
  });
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletActionLoading, setWalletActionLoading] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [userId, setUserId] = useState('');
  const [obLoading, setObLoading] = useState(false);

  const showingDriverWallet = walletView === "driver" && canUseDriverWallet;
  const showingRiderWallet = walletView === "rider" && canUseRiderWallet;

  useEffect(() => {
    if (walletView === "driver" && !canUseDriverWallet && canUseRiderWallet) {
      setWalletView("rider");
    }
    if (walletView === "rider" && !canUseRiderWallet && canUseDriverWallet) {
      setWalletView("driver");
    }
  }, [walletView, canUseDriverWallet, canUseRiderWallet]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setWalletLoading(true);
      try {
        const [profileResponse, walletResponse, ridesResponse] = await Promise.all([
          showingDriverWallet ? getDriverProfile() : getRiderProfile(),
          showingDriverWallet ? getDriverWallet() : getRiderWallet(),
          showingDriverWallet ? getDriverRides(0, 100) : getRiderRides(0, 100),
        ]);
        
        const normalizedWallet = normalizeWallet(walletResponse);
        let tx = [...(normalizedWallet.transactions || [])];
        if (ridesResponse && ridesResponse.content) {
            const cashRides = ridesResponse.content.filter(r => r.paymentMethod === 'CASH' && r.rideStatus === 'ENDED');
            cashRides.forEach(ride => {
                const commission = 0.15;
                const driverEarnings = ride.fare ? ride.fare * (1 - commission) : 0;
                tx.push({
                   id: `cash_${ride.id}`,
                   transactionType: showingDriverWallet ? 'CREDIT' : 'DEBIT',
                   transactionMethod: 'CASH_HANDOVER',
                   amount: showingDriverWallet ? driverEarnings : (ride.fare || 0),
                   timeStamp: ride.endedAt || ride.createdTime || new Date().toISOString(),
                   ride
                });
            });
            tx.sort((a,b) => new Date(b.timeStamp) - new Date(a.timeStamp));
        }
        
        setProfile(profileResponse);
        const profileEmail = profileResponse?.user?.email || profileResponse?.email;
        const profilePhone = profileResponse?.user?.phoneNumber || profileResponse?.phoneNumber;
        if (profileEmail && profilePhone) {
          cachePhoneNumber(profileEmail, profilePhone);
        }
        setWallet({ ...normalizedWallet, balance: getWalletBalance(normalizedWallet), transactions: tx });
      } catch {
        setProfile((current) => current || {
          name: user?.name || "",
          email: user?.email || "",
          phoneNumber: user?.phoneNumber || getCachedPhoneNumber(user?.email),
        });
      } finally {
        setLoading(false);
        setWalletLoading(false);
      }
    };
    load();
  }, [showingDriverWallet]);

  const handleOnboard = async () => {
    if (!vehicleId || !userId) { toast.error('Please enter both your user ID and vehicle ID.'); return; }
    setObLoading(true);
    try {
      const d = await onboardDriver(userId, vehicleId);
      const mergedRoles = Array.from(new Set([...(user?.roles || []), 'DRIVER']));
      login({ ...user, roles: mergedRoles }, token || localStorage.getItem('token'));
      toast.success(`Driver profile activated for vehicle ${d.vehicleId}.`);
      setOnboarding(false);
    } catch (e) {
      toast.error(e.message || 'Unable to complete driver onboarding.');
    } finally {
      setObLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success("You have been signed out.");
    navigate("/");
  };

  const handleWalletAction = async (action) => {
    const amount = Number.parseFloat(walletAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid wallet amount");
      return;
    }

    setWalletActionLoading(true);
    try {
      if (showingDriverWallet) {
        const response = await withdrawMoneyFromDriverWallet(amount);
        setWallet((current) => {
          const normalizedCurrent = normalizeWallet(current);
          const normalizedResponse = normalizeWallet(response, normalizedCurrent);
          return {
            ...normalizedResponse,
            transactions: [
              {
                id: `driver_withdraw_${Date.now()}`,
                transactionType: 'DEBIT',
                transactionMethod: 'BANKING',
                amount,
                timeStamp: new Date().toISOString(),
              },
              ...(normalizedResponse.transactions || normalizedCurrent.transactions || []),
            ],
          };
        });
      } else {
        await addMoneyToRiderWallet(amount);
        const refreshedWallet = await getRiderWallet();
        setWallet((current) => {
          const normalizedCurrent = normalizeWallet(current);
          const normalizedRefreshed = normalizeWallet(refreshedWallet, normalizedCurrent);
          const refreshedBalance = getWalletBalance(normalizedRefreshed);
          const currentBalance = getWalletBalance(normalizedCurrent);

          if (refreshedBalance <= currentBalance) {
            return {
              ...normalizedRefreshed,
              balance: currentBalance + amount,
              transactions: normalizedRefreshed.transactions?.length
                ? normalizedRefreshed.transactions
                : normalizedCurrent.transactions || [],
            };
          }

          return {
            ...normalizedRefreshed,
            transactions: normalizedRefreshed.transactions || normalizedCurrent.transactions || [],
          };
        });
        notifyRiderWalletUpdated();
      }

      setWalletAmount("");
      toast.success(showingDriverWallet ? "Money withdrawn from driver wallet" : "Money added to rider wallet");
    } catch (e) {
      if (!showingDriverWallet && e?.status === 403) {
        toast.error("Rider wallet top-up was blocked by the backend. If you recently changed account roles, sign out and sign back in once. Otherwise the backend may not allow this rider wallet route yet.");
      } else {
        toast.error(e.message || "Wallet action failed");
      }
    } finally {
      setWalletActionLoading(false);
    }
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="fade-in">
      <div className="premium-hero-panel" style={{ background: 'var(--chrome-bg)', padding: '2.5rem 1.5rem 5rem', position: 'relative', overflow: 'hidden' }}>
        <div className="animated-grid" />
        <div className="app-orb" style={{ top: -60, right: -60, width: 280, height: 280, background: 'var(--brand)' }} />
        <div className="app-orb alt" style={{ bottom: -40, left: '12%', width: 160, height: 160, background: '#fff' }} />
        <div className="page-wrap">
          <span className="badge badge-yellow" style={{ marginBottom: '0.75rem' }}>👤 Profile</span>
          <h1 style={{ color: 'var(--chrome-fg)', fontSize: '2rem', letterSpacing: '-1px' }}>My profile</h1>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', marginTop: -32, borderRadius: '32px 32px 0 0', padding: '0 1.5rem 3rem' }}>
        <div className="page-wrap" style={{ maxWidth: 560 }}>
          <div className="card premium-card animate-fade-up" style={{ marginTop: '-2.5rem', padding: '1.5rem', position: 'relative', zIndex: 2, marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'var(--chrome-bg)', color: 'var(--brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem', fontFamily: 'Clash Display', fontWeight: 700, flexShrink: 0,
                }}>
                  {initials}
                </div>
                <div>
                  <h2 style={{ fontSize: '1.3rem', letterSpacing: '-0.5px', marginBottom: 4 }}>{user?.name || '—'}</h2>
                  <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>{user?.email}</p>
                  <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: 2 }}>{formatPhoneNumber(profile?.user?.phoneNumber || profile?.phoneNumber || user?.phoneNumber || '') || 'Phone number required'}</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {user?.roles?.map(r => (
                      <span key={r} className="badge badge-yellow" style={{ fontSize: '0.7rem' }}>{r}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>



          {/* Stats from API */}
          {(profile || loading) && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)', marginBottom: '1rem' }}>
                Account details
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {loading ? (
                  <>
                    <RowSkeleton />
                    <RowSkeleton />
                    <RowSkeleton />
                  </>
                ) : (
                  <>
                    {showingDriverWallet && (
                      <>
                        <Row label="Driver ID" value={formatDriverId(profile.id)} />
                        <Row label="Vehicle" value={profile.vehicleId || '—'} />
                        <Row label="Rating" value={profile.rating ? `⭐ ${profile.rating.toFixed(2)}` : '—'} />
                        <Row label="Availability" value={
                          <span className={`badge ${profile.available ? 'badge-green' : 'badge-red'}`}>
                            {profile.available ? 'Available' : 'Unavailable'}
                          </span>
                        } />
                      </>
                    )}
                    {showingRiderWallet && (
                      <>
                        <Row label="Rider ID" value={formatRiderId(profile.id)} />
                        <Row label="Rating" value={profile.rating ? `⭐ ${profile.rating.toFixed(2)}` : '—'} />
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <SupportPanel
              compact
              contextLabel="my account profile"
              title="Need help updating your phone number?"
              description="Support can help if your account contact number is wrong, missing, or blocking ride coordination."
            />
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)', marginBottom: 6 }}>
                  Wallet
                </h4>
                <div style={{ fontFamily: 'Clash Display', fontSize: '2rem', letterSpacing: '-1px', display: 'flex', alignItems: 'center', height: 38 }}>
                  {walletLoading ? <div className="skeleton-shimmer" style={{ width: 120, height: 34, borderRadius: 6 }} /> : formatCurrency(wallet?.balance)}
                </div>
              </div>
              <span className={`badge ${showingDriverWallet ? 'badge-blue' : 'badge-yellow'}`}>
                {showingDriverWallet ? 'Driver wallet' : 'Rider wallet'}
              </span>
            </div>

            {canUseRiderWallet && canUseDriverWallet && (
              <div style={{ display: 'flex', gap: 10, marginBottom: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setWalletView("rider")}
                  style={{
                    background: walletView === "rider" ? "var(--chrome-bg)" : "var(--white)",
                    color: walletView === "rider" ? "var(--chrome-fg)" : "var(--muted)",
                    border: "1px solid var(--surface-2)",
                  }}
                >
                  Rider wallet
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setWalletView("driver")}
                  style={{
                    background: walletView === "driver" ? "var(--chrome-bg)" : "var(--white)",
                    color: walletView === "driver" ? "var(--chrome-fg)" : "var(--muted)",
                    border: "1px solid var(--surface-2)",
                  }}
                >
                  Driver wallet
                </button>
              </div>
            )}

            <p style={{ fontSize: '0.86rem', color: 'var(--muted)', marginBottom: '1rem' }}>
              {showingDriverWallet
                ? 'Trip earnings are credited here automatically. Withdraw your earned balance when needed.'
                : 'Add money here before choosing wallet payment. Ride fare is deducted automatically when the trip ends.'}
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '1rem' }}>
              <input
                className="input-field"
                placeholder={showingDriverWallet ? 'Enter withdrawal amount' : 'Enter amount to add'}
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                style={{ flex: 1, minWidth: 180 }}
              />
              {showingDriverWallet ? (
                <button className="btn btn-ghost" onClick={() => handleWalletAction('withdraw')} disabled={walletActionLoading}>
                  {walletActionLoading ? <span className="spinner" /> : 'Withdraw'}
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => handleWalletAction('add')} disabled={walletActionLoading}>
                  {walletActionLoading ? <span className="spinner" /> : 'Add money'}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)' }}>
                Recent transactions
              </h4>
              {walletLoading ? (
                <>
                  <TransactionSkeleton />
                  <TransactionSkeleton />
                  <TransactionSkeleton />
                </>
              ) : wallet?.transactions?.length ? (
                wallet.transactions.slice(0, 6).map((transaction) => (
                  <div
                    key={transaction.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      padding: '0.9rem 1rem',
                      borderRadius: 14,
                      background: 'var(--surface)',
                      border: '1px solid var(--surface-2)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700 }}>{getTransactionLabel(transaction)}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
                        {transaction.transactionMethod === 'CASH_HANDOVER' ? 'In-Person Cash Payment' : transaction.transactionMethod} • {transaction.timeStamp ? formatDateTime(transaction.timeStamp) : 'Just now'}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: transaction.transactionType === 'CREDIT' ? '#0b8f55' : '#a93d3d' }}>
                      {transaction.transactionType === 'CREDIT' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: '0.86rem', color: 'var(--muted)' }}>
                  No wallet transactions yet.
                </p>
              )}
            </div>
          </div>

          {/* Onboard as driver (for riders who want to become drivers too) */}
          {isRider && !isDriver && (
            <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--chrome-bg)', color: 'var(--chrome-fg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ color: 'var(--chrome-fg)', marginBottom: 4 }}>Become a driver</h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--hero-text-muted)' }}>Register your vehicle and start earning on BookCar.</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setOnboarding(v => !v)}>
                  {onboarding ? 'Cancel setup' : 'Start setup'}
                </button>
              </div>

              {onboarding && (
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--hero-text-muted)', marginBottom: 6 }}>Your user ID</label>
                    <input className="input-field" placeholder="e.g. 5" value={userId} onChange={e => setUserId(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.15)', color: 'var(--chrome-fg)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--hero-text-muted)', marginBottom: 6 }}>Vehicle ID</label>
                    <input className="input-field" placeholder="MH12AB1234" value={vehicleId} onChange={e => setVehicleId(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.15)', color: 'var(--chrome-fg)' }} />
                  </div>
                  <button className="btn btn-primary" onClick={handleOnboard} disabled={obLoading}>
                    {obLoading ? <span className="spinner" /> : 'Activate driver profile'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Sign out */}
          <div className="card">
            <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)', marginBottom: '0.5rem' }}>Session</h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
            </p>
            <button className="btn btn-ghost btn-full" onClick={handleLogout}>
              Sign out 
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="skeleton-shimmer" style={{ width: 80, height: 14, borderRadius: 4 }} />
      <div className="skeleton-shimmer" style={{ width: 100, height: 14, borderRadius: 4 }} />
    </div>
  );
}

function TransactionSkeleton() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '0.9rem 1rem', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
      <div>
        <div className="skeleton-shimmer" style={{ width: 120, height: 16, borderRadius: 4, marginBottom: 6 }} />
        <div className="skeleton-shimmer" style={{ width: 160, height: 12, borderRadius: 4 }} />
      </div>
      <div className="skeleton-shimmer" style={{ width: 60, height: 18, borderRadius: 4 }} />
    </div>
  );
}
