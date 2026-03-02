import { IsOptional, IsString, MinLength, MaxLength, IsUrl } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
