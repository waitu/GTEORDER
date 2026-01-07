import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { LabelServiceType, LabelStatus } from '../label.entity.js';

export class AdminListLabelsDto {
  @IsOptional()
  @IsEnum(LabelStatus)
  status?: LabelStatus;

  @IsOptional()
  @IsEnum(LabelServiceType)
  serviceType?: LabelServiceType;

  @IsOptional()
  @IsString()
  userEmail?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;
}
