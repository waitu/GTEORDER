import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { User } from '../../modules/users/user.entity.js';
import { UserProfile } from '../../modules/users/user-profile.entity.js';
import { RegistrationRequest } from '../../modules/admin/registration-request.entity.js';
import { OtpCode } from '../../modules/otp/otp-code.entity.js';
import { TrustedDevice } from '../../modules/devices/trusted-device.entity.js';
import { RefreshToken } from '../../modules/auth/refresh-token.entity.js';
import { LoginAudit } from '../../modules/auth/login-audit.entity.js';
import { AdminAudit } from '../../modules/admin/admin-audit.entity.js';
import { Order } from '../../modules/orders/order.entity.js';
import { BalanceTransaction } from '../balance/balance-transaction.entity.js';
import { Label } from '../../modules/labels/label.entity.js';
import { PricingRule } from '../../modules/pricing/pricing.entity.js';

export const typeOrmConfigFactory = (config: ConfigService): TypeOrmModuleOptions => {
  const databaseUrl = config.get<string>('DATABASE_URL');
  const ssl = config.get<boolean>('DB_SSL');
  const isDev = config.get<string>('NODE_ENV') !== 'production';
  const synchronize = config.get<boolean>('DB_SYNC') ?? isDev;

  return {
    type: 'postgres',
    url: databaseUrl,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
    autoLoadEntities: false,
    entities: [
      User,
      UserProfile,
      RegistrationRequest,
      OtpCode,
      TrustedDevice,
      RefreshToken,
      LoginAudit,
      AdminAudit,
      Order,
      PricingRule,
      Label,
      BalanceTransaction,
    ],
    synchronize,
    migrations: ['dist/migrations/*.js'],
    migrationsRun: false,
    logging: ['error', 'warn'],
  };
};
