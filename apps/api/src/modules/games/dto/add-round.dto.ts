import { ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PenaltyType } from '@prisma/client';

class RoundScoreDto {
  @IsString()
  playerId!: string;

  @IsInt()
  @Min(-1000)
  points!: number;
}

class PenaltyDto {
  @IsString()
  playerId!: string;

  @IsEnum(PenaltyType)
  type!: PenaltyType;

  @IsInt()
  @Min(0)
  value!: number;
}

export class AddRoundDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RoundScoreDto)
  scores!: RoundScoreDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PenaltyDto)
  penalties?: PenaltyDto[];
}
