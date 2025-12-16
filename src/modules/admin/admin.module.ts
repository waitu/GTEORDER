import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminAudit } from './admin-audit.entity.js';
import { RegistrationRequest } from './registration-request.entity.js';
import { AdminService } from './admin.service.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([RegistrationRequest, AdminAudit]), UsersModule],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
