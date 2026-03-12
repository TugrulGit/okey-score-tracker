import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig
} from 'axios';
import type { ApiErrorPayload } from '../../types/auth';

// === Axios request config augmentation ===

declare module 'axios' {
  interface AxiosRequestConfig {
    skipAuthRefresh?: boolean;
    _retry?: boolean;
  }
}

interface ApiClientErrorInit {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * @description Normalized HTTP client error exposed to consuming hooks/components.
 * @param init - Structured error data (status, message, code, optional details).
 * @returns Error instance with API metadata for UI-level handling.
 * @Used_by
 *   - Axios interceptor failure path and auth context consumers.
 * @Side_effects
 *   - None.
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(init: ApiClientErrorInit) {
    super(init.message);
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
  }
}

// === HTTP client setup ===

export const httpClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
});

let refreshRequest: Promise<void> | null = null;

const AUTH_ENDPOINT_FRAGMENT = '/auth/';

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorPayload>) => {
    const config = (error.config ?? {}) as InternalAxiosRequestConfig &
      AxiosRequestConfig;

    if (shouldRetryWithRefresh(error, config)) {
      config._retry = true;

      try {
        await ensureFreshSession();
        return httpClient.request(config);
      } catch (refreshError) {
        await requestLogoutCleanup();
        throw toApiClientError(refreshError);
      }
    }

    throw toApiClientError(error);
  }
);

/**
 * @description Convenience request wrapper returning response body only.
 * @param config - Standard axios request options.
 * @returns Typed response body payload.
 * @Used_by
 *   - Web features that prefer lightweight request calls over full axios responses.
 * @Side_effects
 *   - Performs network I/O to Next.js API routes.
 */
export async function requestJson<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await httpClient.request<T>(config);
  return response.data;
}

// === Refresh and retry helpers ===

/**
 * @description Determines whether the failed request should trigger a token refresh and retry.
 * @param error - Axios error returned from the original request.
 * @param config - Original axios request config.
 * @returns True when request is retriable via refresh; otherwise false.
 * @Used_by
 *   - Response interceptor retry branch.
 * @Side_effects
 *   - None.
 */
function shouldRetryWithRefresh(
  error: AxiosError<ApiErrorPayload>,
  config: AxiosRequestConfig
): boolean {
  const unauthorized = error.response?.status === 401;
  if (!unauthorized) {
    return false;
  }

  if (config.skipAuthRefresh || config._retry) {
    return false;
  }

  const url = config.url ?? '';
  return !url.includes(AUTH_ENDPOINT_FRAGMENT);
}

/**
 * @description Deduplicates parallel refresh calls so only one `/auth/refresh` request runs at a time.
 * @returns Promise that resolves once the session refresh succeeds.
 * @Used_by
 *   - Response interceptor when retrying unauthorized requests.
 * @Side_effects
 *   - May mutate auth cookies through the `/api/auth/refresh` route.
 */
async function ensureFreshSession(): Promise<void> {
  if (!refreshRequest) {
    refreshRequest = httpClient
      .post('/auth/refresh', undefined, { skipAuthRefresh: true })
      .then(() => undefined)
      .finally(() => {
        refreshRequest = null;
      });
  }

  await refreshRequest;
}

/**
 * @description Performs best-effort logout cleanup after refresh failure.
 * @returns Promise that resolves regardless of logout success.
 * @Used_by
 *   - Response interceptor refresh failure branch.
 * @Side_effects
 *   - Requests cookie/session invalidation via `/api/auth/logout`.
 */
async function requestLogoutCleanup(): Promise<void> {
  try {
    await httpClient.post('/auth/logout', undefined, { skipAuthRefresh: true });
  } catch {
    // Ignore cleanup errors; the original auth failure will be surfaced.
  }
}

// === Error normalization ===

/**
 * @description Converts unknown/axios errors into a single `ApiClientError` shape.
 * @param error - Unknown thrown value from axios/interceptor branches.
 * @returns Normalized `ApiClientError` suitable for UI and form error handling.
 * @Used_by
 *   - Axios interceptor rejection path.
 * @Side_effects
 *   - None.
 */
function toApiClientError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) {
    return error;
  }

  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const status = error.response?.status ?? 500;
    return new ApiClientError({
      status,
      message: error.response?.data?.message ?? error.message ?? 'Request failed',
      code: error.response?.data?.code ?? 'HTTP_ERROR',
      details: error.response?.data?.details
    });
  }

  if (error instanceof Error) {
    return new ApiClientError({
      status: 500,
      code: 'UNKNOWN_ERROR',
      message: error.message
    });
  }

  return new ApiClientError({
    status: 500,
    code: 'UNKNOWN_ERROR',
    message: 'Unknown request failure',
    details: error
  });
}
