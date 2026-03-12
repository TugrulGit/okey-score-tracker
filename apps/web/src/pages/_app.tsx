import type { AppProps } from 'next/app';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/auth/AuthContext';
import { ThemeProvider } from '../lib/theme/ThemeProvider';
import '../styles/global.css';

/**
 * @description Root Next.js app wrapper that composes global providers.
 * @param Component - Active page component selected by Next.js routing.
 * @param pageProps - Props injected into the active page component.
 * @returns The page wrapped with Query, theme, and auth providers.
 * @Used_by
 *   - Next.js runtime entrypoint for every route under `src/pages`.
 * @Side_effects
 *   - Instantiates a shared React Query client for the browser session.
 */
export default function MyApp({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
            retry: 1
          },
          mutations: {
            retry: 0
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
