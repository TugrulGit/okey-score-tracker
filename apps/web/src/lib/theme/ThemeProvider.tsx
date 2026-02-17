import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

// === Theme context contract ===

export type ThemeMode = 'light' | 'dark';

type ThemeSource = 'system' | 'user';

interface ThemeContextValue {
  theme: ThemeMode;
  systemTheme: ThemeMode;
  source: ThemeSource;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  resetToSystem: () => void;
}

const STORAGE_KEY = 'okey-score-theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

const prefersDarkQuery = '(prefers-color-scheme: dark)';

// === Theme detection & persistence helpers ===

/**
 * Narrows persisted strings to supported theme modes so we ignore corrupt storage values.
 * Internal helper; only used while reading and validating localStorage.
 */
const isThemeMode = (value: string | null): value is ThemeMode =>
  value === 'light' || value === 'dark';

/**
 * Reads the OS-level preference (light/dark) via matchMedia.
 * Falls back to `light` on the server so SSR markup is deterministic.
 */
const getSystemTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia(prefersDarkQuery).matches ? 'dark' : 'light';
};

/**
 * Pulls a previously selected theme from localStorage when available.
 * Returns null whenever storage is unavailable, unreadable, or contains unsupported values.
 */
const getStoredTheme = (): ThemeMode | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isThemeMode(value) ? value : null;
  } catch (error) {
    console.warn('Theme storage unavailable:', error);
    return null;
  }
};

/**
 * Wraps the React tree with a theme context that syncs the OS preference,
 * persisted overrides, and document-level attributes (data-theme + color-scheme).
 * Consumed across the web app via `useTheme` to drive Tailwind/theme tokens and toggle controls.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [systemTheme, setSystemTheme] = useState<ThemeMode>('light');
  const [source, setSource] = useState<ThemeSource>('system');

  // === Provider lifecycle synchronization ===

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedTheme = getStoredTheme();
    const nextSystemTheme = getSystemTheme();
    setSystemTheme(nextSystemTheme);
    if (storedTheme) {
      setThemeState(storedTheme);
      setSource('user');
    } else {
      setThemeState(nextSystemTheme);
      setSource('system');
    }
  }, []);

  // Persist attribute + color scheme for the document.
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  }, [theme]);

  // Synchronize localStorage with manual overrides.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      if (source === 'user') {
        window.localStorage.setItem(STORAGE_KEY, theme);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.warn('Unable to persist theme preference:', error);
    }
  }, [source, theme]);

  // Track OS changes separately and adopt them when following the system.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const mediaQuery = window.matchMedia(prefersDarkQuery);
    const updateSystemTheme = (matches: boolean) => {
      setSystemTheme(matches ? 'dark' : 'light');
    };
    updateSystemTheme(mediaQuery.matches);
    const handleChange = (event: MediaQueryListEvent) => {
      updateSystemTheme(event.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (source === 'system') {
      setThemeState(systemTheme);
    }
  }, [source, systemTheme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setSource('user');
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setSource('user');
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const resetToSystem = useCallback(() => {
    setSource('system');
    setThemeState(systemTheme);
  }, [systemTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, systemTheme, source, setTheme, toggleTheme, resetToSystem }),
    [theme, systemTheme, source, setTheme, toggleTheme, resetToSystem]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Convenience hook for consuming the theme context; throws when called outside the provider
 * so feature modules fail fast instead of silently rendering with stale defaults.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
