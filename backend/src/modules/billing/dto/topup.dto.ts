import { IsIn, IsOptional, IsNumber, Min } from 'class-validator';

export class TopupDto {
  @IsIn(['basic', 'standard', 'premier', 'ultra', 'custom'])
  package!: 'basic' | 'standard' | 'premier' | 'ultra' | 'custom';

  @IsOptional()
  @IsNumber()
  @Min(1)
  customCredits?: number;
}
