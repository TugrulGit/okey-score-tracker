import type { NextApiRequest, NextApiResponse } from 'next';
import { requestBackendJson, respondWithProxyError } from '../../../lib/api-proxy/backend';

interface ResetPasswordResponse {
  message: string;
}

// === /api/auth/reset-password proxy ===

/**
 * @description Proxies reset-password submissions (token + new password) to Nest.
 * @param req - Next API request containing reset token and new password fields.
 * @param res - Next API response with success/failure message.
 * @returns A reset completion payload from the auth module.
 * @Used_by
 *   - Upcoming `/reset-password` page submission flow.
 * @Side_effects
 *   - None.
 */
export default async function resetPasswordHandler(
  req: NextApiRequest,
  res: NextApiResponse<ResetPasswordResponse | { message: string; code: string }>
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    const payload = await requestBackendJson<ResetPasswordResponse>({
      path: '/auth/reset-password',
      method: 'POST',
      body: req.body
    });

    res.status(200).json(payload);
  } catch (error) {
    respondWithProxyError(res, error);
  }
}
