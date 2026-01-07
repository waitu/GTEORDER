import { Body, Controller, Post, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { Request } from 'express';

import { AccessAuthGuard } from '../auth/access-auth.guard.js';
import { BalanceService } from '../../shared/balance/balance.service.js';
import { TopupDto } from './dto/topup.dto.js';
import { TOPUP_PACKAGES } from '../../shared/config/pricing.config.js';

@Controller('billing')
@UseGuards(AccessAuthGuard)
export class BillingController {
  constructor(private readonly balanceService: BalanceService) {}

  @Post('topup')
  async topup(@Req() req: Request & { user?: any }, @Body() body: TopupDto) {
    const userId = req.user?.sub;
    if (!userId) throw new BadRequestException('User context missing');

    const pkg = body.package;
    if (!['basic', 'standard', 'premier', 'ultra', 'custom'].includes(pkg)) {
      throw new BadRequestException('Invalid package');
    }

    let credits: number;
    let price: number;
    if (pkg === 'custom') {
      if (!body.customCredits || body.customCredits <= 0) {
        throw new BadRequestException('customCredits must be provided and > 0 for custom package');
      }
      credits = Number(body.customCredits);
      const unitPrice = 0.35; // default unit price for custom packages (could be made configurable)
      price = Number((credits * unitPrice).toFixed(2));
    } else {
      const p = (TOPUP_PACKAGES as any)[pkg];
      if (!p) throw new BadRequestException('Invalid package');
      credits = Number(p.credits);
      price = Number(p.price);
    }

    // Apply credit to user balance
    // reason includes package key for traceability
    const reason = `topup:${pkg}`;
    await this.balanceService.creditAmount(userId, credits, reason, pkg === 'custom' ? 'custom' : pkg);

    const newBalance = await this.balanceService.getBalance(userId);
    return { balance: newBalance };
  }
}
