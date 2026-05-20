import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authExpiredEventName, clearStoredAuth, setStoredTokens } from "../utils/authToken";
import { getCurrentUser, refreshAccessToken } from "../services/api";
import { cachePhoneNumber, getCachedPhoneNumber } from "../utils/userContactCache";

const AuthCtx = createContext(null);

const normalizeRoles = (roles) => {
  if (!roles) return [];
  if (Array.isArray(roles)) return roles;
  if (typeof roles === "string") {
    const text = roles.trim();
    if (text.startsWith("[") && text.endsWith("]")) {
      return text
        .slice(1, -1)
        .split(",")
        .map((role) => role.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
    return [text];
  }
  return [];
};

const normalizeUser = (userData) => {
  if (!userData) return null;
  const normalizedUser = {
    ...userData,
    phoneNumber: userData?.phoneNumber || getCachedPhoneNumber(userData?.email),
    roles: normalizeRoles(userData?.roles),
  };
  if (normalizedUser?.email && normalizedUser?.phoneNumber) {
    cachePhoneNumber(normalizedUser.email, normalizedUser.phoneNumber);
  }
  return normalizedUser;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const profile = await getCurrentUser();
        if (!cancelled) setUser(normalizeUser(profile));
      } catch (error) {
        if (error?.status === 401 || error?.status === 403) {
          try {
            const refreshResponse = await refreshAccessToken();
            const profile = refreshResponse?.user || await getCurrentUser();
            if (!cancelled) setUser(normalizeUser(profile));
          } catch {
            if (!cancelled) {
              setUser(null);
              clearStoredAuth();
            }
          }
        } else if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    restoreSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      clearStoredAuth();
    };

    window.addEventListener(authExpiredEventName, handleExpired);
    return () => window.removeEventListener(authExpiredEventName, handleExpired);
  }, []);

  const login = (userData) => {
    if (userData?.accessToken || userData?.refreshToken) {
      setStoredTokens(userData.accessToken, userData.refreshToken);
    }
    setUser(normalizeUser(userData));
  };

  const logout = () => {
    try {
      sessionStorage.removeItem("bookcar-pending-driver-vehicle");
      sessionStorage.removeItem("rebook_ride");
    } catch {
      // ignore
    }
    clearStoredAuth();
    setUser(null);
  };

  const value = useMemo(() => ({
    user,
    token: null,
    loading,
    login,
    logout,
    isDriver: user?.roles?.includes("DRIVER"),
    isRider: user?.roles?.includes("RIDER"),
    isAdmin: user?.roles?.includes("ADMIN"),
  }), [loading, user]);

  return (
    <AuthCtx.Provider value={value}>
      {!loading && children}
      {loading && (
        <div style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          color: "var(--brand)",
        }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      )}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthCtx);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
