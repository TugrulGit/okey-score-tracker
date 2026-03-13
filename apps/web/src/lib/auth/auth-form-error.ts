import { ApiClientError } from '../api/httpClient';

/**
 * @description Converts unknown submission errors into user-facing auth form messages.
 * @param error - Unknown thrown value from auth form submit handlers.
 * @returns Safe error message string that can be shown inline on auth forms.
 * @Used_by
 *   - Login, register, forgot-password, and reset-password pages.
 * @Side_effects
 *   - None.
 */
export function toAuthFormErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}
