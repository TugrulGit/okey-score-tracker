import type { AxiosRequestConfig } from 'axios';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { httpClient } from '../api/httpClient';
import type { AuthUser, ProxyAuthSuccess } from '../../types/auth';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  displayName: string;
  avatarUrl?: string;
  timezone?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  login: (payload: LoginInput) => Promise<AuthUser>;
  register: (payload: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const NO_REFRESH_CONFIG: AxiosRequestConfig = { skipAuthRefresh: true };

// === Session lifecycle helper ===

/**
 * @description Fetches the current session user from the Next auth proxy route.
 * @returns Authenticated user payload when a valid cookie session exists.
 * @Used_by
 *   - `AuthProvider` bootstrap and manual session refresh operations.
 * @Side_effects
 *   - Performs network I/O to `/api/auth/session`.
 */
async function fetchSessionUser(): Promise<AuthUser> {
  const response = await httpClient.get<ProxyAuthSuccess>(
    '/auth/session',
    NO_REFRESH_CONFIG
  );
  return response.data.user;
}

// === Auth provider ===

/**
 * @description Provides auth state/actions (login/register/logout/refresh) to the web app.
 * @param children - React subtree that consumes auth context.
 * @returns Context provider wrapping the given children.
 * @Used_by
 *   - `_app.tsx` provider tree.
 * @Side_effects
 *   - Bootstraps auth on mount and mutates local auth state in response to API calls.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const bootstrapSession = useCallback(async () => {
    setStatus('loading');

    try {
      const sessionUser = await fetchSessionUser();
      setUser(sessionUser);
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  const login = useCallback(async (payload: LoginInput) => {
    const response = await httpClient.post<ProxyAuthSuccess>(
      '/auth/login',
      payload,
      NO_REFRESH_CONFIG
    );

    setUser(response.data.user);
    setStatus('authenticated');

    return response.data.user;
  }, []);

  const register = useCallback(async (payload: RegisterInput) => {
    const response = await httpClient.post<ProxyAuthSuccess>(
      '/auth/register',
      payload,
      NO_REFRESH_CONFIG
    );

    setUser(response.data.user);
    setStatus('authenticated');

    return response.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await httpClient.post('/auth/logout', undefined, NO_REFRESH_CONFIG);
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const response = await httpClient.post<ProxyAuthSuccess>(
        '/auth/refresh',
        undefined,
        NO_REFRESH_CONFIG
      );
      setUser(response.data.user);
      setStatus('authenticated');
      return response.data.user;
    } catch {
      setUser(null);
      setStatus('unauthenticated');
      return null;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      login,
      register,
      logout,
      refreshSession
    }),
    [user, status, login, register, logout, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * @description Convenience hook for consuming auth context values/actions.
 * @returns Auth context value with user state and auth actions.
 * @Used_by
 *   - Protected pages, auth forms, and navigation shells.
 * @Side_effects
 *   - None.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
