import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../lib/auth/AuthContext';
import { toAuthFormErrorMessage } from '../lib/auth/auth-form-error';
import styles from '../styles/auth-page.module.css';

const registerSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, 'Display name must be at least 2 characters.'),
    email: z.string().trim().pipe(z.email('Enter a valid email address.')),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .regex(/[a-z]/i, 'Password must include at least one letter.')
      .regex(/\d/, 'Password must include at least one number.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
    avatarUrl: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || /^https?:\/\//.test(value),
        'Avatar URL must start with http:// or https://.'
      )
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.'
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

/**
 * @description Renders the registration page with inline zod validation and auth-proxy submission.
 * @returns The register route UI.
 * @Used_by
 *   - Browser navigation to `/register`.
 * @Side_effects
 *   - Calls auth context register action and redirects authenticated users to `/dashboard`.
 */
export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, status } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
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
      await registerUser({
        displayName: values.displayName,
        email: values.email,
        password: values.password,
        avatarUrl: values.avatarUrl || undefined,
        timezone
      });
      await router.push('/dashboard');
    } catch (error) {
      setServerError(toAuthFormErrorMessage(error));
    }
  });

  return (
    <>
      <Head>
        <title>Okey Score • Register</title>
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
          <p className={styles.eyebrow}>Get Started</p>
          <h1 className={styles.title}>Create your Okey Score account</h1>
          <p className={styles.subtitle}>
            Register once to save your sessions, history, and table preferences.
          </p>

          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <label className={styles.field}>
              <span className={styles.label}>Display name</span>
              <input
                type="text"
                autoComplete="name"
                className={`${styles.input}${errors.displayName ? ` ${styles.inputError}` : ''}`}
                {...register('displayName')}
              />
              {errors.displayName ? (
                <p className={styles.errorText}>{errors.displayName.message}</p>
              ) : null}
            </label>

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
                autoComplete="new-password"
                className={`${styles.input}${errors.password ? ` ${styles.inputError}` : ''}`}
                {...register('password')}
              />
              {errors.password ? (
                <p className={styles.errorText}>{errors.password.message}</p>
              ) : null}
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Confirm password</span>
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

            <label className={styles.field}>
              <span className={styles.label}>Avatar URL (optional)</span>
              <input
                type="url"
                autoComplete="url"
                className={`${styles.input}${errors.avatarUrl ? ` ${styles.inputError}` : ''}`}
                {...register('avatarUrl')}
              />
              {errors.avatarUrl ? (
                <p className={styles.errorText}>{errors.avatarUrl.message}</p>
              ) : null}
            </label>

            {serverError ? <p className={styles.serverError}>{serverError}</p> : null}

            <button
              type="submit"
              className={styles.button}
              disabled={isSubmitting || status === 'loading'}
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className={styles.links}>
            <Link className={styles.link} href="/login">
              Already have an account?
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
