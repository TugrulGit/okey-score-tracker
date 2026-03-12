import type { NextApiRequest, NextApiResponse } from 'next';
import type { AuthApiSuccess, ProxyAuthSuccess } from '../../../types/auth';
import { requestBackendJson, respondWithProxyError } from '../../../lib/api-proxy/backend';
import { setAuthCookies } from '../../../lib/api-proxy/cookies';
import { buildForwardHeaders } from '../../../lib/api-proxy/forward-headers';

// === /api/auth/register proxy ===

/**
 * @description Proxies registration requests to Nest auth and persists returned tokens in cookies.
 * @param req - Next API request containing registration fields.
 * @param res - Next API response returning the newly created user profile.
 * @returns A JSON payload with the authenticated user profile.
 * @Used_by
 *   - Browser auth flows via `httpClient.post('/auth/register')`.
 * @Side_effects
 *   - Sets access/refresh auth cookies on successful registration.
 */
export default async function registerHandler(
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
      path: '/auth/register',
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
