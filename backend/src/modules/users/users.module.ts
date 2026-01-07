import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersService } from './users.service.js';
import { User } from './user.entity.js';
import { UserProfile } from './user-profile.entity.js';
import { UsersController } from './users.controller.js';
import { DeviceModule } from '../devices/device.module.js';
import { AccessAuthGuard } from '../auth/access-auth.guard.js';
import { LoginAudit } from '../auth/login-audit.entity.js';
import { RefreshToken } from '../auth/refresh-token.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserProfile, LoginAudit, RefreshToken]), DeviceModule, JwtModule.register({})],
  controllers: [UsersController],
  providers: [UsersService, AccessAuthGuard],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
