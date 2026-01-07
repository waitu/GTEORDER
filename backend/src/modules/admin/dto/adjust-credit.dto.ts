import { IsIn, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class AdjustCreditDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsIn(['credit', 'debit'])
  direction!: 'credit' | 'debit';

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  note?: string;
}
