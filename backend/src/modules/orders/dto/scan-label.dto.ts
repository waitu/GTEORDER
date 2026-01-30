import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ScanLabelDto {
  @IsString()
  @MaxLength(128)
  @IsNotEmpty()
  trackingCode!: string;
}
