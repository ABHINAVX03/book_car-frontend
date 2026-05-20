const AUTH_EXPIRED_EVENT = "bookcar:auth-expired";
const ACCESS_TOKEN_KEY = "bookcar-access-token";
const REFRESH_TOKEN_KEY = "bookcar-refresh-token";

const getSessionStorageValue = (key) => {
  try {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(key);
    }
  } catch {
    // ignore storage errors in restrictive browsers
  }
  return null;
};

const setSessionStorageValue = (key, value) => {
  try {
    if (typeof window !== "undefined") {
      if (value == null) {
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
      }
    }
  } catch {
    // ignore storage errors in restrictive browsers
  }
};

export const getStoredToken = () => getSessionStorageValue(ACCESS_TOKEN_KEY);
export const getStoredAccessToken = () => getSessionStorageValue(ACCESS_TOKEN_KEY);
export const getStoredRefreshToken = () => getSessionStorageValue(REFRESH_TOKEN_KEY);

export const setStoredTokens = (accessToken, refreshToken) => {
  if (accessToken != null) {
    setSessionStorageValue(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken != null) {
    setSessionStorageValue(REFRESH_TOKEN_KEY, refreshToken);
  }
};

export const isTokenExpired = () => !getStoredToken();

export const clearStoredAuth = () => {
  try {
    localStorage.removeItem("user");
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
