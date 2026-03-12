// === Shared auth payload contracts ===

/**
 * @description Public user profile fields returned by auth/session endpoints.
 */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  timezone: string;
}

/**
 * @description Token bundle returned from the Nest auth module.
 */
export interface AuthTokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * @description Successful payload shape returned by Nest auth endpoints.
 */
export interface AuthApiSuccess {
  user: AuthUser;
  tokens: AuthTokenBundle;
}

/**
 * @description Successful payload exposed by Next.js auth proxy routes.
 */
export interface ProxyAuthSuccess {
  user: AuthUser;
}

/**
 * @description Normalized API error contract used by both API routes and the browser client.
 */
export interface ApiErrorPayload {
  message: string;
  code: string;
  details?: unknown;
}
