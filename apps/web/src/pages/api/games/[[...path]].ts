import type { NextApiRequest, NextApiResponse } from 'next';
import { requestBackendJson, respondWithProxyError } from '../../../lib/api-proxy/backend';
import { readAuthCookies } from '../../../lib/api-proxy/cookies';
import { buildForwardHeaders } from '../../../lib/api-proxy/forward-headers';

type AllowedMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const ALLOWED_METHODS: AllowedMethod[] = ['GET', 'POST', 'PATCH', 'DELETE'];
const METHODS_WITH_BODY: AllowedMethod[] = ['POST', 'PATCH'];

// === /api/games/* proxy ===

/**
 * @description Proxies authenticated game requests to Nest while forwarding the access-token cookie as bearer auth.
 * @param req - Next API request containing method, path segments, query params, and optional JSON body.
 * @param res - Next API response returning backend JSON payloads or normalized proxy errors.
 * @returns JSON response from the upstream `/games` API route.
 * @Used_by
 *   - Dashboard game data hooks and mutations through `httpClient` (`/api/games/*`).
 * @Side_effects
 *   - Performs network I/O to Nest; may mutate game state for POST/PATCH requests.
 */
export default async function gamesProxyHandler(
  req: NextApiRequest,
  res: NextApiResponse<unknown | { message: string; code: string }>
): Promise<void> {
  const method = req.method as AllowedMethod | undefined;

  if (!method || !ALLOWED_METHODS.includes(method)) {
    res.setHeader('Allow', ALLOWED_METHODS.join(', '));
    res.status(405).json({ message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const { accessToken } = readAuthCookies(req);
  if (!accessToken) {
    res.status(401).json({ message: 'Missing session token', code: 'MISSING_ACCESS_COOKIE' });
    return;
  }

  try {
    const payload = await requestBackendJson<unknown>({
      path: buildGamesPath(req),
      method,
      body: METHODS_WITH_BODY.includes(method) ? req.body : undefined,
      bearerToken: accessToken,
      headers: buildForwardHeaders(req)
    });

    res.status(200).json(payload);
  } catch (error) {
    respondWithProxyError(res, error);
  }
}

/**
 * @description Builds the upstream `/games` path including optional nested segments and query-string filters.
 * @param req - Next API request carrying catch-all `path` segments and additional query params.
 * @returns API-relative path passed to `requestBackendJson`.
 * @Used_by
 *   - `gamesProxyHandler` before forwarding requests upstream.
 * @Side_effects
 *   - None.
 */
function buildGamesPath(req: NextApiRequest): string {
  const segmentParam = req.query.path;
  const segments = Array.isArray(segmentParam)
    ? segmentParam
    : segmentParam
      ? [segmentParam]
      : [];
  const basePath = `/games${segments.length ? `/${segments.join('/')}` : ''}`;

  const queryEntries = Object.entries(req.query).filter(
    ([key]) => key !== 'path'
  );

  if (queryEntries.length === 0) {
    return basePath;
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of queryEntries) {
    if (Array.isArray(value)) {
      value.forEach((entry) => searchParams.append(key, entry));
      continue;
    }
    if (typeof value === 'string') {
      searchParams.append(key, value);
    }
  }

  const suffix = searchParams.toString();
  return suffix ? `${basePath}?${suffix}` : basePath;
}
