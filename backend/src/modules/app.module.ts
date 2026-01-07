import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { AdminModule } from './admin/admin.module.js';
import { DeviceModule } from './devices/device.module.js';
import { OtpModule } from './otp/otp.module.js';
import { envValidationSchema } from '../shared/config/env.validation.js';
import { typeOrmConfigFactory } from '../shared/config/typeorm.factory.js';
import { RedisModule } from '../shared/redis/redis.module.js';
import { RateLimitModule } from '../shared/rate-limit/rate-limit.module.js';
import { MailerModule } from '../shared/mailer/mailer.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { BalanceModule } from '../shared/balance/balance.module.js';
import { BillingModule } from './billing/billing.module.js';
import { LabelsModule } from './labels/labels.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { CreditModule } from './credit/credit.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: typeOrmConfigFactory,
      inject: [ConfigService],
    }),
    RedisModule,
    RateLimitModule,
    MailerModule,
    BalanceModule,
    BillingModule,
    PricingModule,
    CreditModule,
    UsersModule,
    AuthModule,
    OtpModule,
    DeviceModule,
    AdminModule,
    DashboardModule,
    LabelsModule,
    OrdersModule,
  ],
})
export class AppModule {}
