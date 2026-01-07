import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListAccountsDto {
  @IsOptional()
  @IsIn(['pending', 'active', 'disabled', 'rejected'])
  status?: string;

  @IsOptional()
  @IsIn(['admin', 'user'])
  role?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
