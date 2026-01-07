import { Controller, Delete, Get, HttpCode, HttpStatus, ParseIntPipe, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';

import { UsersService } from './users.service.js';
import { DeviceService } from '../devices/device.service.js';
import { AccessAuthGuard } from '../auth/access-auth.guard.js';
import { LoginAudit } from '../auth/login-audit.entity.js';
import { LoginHistoryDto } from './dto/login-history.dto.js';

@Controller('me')
@UseGuards(AccessAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly deviceService: DeviceService,
    @InjectRepository(LoginAudit) private readonly loginAuditRepo: Repository<LoginAudit>,
  ) {}

  @Get()
  async getCurrentUser(@Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('User context missing');

    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const [devices, lastAudit] = await Promise.all([
      this.deviceService.listDevicesForUser(userId),
      this.loginAuditRepo.findOne({ where: { user: { id: userId } as any, result: 'success' }, order: { createdAt: 'DESC' } }),
    ]);

    return {
      id: user.id,
      email: user.email,
      role: (user as any).profile?.role ?? 'user',
      status: user.status,
      trustedDevice: devices.length > 0,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: this.maskIp(lastAudit?.ip ?? null),
    };
  }

  @Get('login-history')
  async loginHistory(@Query() query: LoginHistoryDto, @Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('User context missing');

    const limit = query.limit ?? 20;
    const rows = await this.loginAuditRepo.find({
      where: { user: { id: userId } as any },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      result: row.result,
      reason: row.reason,
      ip: this.maskIp(row.ip ?? null),
      userAgent: row.userAgent,
      deviceFingerprint: row.deviceFingerprint ? `${row.deviceFingerprint.slice(0, 6)}...` : null,
      createdAt: row.createdAt,
    }));
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('User context missing');

    await this.usersService.revokeAllRefreshTokens(userId);
    await this.loginAuditRepo.save(
      this.loginAuditRepo.create({
        user: { id: userId } as any,
        result: 'success',
        reason: 'user_logout_all',
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string,
      }),
    );
  }

  private maskIp(ip: string | null): string | null {
    if (!ip) return null;
    if (ip.includes(':')) {
      // IPv6: keep first two segments
      const parts = ip.split(':');
      return `${parts.slice(0, 2).join(':')}::xxxx`;
    }
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return ip;
  }
}
