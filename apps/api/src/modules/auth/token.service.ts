import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';

export interface TokenUserPayload {
  id: string;
  email: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload extends AccessTokenPayload {
  sessionId: string;
}

const BASE_HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

@Injectable()
export class TokenService {
  readonly accessTtlSeconds = this.resolveInt(process.env.JWT_ACCESS_TTL, 15 * 60);
  readonly refreshTtlSeconds = this.resolveInt(process.env.JWT_REFRESH_TTL, 7 * 24 * 60 * 60);

  async generateAccessToken(user: TokenUserPayload): Promise<string> {
    const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = { sub: user.id, email: user.email };
    return this.sign(payload, this.accessSecret, this.accessTtlSeconds);
  }

  async generateRefreshToken(user: TokenUserPayload, sessionId: string): Promise<string> {
    const payload = { sub: user.id, email: user.email, sessionId };
    return this.sign(payload, this.refreshSecret, this.refreshTtlSeconds);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.verify<AccessTokenPayload>(token, this.accessSecret);
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return this.verify<RefreshTokenPayload>(token, this.refreshSecret);
  }

  generateSessionId(): string {
    return randomBytes(16).toString('hex');
  }

  hashToken(token: string): string {
    return createHmac('sha256', this.refreshSecret).update(token).digest('hex');
  }

  getRefreshExpiryDate(): Date {
    return new Date(Date.now() + this.refreshTtlSeconds * 1000);
  }

  private sign(payload: Record<string, unknown>, secret: string, ttlSeconds: number): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const fullPayload = { ...payload, iat: issuedAt, exp: issuedAt + ttlSeconds };
    const payloadEncoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const data = `${BASE_HEADER}.${payloadEncoded}`;
    const signature = this.createSignature(data, secret);
    return `${data}.${signature}`;
  }

  private verify<T>(token: string, secret: string): T {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) {
      throw new UnauthorizedException('Malformed token');
    }
    if (header !== BASE_HEADER) {
      throw new UnauthorizedException('Unexpected token header');
    }
    const data = `${header}.${payload}`;
    const expected = this.createSignature(data, secret);
    if (signature !== expected) {
      throw new UnauthorizedException('Token signature mismatch');
    }
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T & { exp: number };
    if (decoded.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Token expired');
    }
    return decoded as T;
  }

  private createSignature(data: string, secret: string): string {
    return createHmac('sha256', secret).update(data).digest('base64url');
  }

  private get accessSecret(): string {
    return process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me';
  }

  private get refreshSecret(): string {
    return process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me';
  }

  private resolveInt(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
