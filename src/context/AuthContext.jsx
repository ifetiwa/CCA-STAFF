import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getUserById } from '../data/users';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('authToken'));

  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      const parsed = JSON.parse(savedUser);
      // Re-hydrate from the user store so permission edits made while logged in
      // (e.g. by the super admin in another tab) take effect on next render.
      const fresh = parsed.id ? getUserById(parsed.id) : null;
      setToken(savedToken);
      setUser(fresh ? { ...parsed, ...stripSecret(fresh) } : parsed);
    }
    setLoading(false);
  }, []);

  // Keep the in-memory user in sync if the super admin changes permissions.
  useEffect(() => {
    const refresh = () => {
      setUser((current) => {
        if (!current?.id) return current;
        const fresh = getUserById(current.id);
        if (!fresh) return current;
        const next = { ...current, ...stripSecret(fresh) };
        localStorage.setItem('user', JSON.stringify(next));
        return next;
      });
    };
    window.addEventListener('cca:users-changed', refresh);
    return () => window.removeEventListener('cca:users-changed', refresh);
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

  const can = useCallback(
    (permission) => {
      if (!user) return false;
      if (user.role === 'Super Administrator') return true;
      const perms = user.permissions || [];
      if (Array.isArray(permission)) return permission.some((p) => perms.includes(p));
      return perms.includes(permission);
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

const stripSecret = (u) => {
  const { password: _omit, ...safe } = u;
  return safe;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
