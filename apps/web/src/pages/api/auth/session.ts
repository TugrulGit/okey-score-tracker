import type { NextApiRequest, NextApiResponse } from 'next';
import type { AuthApiSuccess, AuthUser, ProxyAuthSuccess } from '../../../types/auth';
import {
  ProxyHttpError,
  requestBackendJson,
  respondWithProxyError
} from '../../../lib/api-proxy/backend';
import { clearAuthCookies, readAuthCookies, setAuthCookies } from '../../../lib/api-proxy/cookies';
import { buildForwardHeaders } from '../../../lib/api-proxy/forward-headers';

// === /api/auth/session proxy ===

/**
 * @description Returns the current authenticated user by validating access cookie, with refresh fallback when expired.
 * @param req - Next API request carrying access/refresh cookies.
 * @param res - Next API response returning a normalized session payload.
 * @returns A user payload when a valid session exists; 401 otherwise.
 * @Used_by
 *   - `AuthProvider` bootstrap during app mount.
 * @Side_effects
 *   - May rotate auth cookies when refresh fallback succeeds or clear cookies when both tokens are invalid.
 */
export default async function sessionHandler(
  req: NextApiRequest,
  res: NextApiResponse<ProxyAuthSuccess | { message: string; code: string }>
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const { accessToken, refreshToken } = readAuthCookies(req);

  if (!accessToken && !refreshToken) {
    clearAuthCookies(res);
    res.status(401).json({ message: 'No active session', code: 'NO_ACTIVE_SESSION' });
    return;
  }

  try {
    if (accessToken) {
      const me = await requestBackendJson<AuthUser>({
        path: '/users/me',
        method: 'GET',
        bearerToken: accessToken
      });

      if (!me) {
        throw new ProxyHttpError(401, {
          message: 'Session user not found',
          code: 'SESSION_USER_NOT_FOUND'
        });
      }

      res.status(200).json({ user: me });
      return;
    }
  } catch (error) {
    const shouldTryRefresh =
      error instanceof ProxyHttpError &&
      error.status === 401 &&
      Boolean(refreshToken);

    if (!shouldTryRefresh) {
      respondWithProxyError(res, error);
      return;
    }
  }

  if (!refreshToken) {
    clearAuthCookies(res);
    res.status(401).json({ message: 'Refresh token missing', code: 'MISSING_REFRESH_COOKIE' });
    return;
  }

  try {
    const refreshed = await requestBackendJson<AuthApiSuccess>({
      path: '/auth/refresh',
      method: 'POST',
      bearerToken: refreshToken,
      headers: buildForwardHeaders(req)
    });

    setAuthCookies(res, refreshed.tokens);
    res.status(200).json({ user: refreshed.user });
  } catch (error) {
    clearAuthCookies(res);
    respondWithProxyError(res, error);
  }
}
