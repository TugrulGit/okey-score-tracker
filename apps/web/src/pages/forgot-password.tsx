import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ThemeToggle } from '../components/ThemeToggle';
import { requestJson } from '../lib/api/httpClient';
import { toAuthFormErrorMessage } from '../lib/auth/auth-form-error';
import styles from '../styles/auth-page.module.css';

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.')
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordResponse {
  message: string;
}

/**
 * @description Renders forgot-password email capture form and success confirmation state.
 * @returns The forgot-password route UI.
 * @Used_by
 *   - Browser navigation to `/forgot-password`.
 * @Side_effects
 *   - Sends reset-email requests through the Next auth proxy.
 */
export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] =
    useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onSubmit'
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      const response = await requestJson<ForgotPasswordResponse>({
        url: '/auth/forgot-password',
        method: 'POST',
        data: {
          email: values.email
        },
        skipAuthRefresh: true
      });
      setConfirmationMessage(response.message);
    } catch (error) {
      setServerError(toAuthFormErrorMessage(error));
    }
  });

  return (
    <>
      <Head>
        <title>Okey Score • Forgot Password</title>
      </Head>
      <main className={styles.page}>
        <div className={styles.backgroundGlow} aria-hidden>
          <span className={`${styles.glow} ${styles.glowOne}`} />
          <span className={`${styles.glow} ${styles.glowTwo}`} />
        </div>

        <header className={styles.toolbar}>
          <Link className={styles.backLink} href="/login">
            ← Back to login
          </Link>
          <ThemeToggle />
        </header>

        <section className={styles.shell}>
          <p className={styles.eyebrow}>Recovery</p>
          <h1 className={styles.title}>Reset your password</h1>
          <p className={styles.subtitle}>
            Enter your account email and we will send reset instructions.
          </p>

          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input
                type="email"
                autoComplete="email"
                className={`${styles.input}${errors.email ? ` ${styles.inputError}` : ''}`}
                {...register('email')}
              />
              {errors.email ? (
                <p className={styles.errorText}>{errors.email.message}</p>
              ) : null}
            </label>

            {serverError ? <p className={styles.serverError}>{serverError}</p> : null}

            <button type="submit" className={styles.button} disabled={isSubmitting}>
              {isSubmitting ? 'Sending link...' : 'Send reset link'}
            </button>
          </form>

          {confirmationMessage ? (
            <p className={styles.infoBox}>{confirmationMessage}</p>
          ) : null}

          <div className={styles.links}>
            <Link className={styles.link} href="/register">
              Need an account?
            </Link>
            <Link className={styles.link} href="/login">
              Back to login
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
