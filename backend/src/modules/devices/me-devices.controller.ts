import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { AccessAuthGuard } from '../auth/access-auth.guard.js';
import { DeviceService } from './device.service.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginAudit } from '../auth/login-audit.entity.js';

@Controller('me/devices')
@UseGuards(AccessAuthGuard)
export class MeDevicesController {
  constructor(private readonly devices: DeviceService, @InjectRepository(LoginAudit) private readonly auditRepo: Repository<LoginAudit>) {}

  @Get()
  async list(@Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    const devices = await this.devices.listDevicesForUser(userId);
    return devices.map((d) => ({
      id: d.id,
      deviceName: d.deviceName,
      lastIp: d.lastIp,
      lastUsedAt: d.lastUsedAt,
      expiresAt: d.expiresAt,
      createdAt: d.createdAt,
    }));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    await this.devices.revokeDeviceForUser(userId, id);

    await this.auditRepo.save(
      this.auditRepo.create({
        user: { id: userId } as any,
        result: 'success',
        reason: 'device_revoked',
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string,
      }),
    );
  }
}