import Head from 'next/head';
import { AuthGate } from '../lib/auth/AuthGate';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import styles from '../styles/app-shell-page.module.css';

/**
 * @description Renders the protected history placeholder inside the shared dashboard layout.
 * @returns History route scaffold for upcoming history epic work.
 * @Used_by
 *   - Sidebar navigation to `/history`.
 * @Side_effects
 *   - None.
 */
export default function HistoryPage() {
  return (
    <>
      <Head>
        <title>Okey Score • History</title>
      </Head>
      <AuthGate loadingFallback={null}>
        <DashboardLayout
          title="History"
          subtitle="Completed games, filters, and snapshot replay will be added here."
        >
          <div className={styles.stack}>
            <article className={styles.card}>
              <p className={styles.cardEyebrow}>Placeholder</p>
              <h3 className={styles.cardTitle}>History module pending</h3>
              <p className={styles.cardCopy}>
                This route is now wired into the app shell so navigation and
                route guards are already in place.
              </p>
              <ul className={styles.metaList}>
                <li>Infinite history feed</li>
                <li>Filters by date and participants</li>
                <li>Readonly scoreboard replay modal</li>
              </ul>
            </article>
          </div>
        </DashboardLayout>
      </AuthGate>
    </>
  );
}
