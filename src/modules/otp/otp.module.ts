import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OtpCode } from './otp-code.entity.js';
import { OtpService } from './otp.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([OtpCode])],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
