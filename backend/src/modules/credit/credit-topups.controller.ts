import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { AccessAuthGuard } from '../auth/access-auth.guard.js';
import { CreatePingPongTxIdTopupDto } from './dto/create-pingpong-txid-topup.dto.js';
import { CreatePingPongPackageTxIdTopupDto } from './dto/create-pingpong-package-txid-topup.dto.js';
import { CreditTopupsService } from './credit-topups.service.js';

@Controller('api/credits')
@UseGuards(AccessAuthGuard)
export class CreditTopupsController {
  constructor(private readonly topups: CreditTopupsService) {}

  // New flow: user submits PingPong transaction id (no bill image)
  @Post('topup/pingpong/txid')
  async createPingPongTxIdTopup(
    @Req() req: Request & { user?: any },
    @Body() dto: CreatePingPongTxIdTopupDto,
  ) {
    const userId = req.user?.sub;
    return this.topups.createPingPongTxIdTopup({
      userId,
      amountUsd: dto.amountUsd,
      pingpongTxId: dto.pingpongTxId,
      note: dto.note ?? null,
    });
  }

  // New flow: package purchase with PingPong tx id (no bill image)
  @Post('topup/pingpong/package/txid')
  async createPingPongPackageTxIdTopup(
    @Req() req: Request & { user?: any },
    @Body() dto: CreatePingPongPackageTxIdTopupDto,
  ) {
    const userId = req.user?.sub;
    return this.topups.createPingPongPackageTxIdTopup({
      userId,
      packageKey: dto.packageKey,
      pingpongTxId: dto.pingpongTxId,
      note: dto.note ?? null,
    });
  }

  @Get('topups')
  async listMyTopups(@Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    return this.topups.listUserTopups(userId);
  }
}
