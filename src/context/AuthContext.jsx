import { createContext, useContext, useEffect, useState } from "react";
import {
  authExpiredEventName,
  clearStoredAuth,
  getStoredToken,
  isTokenExpired,
} from "../utils/authToken";
import { refreshAccessToken } from "../services/api";
import { cachePhoneNumber, getCachedPhoneNumber } from "../utils/userContactCache";

const AuthCtx = createContext(null);

const normalizeRoles = (roles) => {
  if (!roles) return [];
  if (Array.isArray(roles)) return roles;
  if (typeof roles === 'string') {
    const text = roles.trim();
    if (text.startsWith('[') && text.endsWith(']')) {
      return text
        .slice(1, -1)
        .split(',')
        .map(role => role.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
    }
    return [text];
  }
  return [];
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => {
    const storedToken = getStoredToken();
    return isTokenExpired(storedToken) ? null : storedToken;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = getStoredToken();
      
      // If token is expired but we have a user, try to refresh immediately
      if (user && isTokenExpired(storedToken)) {
        try {
          const newToken = await refreshAccessToken();
          setToken(newToken);
        } catch (err) {
          // If refresh fails, clear everything
          setUser(null);
          setToken(null);
          clearStoredAuth();
        }
      }
      setLoading(false);
    };

    restoreSession();
  }, []);

  const login = (userData, tok) => {
    const normalizedUser = {
      ...userData,
      phoneNumber: userData?.phoneNumber || getCachedPhoneNumber(userData?.email),
      roles: normalizeRoles(userData?.roles),
    };
    setUser(normalizedUser);
    setToken(tok);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    if (tok) localStorage.setItem('token', tok);
    if (normalizedUser?.email && normalizedUser?.phoneNumber) {
      cachePhoneNumber(normalizedUser.email, normalizedUser.phoneNumber);
    }
  };

  const logout = () => {
    try {
      sessionStorage.removeItem("bookcar-pending-driver-vehicle");
    } catch {
      /* ignore */
    }
    setUser(null);
    setToken(null);
    clearStoredAuth();
  };

  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener(authExpiredEventName, handleExpired);
    return () => window.removeEventListener(authExpiredEventName, handleExpired);
  }, []);

  const isDriver = user?.roles?.includes('DRIVER');
  const isRider = user?.roles?.includes('RIDER');
  const isAdmin = user?.roles?.includes('ADMIN');

  return (
    <AuthCtx.Provider value={{ user, token, loading, login, logout, isDriver, isRider, isAdmin }}>
      {!loading && children}
      {loading && (
        <div style={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'var(--bg)',
          color: 'var(--brand)'
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
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
