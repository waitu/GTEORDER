import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class PayOrdersDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orderIds!: string[];
}
