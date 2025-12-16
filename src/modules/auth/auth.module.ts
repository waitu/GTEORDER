import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminModule } from '../admin/admin.module.js';
import { DeviceModule } from '../devices/device.module.js';
import { OtpModule } from '../otp/otp.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LoginAudit } from './login-audit.entity.js';
import { RefreshToken } from './refresh-token.entity.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken, LoginAudit]),
    UsersModule,
    OtpModule,
    DeviceModule,
    AdminModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
