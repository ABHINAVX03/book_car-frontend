const AUTH_EXPIRED_EVENT = "bookcar:auth-expired";
const ACCESS_TOKEN_KEY = "bookcar-access-token";
const REFRESH_TOKEN_KEY = "bookcar-refresh-token";

const getStorageValue = (key) => {
  try {
    if (typeof window !== "undefined") {
      // Try sessionStorage first (session-scoped), then localStorage (persistent)
      return sessionStorage.getItem(key) || localStorage.getItem(key);
    }
  } catch {
    // ignore storage errors in restrictive browsers
  }
  return null;
};

const setStorageValue = (key, value) => {
  try {
    if (typeof window !== "undefined") {
      if (value == null) {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      } else {
        // Store in both sessionStorage and localStorage for redundancy
        sessionStorage.setItem(key, value);
        localStorage.setItem(key, value);
      }
    }
  } catch {
    // ignore storage errors in restrictive browsers
  }
};

export const getStoredToken = () => getStorageValue(ACCESS_TOKEN_KEY);
export const getStoredAccessToken = () => getStorageValue(ACCESS_TOKEN_KEY);
export const getStoredRefreshToken = () => getStorageValue(REFRESH_TOKEN_KEY);

export const setStoredTokens = (accessToken, refreshToken) => {
  if (accessToken != null) {
    setStorageValue(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken != null) {
    setStorageValue(REFRESH_TOKEN_KEY, refreshToken);
  }
};

export const isTokenExpired = () => !getStoredToken();

export const clearStoredAuth = () => {
  try {
    localStorage.removeItem("user");
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem("user");
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // ignore storage errors in restrictive browsers
  }
};

export const expireAuth = (reason = "Session expired. Please login again.") => {
  clearStoredAuth();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { reason } }));
  }
};

export const authExpiredEventName = AUTH_EXPIRED_EVENT;
