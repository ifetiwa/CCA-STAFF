import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../utils/api';
import { normalizeUser } from '../utils/authUser';
import { updateCachedUser } from '../utils/offlineAuth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('authToken'));

  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (_) { /* ignore corrupt cache */ }
      setToken(savedToken);

      // Best-effort refresh from the server when online. If the request fails
      // (offline or transient), we keep the cached user so the session stays
      // valid — this is what lets the app work offline for days. A genuine 401
      // from an online server is handled by the axios interceptor, which
      // clears the session and redirects to /login.
      if (!savedToken.startsWith('demo-token-')) {
        authAPI.getCurrentUser()
          .then(({ data }) => {
            const fresh = normalizeUser(data);
            setUser(fresh);
            localStorage.setItem('user', JSON.stringify(fresh));
            if (fresh.email) updateCachedUser(fresh.email, fresh);
          })
          .catch(() => { /* offline / transient — keep cached user */ });
      }
    }
    setLoading(false);
  }, []);

  const login = (userData, authToken) => {
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setToken(authToken);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };

  // Permission resolver. Real Django payload uses user.permissions as an object
  // ({ can_view_staff: true, ... }) with user.role_key = 'super_admin' (raw)
  // and user.role = display label. Callers pass short keys like 'view_staff'.
  const hasOne = (perms, key) => {
    if (!key) return false;
    if (Array.isArray(perms)) return perms.includes(key);
    if (perms && typeof perms === 'object') {
      // Backend keys are prefixed with "can_" — accept both forms.
      return Boolean(perms[key] || perms[`can_${key}`]);
    }
    return false;
  };

  const can = useCallback(
    (permission) => {
      if (!user) return false;
      if (user.role_key === 'super_admin') return true;
      if (user.is_superuser) return true;
      const perms = user.permissions || {};
      if (Array.isArray(permission)) return permission.some((p) => hasOne(perms, p));
      return hasOne(perms, permission);
    },
    [user],
  );

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, loading, isAuthenticated, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
