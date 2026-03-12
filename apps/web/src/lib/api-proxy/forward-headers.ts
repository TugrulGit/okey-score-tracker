import type { NextApiRequest } from 'next';

// === Upstream context forwarding ===

/**
 * @description Builds selected headers that preserve client context for upstream auth/session records.
 * @param req - Incoming Next.js API request.
 * @returns Header object containing `user-agent` and `x-forwarded-for` when available.
 * @Used_by
 *   - Auth proxy routes before forwarding requests to Nest.
 * @Side_effects
 *   - None.
 */
export function buildForwardHeaders(
  req: NextApiRequest
): Record<string, string | undefined> {
  const userAgentHeader = req.headers['user-agent'];
  const forwardedForHeader = req.headers['x-forwarded-for'];

  const userAgent = Array.isArray(userAgentHeader)
    ? userAgentHeader[0]
    : userAgentHeader;

  const forwardedFor = Array.isArray(forwardedForHeader)
    ? forwardedForHeader[0]
    : forwardedForHeader;

  return {
    'user-agent': userAgent,
    'x-forwarded-for': forwardedFor ?? req.socket.remoteAddress
  };
}
