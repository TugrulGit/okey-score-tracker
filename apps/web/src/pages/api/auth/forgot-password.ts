import type { NextApiRequest, NextApiResponse } from 'next';
import { requestBackendJson, respondWithProxyError } from '../../../lib/api-proxy/backend';

interface ForgotPasswordResponse {
  message: string;
}

// === /api/auth/forgot-password proxy ===

/**
 * @description Proxies forgot-password requests to Nest without exposing tokens.
 * @param req - Next API request containing the target email.
 * @param res - Next API response with the generic confirmation message.
 * @returns A confirmation payload from the auth module.
 * @Used_by
 *   - Upcoming `/forgot-password` page form submission.
 * @Side_effects
 *   - None.
 */
export default async function forgotPasswordHandler(
  req: NextApiRequest,
  res: NextApiResponse<ForgotPasswordResponse | { message: string; code: string }>
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    const payload = await requestBackendJson<ForgotPasswordResponse>({
      path: '/auth/forgot-password',
      method: 'POST',
      body: req.body
    });

    res.status(200).json(payload);
  } catch (error) {
    respondWithProxyError(res, error);
  }
}
