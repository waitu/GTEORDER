import { IsEnum } from 'class-validator';
import { OrderStatus } from '../order.entity.js';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  orderStatus!: OrderStatus;
}
