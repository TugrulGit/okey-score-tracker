import { useRouter } from 'next/router';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface AuthGateProps {
  children: ReactNode;
  redirectTo?: string;
  loadingFallback?: ReactNode;
}

// === Route guard component ===

/**
 * @description Guards protected trees by waiting for auth bootstrap, then redirecting unauthenticated users.
 * @param children - Protected UI subtree shown only for authenticated users.
 * @param redirectTo - Route used when auth is missing (defaults to `/login`).
 * @param loadingFallback - Optional placeholder rendered while auth status is loading.
 * @returns Protected children, loading fallback, or null during redirect.
 * @Used_by
 *   - Upcoming dashboard/history/profile pages.
 * @Side_effects
 *   - Triggers client-side route replacement for unauthenticated users.
 */
export function AuthGate({
  children,
  redirectTo = '/login',
  loadingFallback = null
}: AuthGateProps) {
  const router = useRouter();
  const { status, isAuthenticated } = useAuth();

  useEffect(() => {
    if (status === 'unauthenticated') {
      void router.replace(redirectTo);
    }
  }, [status, router, redirectTo]);

  if (status === 'loading') {
    return <>{loadingFallback}</>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
