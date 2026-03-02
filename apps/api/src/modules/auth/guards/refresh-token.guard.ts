import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenService, RefreshTokenPayload } from '../token.service.js';

/** Ensures refresh/logout calls include a valid refresh token. */
@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers?: Record<string, string | string[]>; user?: RefreshTokenPayload & { refreshToken: string } }>();
    const token = this.extractBearerToken(request.headers);
    if (!token) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const payload = this.tokenService.verifyRefreshToken(token);
    request.user = { ...payload, refreshToken: token };
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
