import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditService } from './credit.service.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { BalanceModule } from '../../shared/balance/balance.module.js';
import { CreditTopup } from './credit-topup.entity.js';
import { CreditTopupsService } from './credit-topups.service.js';
import { CreditTopupsController } from './credit-topups.controller.js';
import { AdminCreditTopupsController } from './admin-credit-topups.controller.js';
import { TopupBillStorageService } from './topup-bill-storage.service.js';
import { AdminAuthGuard } from '../admin/admin-auth.guard.js';

@Module({
  imports: [PricingModule, BalanceModule, JwtModule.register({}), TypeOrmModule.forFeature([CreditTopup])],
  controllers: [CreditTopupsController, AdminCreditTopupsController],
  providers: [CreditService, CreditTopupsService, TopupBillStorageService, AdminAuthGuard],
  exports: [CreditService, CreditTopupsService],
})
export class CreditModule {}
