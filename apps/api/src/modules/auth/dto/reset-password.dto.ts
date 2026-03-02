import { IsString, MinLength } from 'class-validator';

/**
 * Consumes the emailed token and sets a fresh password.
 */
export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
