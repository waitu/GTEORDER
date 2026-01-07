import 'dotenv/config';
import { DataSource } from 'typeorm';

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

const databaseUrl = process.env.DATABASE_URL;
const ssl = process.env.DB_SSL === 'true';
const isDev = process.env.NODE_ENV !== 'production';
const synchronize = process.env.DB_SYNC ? process.env.DB_SYNC === 'true' : isDev;

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  ssl: ssl ? { rejectUnauthorized: false } : undefined,
  entities: [User, UserProfile, RegistrationRequest, OtpCode, TrustedDevice, RefreshToken, LoginAudit, AdminAudit, Order, Label, BalanceTransaction],
  migrations: ['dist/migrations/*.js'],
  synchronize,
});
