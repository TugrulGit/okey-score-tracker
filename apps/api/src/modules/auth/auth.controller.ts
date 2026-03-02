import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { RefreshTokenGuard } from './guards/refresh-token.guard.js';
import { RefreshTokenPayload } from './token.service.js';
import { RateLimit } from './rate-limit.decorator.js';
import { RateLimitGuard } from './rate-limit.guard.js';

interface AuthenticatedRequest {
  user: RefreshTokenPayload & { refreshToken: string };
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

/**
 * REST facade for auth flows; returns tokens directly so the Next.js proxy can
 * forward them into httpOnly cookies.
 */
@UseGuards(RateLimitGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @RateLimit({ key: 'auth:register', limit: 5, ttl: 60 })
  register(@Body() dto: RegisterDto, @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string }) {
    return this.authService.register(dto, this.extractContext(req));
  }

  @Post('login')
  @RateLimit({ key: 'auth:login', limit: 10, ttl: 60 })
  login(@Body() dto: LoginDto, @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string }) {
    return this.authService.login(dto, this.extractContext(req));
  }

  @Post('logout')
  @RateLimit({ key: 'auth:logout', limit: 30, ttl: 60 })
  @UseGuards(RefreshTokenGuard)
  logout(@Req() req: AuthenticatedRequest) {
    return this.authService.logout(req.user.sub, req.user.sessionId);
  }

  @Post('refresh')
  @RateLimit({ key: 'auth:refresh', limit: 60, ttl: 60 })
  @UseGuards(RefreshTokenGuard)
  refresh(@Req() req: AuthenticatedRequest) {
    return this.authService.refreshTokens(
      req.user.sub,
      req.user.sessionId,
      req.user.refreshToken,
      this.extractContext(req)
    );
  }

  @Post('forgot-password')
  @RateLimit({ key: 'auth:forgot', limit: 5, ttl: 300 })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto);
    return { message: 'If that email exists we sent instructions.' };
  }

  @Post('reset-password')
  @RateLimit({ key: 'auth:reset', limit: 10, ttl: 300 })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Password updated successfully.' };
  }

  private extractContext(req: { headers: Record<string, string | string[] | undefined>; ip?: string }) {
    const userAgentHeader = req.headers['user-agent'];
    return {
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
      userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader
    };
  }
}
