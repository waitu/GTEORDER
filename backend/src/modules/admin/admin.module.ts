import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminAudit } from './admin-audit.entity.js';
import { AdminController } from './admin.controller.js';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { RegistrationRequest } from './registration-request.entity.js';
import { BalanceTransaction } from '../../shared/balance/balance-transaction.entity.js';
import { AdminService } from './admin.service.js';
import { UsersModule } from '../users/users.module.js';
import { LabelsModule } from '../labels/labels.module.js';
import { User } from '../users/user.entity.js';
import { UserProfile } from '../users/user-profile.entity.js';
import { LoginAudit } from '../auth/login-audit.entity.js';
import { RefreshToken } from '../auth/refresh-token.entity.js';
import { TrustedDevice } from '../devices/trusted-device.entity.js';
import { OrdersModule } from '../orders/orders.module.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import { AdminAccountsController } from './admin-accounts.controller.js';
import { AdminLabelsController } from './admin-labels.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([RegistrationRequest, AdminAudit, User, UserProfile, LoginAudit, RefreshToken, TrustedDevice, BalanceTransaction]), UsersModule, OrdersModule, LabelsModule, JwtModule.register({})],
  controllers: [AdminController, AdminOrdersController, AdminAccountsController, AdminLabelsController],
  providers: [AdminService, AdminAuthGuard],
  exports: [AdminService],
})
export class AdminModule {}
