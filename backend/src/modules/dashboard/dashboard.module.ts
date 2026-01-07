import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardController } from './dashboard.controller.js';
import { UsersModule } from '../users/users.module.js';
import { DeviceModule } from '../devices/device.module.js';
import { LoginAudit } from '../auth/login-audit.entity.js';
import { RegistrationRequest } from '../admin/registration-request.entity.js';
import { Order } from '../orders/order.entity.js';
import { BalanceTransaction } from '../../shared/balance/balance-transaction.entity.js';
import { AccessAuthGuard } from '../auth/access-auth.guard.js';

@Module({
  imports: [TypeOrmModule.forFeature([LoginAudit, RegistrationRequest, Order, BalanceTransaction]), UsersModule, DeviceModule, JwtModule.register({})],
  controllers: [DashboardController],
  providers: [AccessAuthGuard],
})
export class DashboardModule {}
