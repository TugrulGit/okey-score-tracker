import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

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

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === 'light' || value === 'dark';

const getSystemTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia(prefersDarkQuery).matches ? 'dark' : 'light';
};

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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [systemTheme, setSystemTheme] = useState<ThemeMode>('light');
  const [source, setSource] = useState<ThemeSource>('system');

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

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
