import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePingPongTxIdTopupDto {
  @IsNumber()
  @Min(0.01)
  amountUsd!: number;

  @IsString()
  @MaxLength(128)
  pingpongTxId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
