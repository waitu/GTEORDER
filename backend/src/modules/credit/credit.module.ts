import { Module } from '@nestjs/common';
import { CreditService } from './credit.service.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { BalanceModule } from '../../shared/balance/balance.module.js';

@Module({
  imports: [PricingModule, BalanceModule],
  providers: [CreditService],
  exports: [CreditService],
})
export class CreditModule {}
