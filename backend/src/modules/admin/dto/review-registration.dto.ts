import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewRegistrationDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  reason?: string;
}