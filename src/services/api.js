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

      // Check both nested data and direct object based on standard payload
      const newToken = json?.data?.accessToken || json?.accessToken;
      if (newToken) {
        window.localStorage.setItem('token', newToken);
        return newToken;
      }
      throw new Error('No refresh token provided');
    } catch (e) {
      expireAuth();
      throw e;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
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
    return await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        ...options.headers,
      },
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

    // Reactive refresh if backend strictly rejected the token
    if (shouldExpireAuthForError(res.status, message)) {
      if (!isRetrying) {
        isRetrying = true;
        try {
          const newToken = await callRefreshToken();
          // Retry the request with the new token
          res = await doFetch(newToken);
          
          if (res.ok) {
            const retryText = await res.text();
            let retryJson = null;
            try { retryJson = retryText ? JSON.parse(retryText) : null; } catch {}
            return retryJson?.data ?? retryJson;
          }
          // If retry fails too, fallback to original error throw logic below
        } catch (e) {
          // callRefreshToken already handles expireAuth
          const error = new Error('Session expired. Please login again.');
          error.status = 401;
          throw error;
        }
      } else {
        expireAuth();
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

const shouldTryWalletFallback = (error) =>
  [400, 403, 404, 405].includes(error?.status);

const tryWalletMutationVariants = async (variants = []) => {
  let lastError = null;

  for (const variant of variants) {
    try {
      return await fetchJson(variant.url, variant.options);
    } catch (error) {
      lastError = error;
      if (!shouldTryWalletFallback(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Wallet action failed");
};

// AUTH
export const signup = (data) =>
  fetchJson(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const login = (data) =>
  fetchJson(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const onboardDriver = async (userId, vehicleId) => {
  const payload = {
    method: 'POST',
    body: JSON.stringify({ vehicleId }),
  };

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

// RIDER
export const estimateRideFare = (data) =>
  fetchJson(`${BASE_URL}/riders/estimateFare`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const requestRide = (data) =>
  fetchJson(`${BASE_URL}/riders/requestRide`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const cancelRideRequestRider = (id) =>
  fetchJson(`${BASE_URL}/riders/cancelRideRequest/${id}`, {
    method: 'POST',
  });

export const cancelRideRider = (id) =>
  fetchJson(`${BASE_URL}/riders/cancelRide/${id}`, {
    method: 'POST',
  });

export const rateDriverByBody = (rideId, rating) =>
  fetchJson(`${BASE_URL}/riders/rateDriver`, {
    method: 'POST',
    body: JSON.stringify({ rideId, rating }),
  });

export const getRiderProfile = () =>
  fetchJson(`${BASE_URL}/riders/getMyProfile`);

export const updateRiderProfile = (data) =>
  fetchJson(`${BASE_URL}/riders/updateProfile`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const getRiderRides = (pageOffset = 0, pageSize = 10) =>
  fetchJson(`${BASE_URL}/riders/getMyRides?pageOffset=${pageOffset}&pageSize=${pageSize}`);

export const getRiderWallet = () =>
  fetchJson(`${BASE_URL}/riders/wallet`);

export const addMoneyToRiderWallet = (amount) =>
  tryWalletMutationVariants([
    {
      url: `${BASE_URL}/riders/wallet/addMoney`,
      options: {
        method: 'POST',
        body: JSON.stringify({ amount }),
      },
    },
    {
      url: `${BASE_URL}/riders/wallet/add-money`,
      options: {
        method: 'POST',
        body: JSON.stringify({ amount }),
      },
    },
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

// DRIVER
export const getIncomingRideRequest = () =>
  fetchJson(`${BASE_URL}/drivers/getIncomingRideRequest`);

export const acceptRide = (rideRequestId) =>
  fetchJson(`${BASE_URL}/drivers/acceptRide/${rideRequestId}`, {
    method: 'POST',
  });

export const startRide = (rideId, otp) =>
  fetchJson(`${BASE_URL}/drivers/startRide/${rideId}`, {
    method: 'POST',
    body: JSON.stringify({ otp }),
  });

export const endRide = (rideId) =>
  fetchJson(`${BASE_URL}/drivers/endRide/${rideId}`, {
    method: 'POST',
  });

export const cancelRideDriver = (rideId) =>
  fetchJson(`${BASE_URL}/drivers/cancelRide/${rideId}`, {
    method: 'POST',
  });

export const rateRiderByBody = (rideId, rating) =>
  fetchJson(`${BASE_URL}/drivers/rateRider`, {
    method: 'POST',
    body: JSON.stringify({ rideId, rating }),
  });

export const getDriverProfile = () =>
  fetchJson(`${BASE_URL}/drivers/getMyProfile`);

export const updateDriverProfile = (data) =>
  fetchJson(`${BASE_URL}/drivers/updateProfile`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const getDriverRides = (pageOffset = 0, pageSize = 10) =>
  fetchJson(`${BASE_URL}/drivers/getMyRides?pageOffset=${pageOffset}&pageSize=${pageSize}`);

export const getDriverWallet = () =>
  fetchJson(`${BASE_URL}/drivers/wallet`);

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
    body: JSON.stringify({
      coordinates: [longitude, latitude]
    }),
  });
