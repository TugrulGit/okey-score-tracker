import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ThemeToggle } from '../components/ThemeToggle';
import { requestJson } from '../lib/api/httpClient';
import { toAuthFormErrorMessage } from '../lib/auth/auth-form-error';
import styles from '../styles/auth-page.module.css';

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .regex(/[a-z]/i, 'Password must include at least one letter.')
      .regex(/\d/, 'Password must include at least one number.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.')
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.'
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordResponse {
  message: string;
}

/**
 * @description Renders reset-password form that consumes the token query parameter and submits a new password.
 * @returns The reset-password route UI.
 * @Used_by
 *   - Browser navigation to `/reset-password?token=...` from reset emails.
 * @Side_effects
 *   - Sends password reset submissions through the Next auth proxy.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const token = useMemo(() => {
    const queryToken = router.query.token;
    return typeof queryToken === 'string' ? queryToken : '';
  }, [router.query.token]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onSubmit'
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!token) {
      setServerError('Reset token is missing. Please request a new reset link.');
      return;
    }

    setServerError(null);

    try {
      const response = await requestJson<ResetPasswordResponse>({
        url: '/auth/reset-password',
        method: 'POST',
        data: {
          token,
          newPassword: values.newPassword
        },
        skipAuthRefresh: true
      });

      setSuccessMessage(response.message);
    } catch (error) {
      setServerError(toAuthFormErrorMessage(error));
    }
  });

  return (
    <>
      <Head>
        <title>Okey Score • Set New Password</title>
      </Head>
      <main className={styles.page}>
        <div className={styles.backgroundGlow} aria-hidden>
          <span className={`${styles.glow} ${styles.glowOne}`} />
          <span className={`${styles.glow} ${styles.glowTwo}`} />
        </div>

        <header className={styles.toolbar}>
          <Link className={styles.backLink} href="/forgot-password">
            ← Request new link
          </Link>
          <ThemeToggle />
        </header>

        <section className={styles.shell}>
          <p className={styles.eyebrow}>Set New Password</p>
          <h1 className={styles.title}>Choose a fresh password</h1>
          <p className={styles.subtitle}>
            For security, use at least 8 characters including letters and numbers.
          </p>

          {!token && router.isReady ? (
            <p className={styles.serverError}>
              Reset token missing from URL. Please request a new reset link.
            </p>
          ) : null}

          {successMessage ? (
            <>
              <p className={styles.infoBox}>{successMessage}</p>
              <div className={styles.links}>
                <Link className={styles.link} href="/login">
                  Continue to login
                </Link>
              </div>
            </>
          ) : (
            <form className={styles.form} onSubmit={onSubmit} noValidate>
              <label className={styles.field}>
                <span className={styles.label}>New password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={`${styles.input}${errors.newPassword ? ` ${styles.inputError}` : ''}`}
                  {...register('newPassword')}
                />
                {errors.newPassword ? (
                  <p className={styles.errorText}>{errors.newPassword.message}</p>
                ) : null}
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Confirm new password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={`${styles.input}${errors.confirmPassword ? ` ${styles.inputError}` : ''}`}
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword ? (
                  <p className={styles.errorText}>{errors.confirmPassword.message}</p>
                ) : null}
              </label>

              {serverError ? <p className={styles.serverError}>{serverError}</p> : null}

              <button type="submit" className={styles.button} disabled={isSubmitting || !token}>
                {isSubmitting ? 'Updating password...' : 'Update password'}
              </button>
            </form>
          )}
        </section>
      </main>
    </>
  );
}
