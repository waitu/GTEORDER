import { IsOptional, IsString } from 'class-validator';

export class ImageImportDto {
  // JSON array string describing per-file metadata: [{serviceType, trackingNumber, carrier, clientRequestId, sourceFileName}]
  @IsOptional()
  @IsString()
  meta?: string;
}
