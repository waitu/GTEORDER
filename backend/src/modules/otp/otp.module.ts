import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoginAudit } from '../auth/login-audit.entity.js';
import { UsersModule } from '../users/users.module.js';
import { OtpCode } from './otp-code.entity.js';
import { OtpService } from './otp.service.js';
import { RateLimitModule } from '../../shared/rate-limit/rate-limit.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([OtpCode, LoginAudit]), UsersModule, RateLimitModule, ConfigModule],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
