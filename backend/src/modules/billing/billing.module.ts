import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BalanceModule } from '../../shared/balance/balance.module.js';
import { BillingController } from './billing.controller.js';

@Module({
  imports: [BalanceModule, JwtModule.register({})],
  controllers: [BillingController],
})
export class BillingModule {}
