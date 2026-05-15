import { expireAuth, getStoredToken, isTokenExpired } from "../utils/authToken";

const BASE_URL = "https://bookkaro-backend-spring-boot-production.up.railway.app";

let refreshPromise = null;

const callRefreshToken = async () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        credentials: 'include',
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (!res.ok || json?.error) {
        throw new Error('Refresh failed');
      }

      const newToken = json?.data?.accessToken || json?.accessToken;
      if (newToken) {
        window.localStorage.setItem('token', newToken);
        return newToken;
      }
      throw new Error('No access token in refresh response');
    } catch (e) {
      expireAuth();
      throw e;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/** Refreshes access token using the httpOnly refresh cookie. */
export const refreshAccessToken = () => callRefreshToken();

/**
 * FIX BUG-04: Broadened to trigger refresh on both 401 and 403.
 * Spring Security can return 403 for an expired token depending on the
 * exception resolver configuration, so we must treat 403 as a potential
 * auth failure and attempt a refresh.
 */
const shouldAttemptRefreshForError = (status, message = "") => {
  const msg = message.toLowerCase();

  // Explicit token-error messages always refresh
  if (
    msg.includes('jwt expired') ||
    msg.includes('token expired') ||
    msg.includes('session expired') ||
    msg.includes('invalid token') ||
    msg.includes('token invalid')
  ) {
    return true;
  }

  // 401 — auth required
  if (status === 401) return true;

  // 403 — might be expired token misrouted as forbidden
  if (status === 403 && (
    msg.includes('access denied') ||
    msg.includes('forbidden') ||
    msg.includes('full authentication') ||
    msg === '' // empty body on 403 is likely an auth filter reject
  )) {
    return true;
  }

  return false;
};

const shouldExpireAuthForError = (status, message = "") => {
  const normalizedMessage = message.toLowerCase();
  if (
    normalizedMessage.includes('jwt expired') ||
    normalizedMessage.includes('token expired') ||
    normalizedMessage.includes('session expired') ||
    normalizedMessage.includes('invalid token') ||
    normalizedMessage.includes('token invalid')
  ) {
    return true;
  }
  if (status === 401) {
    return (
      normalizedMessage.includes('authentication required') ||
      normalizedMessage.includes('full authentication is required') ||
      normalizedMessage.includes('missing token')
    );
  }
  return false;
};

const getHeaders = () => {
  const token = getStoredToken();
  if (token && isTokenExpired(token)) {
    expireAuth();
    return { Accept: 'application/json', 'Content-Type': 'application/json' };
  }
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const fetchJson = async (url, options = {}) => {
  let token = getStoredToken();
  let isRetrying = false;

  // Pre-emptive refresh if we already know locally that the token expired
  if (token && isTokenExpired(token)) {
    token = await callRefreshToken();
  }

  const doFetch = async (currentToken) => {
    const headers = {
      Accept: 'application/json',
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      ...options.headers,
    };

    // FIX: Only set Content-Type to JSON if the body is NOT FormData.
    // If it IS FormData, let the browser set it automatically with the correct boundary.
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    return await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  };

  let res = await doFetch(token);

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const message = json?.error?.message || json?.message || text || `HTTP ${res.status}`;

    if (shouldAttemptRefreshForError(res.status, message) && !isRetrying) {
      isRetrying = true;
      try {
        const newToken = await callRefreshToken();
        res = await doFetch(newToken);

        if (res.ok) {
          const retryText = await res.text();
          let retryJson = null;
          try { retryJson = retryText ? JSON.parse(retryText) : null; } catch {}
          return retryJson?.data ?? retryJson;
        }
        // Retry also failed — fall through to throw below
      } catch (e) {
        const error = new Error('Session expired. Please login again.');
        error.status = 401;
        throw error;
      }
    }

    const finalMessage = json?.error?.message || json?.message || `HTTP ${res.status}`;
    const error = new Error(finalMessage);
    error.status = res.status;
    error.url = url;
    throw error;
  }

  if (json?.error) {
    throw new Error(json.error.message || json.error || 'API Error');
  }

  return json?.data ?? json;
};

const shouldTryWalletFallback = (error) => [400, 403, 404, 405].includes(error?.status);

const tryWalletMutationVariants = async (variants = []) => {
  let lastError = null;
  for (const variant of variants) {
    try {
      return await fetchJson(variant.url, variant.options);
    } catch (error) {
      lastError = error;
      if (!shouldTryWalletFallback(error)) throw error;
    }
  }
  throw lastError || new Error("Wallet action failed");
};

// ─── AUTH ────────────────────────────────────────────────────────────────────
export const signup = (data) =>
  fetchJson(`${BASE_URL}/auth/signup`, { method: 'POST', body: JSON.stringify(data) });

export const login = (data) =>
  fetchJson(`${BASE_URL}/auth/login`, { method: 'POST', body: JSON.stringify(data) });

export const sendOtp = (phoneNumber) =>
  fetchJson(`${BASE_URL}/auth/send-otp`, { method: 'POST', body: JSON.stringify({ phoneNumber }) });

export const verifyOtp = (phoneNumber, otp) =>
  fetchJson(`${BASE_URL}/auth/verify-otp`, { method: 'POST', body: JSON.stringify({ phoneNumber, otp }) });

export const onboardDriver = async (userId, vehicleId, vehicleType = 'MINI', phoneNumber) => {
  const payload = { method: 'POST', body: JSON.stringify({ vehicleId, vehicleType, phoneNumber }) };
  if (userId) {
    try {
      return await fetchJson(`${BASE_URL}/auth/onBoardNewDriver/${userId}`, payload);
    } catch (error) {
      if (error.message?.toLowerCase().includes('access denied')) {
        return await fetchJson(`${BASE_URL}/auth/onBoardNewDriver`, payload);
      }
      throw error;
    }
  }
  return fetchJson(`${BASE_URL}/auth/onBoardNewDriver`, payload);
};

// ─── RIDER ───────────────────────────────────────────────────────────────────
export const estimateRideFare = (data) =>
  fetchJson(`${BASE_URL}/riders/estimateFare`, { method: 'POST', body: JSON.stringify(data) });

export const requestRide = (data) =>
  fetchJson(`${BASE_URL}/riders/requestRide`, { method: 'POST', body: JSON.stringify(data) });

export const cancelRideRequestRider = (id) =>
  fetchJson(`${BASE_URL}/riders/cancelRideRequest/${id}`, { method: 'POST' });

export const cancelRideRider = (id) =>
  fetchJson(`${BASE_URL}/riders/cancelRide/${id}`, { method: 'POST' });

export const rateDriverByBody = (rideId, rating) =>
  fetchJson(`${BASE_URL}/riders/rateDriver`, {
    method: 'POST',
    body: JSON.stringify({ rideId, rating }),
  });

export const getRiderProfile = () => fetchJson(`${BASE_URL}/riders/getMyProfile`);

export const updateRiderProfile = (data) =>
  fetchJson(`${BASE_URL}/riders/updateProfile`, { method: 'PUT', body: JSON.stringify(data) });

export const getRiderRides = (pageOffset = 0, pageSize = 10) =>
  fetchJson(`${BASE_URL}/riders/getMyRides?pageOffset=${pageOffset}&pageSize=${pageSize}`);

/**
 * NEW — FIX BUG-07.
 * Returns the rider's current CONFIRMED or ONGOING ride directly from the backend.
 * Returns null (204 No Content → fetchJson returns null) if none exists.
 */
export const getCurrentRide = () =>
  fetchJson(`${BASE_URL}/riders/currentRide`).catch((err) => {
    // 204 No Content — no active ride, that's fine
    if (err?.status === 204) return null;
    throw err;
  });

export const getRiderWallet = () => fetchJson(`${BASE_URL}/riders/wallet`);

export const addMoneyToRiderWallet = (amount) =>
  tryWalletMutationVariants([
    { url: `${BASE_URL}/riders/wallet/addMoney`, options: { method: 'POST', body: JSON.stringify({ amount }) } },
    { url: `${BASE_URL}/riders/wallet/add-money`, options: { method: 'POST', body: JSON.stringify({ amount }) } },
  ]);

export const createRiderWalletPaymentOrder = (amount) =>
  fetchJson(`${BASE_URL}/riders/wallet/payment-order`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });

