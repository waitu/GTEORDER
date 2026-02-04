import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePingPongPackageTxIdTopupDto {
  @IsString()
  @MaxLength(64)
  packageKey!: string;

  @IsString()
  @MaxLength(128)
  pingpongTxId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
