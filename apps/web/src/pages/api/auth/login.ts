import type { NextApiRequest, NextApiResponse } from 'next';
import type { AuthApiSuccess, ProxyAuthSuccess } from '../../../types/auth';
import { requestBackendJson, respondWithProxyError } from '../../../lib/api-proxy/backend';
import { setAuthCookies } from '../../../lib/api-proxy/cookies';
import { buildForwardHeaders } from '../../../lib/api-proxy/forward-headers';

// === /api/auth/login proxy ===

/**
 * @description Proxies login requests to Nest auth, then stores returned tokens in httpOnly cookies.
 * @param req - Next API request containing login credentials.
 * @param res - Next API response returning the authenticated user.
 * @returns A JSON payload with the authenticated user profile.
 * @Used_by
 *   - Browser auth flows via `httpClient.post('/auth/login')`.
 * @Side_effects
 *   - Sets access/refresh auth cookies on successful login.
 */
export default async function loginHandler(
  req: NextApiRequest,
  res: NextApiResponse<ProxyAuthSuccess | { message: string; code: string }>
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    const payload = await requestBackendJson<AuthApiSuccess>({
      path: '/auth/login',
      method: 'POST',
      body: req.body,
      headers: buildForwardHeaders(req)
    });

    setAuthCookies(res, payload.tokens);
    res.status(200).json({ user: payload.user });
  } catch (error) {
    respondWithProxyError(res, error);
  }
}
