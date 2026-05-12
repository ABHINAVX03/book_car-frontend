import { createContext, useContext, useEffect, useState } from "react";
import {
  authExpiredEventName,
  clearStoredAuth,
  getStoredToken,
  isTokenExpired,
} from "../utils/authToken";
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
    setUser(null);
    setToken(null);
    clearStoredAuth();
  };

  useEffect(() => {
    const storedToken = getStoredToken();
    if (storedToken && isTokenExpired(storedToken)) {
      logout();
      return undefined;
    }

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
    <AuthCtx.Provider value={{ user, token, login, logout, isDriver, isRider, isAdmin }}>
      {children}
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
