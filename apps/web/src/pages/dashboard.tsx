import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../lib/auth/AuthContext';
import { AuthGate } from '../lib/auth/AuthGate';
import styles from '../styles/auth-page.module.css';

/**
 * @description Temporary protected dashboard target used by auth-page redirects.
 * @returns A guarded dashboard placeholder until the app-shell/dashboard epic is implemented.
 * @Used_by
 *   - Login/register success redirects and direct navigation to `/dashboard`.
 * @Side_effects
 *   - Invokes logout flow and client-side navigation when users sign out.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    await router.push('/login');
  };

  return (
    <>
      <Head>
        <title>Okey Score • Dashboard</title>
      </Head>
      <AuthGate loadingFallback={null}>
        <main className={styles.page}>
          <div className={styles.backgroundGlow} aria-hidden>
            <span className={`${styles.glow} ${styles.glowOne}`} />
            <span className={`${styles.glow} ${styles.glowTwo}`} />
          </div>

          <header className={styles.toolbar}>
            <Link className={styles.backLink} href="/">
              ← Back home
            </Link>
            <ThemeToggle />
          </header>

          <section className={styles.shell}>
            <p className={styles.eyebrow}>Dashboard</p>
            <h1 className={styles.title}>You are signed in</h1>
            <p className={styles.subtitle}>
              Welcome {user?.displayName ?? 'player'}. Dashboard shell pages are next in the
              roadmap.
            </p>

            <div className={styles.infoBox}>
              Current account: <strong>{user?.email ?? 'Unknown'}</strong>
            </div>

            <div className={styles.dashboardActions}>
              <Link className={styles.secondaryButton} href="/score_board">
                Open demo board
              </Link>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </section>
        </main>
      </AuthGate>
    </>
  );
}
