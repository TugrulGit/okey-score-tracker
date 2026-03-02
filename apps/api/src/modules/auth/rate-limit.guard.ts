import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_METADATA, RateLimitOptions } from './rate-limit.decorator.js';

interface HitCounter {
  count: number;
  expiresAt: number;
}

/** Lightweight in-memory rate limiting scoped per-IP + handler. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, HitCounter>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<RateLimitOptions | undefined>(RATE_LIMIT_METADATA, context.getHandler());
    if (!options) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ ip?: string }>();
    const identifier = `${options.key ?? context.getClass().name}.${context.getHandler().name}:${request.ip ?? 'unknown'}`;
    const now = Date.now();
    const existing = this.hits.get(identifier);
    if (!existing || existing.expiresAt < now) {
      this.hits.set(identifier, { count: 1, expiresAt: now + options.ttl * 1000 });
      return true;
    }
    if (existing.count >= options.limit) {
      throw new HttpException('Too many requests, slow down.', HttpStatus.TOO_MANY_REQUESTS);
    }
    existing.count += 1;
    return true;
  }
}
