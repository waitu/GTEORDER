import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePingPongPackageTopupDto {
  @IsString()
  @MinLength(1)
  packageKey!: string;

  @IsString()
  @MinLength(3)
  transferNote!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
