import { IsEnum } from 'class-validator';
import { PaymentStatus } from '../order.entity.js';

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  paymentStatus!: PaymentStatus;
}
