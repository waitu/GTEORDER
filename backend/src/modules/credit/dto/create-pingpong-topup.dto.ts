import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreatePingPongTopupDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(1000000)
  amount!: number;

  @IsString()
  @MinLength(3)
  transferNote!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
