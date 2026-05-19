const AUTH_EXPIRED_EVENT = "bookcar:auth-expired";

export const getStoredToken = () => null;

export const isTokenExpired = () => true;

export const clearStoredAuth = () => {
  try {
    localStorage.removeItem("user");
    sessionStorage.removeItem("user");
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
