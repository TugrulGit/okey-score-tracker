// === Auth proxy configuration ===

export const API_BASE_URL =
  process.env.API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:4000';

export const AUTH_COOKIE_NAMES = {
  accessToken: 'okey_access_token',
  refreshToken: 'okey_refresh_token'
} as const;

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const ACCESS_COOKIE_TTL_SECONDS = resolvePositiveInt(
  process.env.JWT_ACCESS_TTL,
  15 * 60
);

export const REFRESH_COOKIE_TTL_SECONDS = resolvePositiveInt(
  process.env.JWT_REFRESH_TTL,
  7 * 24 * 60 * 60
);

/**
 * @description Parses positive integers from env strings with a safe fallback.
 * @param value - Raw env variable value (may be undefined/non-numeric).
 * @param fallback - Default integer used when `value` cannot be parsed.
 * @returns A positive integer used for cookie TTL calculations.
 * @Used_by
 *   - Auth cookie TTL constants in this module.
 * @Side_effects
 *   - None.
 */
function resolvePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
