import { useEffect, useRef, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import {
  acceptRide,
  cancelRideDriver,
  endRide,
  getDriverWallet,
  getDriverRides,
  getIncomingRideRequest,
  updateDriverLocation,
  rateRiderByBody,
  startRide,
  withdrawMoneyFromDriverWallet,
} from "../services/api";
import {
  RIDE_STATUS,
  getRideStatusBadgeClass,
  normalizeRideStatus,
} from "../constants/rideStatus";
import { getDriverEarnings, commissionLabel } from "../constants/commission";
import LocationName from "../components/LocationName";
import RideMap from "../components/RideMap";
import SupportPanel from "../components/SupportPanel";
import { formatRideId, formatRiderId } from "../utils/formatId";
import { formatDateTime } from "../utils/formatDate";
import { formatPhoneNumber, toDialablePhoneNumber } from "../utils/phone";

const POLL_INTERVAL_MS = 2000;
const RATED_RIDER_STORAGE_KEY = "bookcar-rated-rider-rides";
const ACTIVE_DRIVER_STATUSES = [RIDE_STATUS.CONFIRMED, RIDE_STATUS.ONGOING];
const formatCurrency = (amount) => `₹${Number(amount || 0).toFixed(2)}`;
const normalizeOtpValue = (value = "") => String(value).replace(/\D/g, "");

const readRatedRideIds = () => {
  try {
    const raw = window.localStorage.getItem(RATED_RIDER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveRatedRideIds = (ids) => {
  window.localStorage.setItem(RATED_RIDER_STORAGE_KEY, JSON.stringify(ids));
};

const getRideStage = (ride) => {
  const status = normalizeRideStatus(ride?.rideStatus);
  if (status === RIDE_STATUS.ENDED) return "ended";
  if (status === RIDE_STATUS.ONGOING) return "started";
  if (status === RIDE_STATUS.CONFIRMED) return "accepted";
  return "idle";
};

const getDriverRideStage = (ride, ratedRideIds = []) => {
  if (
    getRideStage(ride) === "ended" &&
    (ratedRideIds.includes(Number(ride?.id)) || ride?.riderRating != null)
  ) {
    return "completed";
  }
  return getRideStage(ride);
};

const isDriverRideCompleted = (ride, ratedRideIds = []) =>
  getDriverRideStage(ride, ratedRideIds) === "completed";

const getVisibleDriverRides = (rides = [], ratedRideIds = []) =>
  rides.filter((ride) => !isDriverRideCompleted(ride, ratedRideIds));

const selectNextDriverRide = (rides = [], currentRideId, ratedRideIds = []) => {
  // 1. Try to find the ride that was previously selected
  const matchingCurrentRide = currentRideId
    ? rides.find((ride) => ride.id === currentRideId)
    : null;
  if (matchingCurrentRide) return matchingCurrentRide;

  const visibleRides = getVisibleDriverRides(rides, ratedRideIds);
  if (!visibleRides.length) return null;

  // 2. Prioritize ONGOING rides (highest priority)
  const ongoing = visibleRides.find(
    (ride) => normalizeRideStatus(ride.rideStatus) === RIDE_STATUS.ONGOING
  );
  if (ongoing) return ongoing;

  // 3. Prioritize CONFIRMED rides (accepted but not started)
  const confirmed = visibleRides.find(
    (ride) => normalizeRideStatus(ride.rideStatus) === RIDE_STATUS.CONFIRMED
  );
  if (confirmed) return confirmed;

  // 4. Fall back to the most recent ride in history
  return visibleRides[0] || null;
};

const DriverRouteSummary = ({ ride }) => {
  if (!ride) return null;
  return (
    <div
      style={{
        margin: "1rem 0",
        padding: "1rem",
        borderRadius: 16,
        background: "var(--surface-2)",
        textAlign: "left",
      }}
    >
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
    </div>
  );
};

import { useNavigate } from "react-router-dom";

export default function DriverPanelPage({ toast }) {
  const navigate = useNavigate();
  const { isDriver } = useAuth();
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletActionLoading, setWalletActionLoading] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [walletAmount, setWalletAmount] = useState("");
  const [liveRides, setLiveRides] = useState([]);
  const [currentRide, setCurrentRide] = useState(null);
  const [rideStage, setRideStage] = useState("idle");
  const [otp, setOtp] = useState("");
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [rating, setRating] = useState(0);
  const [ratedRideIds, setRatedRideIds] = useState(() => readRatedRideIds());
  const currentRideRef = useRef(currentRide);
  const rideStageRef = useRef(rideStage);
  const ratedRideIdsRef = useRef(ratedRideIds);
  const ridesSyncInFlightRef = useRef(false);
  const incomingSyncInFlightRef = useRef(false);
  const walletSyncInFlightRef = useRef(false);

  currentRideRef.current = currentRide;
  rideStageRef.current = rideStage;
  ratedRideIdsRef.current = ratedRideIds;

  const refreshWallet = async ({ silent = false } = {}) => {
    if (walletSyncInFlightRef.current) return;
    walletSyncInFlightRef.current = true;
    if (!silent) setWalletLoading(true);
    try {
      const response = await getDriverWallet();
      setWallet(response);
    } catch (error) {
      toast.error(error.message || "Could not load driver wallet");
    } finally {
      walletSyncInFlightRef.current = false;
      if (!silent) setWalletLoading(false);
    }
  };

  const refreshRides = async ({ silent = false } = {}) => {
    if (ridesSyncInFlightRef.current) return;
    if (document.visibilityState === "hidden") return;
    ridesSyncInFlightRef.current = true;
    if (!silent) setRefreshing(true);
    try {
      const res = await getDriverRides(0, 20);
      const rides = res?.content || [];
      const nextRide = selectNextDriverRide(
        rides,
        currentRideRef.current?.id,
        ratedRideIdsRef.current
      );
      setLiveRides(rides);
      setCurrentRide(nextRide);
      if (rideStageRef.current !== "rating") {
        setRideStage(getDriverRideStage(nextRide, ratedRideIdsRef.current));
      }
    } catch (error) {
      if (!silent) toast.error(error.message || "Could not refresh driver rides");
    } finally {
      ridesSyncInFlightRef.current = false;
      if (!silent) setRefreshing(false);
    }
  };

  const refreshIncomingRequest = async () => {
    if (incomingSyncInFlightRef.current) return;
    if (document.visibilityState === "hidden") return;
    incomingSyncInFlightRef.current = true;
    try {
      const req = await getIncomingRideRequest();
      setIncomingRequest(req || null);
    } catch {
      setIncomingRequest(null);
    } finally {
      incomingSyncInFlightRef.current = false;
    }
  };

  const refreshDriverPanel = async ({ silent = false } = {}) => {
    await Promise.all([refreshRides({ silent }), refreshIncomingRequest()]);
  };

  useEffect(() => {
    saveRatedRideIds(ratedRideIds);
  }, [ratedRideIds]);

  useEffect(() => {
    if (!currentRide) return;
    if (rideStage === "rating") return;
    const nextStage = getDriverRideStage(currentRide, ratedRideIds);
    if (nextStage !== rideStage) setRideStage(nextStage);
  }, [currentRide, ratedRideIds, rideStage]);

  useEffect(() => {
    if (!isDriver) return undefined;
    refreshWallet();
  }, [isDriver]);

  useEffect(() => {
    if (!isDriver) return undefined;
    refreshDriverPanel();
    const intervalId = window.setInterval(() => {
      refreshDriverPanel({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [isDriver, toast]);

  useEffect(() => {
    if (!isDriver) return undefined;
    refreshRides({ silent: true });
  }, [ratedRideIds, isDriver]);

  // FIX BUG-02: Send driver location immediately on mount (one-shot getCurrentPosition)
  // before starting the continuous watchPosition. Without this, a newly-opened driver
  // panel has NULL location in the DB for the first 5-30 seconds, making the driver
  // invisible to all ride-request matching queries during that window.
  useEffect(() => {
    if (!isDriver || !navigator.geolocation) return undefined;

    // Immediate one-shot — fast, low accuracy is fine just to register the driver
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateDriverLocation(
          position.coords.longitude,
          position.coords.latitude
        ).catch(() => {});
      },
      (err) => console.warn("Initial driver location fix failed:", err),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
    );

    // Continuous high-accuracy watch for ongoing location updates
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        updateDriverLocation(
          position.coords.longitude,
          position.coords.latitude
        ).catch(() => {});
      },
      (error) => console.error("Location watch error:", error),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isDriver]);

  const handleAction = async (fn, successMsg, onSuccess) => {
    setActionLoading(true);
    try {
      const res = await fn();
      const nextRide = res || currentRide;
      setCurrentRide(nextRide);
      setRideStage(getDriverRideStage(nextRide, ratedRideIdsRef.current));
      toast.success(successMsg);
      if (onSuccess) onSuccess(nextRide);
      await refreshDriverPanel({ silent: true });
    } catch (error) {
      toast.error(error.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = (reqIdParam) => {
    const requestId = Number(reqIdParam);
    if (!requestId) {
      toast.error("Invalid ride request ID");
      return;
    }
    handleAction(
      () => acceptRide(requestId),
      "Ride accepted!",
      (ride) => {
        // FIX BUG-01: Removed fetch('/api/mock/clear') — that was a dev-only
        // Vite middleware endpoint that doesn't exist in production.
        setIncomingRequest(null);
        setCurrentRide(ride);
        setRideStage(getDriverRideStage(ride, ratedRideIdsRef.current));
        setOtp("");
      }
    );
  };

  const handleStart = () => {
    const rideId = Number(currentRide?.id);
    const normalizedOtp = normalizeOtpValue(otp);
    const expectedOtp = normalizeOtpValue(currentRide?.otp);

    if (!rideId) { toast.error("No confirmed ride selected"); return; }
    if (!normalizedOtp) { toast.error("Enter the rider OTP before starting the trip"); return; }
    if (expectedOtp && normalizedOtp !== expectedOtp) {
      toast.error("Entered OTP does not match the confirmed trip OTP");
      return;
    }

    handleAction(
      () => startRide(rideId, normalizedOtp),
      "Ride started!",
      () => { setRideStage("started"); setOtp(""); }
    );
  };

  const handleEnd = () => {
    const rideId = Number(currentRide?.id);
    if (!rideId) { toast.error("No ongoing ride selected"); return; }

    setActionLoading(true);
    endRide(rideId)
      .then((res) => {
        const nextRide = res || currentRide;
        setCurrentRide(nextRide);
        setRideStage("ended");
        toast.success("Ride ended!");
        refreshWallet({ silent: true }).catch(() => {});
        refreshDriverPanel({ silent: true }).catch(() => {});
      })
      .catch((error) => {
        const message = error.message || "Action failed";
        const normalized = message.toLowerCase();
        const paymentMethod = String(currentRide?.paymentMethod || "").toUpperCase();
        if (normalized.includes("insufficient") && normalized.includes("balance")) {
          if (paymentMethod === "CASH") {
            toast.error("Cash rides should end without wallet deduction. Check backend logs.");
            return;
          }
          if (paymentMethod === "WALLET") {
            toast.error("Rider wallet balance is too low to end this ride.");
            return;
          }
        }
        toast.error(message);
      })
      .finally(() => setActionLoading(false));
  };

  const handleCancel = () => {
    const rideId = Number(currentRide?.id);
    if (!rideId) { toast.error("No confirmed ride selected"); return; }
    handleAction(
      () => cancelRideDriver(rideId),
      "Ride cancelled",
      () => { setCurrentRide(null); setRideStage("idle"); setOtp(""); }
    );
  };

  const handleWalletAction = async () => {
    const amount = Number.parseFloat(walletAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid wallet amount");
      return;
    }
    setWalletActionLoading(true);
    try {
      const response = await withdrawMoneyFromDriverWallet(amount);
      setWallet(response);
      setWalletAmount("");
      toast.success("Money withdrawn from driver wallet");
      await refreshWallet({ silent: true });
    } catch (error) {
      toast.error(error.message || "Wallet action failed");
    } finally {
      setWalletActionLoading(false);
    }
  };

  const mergedWalletTransactions = useMemo(() => {
    const tx = wallet?.transactions ? [...wallet.transactions] : [];
    if (liveRides && liveRides.length > 0) {
      const cashRides = liveRides.filter(
        (r) => r.paymentMethod === "CASH" && r.rideStatus === "ENDED"
      );
      cashRides.forEach((ride) => {
        const driverEarnings = getDriverEarnings(ride.fare);
        if (!tx.find((t) => t.id === `cash_${ride.id}`)) {
          tx.push({
            id: `cash_${ride.id}`,
            transactionType: "CREDIT",
            transactionMethod: "CASH_HANDOVER",
            amount: driverEarnings,
            timeStamp: ride.endedAt || ride.createdTime || new Date().toISOString(),
            ride,
          });
        }
      });
      return tx.sort((a, b) => new Date(b.timeStamp) - new Date(a.timeStamp));
    }
    return tx;
  }, [wallet, liveRides]);

  const handleRate = async () => {
    const rideId = Number(currentRide?.id);
    if (!rideId) { toast.error("No ended ride selected"); return; }
    setActionLoading(true);
    try {
      await rateRiderByBody(rideId, rating);
      toast.success("Rider rated!");
      setRatedRideIds((current) =>
        current.includes(rideId) ? current : [...current, rideId]
      );
      setCurrentRide(null);
      setRideStage("idle");
      setRating(0);
      await refreshDriverPanel({ silent: true });
    } catch (error) {
      const msg = error.message || "";
      if (
        msg.toLowerCase().includes("already") ||
        msg.toLowerCase().includes("not rate again")
      ) {
        setRatedRideIds((current) =>
          current.includes(rideId) ? current : [...current, rideId]
        );
        setCurrentRide(null);
        setRideStage("idle");
        setRating(0);
        await refreshDriverPanel({ silent: true });
      } else {
        toast.error(msg || "Action failed");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkipRating = () => {
    const rideId = Number(currentRide?.id);
    if (rideId)
      setRatedRideIds((current) =>
        current.includes(rideId) ? current : [...current, rideId]
      );
    setCurrentRide(null);
    setRideStage("idle");
    setRating(0);
  };

  const isCurrentRideRated =
    ratedRideIds.includes(Number(currentRide?.id)) || currentRide?.riderRating != null;
  const activeDriverRides = liveRides.filter((ride) =>
    [RIDE_STATUS.CONFIRMED, RIDE_STATUS.ONGOING].includes(
      normalizeRideStatus(ride.rideStatus)
    )
  ).length;
  const completedDriverRides = liveRides.filter(
    (ride) => normalizeRideStatus(ride.rideStatus) === RIDE_STATUS.ENDED
  ).length;
  const availableRequestCount = incomingRequest ? 1 : 0;

  if (!isDriver) {
    return (
      <div className="fade-in">
        <div className="header-banner premium-hero-panel">
          <div className="animated-grid" />
          <h1>Access Denied</h1>
        </div>
        <div className="page-content">
          <div className="card center">
            <div className="emoji-large">🚫</div>
            <h3>Only drivers can access this panel</h3>
            <p className="hint-text">Please switch to driver mode or go back to dashboard</p>
            <button className="btn btn-dark btn-full" onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div
        className="premium-hero-panel"
        style={{
          background: "var(--chrome-bg)",
          padding: "2.5rem 1.5rem 4.5rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div className="animated-grid" />
        <div
          className="app-orb"
          style={{
            position: "absolute",
            bottom: -72,
            right: -20,
            width: 260,
            height: 260,
            background: "var(--brand)",
            borderRadius: "50%",
            opacity: 0.07,
          }}
        />
        <div
          className="app-orb alt"
          style={{ top: -36, left: "10%", width: 170, height: 170, background: "#fff" }}
        />
        <div className="page-wrap">
          <span className="badge badge-yellow" style={{ marginBottom: "0.75rem" }}>
            🚘 Driver
          </span>
          <h1 style={{ color: "#fff", fontSize: "2rem", letterSpacing: "-1px" }}>Driver panel</h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.92rem", marginTop: "0.5rem" }}>
            Your rides refresh automatically every 2 seconds
          </p>
        </div>
      </div>

      <div className="app-shell-content">
        <div className="page-wrap">
          <div className="info-grid overlap-stack" style={{ marginBottom: "1.5rem" }}>
            <div className="info-tile">
              <div className="info-tile-label">Live requests</div>
              <div className="info-tile-value">{availableRequestCount}</div>
            </div>
            <div className="info-tile">
              <div className="info-tile-label">Active rides</div>
              <div className="info-tile-value">{activeDriverRides}</div>
            </div>
            <div className="info-tile">
              <div className="info-tile-label">Completed rides</div>
              <div className="info-tile-value">{completedDriverRides}</div>
            </div>
            <div className="info-tile">
              <div className="info-tile-label">Wallet balance</div>
              <div className="info-tile-value">
                {walletLoading ? "..." : formatCurrency(wallet?.balance)}
              </div>
            </div>
          </div>

          {/* Wallet section */}
          <div className="card premium-card fade-in" style={{ marginBottom: "1.25rem" }}>
            <div className="section-heading">
              <div className="section-heading-copy">
                <h3>Driver wallet</h3>
                <p>Wallet ride earnings land here automatically. Withdraw whenever you are ready.</p>
              </div>
              <span className="badge badge-blue" style={{ display: "flex", alignItems: "center", height: 28 }}>
                {walletLoading ? (
                  <div className="skeleton-shimmer" style={{ width: 60, height: 14, borderRadius: 4 }} />
                ) : (
                  formatCurrency(wallet?.balance)
                )}
              </span>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: wallet?.transactions?.length ? "1rem" : 0 }}>
              <input
                className="input-field"
                placeholder="Enter withdrawal amount"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                style={{ flex: 1, minWidth: 220 }}
              />
              <button className="btn btn-ghost" onClick={handleWalletAction} disabled={walletActionLoading}>
                {walletActionLoading ? <span className="spinner" /> : "Withdraw"}
              </button>
            </div>

            {!!mergedWalletTransactions?.length && (
              <div style={{ display: "grid", gap: 10 }}>
                {mergedWalletTransactions.slice(0, 3).map((transaction) => (
                  <div
                    key={transaction.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      padding: "0.9rem 1rem",
                      borderRadius: 14,
                      background: "var(--surface)",
                      border: "1px solid var(--surface-2)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>
                        {transaction.transactionMethod === "CASH_HANDOVER"
                          ? `${formatRideId(transaction.ride?.id)} (CASH)`
                          : transaction.ride?.id
                          ? formatRideId(transaction.ride.id)
                          : transaction.transactionMethod}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 4 }}>
                        {transaction.transactionMethod === "CASH_HANDOVER"
                          ? "In-Person Cash Collection"
                          : transaction.transactionType}{" "}
                        • {transaction.timeStamp ? formatDateTime(transaction.timeStamp) : "Just now"}
                      </div>
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        color: transaction.transactionType === "CREDIT" ? "#0b8f55" : "#a93d3d",
                      }}
                    >
                      {transaction.transactionType === "CREDIT" ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Incoming ride request */}
          {!(rideStage === "accepted" || rideStage === "started") && incomingRequest && (
            <div
              className="card premium-card fade-in"
              style={{ marginBottom: "1.25rem", border: "2px solid var(--brand)" }}
            >
              <div className="section-heading">
                <div className="section-heading-copy">
                  <h3 style={{ marginBottom: 4 }}>🚨 New ride request!</h3>
                  <p>A rider nearby is looking for an empty cab.</p>
                </div>
                <span className={`badge ${refreshing ? "badge-blue" : "badge-gray"}`}>
                  {refreshing ? "Refreshing..." : "Live"}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ padding: "12px", background: "var(--surface-2)", borderRadius: 12 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <div className="route-dot dot-pickup" />
                    <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>
                      <LocationName coords={incomingRequest.pickupLocation?.coordinates} />
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div className="route-dot dot-drop" />
                    <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>
                      <LocationName coords={incomingRequest.dropOffLocation?.coordinates} />
                    </span>
                  </div>
                  <div style={{ height: "180px", margin: "1rem 0" }}>
                    <RideMap
                      pickup={{
                        lng: incomingRequest.pickupLocation?.coordinates[0],
                        lat: incomingRequest.pickupLocation?.coordinates[1],
                      }}
                      drop={{
                        lng: incomingRequest.dropOffLocation?.coordinates[0],
                        lat: incomingRequest.dropOffLocation?.coordinates[1],
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 12, fontWeight: 700, fontSize: "1.2rem", fontFamily: "Clash Display" }}>
                    {incomingRequest.fare
                      ? `₹${getDriverEarnings(incomingRequest.fare).toFixed(0)}`
                      : "Fare pending"}
                    <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--muted)", marginLeft: 8 }}>
                      via {incomingRequest.paymentMethod}
                    </span>
                    {incomingRequest.fare && (
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 400, marginTop: 2 }}>
                        Your earnings · {commissionLabel}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-dark hover-lift"
                    onClick={() => handleAccept(incomingRequest.id)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <span className="spinner spinner-white" /> : "Accept request →"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setIncomingRequest(null)}
                    disabled={actionLoading}
                  >
                    Ignore
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Current ride details */}
          {currentRide && (
            <div className="card premium-card ride-info" style={{ marginBottom: "1.25rem" }}>
              <div className="section-heading">
                <div className="section-heading-copy">
                  <h3>
                    Selected trip {formatRideId(currentRide.id)}
                  </h3>
                  <p>
                    Rider:{" "}
                    {currentRide.rider?.user?.name ||
                      (currentRide.rider?.id ? formatRiderId(currentRide.rider.id) : "N/A")}
                    {currentRide.rider?.user?.phoneNumber && (
                      <a
                        href={`tel:${toDialablePhoneNumber(currentRide.rider.user.phoneNumber)}`}
                        style={{ marginLeft: 8, color: "var(--text-primary)" }}
                      >
                        📞 {formatPhoneNumber(currentRide.rider.user.phoneNumber)}
                      </a>
                    )}
                  </p>
                </div>
                <span className={`badge ${getRideStatusBadgeClass(currentRide.rideStatus)}`}>
                  {currentRide.rideStatus}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", gap: 6 }}>
                  📍 Pickup:{" "}
                  <strong>
                    <LocationName coords={currentRide.pickupLocation?.coordinates} />
                  </strong>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  🏁 Drop:{" "}
                  <strong>
                    <LocationName coords={currentRide.dropOffLocation?.coordinates} />
                  </strong>
                </div>
                <div>
                  💳 Payment: <strong>{currentRide.paymentMethod || "Unknown"}</strong>
                </div>
                <div>
                  💰 Your earnings:{" "}
                  <strong>
                    {currentRide.fare ? `₹${getDriverEarnings(currentRide.fare).toFixed(0)}` : "Pending"}
                  </strong>
                  {currentRide.fare && (
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)", marginLeft: 6, fontWeight: 400 }}>
                      ({commissionLabel})
                    </span>
                  )}
                </div>
              </div>
              <div style={{ height: "240px", marginTop: "1rem" }}>
                <RideMap
                  pickup={{
                    lng: currentRide.pickupLocation?.coordinates[0],
                    lat: currentRide.pickupLocation?.coordinates[1],
                  }}
                  drop={{
                    lng: currentRide.dropOffLocation?.coordinates[0],
                    lat: currentRide.dropOffLocation?.coordinates[1],
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ marginTop: "1.25rem" }}>
            <SupportPanel
              compact
              contextLabel="my current driver trip"
              title="Need operations support?"
              description="Use BookCar support if you cannot reach the rider, need help with a ride state, or have a safety concern."
            />
          </div>

          {rideStage === "accepted" && (
            <div className="status-card fade-in" style={{ marginBottom: "1.25rem" }}>
              <h3>Start the ride</h3>
              <p className="hint-text" style={{ marginTop: 6, marginBottom: "1rem" }}>
                Ask the rider for the OTP before starting.
              </p>
              <div style={{ marginBottom: "1rem" }}>
                <label className="label">Rider OTP</label>
                <input
                  className="input-field"
                  placeholder="4-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(normalizeOtpValue(e.target.value))}
                  maxLength={6}
                />
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button className="btn btn-success" onClick={handleStart} disabled={actionLoading || !otp}>
                  {actionLoading ? <span className="spinner spinner-white" /> : "Start ride"}
                </button>
                <button
                  className="btn btn-outline hover-shrink"
                  style={{ color: "var(--text-primary)", borderColor: "var(--surface-2)" }}
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${currentRide?.pickupLocation?.coordinates[1]},${currentRide?.pickupLocation?.coordinates[0]}&travelmode=driving`,
                      "_blank"
                    )
                  }
                >
                  🗺️ Navigate to Pickup
                </button>
                <button className="btn btn-danger" onClick={handleCancel} disabled={actionLoading}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {rideStage === "started" && (
            <div className="status-card fade-in center" style={{ marginBottom: "1.25rem" }}>
              <div className="emoji-large">🚗</div>
              <h3>Ride in progress</h3>
              <p className="hint-text" style={{ marginTop: 6, marginBottom: "1rem" }}>
                End the ride once you reach the destination.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn btn-primary" onClick={handleEnd} disabled={actionLoading}>
                  {actionLoading ? <span className="spinner" /> : "End ride"}
                </button>
                <button
                  className="btn btn-dark hover-shrink"
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${currentRide?.dropOffLocation?.coordinates[1]},${currentRide?.dropOffLocation?.coordinates[0]}&travelmode=driving`,
                      "_blank"
                    )
                  }
                >
                  🗺️ Navigate to Dropoff
                </button>
              </div>
            </div>
          )}

          {rideStage === "ended" && !isCurrentRideRated && (
            <div className="status-card fade-in center" style={{ marginBottom: "1.25rem" }}>
              <div className="emoji-large">🏁</div>
              <h3>Ride ended</h3>
              <p className="hint-text" style={{ marginTop: 6, marginBottom: "1rem" }}>
                Rate your rider to complete the trip.
              </p>
              <DriverRouteSummary ride={currentRide} />
              <div style={{ marginBottom: "1rem" }}>
                Fare earned:{" "}
                <strong>
                  {currentRide?.fare ? `₹${getDriverEarnings(currentRide.fare).toFixed(0)}` : "Pending"}
                </strong>
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn btn-primary" onClick={() => setRideStage("rating")}>
                  Rate rider
                </button>
                <button className="btn btn-outline hover-shrink" onClick={handleSkipRating}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {rideStage === "rating" && (
            <div className="status-card fade-in center" style={{ marginBottom: "1.25rem" }}>
              <div className="emoji-large">⭐</div>
              <h3>Rate your rider</h3>
              <p className="hint-text" style={{ marginTop: 6, marginBottom: "1rem" }}>
                How was {currentRide?.rider?.user?.name || "your rider"}?
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: "1rem" }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "2rem",
                      cursor: "pointer",
                      color: star <= rating ? "var(--brand-dark)" : "#d0cec3",
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
              <div
                style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: "1rem" }}
              >
                <button className="btn btn-dark" onClick={handleRate} disabled={actionLoading || !rating}>
                  {actionLoading ? <span className="spinner spinner-white" /> : "Submit rating"}
                </button>
                <button className="btn btn-outline hover-shrink" onClick={handleSkipRating} disabled={actionLoading}>
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Ride history */}
          <div
            className="card premium-card fade-in"
            style={{ marginTop: "2rem", marginBottom: "2rem", padding: "1.5rem" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.25rem",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <h3 style={{ fontSize: "1.1rem", marginBottom: 4 }}>Ride history</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  A complete log of your recent assignments and past trips.
                </p>
              </div>
              <span className={`badge ${refreshing ? "badge-blue" : "badge-gray"}`}>
                {refreshing ? "Syncing..." : `${liveRides.length} records`}
              </span>
            </div>

            {liveRides.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🛣️</div>
                <p style={{ fontWeight: 600 }}>No ride history found</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {liveRides.map((ride) => {
                  const status = normalizeRideStatus(ride.rideStatus);
                  const isCompleted =
                    status === RIDE_STATUS.ENDED || status === RIDE_STATUS.CANCELLED;
                  const isSelected = ride.id === currentRide?.id;

                  return (
                    <button
                      key={ride.id}
                      onClick={() => {
                        setCurrentRide(ride);
                        setRideStage(getDriverRideStage(ride, ratedRideIdsRef.current));
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        background: isSelected ? "var(--surface-2)" : "var(--surface)",
                        border: `1px solid ${isSelected ? "var(--brand)" : "var(--outline)"}`,
                        borderRadius: 12,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}
                        >
                          <span style={{ fontFamily: "Clash Display", fontWeight: 600 }}>
                            {formatRideId(ride.id)}
                          </span>
                          <span
                            className={`badge ${getRideStatusBadgeClass(ride.rideStatus)}`}
                            style={{ padding: "2px 6px", fontSize: "0.65rem" }}
                          >
                            {ride.rideStatus}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--muted)",
                            display: "flex",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <span>Rider: {ride.rider?.user?.name || "Unknown"}</span>
                          <span>{ride.createdTime ? formatDateTime(ride.createdTime) : "Recent"}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", paddingLeft: 16 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            color: isCompleted ? "var(--text-primary)" : "var(--muted)",
                          }}
                        >
                          {ride.fare ? `₹${getDriverEarnings(ride.fare).toFixed(0)}` : "—"}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--muted)",
                            marginTop: 2,
                            textTransform: "uppercase",
                          }}
                        >
                          {ride.paymentMethod || "N/A"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
