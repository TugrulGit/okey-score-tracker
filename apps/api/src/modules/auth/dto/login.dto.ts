import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * Standard login payload for existing accounts.
 */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
