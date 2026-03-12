import type { NextApiRequest, NextApiResponse } from 'next';
import type { AuthApiSuccess, ProxyAuthSuccess } from '../../../types/auth';
import {
  ProxyHttpError,
  requestBackendJson,
  respondWithProxyError
} from '../../../lib/api-proxy/backend';
import { clearAuthCookies, readAuthCookies, setAuthCookies } from '../../../lib/api-proxy/cookies';
import { buildForwardHeaders } from '../../../lib/api-proxy/forward-headers';

// === /api/auth/refresh proxy ===

/**
 * @description Exchanges a refresh cookie for fresh token cookies via Nest auth refresh endpoint.
 * @param req - Next API request carrying httpOnly auth cookies.
 * @param res - Next API response returning refreshed user context.
 * @returns A JSON payload with the refreshed user profile.
 * @Used_by
 *   - Axios refresh interceptor and auth bootstrap/session flows.
 * @Side_effects
 *   - Replaces access/refresh cookies when refresh succeeds.
 */
export default async function refreshHandler(
  req: NextApiRequest,
  res: NextApiResponse<ProxyAuthSuccess | { message: string; code: string }>
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const { refreshToken } = readAuthCookies(req);
  if (!refreshToken) {
    res.status(401).json({ message: 'Missing refresh token cookie', code: 'MISSING_REFRESH_COOKIE' });
    return;
  }

  try {
    const payload = await requestBackendJson<AuthApiSuccess>({
      path: '/auth/refresh',
      method: 'POST',
      bearerToken: refreshToken,
      headers: buildForwardHeaders(req)
    });

    setAuthCookies(res, payload.tokens);
    res.status(200).json({ user: payload.user });
  } catch (error) {
    if (error instanceof ProxyHttpError && error.status === 401) {
      clearAuthCookies(res);
    }
    respondWithProxyError(res, error);
  }
}
