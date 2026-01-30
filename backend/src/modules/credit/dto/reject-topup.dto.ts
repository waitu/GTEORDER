import { IsString, MinLength } from 'class-validator';

export class RejectTopupDto {
  @IsString()
  @MinLength(3)
  adminNote!: string;
}
