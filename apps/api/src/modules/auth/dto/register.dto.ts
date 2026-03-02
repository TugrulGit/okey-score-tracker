import { IsEmail, IsOptional, IsString, MinLength, Matches } from 'class-validator';

/**
 * Payload for initial sign-up.
 */
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/[a-z]/i, { message: 'Password must contain at least one letter.' })
  @Matches(/\d/, { message: 'Password must contain at least one number.' })
  password!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
