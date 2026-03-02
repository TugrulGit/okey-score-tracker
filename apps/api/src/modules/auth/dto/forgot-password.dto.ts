import { IsEmail } from 'class-validator';

/**
 * Triggers password reset email; intentionally minimal to avoid data leakage.
 */
export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}
