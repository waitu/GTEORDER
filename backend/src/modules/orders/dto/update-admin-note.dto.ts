import { IsOptional, IsString } from 'class-validator';

export class UpdateAdminNoteDto {
  @IsOptional()
  @IsString()
  adminNote?: string | null;
}
