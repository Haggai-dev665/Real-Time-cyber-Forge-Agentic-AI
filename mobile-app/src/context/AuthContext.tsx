/**
 * Authentication state: holds the JWT + user, persists to secure storage, and
 * exposes login / register / guest / logout. "Guest" mode skips auth and relies
 * on the backend's public endpoints (orchestrator, OTX, sandbox, health).
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { endpoints } from '../api/endpoints';
import { getItem, setItem, deleteItem, TOKEN_KEY, USER_KEY } from '../api/storage';
import type { AuthUser } from '../api/types';
import { ApiError } from '../api/client';

interface AuthState {
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  isGuest: boolean;
  signedIn: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (p: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const GUEST_FLAG = 'cf_guest';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ready: false,
    token: null,
    user: null,
    isGuest: false,
    signedIn: false,
  });

  // Restore session on boot.
  useEffect(() => {
    (async () => {
      const [token, userJson, guest] = await Promise.all([
        getItem(TOKEN_KEY),
        getItem(USER_KEY),
        getItem(GUEST_FLAG),
      ]);
      setState({
        ready: true,
        token: token ?? null,
        user: userJson ? (JSON.parse(userJson) as AuthUser) : null,
        isGuest: guest === '1',
        signedIn: !!token || guest === '1',
      });
    })();
  }, []);

  const persist = useCallback(async (token: string, user: AuthUser) => {
    await Promise.all([
      setItem(TOKEN_KEY, token),
      setItem(USER_KEY, JSON.stringify(user)),
      deleteItem(GUEST_FLAG),
    ]);
    setState({ ready: true, token, user, isGuest: false, signedIn: true });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await endpoints.login(email, password);
      if (!res.success || !res.data?.token) {
        throw new ApiError(res.message || 'Login failed', 401);
      }
      await persist(res.data.token, res.data.user);
    },
    [persist]
  );

  const register = useCallback(
    async (p: { email: string; password: string; firstName: string; lastName: string }) => {
      const res = await endpoints.register(p);
      if (!res.success || !res.data?.token) {
        throw new ApiError(res.message || 'Registration failed', 400);
      }
      await persist(res.data.token, res.data.user);
    },
    [persist]
  );

  const continueAsGuest = useCallback(async () => {
    await setItem(GUEST_FLAG, '1');
    setState({ ready: true, token: null, user: null, isGuest: true, signedIn: true });
  }, []);

  const logout = useCallback(async () => {
    await Promise.all([deleteItem(TOKEN_KEY), deleteItem(USER_KEY), deleteItem(GUEST_FLAG)]);
    setState({ ready: true, token: null, user: null, isGuest: false, signedIn: false });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, continueAsGuest, logout }),
    [state, login, register, continueAsGuest, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
