import { expireAuth, getStoredAccessToken, getStoredRefreshToken, setStoredTokens, clearStoredAuth } from "../utils/authToken";

const BASE_URL = import.meta.env.VITE_API_URL || "";
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

let accessToken = getStoredAccessToken();
let refreshToken = getStoredRefreshToken();
let refreshPromise = null;

const syncStoredTokens = (newAccessToken, newRefreshToken) => {
  if (newAccessToken) {
    accessToken = newAccessToken;
  }
  if (newRefreshToken) {
    refreshToken = newRefreshToken;
  }
  setStoredTokens(accessToken, refreshToken);
};

const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  clearStoredAuth();
};

const withTimeout = (options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const externalSignal = options.signal;

  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return {
    options: { ...options, signal: controller.signal },
    clear: () => clearTimeout(timeoutId),
  };
};

const buildUrl = (path) => `${BASE_URL}${path}`;

const parseResponse = async (res) => {
  if (res.status === 204) return null;
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const error = new Error(json?.error?.message || json?.message || text || `HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  if (json?.error) {
    throw new Error(json.error.message || json.error || "API Error");
  }
  return json?.data ?? json;
};

const callRefreshToken = async () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const currentRefreshToken = refreshToken || getStoredRefreshToken();
    const headers = { Accept: "application/json" };
    const options = {
      method: "POST",
      headers,
      credentials: "include",
    };

    if (currentRefreshToken) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify({ refreshToken: currentRefreshToken });
    }

    const timed = withTimeout(options);
    try {
      const res = await fetch(buildUrl("/auth/refresh"), timed.options).finally(timed.clear);
      const data = await parseResponse(res);
      if (data?.accessToken || data?.refreshToken) {
        syncStoredTokens(data?.accessToken, data?.refreshToken);
      }
      return data;
    } catch (error) {
      clearTokens();
      expireAuth();
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

export const refreshAccessToken = () => callRefreshToken();

const fetchJson = async (path, options = {}, { retryOnAuth = true } = {}) => {
  const headers = {
    Accept: "application/json",
    ...options.headers,
  };

  const currentAccessToken = accessToken || getStoredAccessToken();
  if (currentAccessToken && !headers["Authorization"] && !headers["authorization"]) {
    headers["Authorization"] = `Bearer ${currentAccessToken}`;
  }

  const timed = withTimeout({
    ...options,
    headers,
    credentials: "include",
  });

  try {
    const response = await fetch(buildUrl(path), timed.options);
    return await parseResponse(response);
  } catch (error) {
    if (retryOnAuth && (error?.status === 401 || error?.status === 403) && !path.startsWith("/auth/")) {
      try {
        await callRefreshToken();
        return await fetchJson(path, options, { retryOnAuth: false });
      } catch (refreshError) {
        clearTokens();
        expireAuth();
        throw refreshError?.status ? refreshError : error;
      }
    }
    throw error;
  } finally {
    timed.clear();
  }
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

export const signup = (data) => fetchJson("/auth/signup", { method: "POST", body: JSON.stringify(data) });
export const login = (data) => fetchJson("/auth/login", { method: "POST", body: JSON.stringify(data) });
export const logoutSession = () => {
  const refreshToken = getStoredRefreshToken();
  const options = {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
  };
  return fetchJson("/auth/logout", options, { retryOnAuth: false });
};
export const getCurrentUser = () => fetchJson("/auth/me");
export const sendOtp = (phoneNumber) => fetchJson("/auth/send-otp", { method: "POST", body: JSON.stringify({ phoneNumber }) });
export const verifyOtp = (phoneNumber, otp) => fetchJson("/auth/verify-otp", { method: "POST", body: JSON.stringify({ phoneNumber, otp }) });

export const onboardDriver = (userId, vehicleId, vehicleType = "MINI", phoneNumber) =>
  fetchJson(`/auth/onBoardNewDriver/${userId}`, {
    method: "POST",
    body: JSON.stringify({ vehicleId, vehicleType, phoneNumber }),
  });

export const estimateRideFare = (data) => fetchJson("/riders/estimateFare", { method: "POST", body: JSON.stringify(data) });
export const requestRide = (data) => fetchJson("/riders/requestRide", { method: "POST", body: JSON.stringify(data) });
export const cancelRideRequestRider = (id) => fetchJson(`/riders/cancelRideRequest/${id}`, { method: "POST" });
export const cancelRideRider = (id) => fetchJson(`/riders/cancelRide/${id}`, { method: "POST" });
export const rateDriverByBody = (rideId, rating) => fetchJson("/riders/rateDriver", { method: "POST", body: JSON.stringify({ rideId, rating }) });
export const getRiderProfile = () => fetchJson("/riders/getMyProfile");
export const updateRiderProfile = (data) => fetchJson("/riders/updateProfile", { method: "PUT", body: JSON.stringify(data) });
export const getRiderRides = (pageOffset = 0, pageSize = 10) => fetchJson(`/riders/getMyRides?pageOffset=${pageOffset}&pageSize=${pageSize}`);
export const getCurrentRide = () => fetchJson("/riders/currentRide").catch((err) => { if (err?.status === 204) return null; throw err; });
export const getRiderWallet = () => fetchJson("/riders/wallet");
export const addMoneyToRiderWallet = (amount) => tryWalletMutationVariants([{ url: "/riders/wallet/addMoney", options: { method: "POST", body: JSON.stringify({ amount }) } }, { url: "/riders/wallet/add-money", options: { method: "POST", body: JSON.stringify({ amount }) } }]);
export const createRiderWalletPaymentOrder = (amount) => fetchJson("/riders/wallet/payment-order", { method: "POST", body: JSON.stringify({ amount }) });
export const verifyRiderWalletPayment = (data) => fetchJson("/riders/wallet/verify-payment", { method: "POST", body: JSON.stringify(data) });
export const withdrawMoneyFromRiderWallet = (amount) => fetchJson("/riders/wallet/withdraw", { method: "POST", body: JSON.stringify({ amount }) });

export const getIncomingRideRequest = () => fetchJson("/drivers/getIncomingRideRequest");
export const acceptRide = (rideRequestId) => fetchJson(`/drivers/acceptRide/${rideRequestId}`, { method: "POST" });
export const startRide = (rideId, otp) => fetchJson(`/drivers/startRide/${rideId}`, { method: "POST", body: JSON.stringify({ otp }) });
export const endRide = (rideId) => fetchJson(`/drivers/endRide/${rideId}`, { method: "POST" });
export const cancelRideDriver = (rideId) => fetchJson(`/drivers/cancelRide/${rideId}`, { method: "POST" });
export const rateRiderByBody = (rideId, rating) => fetchJson("/drivers/rateRider", { method: "POST", body: JSON.stringify({ rideId, rating }) });
export const getDriverProfile = () => fetchJson("/drivers/getMyProfile");
export const updateDriverProfile = (data) => fetchJson("/drivers/updateProfile", { method: "PUT", body: JSON.stringify(data) });
export const getDriverRides = (pageOffset = 0, pageSize = 10) => fetchJson(`/drivers/getMyRides?pageOffset=${pageOffset}&pageSize=${pageSize}`);
export const getDriverWallet = () => fetchJson("/drivers/wallet");
export const addMoneyToDriverWallet = (amount) => fetchJson("/drivers/wallet/addMoney", { method: "POST", body: JSON.stringify({ amount }) });
export const withdrawMoneyFromDriverWallet = (amount) => fetchJson("/drivers/wallet/withdraw", { method: "POST", body: JSON.stringify({ amount }) });
export const updateDriverLocation = (longitude, latitude) => fetchJson("/drivers/updateLocation", { method: "PATCH", body: JSON.stringify({ coordinates: [longitude, latitude] }) });
export const updateDriverAvailability = (available) => fetchJson("/drivers/availability", { method: "PATCH", body: JSON.stringify({ available }) });
export const submitVerification = () => fetchJson("/drivers/submit-verification", { method: "POST" });

export const getAdminRevenue = (page = 0, size = 15) => fetchJson(`/admin/revenue?pageOffset=${page}&pageSize=${size}`, { method: "GET" });
export const getAllDriversByStatus = (status = "PENDING", page = 0) => fetchJson(`/admin/drivers?status=${status}&pageOffset=${page}`, { method: "GET" });
export const approveDriver = (id) => fetchJson(`/admin/drivers/${id}/approve`, { method: "PUT" });
export const rejectDriver = (id, reason) => fetchJson(`/admin/drivers/${id}/reject`, { method: "PUT", body: JSON.stringify({ rejectionReason: reason }) });
export const blockDriver = (id) => fetchJson(`/admin/drivers/${id}/block`, { method: "POST" });
export const unblockDriver = (id) => fetchJson(`/admin/drivers/${id}/unblock`, { method: "POST" });

export const createRidePaymentOrder = (rideId) => fetchJson(`/riders/rides/${rideId}/payment-order`, { method: "POST" });
export const verifyRidePayment = (rideId, data) => fetchJson(`/riders/rides/${rideId}/verify-ride-payment`, { method: "POST", body: JSON.stringify(data) });

export const uploadDriverDoc = (docType, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return fetchJson(`/drivers/upload/${docType}`, { method: "POST", body: formData });
};
