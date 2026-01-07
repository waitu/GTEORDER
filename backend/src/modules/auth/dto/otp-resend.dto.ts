import { IsOptional, IsString, MinLength } from 'class-validator';

export class OtpResendDto {
  @IsString()
  @MinLength(4)
  otpRequestId!: string;

  @IsOptional()
  @IsString()
  deviceInfo?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
