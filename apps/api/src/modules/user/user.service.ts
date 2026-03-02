import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdatePasswordDto } from './dto/update-password.dto.js';
import { PasswordService } from '../auth/password.service.js';

/**
 * Provides authenticated user profile, credential, and session operations.
 * Consumed by `UserController` endpoints under `/users/me`.
 */
@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService
  ) {}

  // === Profile Reads and Updates ===

  /**
   * Returns the current authenticated user's public profile fields.
   * Params:
   * - `userId`: Authenticated user id from JWT (`CurrentUser.sub`).
   * Returns:
   * - A selected user object (`id`, `email`, `displayName`, `avatarUrl`, `timezone`, timestamps) or `null` if missing.
   * Used by:
   * - `UserController.getMe` (`GET /users/me`) to render account/profile screens.
   * Side effects:
   * - None (read-only query).
   */
  getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        timezone: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true
      }
    });
  }

  /**
   * Applies partial profile updates for the authenticated user.
   * Params:
   * - `userId`: Authenticated user id from JWT (`CurrentUser.sub`).
   * - `dto`: Optional profile inputs (`displayName`, `avatarUrl`, `timezone`); only provided fields are written.
   * Returns:
   * - Updated profile payload (`id`, `email`, `displayName`, `avatarUrl`, `timezone`, `updatedAt`) for immediate UI refresh.
   * Used by:
   * - `UserController.updateProfile` (`PATCH /users/me`).
   * Side effects:
   * - Updates `user` row fields in Prisma.
   * Unique pattern:
   * - Constructs a sparse `data` object so omitted fields are not overwritten.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: UpdateProfileDto = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data
    });

    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      timezone: updated.timezone,
      updatedAt: updated.updatedAt
    };
  }

  // === Password and Session Security ===

  /**
   * Changes the authenticated user's password after validating current credentials.
   * Params:
   * - `userId`: Authenticated user id from JWT (`CurrentUser.sub`).
   * - `dto`: Password change input containing `currentPassword`, `newPassword`, and `confirmPassword`.
   * Returns:
   * - `{ success: true }` when password update and session invalidation complete.
   * Used by:
   * - `UserController.changePassword` (`PATCH /users/me/password`).
   * Side effects:
   * - Validates and hashes passwords, updates `passwordHash`, and deletes all active sessions for forced re-authentication.
   * Unique pattern:
   * - Uses a Prisma transaction to atomically rotate password and revoke sessions.
   */
  async changePassword(userId: string, dto: UpdatePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password confirmation does not match.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const matches = await this.passwordService.compare(dto.currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('Current password is incorrect.');
    }

    const sameAsOld = await this.passwordService.compare(dto.newPassword, user.passwordHash);
    if (sameAsOld) {
      throw new BadRequestException('New password must be different from the current password.');
    }

    const newHash = await this.passwordService.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } }),
      this.prisma.session.deleteMany({ where: { userId } })
    ]);

    return { success: true };
  }

  /**
   * Lists active/recent sessions for the authenticated user.
   * Params:
   * - `userId`: Authenticated user id from JWT (`CurrentUser.sub`).
   * Returns:
   * - Session list ordered by `createdAt` descending with `id`, `ip`, `userAgent`, `expiresAt`, `createdAt`.
   * Used by:
   * - `UserController.getSessions` (`GET /users/me/sessions`) for account security/session management UI.
   * Side effects:
   * - None (read-only query).
   */
  async getSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return sessions.map((session) => ({
      id: session.id,
      ip: session.ip,
      userAgent: session.userAgent,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt
    }));
  }

  /**
   * Deletes a single session owned by the authenticated user.
   * Params:
   * - `userId`: Authenticated user id from JWT (`CurrentUser.sub`).
   * - `sessionId`: Target session id from route param (`:id`).
   * Returns:
   * - `{ success: true }` regardless of whether a matching row existed (idempotent delete contract).
   * Used by:
   * - `UserController.deleteSession` (`DELETE /users/me/sessions/:id`).
   * Side effects:
   * - Deletes matching session rows scoped by both `id` and `userId`.
   */
  async deleteSession(userId: string, sessionId: string) {
    await this.prisma.session.deleteMany({ where: { id: sessionId, userId } });
    return { success: true };
  }
}
