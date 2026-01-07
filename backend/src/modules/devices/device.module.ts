import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccessAuthGuard } from '../auth/access-auth.guard.js';
import { TrustedDevice } from './trusted-device.entity.js';
import { DeviceService } from './device.service.js';
import { MeDevicesController } from './me-devices.controller.js';
import { LoginAudit } from '../auth/login-audit.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([TrustedDevice, LoginAudit]), JwtModule.register({})],
  controllers: [MeDevicesController],
  providers: [DeviceService, AccessAuthGuard],
  exports: [DeviceService],
})
export class DeviceModule {}
