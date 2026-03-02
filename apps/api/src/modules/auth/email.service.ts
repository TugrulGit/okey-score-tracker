import { Injectable, Logger } from '@nestjs/common';

/**
 * Dev-only email stub – logs reset links to the console.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  sendPasswordReset(email: string, token: string): void {
    const webBase = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
    const link = `${webBase}/reset-password?token=${token}`;
    this.logger.log(`Password reset link for ${email}: ${link}`);
  }
}
