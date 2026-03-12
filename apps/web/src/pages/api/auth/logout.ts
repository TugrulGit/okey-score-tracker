import type { NextApiRequest, NextApiResponse } from 'next';
import { requestBackendJson, respondWithProxyError } from '../../../lib/api-proxy/backend';
import { clearAuthCookies, readAuthCookies } from '../../../lib/api-proxy/cookies';

interface LogoutResponse {
  success: boolean;
}

// === /api/auth/logout proxy ===

/**
 * @description Proxies logout to Nest (when refresh cookie exists) and always clears local auth cookies.
 * @param req - Next API request carrying auth cookies.
 * @param res - Next API response returning a success flag.
 * @returns `{ success: true }` after cookies are cleared.
 * @Used_by
 *   - Browser logout actions and refresh-failure cleanup paths.
 * @Side_effects
 *   - Clears auth cookies and may revoke the active refresh session upstream.
 */
export default async function logoutHandler(
  req: NextApiRequest,
  res: NextApiResponse<LogoutResponse | { message: string; code: string }>
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const { refreshToken } = readAuthCookies(req);

  try {
    if (refreshToken) {
      await requestBackendJson<LogoutResponse>({
        path: '/auth/logout',
        method: 'POST',
        bearerToken: refreshToken
      });
    }

    clearAuthCookies(res);
    res.status(200).json({ success: true });
  } catch (error) {
    // If upstream logout fails, still clear local cookies before surfacing the proxy error.
    clearAuthCookies(res);
    respondWithProxyError(res, error);
  }
}
