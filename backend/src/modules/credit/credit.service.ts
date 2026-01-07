import { Injectable, BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PricingService } from '../pricing/pricing.service.js';
import { BalanceService } from '../../shared/balance/balance.service.js';

@Injectable()
export class CreditService {
  constructor(private pricing: PricingService, private balanceService: BalanceService) {}

  /**
   * Consume credits for a given user and serviceType key.
   * - serviceType must be a pricing key (e.g. 'scan_label', 'design_2d', 'empty_package').
   * - orderId is optional and will be stored as reference on the ledger when provided.
   * Returns the user's new balance after debit.
   */
  async consume(userId: string, serviceType: string, orderId?: string | null, manager?: EntityManager): Promise<number> {
    const pricing = await this.pricing.getAll();
    const cost = pricing.serviceCreditCost?.[serviceType];
    if (cost == null) {
      throw new BadRequestException('UNKNOWN_SERVICE_TYPE');
    }

    // Quick pre-check (helps produce a clearer error to callers). The underlying
    // BalanceService will still enforce atomicity and throw on race-caused insufficiency.
    const current = await this.balanceService.getBalance(userId);
    if (current < cost) {
      throw new BadRequestException('INSUFFICIENT_BALANCE');
    }

    // Perform the ledger-backed debit. applyChange will throw if balance changed concurrently.
    const after = await this.balanceService.applyChange(userId, cost, 'debit', serviceType, orderId ?? null, null, manager);
    return after;
  }
}
