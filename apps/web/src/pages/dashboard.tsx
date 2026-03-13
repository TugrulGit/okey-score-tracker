import Head from 'next/head';
import Link from 'next/link';
import { AuthGate } from '../lib/auth/AuthGate';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import styles from '../styles/app-shell-page.module.css';

/**
 * @description Renders the protected dashboard landing surface inside the reusable app shell.
 * @returns Dashboard route content wrapped by auth gate + dashboard layout.
 * @Used_by
 *   - Navigation to `/dashboard` after successful auth flows.
 * @Side_effects
 *   - None.
 */
export default function DashboardPage() {
  return (
    <>
      <Head>
        <title>Okey Score • Dashboard</title>
      </Head>
      <AuthGate loadingFallback={null}>
        <DashboardLayout
          title="Dashboard"
          subtitle="Track active games, history, and profile controls from one place."
        >
          <div className={styles.stack}>
            <article className={styles.card}>
              <p className={styles.cardEyebrow}>Status</p>
              <h3 className={styles.cardTitle}>App shell ready</h3>
              <p className={styles.cardCopy}>
                The responsive navigation and top-bar user controls are now in
                place. Dashboard game wiring is the next epic.
              </p>
              <Link className={styles.linkButton} href="/score_board">
                Open score board demo
              </Link>
            </article>

            <div className={styles.grid}>
              <article className={styles.card}>
                <p className={styles.cardEyebrow}>Next</p>
                <h3 className={styles.cardTitle}>History view</h3>
                <p className={styles.cardCopy}>
                  Browse completed sessions and inspect round snapshots.
                </p>
                <Link className={styles.linkButton} href="/history">
                  Go to history
                </Link>
              </article>

              <article className={styles.card}>
                <p className={styles.cardEyebrow}>Next</p>
                <h3 className={styles.cardTitle}>Profile controls</h3>
                <p className={styles.cardCopy}>
                  Manage personal details, password rotation, and active sessions.
                </p>
                <Link className={styles.linkButton} href="/profile">
                  Go to profile
                </Link>
              </article>
            </div>
          </div>
        </DashboardLayout>
      </AuthGate>
    </>
  );
}
