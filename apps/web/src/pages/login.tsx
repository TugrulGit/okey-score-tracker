import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../lib/auth/AuthContext';
import { toAuthFormErrorMessage } from '../lib/auth/auth-form-error';
import styles from '../styles/auth-page.module.css';

const loginSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address.')),
  password: z.string().min(8, 'Password must be at least 8 characters.')
});

type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * @description Renders the login page with zod-validated credentials form and proxy-backed submit flow.
 * @returns The login route UI.
 * @Used_by
 *   - Browser navigation to `/login`.
 * @Side_effects
 *   - Calls auth context login action and redirects authenticated users to `/dashboard`.
 */
export default function LoginPage() {
  const router = useRouter();
  const { login, status } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit'
  });

  useEffect(() => {
    if (status === 'authenticated') {
      void router.replace('/dashboard');
    }
  }, [status, router]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      await login({
        email: values.email,
        password: values.password
      });
      await router.push('/dashboard');
    } catch (error) {
      setServerError(toAuthFormErrorMessage(error));
    }
  });

  return (
    <>
      <Head>
        <title>Okey Score • Login</title>
      </Head>
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
          <p className={styles.eyebrow}>Welcome Back</p>
          <h1 className={styles.title}>Sign in to your score hub</h1>
          <p className={styles.subtitle}>
            Continue where you left off and keep your table history in sync.
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

            <label className={styles.field}>
              <span className={styles.label}>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                className={`${styles.input}${errors.password ? ` ${styles.inputError}` : ''}`}
                {...register('password')}
              />
              {errors.password ? (
                <p className={styles.errorText}>{errors.password.message}</p>
              ) : null}
            </label>

            {serverError ? <p className={styles.serverError}>{serverError}</p> : null}

            <button
              type="submit"
              className={styles.button}
              disabled={isSubmitting || status === 'loading'}
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className={styles.links}>
            <Link className={styles.link} href="/forgot-password">
              Forgot password?
            </Link>
            <Link className={styles.link} href="/register">
              Create account
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
