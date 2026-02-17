import { ReactElement } from 'react';
import { useTheme } from '../lib/theme/ThemeProvider';
import styles from './ThemeToggle.module.css';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps): ReactElement {
  const { theme, toggleTheme, source } = useTheme();
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  const label = source === 'system' ? `${nextTheme} • auto` : nextTheme;

  return (
    <button
      type="button"
      className={`${styles.toggle}${className ? ` ${className}` : ''}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <span aria-hidden className={styles.icon}>
        {theme === 'light' ? '🌙' : '☀️'}
      </span>
      <span className={styles.text}>Toggle {label}</span>
    </button>
  );
}
