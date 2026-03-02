import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenService, AccessTokenPayload } from '../token.service.js';

/** Protects standard API routes by verifying the bearer access token. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers?: Record<string, string | string[]>; user?: AccessTokenPayload }>();
    const token = this.extractBearerToken(request.headers);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }
    request.user = this.tokenService.verifyAccessToken(token);
    return true;
  }

  private extractBearerToken(headers?: Record<string, string | string[]>): string | undefined {
    const header = headers?.authorization ?? headers?.Authorization;
    if (!header) {
      return undefined;
    }
    const value = Array.isArray(header) ? header[0] : header;
    const [scheme, token] = value.split(' ');
    return scheme?.toLowerCase() === 'bearer' ? token : undefined;
  }
}
