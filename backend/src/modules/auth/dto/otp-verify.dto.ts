import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class OtpVerifyDto {
  @IsString()
  otpRequestId!: string;

  @IsString()
  @MinLength(4)
  code!: string;

  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  deviceFingerprint?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