export const verifyRiderWalletPayment = (data) =>
  fetchJson(`${BASE_URL}/riders/wallet/verify-payment`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const withdrawMoneyFromRiderWallet = (amount) =>
  fetchJson(`${BASE_URL}/riders/wallet/withdraw`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });

// ─── DRIVER ──────────────────────────────────────────────────────────────────
export const getIncomingRideRequest = () =>
  fetchJson(`${BASE_URL}/drivers/getIncomingRideRequest`);

export const acceptRide = (rideRequestId) =>
  fetchJson(`${BASE_URL}/drivers/acceptRide/${rideRequestId}`, { method: 'POST' });

export const startRide = (rideId, otp) =>
  fetchJson(`${BASE_URL}/drivers/startRide/${rideId}`, {
    method: 'POST',
    body: JSON.stringify({ otp }),
  });

export const endRide = (rideId) =>
  fetchJson(`${BASE_URL}/drivers/endRide/${rideId}`, { method: 'POST' });

export const cancelRideDriver = (rideId) =>
  fetchJson(`${BASE_URL}/drivers/cancelRide/${rideId}`, { method: 'POST' });

export const rateRiderByBody = (rideId, rating) =>
  fetchJson(`${BASE_URL}/drivers/rateRider`, {
    method: 'POST',
    body: JSON.stringify({ rideId, rating }),
  });

