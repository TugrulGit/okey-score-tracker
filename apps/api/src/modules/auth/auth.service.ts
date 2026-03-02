import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { EmailService } from './email.service.js';

interface RequestContext {
  ip?: string;
  userAgent?: string;
}

interface AuthResult {
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string | null;
    timezone: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly resetTtlMs = 60 * 60 * 1000; // 60 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService
  ) {}

  async register(dto: RegisterDto, context: RequestContext): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: dto.displayName,
        avatarUrl: dto.avatarUrl,
        timezone: dto.timezone ?? 'UTC'
      }
    });

    return this.issueTokens(user.id, email, dto.displayName, user.avatarUrl, user.timezone, context);
  }

  async login(dto: LoginDto, context: RequestContext): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await this.passwordService.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    return this.issueTokens(user.id, user.email, user.displayName, user.avatarUrl, user.timezone, context);
  }

  async logout(userId: string, sessionId: string): Promise<{ success: boolean }> {
    await this.prisma.session.deleteMany({ where: { id: sessionId, userId } });
    return { success: true };
  }

  async refreshTokens(
    userId: string,
    sessionId: string,
    refreshToken: string,
    context: RequestContext
  ): Promise<AuthResult> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Refresh session invalid');
    }

    if (session.expiresAt.getTime() < Date.now()) {
      await this.prisma.session.delete({ where: { id: sessionId } });
      throw new UnauthorizedException('Refresh token expired');
    }

    const hashed = this.tokenService.hashToken(refreshToken);
    if (hashed !== session.refreshTokenHash) {
      await this.prisma.session.delete({ where: { id: sessionId } });
      throw new UnauthorizedException('Refresh token revoked');
    }

    await this.prisma.session.delete({ where: { id: sessionId } });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.issueTokens(user.id, user.email, user.displayName, user.avatarUrl, user.timezone, context);
  }

  async requestPasswordReset(dto: ForgotPasswordDto): Promise<void> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.tokenService.hashToken(token + this.resetSecret),
        expiresAt: new Date(Date.now() + this.resetTtlMs)
      }
    });

    this.emailService.sendPasswordReset(user.email, token);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const hashedToken = this.tokenService.hashToken(dto.token + this.resetSecret);
    const tokenRecord = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: hashedToken } });
    if (!tokenRecord || tokenRecord.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Reset token invalid or expired');
    }

    const newHash = await this.passwordService.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { passwordHash: newHash }
      }),
      this.prisma.passwordResetToken.delete({ where: { id: tokenRecord.id } }),
      this.prisma.session.deleteMany({ where: { userId: tokenRecord.userId } })
    ]);
  }

  private get resetSecret(): string {
    return process.env.RESET_TOKEN_SECRET ?? 'dev-reset-secret-change-me';
  }

  private async issueTokens(
    userId: string,
    email: string,
    displayName: string,
    avatarUrl: string | null | undefined,
    timezone: string,
    context: RequestContext
  ): Promise<AuthResult> {
    const sessionId = this.tokenService.generateSessionId();
    const refreshToken = this.tokenService.generateRefreshToken({ id: userId, email }, sessionId);
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash: this.tokenService.hashToken(refreshToken),
        expiresAt: this.tokenService.getRefreshExpiryDate(),
        ip: context.ip,
        userAgent: context.userAgent
      }
    });

    const accessToken = this.tokenService.generateAccessToken({ id: userId, email });

    return {
      user: {
        id: userId,
        email,
        displayName,
        avatarUrl,
        timezone
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: this.tokenService.accessTtlSeconds
      }
    };
  }
}
