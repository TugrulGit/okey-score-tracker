import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  limit: number;
  ttl: number;
  key?: string;
}

export const RATE_LIMIT_METADATA = 'rateLimit';

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_METADATA, options);
