import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearSession, getStoredSession, logout as apiLogout, persistSession, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const stored = getStoredSession();
  const [token, setToken] = useState(stored.token);
  const [user, setUser] = useState(stored.user);
  const [loginStep, setLoginStep] = useState('credentials');
  const [mfaToken, setMfaToken] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
      setLoginStep('credentials');
      setMfaToken(null);
      setPendingUser(null);
      clearSession();
    });
  }, []);

  const signIn = async (username, password) => {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.step === 'mfa') {
      setLoginStep('mfa');
      setMfaToken(data.mfa_token);
      setPendingUser(data.user);
      return data;
    }
    persistSession(data);
    setToken(data.token);
    setUser(data.user);
    setLoginStep('credentials');
    return data;
  };

  const verifyMfa = async (code) => {
    const data = await api('/api/auth/verify-mfa', {
      method: 'POST',
      body: JSON.stringify({ mfa_token: mfaToken, code }),
    });
    persistSession(data);
    setToken(data.token);
    setUser(data.user);
    setLoginStep('credentials');
    setMfaToken(null);
    setPendingUser(null);
    return data;
  };

  const signOut = () => {
    apiLogout(); // revoke the refresh token server-side (best effort)
    clearSession();
    setToken(null);
    setUser(null);
    setLoginStep('credentials');
    setMfaToken(null);
    setPendingUser(null);
  };

  const updateUser = (patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem('bt_user', JSON.stringify(next));
      return next;
    });
  };

  const setOAuthSession = useCallback((data) => {
    persistSession(data);
    setToken(data.token);
    setUser(data.user);
    setLoginStep('credentials');
    setMfaToken(null);
    setPendingUser(null);
  }, []);

  const beginOAuthMfa = useCallback((mfa_token, pending) => {
    setLoginStep('mfa');
    setMfaToken(mfa_token);
    setPendingUser(pending);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loginStep,
      mfaToken,
      pendingUser,
      isAuthenticated: !!token && !!user,
      signIn,
      verifyMfa,
      signOut,
      updateUser,
      setOAuthSession,
      beginOAuthMfa,
      resetLogin: () => {
        setLoginStep('credentials');
        setMfaToken(null);
        setPendingUser(null);
      },
      isSuperAdmin: user?.role === 'super_admin',
      isAdmin: user?.role === 'admin',
      isAdminOrAbove: user?.role === 'super_admin' || user?.role === 'admin',
    }),
    [token, user, loginStep, mfaToken, pendingUser, setOAuthSession, beginOAuthMfa]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
