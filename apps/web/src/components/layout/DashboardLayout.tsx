import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { ThemeToggle } from '../ThemeToggle';
import { useAuth } from '../../lib/auth/AuthContext';
import styles from './DashboardLayout.module.css';

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/history', label: 'History' },
  { href: '/profile', label: 'Profile' }
];

// === Route matching helpers ===

/**
 * @description Resolves whether a nav item should be highlighted as active.
 * @param pathname - Current route pathname from Next router.
 * @param href - Nav target href.
 * @returns True when the current path belongs to the nav target.
 * @Used_by
 *   - Sidebar and mobile drawer nav rendering inside `DashboardLayout`.
 * @Side_effects
 *   - None.
 */
function isActivePath(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * @description Derives short initials for user avatar pills in the app shell top bar.
 * @param displayName - User display name when available.
 * @param email - User email fallback.
 * @returns A 1-2 character uppercase initials string.
 * @Used_by
 *   - `DashboardLayout` user badge rendering.
 * @Side_effects
 *   - None.
 */
function deriveInitials(displayName?: string, email?: string): string {
  const source = displayName?.trim() || email?.trim() || 'U';
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

// === App shell layout ===

/**
 * @description Reusable authenticated app shell with responsive sidebar/drawer navigation and top bar controls.
 * @param title - Page title shown in the shell header.
 * @param subtitle - Optional supporting text shown under the title.
 * @param children - Route-specific page content rendered in the shell content area.
 * @returns A full-page app shell layout for dashboard/history/profile routes.
 * @Used_by
 *   - `/dashboard`, `/history`, and `/profile` pages.
 * @Side_effects
 *   - Performs logout requests and route transitions; toggles mobile navigation drawer state.
 */
export function DashboardLayout({
  title,
  subtitle,
  children
}: DashboardLayoutProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [router.asPath]);

  const initials = useMemo(
    () => deriveInitials(user?.displayName, user?.email),
    [user?.displayName, user?.email]
  );

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await logout();
      await router.push('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.glowLayer} aria-hidden>
        <span className={`${styles.glow} ${styles.glowOne}`} />
        <span className={`${styles.glow} ${styles.glowTwo}`} />
      </div>

      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.brandBlock}>
            <p className={styles.brandEyebrow}>Okey Score</p>
            <h1 className={styles.brandTitle}>Control Center</h1>
          </div>

          <nav className={styles.nav} aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem}${isActivePath(router.pathname, item.href) ? ` ${styles.navItemActive}` : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            className={styles.logoutButton}
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </aside>

        <div className={styles.mainColumn}>
          <header className={styles.topBar}>
            <div>
              <p className={styles.pageEyebrow}>Authenticated Workspace</p>
              <h2 className={styles.pageTitle}>{title}</h2>
              {subtitle ? <p className={styles.pageSubtitle}>{subtitle}</p> : null}
            </div>

            <div className={styles.topActions}>
              <div className={styles.userChip}>
                <span className={styles.userInitials} aria-hidden>
                  {initials}
                </span>
                <div className={styles.userMeta}>
                  <span className={styles.userName}>
                    {user?.displayName ?? 'Player'}
                  </span>
                  <span className={styles.userEmail}>{user?.email ?? '—'}</span>
                </div>
              </div>

              <ThemeToggle />

              <button
                type="button"
                className={styles.mobileMenuButton}
                aria-label="Toggle navigation"
                aria-expanded={isMobileNavOpen}
                onClick={() => setIsMobileNavOpen((prev) => !prev)}
              >
                {isMobileNavOpen ? 'Close' : 'Menu'}
              </button>
            </div>
          </header>

          <section className={styles.content}>{children}</section>
        </div>
      </div>

      {isMobileNavOpen ? (
        <div className={styles.mobileDrawer}>
          <nav className={styles.mobileNav} aria-label="Mobile primary">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.mobileNavItem}${isActivePath(router.pathname, item.href) ? ` ${styles.mobileNavItemActive}` : ''}`}
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              className={styles.mobileLogoutButton}
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </nav>
        </div>
      ) : null}
    </main>
  );
}
