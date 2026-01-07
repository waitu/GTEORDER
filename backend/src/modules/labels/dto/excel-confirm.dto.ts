import { IsUUID } from 'class-validator';

export class ExcelConfirmDto {
  @IsUUID()
  previewId!: string;
}
