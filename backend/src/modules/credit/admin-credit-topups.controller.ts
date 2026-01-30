import { Controller, Get, Post, Query, Req, UseGuards, Param, Body } from '@nestjs/common';
import { Request } from 'express';

import { AdminAuthGuard } from '../admin/admin-auth.guard.js';
import { CreditTopupStatus } from './credit-topup.entity.js';
import { CreditTopupsService } from './credit-topups.service.js';
import { RejectTopupDto } from './dto/reject-topup.dto.js';

@Controller('api/admin/credits')
@UseGuards(AdminAuthGuard)
export class AdminCreditTopupsController {
  constructor(private readonly topups: CreditTopupsService) {}

  @Get('topups')
  async listTopups(@Query('status') status?: string) {
    const normalized = (status || '').trim().toLowerCase();
    const allowed = Object.values(CreditTopupStatus);
    const parsed = allowed.includes(normalized as any) ? (normalized as CreditTopupStatus) : undefined;
    return this.topups.listAdminTopups(parsed);
  }

  @Post('topups/:id/approve')
  async approve(@Req() req: Request & { user?: any }, @Param('id') id: string) {
    const adminId = req.user?.sub;
    return this.topups.approveTopup({ topupId: id, adminId });
  }

  @Post('topups/:id/reject')
  async reject(@Req() req: Request & { user?: any }, @Param('id') id: string, @Body() dto: RejectTopupDto) {
    const adminId = req.user?.sub;
    return this.topups.rejectTopup({ topupId: id, adminId, adminNote: dto.adminNote });
  }
}
