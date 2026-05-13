import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  cancelRideRequestRider,
  cancelRideRider,
  estimateRideFare,
  getRiderWallet,
  getRiderRides,
  rateDriverByBody,
  requestRide,
  verifyRidePayment,
} from "../services/api";
import LocationAutocomplete from "../components/LocationAutocomplete";
import LocationName from "../components/LocationName";
import RideMap from "../components/RideMap";
import SupportPanel from "../components/SupportPanel";
import { FiCrosshair, FiMapPin } from "react-icons/fi";
import { formatRideId } from "../utils/formatId";
import { formatPhoneNumber, toDialablePhoneNumber } from "../utils/phone";
import { getWalletBalance } from "../utils/wallet";
import { riderWalletUpdatedEventName } from "../utils/walletEvents";
import {
  RIDE_REQUEST_STATUS,
  RIDE_STATUS,
  getRideRequestStatusBadgeClass,
  getRideStatusBadgeClass,
  isRideCancelable,
  isRideOngoing,
  isRideRateable,
  normalizeRideStatus,
} from "../constants/rideStatus";

const PAYMENT_METHODS = ["CASH", "WALLET", "RAZORPAY"];
const POLL_INTERVAL_MS = 2000;
const SAME_LOCATION_TOLERANCE = 0.000001;
const formatCurrency = (amount) => `₹${Number(amount || 0).toFixed(2)}`;

const areSameCoords = (left = [], right = []) =>
  left.length === right.length &&
  left.every((value, index) => Number(value).toFixed(6) === Number(right[index]).toFixed(6));

const parseCoordinate = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toRadians = (value) => (value * Math.PI) / 180;

const calculateDistanceInKm = (pickup, drop) => {
  const earthRadiusKm = 6371;
  const latDistance = toRadians(drop.lat - pickup.lat);
  const lngDistance = toRadians(drop.lng - pickup.lng);
  const originLat = toRadians(pickup.lat);
  const destinationLat = toRadians(drop.lat);

  const haversine =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(lngDistance / 2) ** 2;

  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadiusKm * arc;
};

const getFallbackEstimatedFare = (pickup, drop) => {
  const distanceInKm = calculateDistanceInKm(pickup, drop);
  const baseFare = 65;
  const perKmFare = 18;
  const bookingFee = 24;

  return Math.max(99, Math.round(baseFare + distanceInKm * perKmFare + bookingFee));
};

const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not supported on this device"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000,
    });
  });

const getShortAddress = async (lat, lng) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        signal: controller.signal,
        headers: { "Accept-Language": "en" },
      }
    );
    const data = await res.json();
    return data.display_name?.split(",").slice(0, 3).join(", ") || "Current location";
  } finally {
    clearTimeout(timeoutId);
  }
};

const normalizeOtpValue = (value = "") => String(value).replace(/\D/g, "");

const areLocationsTooClose = (pickup, drop) =>
  Math.abs(pickup.lat - drop.lat) < SAME_LOCATION_TOLERANCE &&
  Math.abs(pickup.lng - drop.lng) < SAME_LOCATION_TOLERANCE;

const matchesRequestedRide = (ride, request) => {
  if (!ride || !request) return false;

  return (
    areSameCoords(ride.pickupLocation?.coordinates, request.pickupLocation?.coordinates) &&
    areSameCoords(ride.dropOffLocation?.coordinates, request.dropOffLocation?.coordinates) &&
    ride.paymentMethod === request.paymentMethod
  );
};

const isActiveResolvedRide = (ride) => {
  const status = normalizeRideStatus(ride?.rideStatus);
  return status === RIDE_STATUS.CONFIRMED || status === RIDE_STATUS.ONGOING;
};

import { useNavigate, useLocation } from "react-router-dom";

