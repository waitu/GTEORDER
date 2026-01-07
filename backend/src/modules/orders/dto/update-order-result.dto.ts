import { IsString, IsUrl } from 'class-validator';

export class UpdateOrderResultDto {
  @IsString()
  @IsUrl({ require_protocol: true })
  resultUrl!: string;
}