export const getDriverProfile = () => fetchJson(`${BASE_URL}/drivers/getMyProfile`);

export const updateDriverProfile = (data) =>
  fetchJson(`${BASE_URL}/drivers/updateProfile`, { method: 'PUT', body: JSON.stringify(data) });

export const getDriverRides = (pageOffset = 0, pageSize = 10) =>
  fetchJson(`${BASE_URL}/drivers/getMyRides?pageOffset=${pageOffset}&pageSize=${pageSize}`);

export const getDriverWallet = () => fetchJson(`${BASE_URL}/drivers/wallet`);

export const addMoneyToDriverWallet = (amount) =>
  fetchJson(`${BASE_URL}/drivers/wallet/addMoney`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });

export const withdrawMoneyFromDriverWallet = (amount) =>
  fetchJson(`${BASE_URL}/drivers/wallet/withdraw`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });

export const updateDriverLocation = (longitude, latitude) =>
  fetchJson(`${BASE_URL}/drivers/updateLocation`, {
    method: 'PATCH',
    body: JSON.stringify({ coordinates: [longitude, latitude] }),
  });

export const updateDriverAvailability = (available) =>
  fetchJson(`${BASE_URL}/drivers/availability`, {
    method: 'PATCH',
    body: JSON.stringify({ available }),
  });

// ─── ADMIN ───────────────────────────────────────────────────────────────────
export const getAdminRevenue = (page = 0, size = 15) =>
  fetchJson(`${BASE_URL}/admin/revenue?page=${page}&size=${size}`);

// ─── RAZORPAY RIDE PAYMENT ────────────────────────────────────────────────────
export const createRidePaymentOrder = (rideId) =>
  fetchJson(`${BASE_URL}/riders/rides/${rideId}/payment-order`, { method: 'POST' });

export const verifyRidePayment = (rideId, data) =>
  fetchJson(`${BASE_URL}/riders/rides/${rideId}/verify-ride-payment`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

// ─── VERIFICATION ─────────────────────────────────────────────────────────────
export const uploadDriverDoc = (docType, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return fetchJson(`${BASE_URL}/drivers/upload/${docType}`, {
    method: 'POST',
    body: formData,
  });
};

export const getAllDriversByStatus = (status = 'PENDING', page = 0) =>
  fetchJson(`${BASE_URL}/admin/drivers?status=${status}&pageOffset=${page}`, { method: 'GET' });

export const approveDriver = (id) =>
  fetchJson(`${BASE_URL}/admin/drivers/${id}/approve`, { method: 'PUT' });

export const rejectDriver = (id, reason) =>
  fetchJson(`${BASE_URL}/admin/drivers/${id}/reject`, { method: 'PUT', body: JSON.stringify({ rejectionReason: reason }) });

export const blockDriver = (id) =>
  fetchJson(`${BASE_URL}/admin/drivers/${id}/block`, { method: 'POST' });

export const unblockDriver = (id) =>
  fetchJson(`${BASE_URL}/admin/drivers/${id}/unblock`, { method: 'POST' });
