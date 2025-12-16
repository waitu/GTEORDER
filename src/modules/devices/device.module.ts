import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TrustedDevice } from './trusted-device.entity.js';
import { DeviceService } from './device.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([TrustedDevice])],
  providers: [DeviceService],
  exports: [DeviceService],
})
export class DeviceModule {}
