const TOKEN_KEY = "token";
const USER_KEY = "user";
const AUTH_EXPIRED_EVENT = "bookcar:auth-expired";

const decodeJwtPayload = (token) => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);

export const isTokenExpired = (token) => {
  if (!token) return true;

  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (!exp) return false;

  return Date.now() >= exp * 1000;
};

export const clearStoredAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const expireAuth = (reason = "Session expired. Please login again.") => {
  clearStoredAuth();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { reason } }));
  }
};

export const authExpiredEventName = AUTH_EXPIRED_EVENT;
