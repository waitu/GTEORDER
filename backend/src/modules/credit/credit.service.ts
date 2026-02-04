import { Injectable, BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PricingService } from '../pricing/pricing.service.js';
import { BalanceService } from '../../shared/balance/balance.service.js';

@Injectable()
export class CreditService {
  constructor(private pricing: PricingService, private balanceService: BalanceService) {}

  private async getCost(serviceType: string): Promise<number> {
    const pricing = await this.pricing.getAll();
    const cost = pricing.serviceCreditCost?.[serviceType];
    if (cost == null) {
      throw new BadRequestException('UNKNOWN_SERVICE_TYPE');
    }
    return cost;
  }

  async getCostForService(serviceType: string): Promise<number> {
    return this.getCost(serviceType);
  }

  /**
   * Consume credits for a given user and serviceType key.
   * - serviceType must be a pricing key (e.g. 'scan_label', 'design_2d', 'empty_package').
   * - orderId is optional and will be stored as reference on the ledger when provided.
   * Returns the user's new balance after debit.
   */
  async consume(userId: string, serviceType: string, orderId?: string | null, manager?: EntityManager): Promise<number> {
    const cost = await this.getCost(serviceType);
    try {
      // Perform the ledger-backed debit. applyChange will throw if balance changed concurrently.
      const after = await this.balanceService.applyChange(userId, cost, 'debit', serviceType, orderId ?? null, null, manager);
      return after;
    } catch (err: any) {
      const msg = err?.response?.message ?? err?.message;
      if (msg === 'INSUFFICIENT_BALANCE') {
        throw new BadRequestException('INSUFFICIENT_BALANCE');
      }
      throw err;
    }
  }

  /**
   * Attempt to consume credits; returns ok=false when balance is insufficient.
   * Useful for import flows where we want to create records even if unpaid.
   */
  async tryConsume(
    userId: string,
    serviceType: string,
    orderId?: string | null,
    manager?: EntityManager,
  ): Promise<{ ok: true; balanceAfter: number } | { ok: false; reason: 'INSUFFICIENT_BALANCE' }> {
    const cost = await this.getCost(serviceType);
    try {
      const after = await this.balanceService.applyChange(userId, cost, 'debit', serviceType, orderId ?? null, null, manager);
      return { ok: true, balanceAfter: after };
    } catch (err: any) {
      const msg = err?.response?.message ?? err?.message;
      if (msg === 'INSUFFICIENT_BALANCE') {
        return { ok: false, reason: 'INSUFFICIENT_BALANCE' };
      }
      throw err;
    }
  }
}