export default function BookRidePage({ toast }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isRider } = useAuth();
  const [step, setStep] = useState("form");
  const [loading, setLoading] = useState(false);
  const [requestRefreshLoading, setRequestRefreshLoading] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [resolvedRide, setResolvedRide] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [rating, setRating] = useState(0);
  const [rebookLoading, setRebookLoading] = useState(false);
  const [farePreview, setFarePreview] = useState(null);
  const [farePreviewLoading, setFarePreviewLoading] = useState(false);
  const [findingDriverTimeout, setFindingDriverTimeout] = useState(false);
  const [findingDriverStartTime, setFindingDriverStartTime] = useState(null);
  const [currentLocationLoading, setCurrentLocationLoading] = useState(false);
  const [razorpayPaymentLoading, setRazorpayPaymentLoading] = useState(false);
  const [razorpayPaid, setRazorpayPaid] = useState(false);
  const cancelInFlightRef = useRef(false);
  const fareFallbackNoticeShownRef = useRef(false);

  const [form, setForm] = useState({
    pickupLocation: null,
    dropLocation: null,
    paymentMethod: "CASH",
  });

  useEffect(() => {
    let cancelled = false;

    const loadWallet = async () => {
      try {
        const wallet = await getRiderWallet();
        if (!cancelled) {
          setWalletBalance(getWalletBalance(wallet));
        }
      } catch {
        if (!cancelled) {
          setWalletBalance(null);
        }
      }
    };

    loadWallet();

    const handleWalletRefresh = () => {
      loadWallet();
    };

    const handleWindowFocus = () => {
      loadWallet();
    };

    window.addEventListener(riderWalletUpdatedEventName, handleWalletRefresh);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      cancelled = true;
      window.removeEventListener(riderWalletUpdatedEventName, handleWalletRefresh);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  useEffect(() => {
    let ride = location.state?.rebookRide;
    const raw = sessionStorage.getItem("rebook_ride");

    if (!ride && raw) {
      try {
        ride = JSON.parse(raw);
      } catch (e) {}
    }

    if (ride) {
      sessionStorage.removeItem("rebook_ride");
      window.history.replaceState({}, '');
      
      if (ride.pickupLocation?.coordinates && ride.dropOffLocation?.coordinates) {
        setRebookLoading(true);
          const pLat = ride.pickupLocation.coordinates[1];
          const pLng = ride.pickupLocation.coordinates[0];
          const dLat = ride.dropOffLocation.coordinates[1];
          const dLng = ride.dropOffLocation.coordinates[0];

          setForm(prev => ({
            ...prev,
            pickupLocation: { lng: pLng, lat: pLat, address: "Loading pickup..." },
            dropLocation: { lng: dLng, lat: dLat, address: "Loading destination..." }
          }));

          const fetchAddresses = async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);

            try {
              const [pRes, dRes] = await Promise.all([
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pLat}&lon=${pLng}`, {
                  signal: controller.signal,
                  headers: { 'Accept-Language': 'en' }
                }),
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${dLat}&lon=${dLng}`, {
                  signal: controller.signal,
                  headers: { 'Accept-Language': 'en' }
                })
              ]);
              clearTimeout(timeoutId);
              const pData = await pRes.json();
              const dData = await dRes.json();

              setForm(prev => ({
                ...prev,
                pickupLocation: { lng: pLng, lat: pLat, address: pData.display_name?.split(',').slice(0,2).join(', ') || "Saved location" },
                dropLocation: { lng: dLng, lat: dLat, address: dData.display_name?.split(',').slice(0,2).join(', ') || "Saved location" }
              }));
            } catch (err) {
              setForm(prev => ({
                ...prev,
                pickupLocation: { lng: pLng, lat: pLat, address: "Saved location" },
                dropLocation: { lng: dLng, lat: dLat, address: "Saved location" }
              }));
            } finally {
              setRebookLoading(false);
            }
          };

          fetchAddresses();
        }
    }
  }, []);

  useEffect(() => {
    if (step !== "pending" || !activeRequest) return undefined;

    let cancelled = false;
    let timeoutId;
    const startTime = Date.now();

    const syncCurrentRide = async (silent = false) => {
      // Pause polling if the tab is not active
      if (!cancelled && document.visibilityState === 'hidden') {
         timeoutId = setTimeout(() => syncCurrentRide(true), 3000);
         return;
      }

      if (!silent) setRequestRefreshLoading(true);

      try {
        const res = await getRiderRides(0, 10);
        if (cancelled) return;

        const rides = res?.content || [];
        const matchingRide = resolvedRide?.id
          ? rides.find((ride) => ride.id === resolvedRide.id) || null
          : rides.find((ride) => isActiveResolvedRide(ride) && matchesRequestedRide(ride, activeRequest)) || null;
        setResolvedRide(matchingRide);
      } catch (error) {
        if (!cancelled && !silent) {
          toast.error(error.message || "Could not refresh your ride");
        }
      } finally {
        if (!cancelled) {
          if (!silent) setRequestRefreshLoading(false);
          
          let nextInterval = 3000;
          const elapsed = Date.now() - startTime;
          // Scale backoff if waiting purely in PENDING state
          if (!resolvedRide || (resolvedRide.rideStatus || "").toUpperCase() === "PENDING") {
             if (elapsed > 60000) nextInterval = 15000;
             else if (elapsed > 30000) nextInterval = 10000;
          }
          
          timeoutId = setTimeout(() => syncCurrentRide(true), nextInterval);
        }
      }
    };

    syncCurrentRide();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [step, activeRequest, resolvedRide?.id, toast]);

  useEffect(() => {
    if (step === "pending" && activeRequest && !resolvedRide) {
      if (!findingDriverStartTime) {
        setFindingDriverStartTime(Date.now());
        setFindingDriverTimeout(false);
        return;
      }
      const interval = setInterval(() => {
        if (Date.now() - findingDriverStartTime >= 120000) {
          setFindingDriverTimeout(true);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step, activeRequest, resolvedRide, findingDriverStartTime]);

  if (!isRider) {
    return (
      <div className="animate-page-enter">
        <div className="header-banner premium-hero-panel">
          <div className="animated-grid" />
          <h1>Access Denied</h1>
        </div>
        <div className="page-content">
          <div className="card center">
            <div className="emoji-large">🚫</div>
            <h3>Only riders can book rides</h3>
            <p className="hint-text">
              Please switch to rider mode or go back to dashboard
            </p>
            <button
              className="btn btn-dark btn-full"
              onClick={() => navigate("/dashboard")}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleUseCurrentPickup = async () => {
    setCurrentLocationLoading(true);

    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      let address = "Current location";

      try {
        address = await getShortAddress(latitude, longitude);
      } catch {
        address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      }

      setForm((current) => ({
        ...current,
        pickupLocation: {
          lat: latitude,
          lng: longitude,
          address,
          source: "current-location",
        },
      }));
      toast.success("Pickup set to your current location");
    } catch (error) {
      const permissionDenied = error?.code === 1;
      toast.error(
        permissionDenied
          ? "Location permission was blocked. Allow location access or type your pickup."
          : error?.message || "Could not get your current location"
      );
    } finally {
      setCurrentLocationLoading(false);
    }
  };

  useEffect(() => {
    if (!form.pickupLocation?.lat || !form.dropLocation?.lat) {
      if (farePreview) {
        setFarePreview(null);
      }
      return;
    }

    const pickupCoords = form.pickupLocation;
    const dropCoords = form.dropLocation;

    if (areLocationsTooClose(pickupCoords, dropCoords)) {
      if (farePreview) {
        setFarePreview(null);
      }
      return;
    }

    let cancelled = false;
    const payload = {
      pickupLocation: {
        type: "Point",
        coordinates: [pickupCoords.lng, pickupCoords.lat],
      },
      dropOffLocation: {
        type: "Point",
        coordinates: [dropCoords.lng, dropCoords.lat],
      },
      paymentMethod: form.paymentMethod,
    };

    const syncFarePreview = async () => {
      setFarePreviewLoading(true);
      try {
        const response = await estimateRideFare(payload);
        if (cancelled) return;

        setFarePreview((current) => {
          if (
            current &&
            current.fare === response?.fare &&
            current.paymentMethod === response?.paymentMethod
          ) {
            return current;
          }

          return {
            fare: response?.fare,
            paymentMethod: response?.paymentMethod || form.paymentMethod,
          };
        });
      } catch (error) {
        if (!cancelled) {
          const fallbackFare = getFallbackEstimatedFare(pickupCoords, dropCoords);

          setFarePreview({
            fare: fallbackFare,
            paymentMethod: form.paymentMethod,
          });

          if (
            (error?.status === 404 ||
              String(error?.message || "").toLowerCase().includes("no static resource riders/estimatefare")) &&
            !fareFallbackNoticeShownRef.current
          ) {
            fareFallbackNoticeShownRef.current = true;
            toast.info("Backend fare preview is not active yet. Restart the backend to sync preview and final price.");
          } else if (error?.status !== 404) {
            toast.error(error.message || "Could not estimate fare");
          }
        }
      } finally {
        if (!cancelled) {
          setFarePreviewLoading(false);
        }
      }
    };

    syncFarePreview();

    return () => {
      cancelled = true;
    };
  }, [form.pickupLocation, form.dropLocation, form.paymentMethod, toast]);

  const handleRequest = async () => {
    if (!form.pickupLocation?.lat || !form.dropLocation?.lat) {
      toast.error("Please select both pickup and dropoff locations from the suggestions");
      return;
    }

    setLoading(true);

    const pickupCoords = form.pickupLocation;
    const dropCoords = form.dropLocation;

    if (areLocationsTooClose(pickupCoords, dropCoords)) {
      toast.error("Pickup and dropoff locations are too close or identical");
      setLoading(false);
      return;
    }

    if (!farePreview) {
      toast.error("Please preview the fare before booking the ride");
      setLoading(false);
      return;
    }

    const payload = {
      pickupLocation: {
        type: "Point",
        coordinates: [pickupCoords.lng, pickupCoords.lat],
      },
      dropOffLocation: {
        type: "Point",
        coordinates: [dropCoords.lng, dropCoords.lat],
      },
      paymentMethod: form.paymentMethod,
    };

    try {
      const res = await requestRide(payload);
      if (!res || Number(res.fare) <= 0) {
        toast.error("Please enter valid pickup and dropoff coordinates");
        return;
      }
      if (
        form.paymentMethod === "WALLET" &&
        walletBalance !== null &&
        Number(res.fare) > Number(walletBalance)
      ) {
        toast.error(
          `Insufficent funds to book a ride`,
        );
        return;
      }
      
      // Broadcast this request to the vite proxy to simulate real-time notifications
      fetch('/api/mock/broadcast', { method: 'POST', body: JSON.stringify(res) }).catch(() => {});

      setActiveRequest(res);
      setResolvedRide(null);
      setFarePreview(null);
      setRazorpayPaid(false);
      setStep("pending");
      setFindingDriverStartTime(Date.now());
      setFindingDriverTimeout(false);
      toast.success("Ride requested! Looking for a driver...");
    } catch (error) {
      toast.error(error.message || "Could not request ride");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (cancelInFlightRef.current) return;

    cancelInFlightRef.current = true;
    setLoading(true);

    try {
      if (!resolvedRide && activeRequest?.id && requestStatus === RIDE_REQUEST_STATUS.PENDING) {
        const cancelledRequest = await cancelRideRequestRider(activeRequest.id);
        fetch('/api/mock/clear', { method: 'POST' }).catch(() => {});
        toast.success("Ride request cancelled");
        setStep("form");
        setActiveRequest(cancelledRequest);
        setResolvedRide(null);
        setFindingDriverStartTime(null);
        setFindingDriverTimeout(false);
        return;
      }

      let rideToCancel = resolvedRide;

      if (!rideToCancel && activeRequest) {
        const res = await getRiderRides(0, 10);
        const rides = res?.content || [];
        rideToCancel =
          rides.find((ride) => isActiveResolvedRide(ride) && matchesRequestedRide(ride, activeRequest)) || null;
        if (rideToCancel) {
          setResolvedRide(rideToCancel);
        }
      }

      const rideId = rideToCancel?.id;

      if (!rideId) {
        toast.error("This ride cannot be cancelled yet. Please wait for driver confirmation.");
        return;
      }

      await cancelRideRider(rideId);
      fetch('/api/mock/clear', { method: 'POST' }).catch(() => {});
      toast.success("Ride cancelled");
      setStep("form");
      setActiveRequest(null);
      setResolvedRide(null);
    } catch (error) {
      const message = error.message || "Cancel failed";
      const normalized = message.toLowerCase();

      if (error?.status === 401 || normalized.includes("unauthorized")) {
        toast.error("Session expired. Please login again.");
        navigate("/login");
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
      cancelInFlightRef.current = false;
    }
  };

  const handleRate = async () => {
    if (!rating) {
      toast.error("Please select a rating");
      return;
    }

    const rideId = resolvedRide?.id;
    if (!rideId) {
      toast.error("No completed ride found to rate");
      return;
    }

    setLoading(true);
    try {
      await rateDriverByBody(rideId, rating);
      toast.success("Thanks for your feedback!");
      setStep("form");
      setActiveRequest(null);
      setResolvedRide(null);
      setRating(0);
    } catch (error) {
      toast.error(error.message || "Rating failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipRating = () => {
    setStep("form");
    setActiveRequest(null);
    setResolvedRide(null);
    setRating(0);
    setRazorpayPaid(false);
  };

  const handleRazorpayRidePayment = async () => {
    const rideId = resolvedRide?.id;
    if (!rideId) return;
    setRazorpayPaymentLoading(true);
    try {
      const order = await createRidePaymentOrder(rideId);
      await new Promise((resolve, reject) => {
        if (window.Razorpay) return resolve();
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Could not load Razorpay SDK'));
        document.body.appendChild(script);
      });
      const options = {
        key: order.key,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'BookCar',
        description: order.description || `Payment for ride #${rideId}`,
        order_id: order.orderId,
        handler: async (response) => {
          try {
            await verifyRidePayment(rideId, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setRazorpayPaid(true);
            toast.success('Payment successful! Receipt emailed to you.');
          } catch (err) {
            toast.error(err.message || 'Payment verification failed');
          } finally {
            setRazorpayPaymentLoading(false);
          }
        },
        prefill: {},
        theme: { color: '#6366f1' },
        modal: { ondismiss: () => setRazorpayPaymentLoading(false) },
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        toast.error('Payment failed: ' + (resp.error?.description || 'Unknown error'));
        setRazorpayPaymentLoading(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(err.message || 'Could not initiate Razorpay payment');
      setRazorpayPaymentLoading(false);
    }
  };

  const visibleStatus = resolvedRide?.rideStatus || activeRequest?.rideRequestStatus || RIDE_REQUEST_STATUS.PENDING;
  const visibleStatusClass = resolvedRide
    ? getRideStatusBadgeClass(visibleStatus)
    : getRideRequestStatusBadgeClass(visibleStatus);
  const displayId = resolvedRide?.id || activeRequest?.id;
  const driver = resolvedRide?.driver;
  const rideStatus = normalizeRideStatus(resolvedRide?.rideStatus);
  const requestStatus = normalizeRideStatus(activeRequest?.rideRequestStatus);
  const canCancelPendingRequest = !resolvedRide && requestStatus === RIDE_REQUEST_STATUS.PENDING;
  const canCancelRide =
    isRideCancelable(rideStatus) ||
    (!resolvedRide &&
      requestStatus === RIDE_REQUEST_STATUS.CONFIRMED);
  const rideOtp = normalizeOtpValue(resolvedRide?.otp);
  const riderActionLabel = isRideRateable(rideStatus)
    ? "Rate your driver"
    : canCancelPendingRequest
      ? "Cancel request"
    : canCancelRide
      ? resolvedRide
        ? "Cancel ride"
        : "Cancel confirmed ride"
      : isRideOngoing(rideStatus)
        ? "Ride in progress"
        : rideStatus === RIDE_STATUS.CANCELLED
          ? "Book another ride"
          : "Waiting for driver";
  const riderActionHint = isRideRateable(rideStatus)
    ? "Your ride has ended. Share a rating to finish the trip."
    : canCancelPendingRequest
      ? "You can cancel while we are finding a driver."
    : canCancelRide
      ? "Your trip is confirmed and can still be cancelled before it starts."
      : isRideOngoing(rideStatus)
        ? "The driver has started the ride, so cancellation is locked."
        : rideStatus === RIDE_STATUS.CANCELLED
      ? "This trip is closed. Start a new booking whenever you are ready."
      : "We will enable cancellation once a driver has confirmed your request.";
  const selectedFare = Number(farePreview?.fare || 0);
  const walletCanCoverPreview = walletBalance !== null && selectedFare > 0 && walletBalance >= selectedFare;
  const walletShortfall =
    walletBalance !== null && selectedFare > 0 ? Math.max(0, selectedFare - walletBalance) : 0;

  return (
    <div className="animate-page-enter">
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
            bottom: -60,
            right: -60,
            width: 240,
            height: 240,
            background: "var(--brand)",
            borderRadius: "50%",
            opacity: 0.07,
          }}
        />
        <div
          className="app-orb alt"
          style={{
            top: -30,
            left: "8%",
            width: 180,
            height: 180,
            background: "#fff",
          }}
        />
        <div className="page-wrap">
          <span className="badge badge-yellow" style={{ marginBottom: "0.75rem" }}>
            🚗 Rider
          </span>
          <h1 style={{ color: "#fff", fontSize: "2rem", letterSpacing: "-1px" }}>
            Book a ride
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.9rem",
              marginTop: "0.5rem",
            }}
          >
            Enter coordinates to find the best driver near you
          </p>
        </div>
      </div>

      <div
        style={{
          background: "var(--surface)",
          marginTop: -24,
          borderRadius: "24px 24px 0 0",
          padding: "2rem 1.5rem 3rem",
        }}
      >
        <div className="page-wrap" style={{ maxWidth: 600 }}>
          {step === "form" && (
            <div className="card premium-card animate-fade-up delay-100">
              <h3
                style={{
                  fontSize: "1.1rem",
                  marginBottom: "1.5rem",
                  letterSpacing: "-0.3px",
                }}
              >
                Where to?
              </h3>

              <div style={{ marginBottom: "1.5rem", height: "260px" }}>
                <RideMap pickup={form.pickupLocation} drop={form.dropLocation} />
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginBottom: "1rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div className="label" style={{ marginBottom: 4 }}>
                      Pickup
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                      Use GPS now, or type another pickup below.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleUseCurrentPickup}
                    disabled={currentLocationLoading || rebookLoading}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                    }}
                  >
                    {currentLocationLoading ? (
                      <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    ) : (
                      <FiCrosshair />
                    )}
                    Current location
                  </button>
                </div>
                <LocationAutocomplete
                  label="📍 Pickup Location"
                  placeholder="e.g. India Gate, New Delhi"
                  value={form.pickupLocation?.address || ""}
                  onSelect={(data) => {
                    setForm(f => ({ ...f, pickupLocation: data }));
                  }}
                  isSkeleton={rebookLoading}
                />
                {form.pickupLocation?.source === "current-location" && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: "var(--muted)",
                      fontSize: "0.78rem",
                      marginTop: -4,
                    }}
                  >
                    <FiMapPin />
                    Using your GPS location. Type in pickup to change it.
                  </div>
                )}
                <LocationAutocomplete
                  label="🏁 Drop Location"
                  placeholder="e.g. Connaught Place, New Delhi"
                  value={form.dropLocation?.address || ""}
                  onSelect={(data) => {
                    setForm(f => ({ ...f, dropLocation: data }));
                  }}
                  isSkeleton={rebookLoading}
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label className="label">Payment method</label>
                <div className="payment-method-grid">
                  {PAYMENT_METHODS.map((method) => {
                    const isWallet = method === "WALLET";
                    const isSelected = form.paymentMethod === method;
                    const isDisabled = isWallet && walletBalance === null;

                    return (
                      <button
                        key={method}
                        type="button"
                        className={`payment-method-card ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""}`}
                        onClick={() => {
                          if (!isDisabled) {
                            set("paymentMethod", method);
                          }
                        }}
                      >
                        <div className="payment-method-topline">
                          <span className="payment-method-icon">{isWallet ? "👛" : "💵"}</span>
                          <span className={`badge ${isSelected ? "badge-yellow" : "badge-gray"}`}>
                            {isSelected ? "Selected" : "Available"}
                          </span>
                        </div>
                        <div className="payment-method-title">{method === "WALLET" ? "Wallet pay" : "Cash pay"}</div>
                        <div className="payment-method-copy">
                          {isWallet
                            ? walletBalance === null
                              ? "Wallet balance is syncing."
                              : `Balance ${formatCurrency(walletBalance)}`
                            : "Pay the driver directly at the end of the trip."}
                        </div>
                        {isWallet && selectedFare > 0 && walletBalance !== null && (
                          <div className={`payment-method-hint ${walletCanCoverPreview ? "ok" : "warn"}`}>
                            {walletCanCoverPreview
                              ? "Ready for this fare"
                              : `Add ${formatCurrency(walletShortfall)} more for wallet`}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="payment-transition-card">
                  <div>
                    <div className="summary-label">Current payment flow</div>
                    <div className="summary-value">
                      {form.paymentMethod === "WALLET" ? "Wallet will be charged automatically" : "Cash will be collected after drop-off"}
                    </div>
                  </div>
                  {form.paymentMethod === "WALLET" && walletBalance !== null && !walletCanCoverPreview && selectedFare > 0 ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate("/profile")}
                    >
                      Top up wallet
                    </button>
                  ) : form.paymentMethod === "WALLET" ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => set("paymentMethod", "CASH")}
                    >
                      Switch to cash
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => set("paymentMethod", "WALLET")}
                      disabled={walletBalance === null}
                    >
                      Try wallet
                    </button>
                  )}
                </div>
              </div>

              {farePreviewLoading ? (
                <div className="premium-card" style={{ padding: "1rem", border: "1px solid var(--premium-border)", marginTop: "0.5rem" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: "0.9rem",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div className="skeleton-shimmer" style={{ width: 88, height: 12, borderRadius: 6, marginBottom: 10 }} />
                      <div className="skeleton-shimmer" style={{ width: 140, height: 34, borderRadius: 8 }} />
                    </div>
                    <div className="skeleton-shimmer" style={{ width: 86, height: 28, borderRadius: 999 }} />
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div className="skeleton-shimmer" style={{ flex: 1, height: 46, borderRadius: 12 }} />
                  </div>
                </div>
              ) : farePreview ? (
                <div
                  className="premium-card"
                  style={{
                    padding: "1rem",
                    border: "1px solid var(--premium-border)",
                    marginTop: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: "0.9rem",
                    }}
                  >
                    <div>
                      <div className="summary-label">Estimated fare</div>
                      <div
                        className="summary-value"
                        style={{
                          fontSize: "1.8rem",
                          fontFamily: "Clash Display",
                          letterSpacing: "-0.04em",
                        }}
                      >
                        ₹{farePreview.fare?.toFixed(0)}
                      </div>
                    </div>
                    <span className="badge badge-yellow">{farePreview.paymentMethod}</span>
                  </div>
                  <div className="button-group">
                    <button
                      className="btn btn-dark flex-1"
                      onClick={handleRequest}
                      disabled={loading}
                    >
                      {loading ? <span className="spinner spinner-white" /> : "Confirm and book ride"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.6 }}>
                  Select both pickup and destination to see the fare preview automatically.
                </div>
              )}
            </div>
          )}

          {step === "pending" && activeRequest && (
            <div className="animate-fade-up delay-100">
              <div
                className="card premium-card"
                style={{
                  borderLeft: "4px solid var(--brand)",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <h3 style={{ letterSpacing: "-0.3px" }}>{formatRideId(displayId)}</h3>
                    <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: 4 }}>
                      {requestRefreshLoading ? "Refreshing ride status..." : "Status synced with backend"}
                    </p>
                  </div>
                  <span className={`badge ${visibleStatusClass}`}>{visibleStatus}</span>
                </div>

                <div className="ride-route">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="route-dot dot-pickup" />
                    <span style={{ fontSize: "0.88rem", display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: 'var(--muted)' }}>Pickup:</span> 
                      <span style={{ fontWeight: 500 }}><LocationName coords={activeRequest.pickupLocation?.coordinates} fallbackText={form.pickupLocation?.address} /></span>
                    </span>
                  </div>
                  <div className="route-line" style={{ marginLeft: 4 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="route-dot dot-drop" />
                    <span style={{ fontSize: "0.88rem", display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: 'var(--muted)' }}>Drop:</span> 
                      <span style={{ fontWeight: 500 }}><LocationName coords={activeRequest.dropOffLocation?.coordinates} fallbackText={form.dropLocation?.address} /></span>
                    </span>
                  </div>
                </div>

                <div style={{ height: "200px", margin: "1rem 0" }}>
                  <RideMap 
                    pickup={{ 
                      lng: activeRequest.pickupLocation?.coordinates[0], 
                      lat: activeRequest.pickupLocation?.coordinates[1] 
                    }} 
                    drop={{ 
                      lng: activeRequest.dropOffLocation?.coordinates[0], 
                      lat: activeRequest.dropOffLocation?.coordinates[1] 
                    }} 
                  />
                </div>

                <div className="book-ride-summary">
                  {activeRequest.fare && (
                    <div className="summary-tile">
                      <span className="summary-label">Estimated fare</span>
                      <span
                        className="summary-value"
                        style={{
                          fontSize: "1.3rem",
                          fontFamily: "Clash Display",
                          letterSpacing: "-0.03em",
                        }}
                      >
                        ₹{activeRequest.fare?.toFixed(0)}
                      </span>
                    </div>
                  )}
                  <div className="summary-tile">
                    <span className="summary-label">Payment</span>
                    <span className="summary-value">{activeRequest.paymentMethod || "Pending"}</span>
                  </div>
                </div>



                {rideOtp && (
                  <div
                    style={{
                      marginTop: "1rem",
                      background: "var(--surface-2)",
                      borderRadius: 10,
                      padding: "10px 14px",
                    }}
                  >
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Ride OTP: </span>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "1.1rem",
                        letterSpacing: 4,
                        fontFamily: "monospace",
                      }}
                    >
                      {rideOtp}
                    </span>
                  </div>
                )}

                {!rideOtp && resolvedRide && rideStatus === RIDE_STATUS.CONFIRMED && (
                  <div className="status-message info">
                    Your ride is confirmed. The trip OTP will appear here as soon as the confirmed ride details finish syncing.
                  </div>
                )}

                {!resolvedRide && requestStatus === RIDE_REQUEST_STATUS.PENDING && (
                  <div className="status-message info">
                    Waiting for a driver to accept your ride. You can cancel this request before a driver confirms.
                  </div>
                )}

                {resolvedRide && rideStatus === RIDE_STATUS.CANCELLED && (
                  <div className="status-message cancelled">
                    This ride was cancelled. You can book a new ride now.
                  </div>
                )}

                {rideStatus === RIDE_STATUS.ENDED && resolvedRide?.paymentMethod === 'RAZORPAY' && !razorpayPaid && (
                  <div style={{ marginTop: '1rem', padding: '1.25rem', background: 'linear-gradient(135deg,#6366f110,var(--surface))', border: '2px solid #6366f140', borderRadius: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>💳 Payment Required</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                      Your ride is complete! Pay <strong>₹{resolvedRide?.fare?.toFixed(2)}</strong> securely via card, UPI, or netbanking.
                    </div>
                    <button
                      className="btn btn-primary btn-full"
                      onClick={handleRazorpayRidePayment}
                      disabled={razorpayPaymentLoading}
                    >
                      {razorpayPaymentLoading ? <span className="spinner spinner-white" /> : `Pay ₹${resolvedRide?.fare?.toFixed(2)} via Card / UPI`}
                    </button>
                  </div>
                )}

                {rideStatus === RIDE_STATUS.ENDED && resolvedRide?.paymentMethod === 'RAZORPAY' && razorpayPaid && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#10b98115', border: '1px solid #10b98140', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.4rem' }}>✅</span>
                    <div>
                      <div style={{ fontWeight: 700 }}>Payment confirmed!</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>A receipt has been emailed to you. Please rate your driver.</div>
                    </div>
                  </div>
                )}
              </div>

              {driver && (
                <div className="card premium-card" style={{ marginBottom: 16 }}>
                  <h4
                    style={{
                      fontSize: "0.82rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.8px",
                      color: "var(--muted)",
                      marginBottom: "0.75rem",
                    }}
                  >
                    Your driver
                  </h4>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "var(--brand)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontFamily: "Clash Display",
                      }}
                    >
                      {driver.user?.name?.[0] || "?"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{driver.user?.name || "Driver"}</div>
                      <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                        ⭐ {driver.rating?.toFixed(1) || "—"} · {driver.vehicleId || "Vehicle pending"}
                      </div>
                      {driver.user?.phoneNumber && (
                        <a
                          href={`tel:${toDialablePhoneNumber(driver.user.phoneNumber)}`}
                          style={{ fontSize: "0.82rem", color: "var(--text-primary)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}
                        >
                          📞 {formatPhoneNumber(driver.user.phoneNumber)}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!resolvedRide && requestStatus === RIDE_REQUEST_STATUS.PENDING && !findingDriverTimeout && (
                <div className="card premium-card" style={{ marginBottom: 16 }}>
                  <h4 style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--muted)", marginBottom: "0.75rem", display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="spinner spinner-dark" style={{ width: 14, height: 14, borderWidth: 2 }} /> Finding your driver...
                  </h4>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: "50%" }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-shimmer" style={{ width: 120, height: 16, borderRadius: 4, marginBottom: 8 }} />
                      <div className="skeleton-shimmer" style={{ width: 180, height: 12, borderRadius: 4 }} />
                    </div>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <div className="skeleton-shimmer" style={{ width: "100%", height: 36, borderRadius: 8 }} />
                  </div>
                </div>
              )}

              {!resolvedRide && requestStatus === RIDE_REQUEST_STATUS.PENDING && findingDriverTimeout && (
                <div className="card premium-card" style={{ marginBottom: 16, border: "2px solid var(--wallet-warn-bg)", background: "var(--surface-2)" }}>
                  <h4 style={{ fontSize: "1.1rem", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                    Taking longer than expected...
                  </h4>
                  <p style={{ fontSize: "0.88rem", color: "var(--muted)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                    No drivers have accepted your ride request yet. We are searching in an extended radius. You can keep searching or try again later.
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary hover-lift flex-1" onClick={() => {
                      setFindingDriverStartTime(Date.now());
                      setFindingDriverTimeout(false);
                    }}>
                      Keep trying
                    </button>
                    <button className="btn btn-outline hover-shrink flex-1" onClick={handleCancel} disabled={loading} style={{ background: 'var(--surface)' }}>
                      {loading ? <span className="spinner" /> : "Try again later"}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 12 }}>
                <div
                  className="card premium-card"
                  style={{
                    marginBottom: 0,
                    flex: 1,
                    padding: "1rem 1.1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.76rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 6 }}>
                      Current action
                    </div>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{riderActionLabel}</div>
                    <div style={{ marginTop: 4, fontSize: "0.85rem", color: "var(--muted)" }}>{riderActionHint}</div>
                  </div>
                {rideStatus === RIDE_STATUS.ENDED && resolvedRide?.paymentMethod === 'RAZORPAY' && !razorpayPaid ? (
                  <button className="btn btn-primary" style={{ minWidth: 210, background: '#6366f1' }} onClick={handleRazorpayRidePayment} disabled={razorpayPaymentLoading}>
                    {razorpayPaymentLoading ? <span className="spinner spinner-white" /> : '💳 Pay Now'}
                  </button>
                ) : isRideRateable(rideStatus) && (resolvedRide?.paymentMethod !== 'RAZORPAY' || razorpayPaid) ? (
                  <button className="btn btn-primary" style={{ minWidth: 210 }} onClick={() => setStep("rating")}>
                    Rate your driver ⭐
                  </button>
                ) : canCancelPendingRequest ? (
                  <button
                    className="btn btn-danger"
                    style={{ minWidth: 210 }}
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    {loading ? <span className="spinner spinner-white" /> : "Cancel request"}
                  </button>
                ) : canCancelRide ? (
                  <button
                    className="btn btn-danger"
                    style={{ minWidth: 210 }}
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    {loading
                      ? <span className="spinner spinner-white" />
                      : resolvedRide
                        ? "Cancel ride"
                        : "Cancel confirmed ride"}
                  </button>
                ) : isRideOngoing(rideStatus) ? (
                  <button className="btn btn-ghost" style={{ minWidth: 210 }} disabled>
                    Ride is ongoing
                  </button>
                ) : rideStatus === RIDE_STATUS.CANCELLED ? (
                  <button
                    className="btn btn-dark"
                    style={{ minWidth: 210 }}
                    onClick={() => {
                      setStep("form");
                      setActiveRequest(null);
                      setResolvedRide(null);
                    }}
                  >
                    Book another ride
                  </button>
                ) : (
                  <button className="btn btn-ghost" style={{ minWidth: 210 }} disabled>
                    Waiting for driver confirmation
                  </button>
                )}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <SupportPanel
                  compact
                  contextLabel="my active ride"
                  title="Need trip support?"
                  description="If your driver is late, unreachable, or something feels wrong during the ride, contact BookCar support directly here."
                />
              </div>
            </div>
          )}

          {step === "rating" && (
            <div className="card animate-fade-up" style={{ textAlign: "center", padding: "2.5rem" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🌟</div>
              <h3
                style={{
                  fontSize: "1.4rem",
                  letterSpacing: "-0.5px",
                  marginBottom: "0.5rem",
                }}
              >
                Rate your driver
              </h3>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "0.9rem",
                  marginBottom: "2rem",
                }}
              >
                How was your ride?
              </p>

              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: "2rem" }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "2.5rem",
                      cursor: "pointer",
                      color: star <= rating ? "var(--brand-dark)" : "#d7d5cb",
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button className="btn btn-dark btn-full" onClick={handleRate} disabled={loading || !rating}>
                  {loading ? <span className="spinner spinner-white" /> : "Submit rating"}
                </button>
                <button className="btn btn-ghost btn-full" onClick={handleSkipRating} disabled={loading}>
                  Skip for now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
