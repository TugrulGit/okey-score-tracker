import type { NextApiRequest, NextApiResponse } from 'next';
import { parse, serialize } from 'cookie';
import type { AuthTokenBundle } from '../../types/auth';
import {
  ACCESS_COOKIE_TTL_SECONDS,
  AUTH_COOKIE_NAMES,
  IS_PRODUCTION,
  REFRESH_COOKIE_TTL_SECONDS
} from './constants';

interface AuthCookieValues {
  accessToken?: string;
  refreshToken?: string;
}

// === Cookie parsing helpers ===

/**
 * @description Reads auth cookies from an incoming Next.js API request.
 * @param req - Next API request carrying the raw cookie header.
 * @returns Access/refresh token values when present; undefined entries when absent.
 * @Used_by
 *   - All auth proxy routes for forwarding bearer tokens to Nest.
 * @Side_effects
 *   - None.
 */
export function readAuthCookies(req: NextApiRequest): AuthCookieValues {
  const parsed = parse(req.headers.cookie ?? '');
  return {
    accessToken: parsed[AUTH_COOKIE_NAMES.accessToken],
    refreshToken: parsed[AUTH_COOKIE_NAMES.refreshToken]
  };
}

/**
 * @description Persists fresh auth tokens as httpOnly cookies on the response.
 * @param res - Next API response that will send `Set-Cookie` headers.
 * @param tokens - Token payload returned by Nest auth endpoints.
 * @returns None.
 * @Used_by
 *   - `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`, and `/api/auth/session` refresh fallback.
 * @Side_effects
 *   - Appends two `Set-Cookie` headers on the response.
 */
export function setAuthCookies(
  res: NextApiResponse,
  tokens: AuthTokenBundle
): void {
  appendSetCookie(res, [
    serialize(AUTH_COOKIE_NAMES.accessToken, tokens.accessToken, {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: 'lax',
      path: '/',
      maxAge: tokens.expiresIn || ACCESS_COOKIE_TTL_SECONDS
    }),
    serialize(AUTH_COOKIE_NAMES.refreshToken, tokens.refreshToken, {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_COOKIE_TTL_SECONDS
    })
  ]);
}

/**
 * @description Clears auth cookies by writing expired cookie values.
 * @param res - Next API response that should invalidate auth cookies.
 * @returns None.
 * @Used_by
 *   - `/api/auth/logout` and unauthorized recovery branches.
 * @Side_effects
 *   - Appends two expiring `Set-Cookie` headers on the response.
 */
export function clearAuthCookies(res: NextApiResponse): void {
  appendSetCookie(res, [
    serialize(AUTH_COOKIE_NAMES.accessToken, '', {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    }),
    serialize(AUTH_COOKIE_NAMES.refreshToken, '', {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    })
  ]);
}

/**
 * @description Appends new cookie values while preserving any pre-existing `Set-Cookie` header entries.
 * @param res - Next API response whose headers are being mutated.
 * @param values - Serialized cookie strings to append.
 * @returns None.
 * @Used_by
 *   - `setAuthCookies` and `clearAuthCookies` in this module.
 * @Side_effects
 *   - Mutates `res` headers.
 */
function appendSetCookie(res: NextApiResponse, values: string[]): void {
  const current = res.getHeader('Set-Cookie');
  const existing =
    typeof current === 'string'
      ? [current]
      : Array.isArray(current)
        ? current.map(String)
        : [];
  res.setHeader('Set-Cookie', [...existing, ...values]);
}
