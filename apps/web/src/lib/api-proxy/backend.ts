import type { NextApiResponse } from 'next';
import { API_BASE_URL } from './constants';
import type { ApiErrorPayload } from '../../types/auth';

interface BackendRequestOptions {
  path: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  bearerToken?: string;
  headers?: Record<string, string | undefined>;
}

interface ErrorLike {
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * @description Rich error used when a backend proxy request returns non-2xx status.
 * @param status - HTTP status code returned by the upstream API.
 * @param payload - Upstream `{ message, code }` response payload.
 * @returns An Error instance carrying status + structured payload.
 * @Used_by
 *   - `requestBackendJson` and `respondWithProxyError` for consistent route error handling.
 * @Side_effects
 *   - None.
 */
export class ProxyHttpError extends Error {
  status: number;
  payload: ApiErrorPayload;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.status = status;
    this.payload = payload;
  }
}

// === Backend request transport ===

/**
 * @description Calls the Nest API and returns parsed JSON on success.
 * @param options - Request details (path, method, optional JSON body, optional bearer token, optional passthrough headers).
 * @returns Parsed JSON payload typed as `T`.
 * @Used_by
 *   - All Next auth proxy route handlers.
 * @Side_effects
 *   - Performs network I/O to the upstream Nest API.
 */
export async function requestBackendJson<T>(
  options: BackendRequestOptions
): Promise<T> {
  const response = await fetch(buildApiUrl(options.path), {
    method: options.method,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.bearerToken
        ? { Authorization: `Bearer ${options.bearerToken}` }
        : {}),
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new ProxyHttpError(response.status, toApiErrorPayload(payload));
  }

  return payload as T;
}

/**
 * @description Serializes proxy handler errors into Next.js API responses.
 * @param res - Next API response object that should receive the normalized error.
 * @param error - Unknown error thrown while proxying to Nest.
 * @returns None.
 * @Used_by
 *   - Catch blocks in `/pages/api/auth/*` handlers.
 * @Side_effects
 *   - Writes status + JSON body to the response.
 */
export function respondWithProxyError(
  res: NextApiResponse,
  error: unknown
): void {
  if (error instanceof ProxyHttpError) {
    res.status(error.status).json(error.payload);
    return;
  }

  const fallback = toApiErrorPayload(
    error && typeof error === 'object' ? (error as ErrorLike) : null
  );

  res.status(500).json({
    message: fallback.message || 'Unexpected proxy failure',
    code: fallback.code || 'PROXY_ERROR',
    details: fallback.details
  });
}

/**
 * @description Builds an absolute upstream URL from an API-relative path.
 * @param path - Relative path (for example `/auth/login` or `users/me`).
 * @returns Fully qualified URL rooted at `API_BASE_URL`.
 * @Used_by
 *   - `requestBackendJson` before invoking `fetch`.
 * @Side_effects
 *   - None.
 */
function buildApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

/**
 * @description Parses JSON/text payloads from upstream responses with safe fallback.
 * @param response - Fetch response from the upstream Nest API.
 * @returns Parsed payload object/string or null when body is empty/unreadable.
 * @Used_by
 *   - `requestBackendJson`.
 * @Side_effects
 *   - Consumes the response body stream.
 */
async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

/**
 * @description Normalizes arbitrary payloads into `{ message, code, details }` shape.
 * @param payload - Unknown upstream payload or runtime error object.
 * @returns API error payload consumable by both browser and server helpers.
 * @Used_by
 *   - `requestBackendJson` and `respondWithProxyError`.
 * @Side_effects
 *   - None.
 */
function toApiErrorPayload(payload: unknown): ApiErrorPayload {
  if (payload && typeof payload === 'object') {
    const candidate = payload as ErrorLike;
    return {
      message: candidate.message ?? 'Request failed',
      code: candidate.code ?? 'HTTP_ERROR',
      details: candidate.details ?? payload
    };
  }

  return {
    message: 'Request failed',
    code: 'HTTP_ERROR',
    details: payload
  };
}
