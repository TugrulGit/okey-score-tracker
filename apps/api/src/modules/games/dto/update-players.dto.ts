import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PlayerUpdateDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsInt()
  seatIndex?: number;
}

export class UpdatePlayersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayerUpdateDto)
  players!: PlayerUpdateDto[];
}
