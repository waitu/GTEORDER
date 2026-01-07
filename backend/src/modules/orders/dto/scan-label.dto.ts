import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ScanLabelDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  trackingCode?: string;
}
