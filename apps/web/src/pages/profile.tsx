import Head from 'next/head';
import { AuthGate } from '../lib/auth/AuthGate';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import styles from '../styles/app-shell-page.module.css';

/**
 * @description Renders the protected profile placeholder inside the shared dashboard layout.
 * @returns Profile route scaffold for upcoming profile epic work.
 * @Used_by
 *   - Sidebar navigation to `/profile`.
 * @Side_effects
 *   - None.
 */
export default function ProfilePage() {
  return (
    <>
      <Head>
        <title>Okey Score • Profile</title>
      </Head>
      <AuthGate loadingFallback={null}>
        <DashboardLayout
          title="Profile"
          subtitle="Account preferences, password updates, and session controls live here next."
        >
          <div className={styles.stack}>
            <article className={styles.card}>
              <p className={styles.cardEyebrow}>Placeholder</p>
              <h3 className={styles.cardTitle}>Profile module pending</h3>
              <p className={styles.cardCopy}>
                The protected route is active and ready for profile API wiring in
                the next epic.
              </p>
              <ul className={styles.metaList}>
                <li>Personal details form</li>
                <li>Password change flow</li>
                <li>Session revocation table</li>
              </ul>
            </article>
          </div>
        </DashboardLayout>
      </AuthGate>
    </>
  );
}
