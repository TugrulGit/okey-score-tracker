import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { EmailService } from './email.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RefreshTokenGuard } from './guards/refresh-token.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RateLimitGuard } from './rate-limit.guard.js';

/**
 * Auth module wires all services + custom guards.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    EmailService,
    RefreshTokenGuard,
    JwtAuthGuard,
    RateLimitGuard
  ],
  exports: [PasswordService, TokenService, JwtAuthGuard, RefreshTokenGuard]
})
export class AuthModule {}
