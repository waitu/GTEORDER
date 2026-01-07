import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';

import { BalanceTransaction } from './balance-transaction.entity.js';
import { User } from '../../modules/users/user.entity.js';
import { Order } from '../../modules/orders/order.entity.js';

@Injectable()
export class BalanceService {
  // IMPORTANT: All updates to `users.credit_balance` MUST go through `applyChange`.
  // Do NOT update `user.creditBalance` directly anywhere else in the codebase.
  // This enforces a single source of truth for the ledger and ensures a ledger row
  // is created for every balance mutation.
  private readonly scanCost: number;

  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(BalanceTransaction) private readonly txRepo: Repository<BalanceTransaction>,
    private readonly dataSource: DataSource,
  ) {
    // Default scan cost; could be moved to config later.
    this.scanCost = 1.0;
  }

  getScanCost(): number {
    return this.scanCost;
  }

  /**
   * Apply a balance change to a user's credit balance and record a ledger entry.
   * - `direction` is 'credit' or 'debit'
   * - If `manager` is provided, operation runs within that transaction/manager; otherwise a new transaction is used.
   * Returns the new balance after change.
   */
  async applyChange(
    userId: string,
    amount: number,
    direction: 'credit' | 'debit',
    reason: string,
    reference?: string | null,
    adminId?: string | null,
    manager?: EntityManager,
  ): Promise<number> {
    if (manager) {
      return this._applyChangeWithManager(manager, userId, amount, direction, reason, reference, adminId);
    }
    return await this.dataSource.transaction(async (trx) => {
      return this._applyChangeWithManager(trx, userId, amount, direction, reason, reference, adminId);
    });
  }

  private async _applyChangeWithManager(
    manager: EntityManager,
    userId: string,
    amount: number,
    direction: 'credit' | 'debit',
    reason: string,
    reference?: string | null,
    adminId?: string | null,
  ): Promise<number> {
    const user = await manager.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
    if (!user) throw new Error('User not found');
    const currentBalance = Number(user.creditBalance ?? 0);
    if (direction === 'debit' && currentBalance < amount) {
      throw new Error('INSUFFICIENT_BALANCE');
    }
    const newBalance = Number(((direction === 'debit' ? currentBalance - amount : currentBalance + amount) || 0).toFixed(2));
    user.creditBalance = newBalance;
    await manager.save(user);

    const signedAmount = direction === 'debit' ? -Math.abs(amount) : Math.abs(amount);

    // Only set order relation when reference looks like a UUID; otherwise leave order NULL and store reference text
    const isUuid = (s?: string | null) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
    const tx = manager.create(BalanceTransaction, {
      user: { id: userId } as any,
      order: isUuid(reference) ? ({ id: reference } as any) : null,
      amount: signedAmount,
      direction,
      balanceAfter: newBalance,
      reason,
      reference: reference ?? null,
    });
    await manager.save(tx);
    return newBalance;
  }

  async getBalance(userId: string): Promise<number> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    // Unified credit system — single balance.
    // Only read `creditBalance` in business logic. Legacy `balance` should not be used.
    if (!user) return 0;
    return user.creditBalance ?? 0;
  }

  async debitForOrder(userId: string, order: Order, amount: number, reason?: string): Promise<void> {
    await this.applyChange(userId, amount, 'debit', reason ?? 'order-debit', order.id);
  }

  async creditForOrder(userId: string, order: Order, amount: number, reason?: string): Promise<void> {
    await this.applyChange(userId, amount, 'credit', reason ?? 'order-credit', order.id);
  }

  /**
   * Credit an arbitrary amount to a user's balance (top-up use-case).
   * Creates a BalanceTransaction with a positive amount and optional reference.
   */
  async creditAmount(userId: string, amount: number, reason?: string, reference?: string | null): Promise<void> {
    await this.applyChange(userId, amount, 'credit', reason ?? 'top-up', reference ?? null);
  }
}
