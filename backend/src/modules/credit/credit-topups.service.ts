import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { BalanceService } from '../../shared/balance/balance.service.js';
import { AdminAudit } from '../admin/admin-audit.entity.js';
import { User } from '../users/user.entity.js';
import { PricingService } from '../pricing/pricing.service.js';
import { CreditTopup, CreditTopupPaymentMethod, CreditTopupStatus } from './credit-topup.entity.js';

const TOPUP_REVIEW_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CreditTopupsService {
  constructor(
    @InjectRepository(CreditTopup) private readonly topupsRepo: Repository<CreditTopup>,
    private readonly dataSource: DataSource,
    private readonly balanceService: BalanceService,
    private readonly pricing: PricingService,
  ) {}

  private normalizePingPongTxId(value: string) {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      throw new BadRequestException('pingpong_tx_id is required');
    }
    if (normalized.length > 128) {
      throw new BadRequestException('pingpong_tx_id is too long');
    }
    return normalized;
  }

  async createPingPongTxIdTopup(params: {
    userId: string;
    amountUsd: number;
    pingpongTxId: string;
    note?: string | null;
  }) {
    const { userId, amountUsd, pingpongTxId, note } = params;

    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      throw new BadRequestException('Invalid amount_usd');
    }

    const normalizedTxId = this.normalizePingPongTxId(pingpongTxId);
    const transferNote = `PP_${userId}_${randomUUID().slice(0, 8).toUpperCase()}`;

    const entity = this.topupsRepo.create({
      user: { id: userId } as any,
      amount: Number(Number(amountUsd).toFixed(2)),
      creditAmount: Number(Number(amountUsd).toFixed(2)),
      packageKey: null,
      paymentMethod: CreditTopupPaymentMethod.PINGPONG_MANUAL,
      transferNote,
      pingpongTxId: normalizedTxId,
      note: note?.trim() ? note.trim() : null,
      billImageUrl: null,
      status: CreditTopupStatus.PENDING,
      admin: null,
      adminNote: null,
      reviewedAt: null,
    });

    try {
      const saved = await this.topupsRepo.save(entity);
      return this.mapUserTopup(saved);
    } catch (err: any) {
      if (err?.code === '23505') {
        // Could be transfer_note or pingpong_tx_id uniqueness
        throw new BadRequestException('Transaction ID already exists');
      }
      throw err;
    }
  }

  async createPingPongPackageTxIdTopup(params: {
    userId: string;
    packageKey: string;
    pingpongTxId: string;
    note?: string | null;
  }) {
    const { userId, packageKey, pingpongTxId, note } = params;

    const normalizedTxId = this.normalizePingPongTxId(pingpongTxId);

    const { topupPackages } = await this.pricing.getAll();
    const normalizedPackageKey = String(packageKey || '').trim().toLowerCase();
    const pkg = topupPackages[normalizedPackageKey];
    if (!pkg) {
      throw new BadRequestException('Invalid package_key');
    }

    if (!Number.isFinite(pkg.price) || pkg.price <= 0) {
      throw new BadRequestException('Invalid package pricing (price)');
    }
    if (!Number.isFinite(pkg.credits) || pkg.credits <= 0) {
      throw new BadRequestException('Invalid package pricing (credits)');
    }

    const transferNote = `PP_${userId}_${randomUUID().slice(0, 8).toUpperCase()}`;
    const entity = this.topupsRepo.create({
      user: { id: userId } as any,
      amount: Number(Number(pkg.price).toFixed(2)),
      creditAmount: Number(Number(pkg.credits).toFixed(2)),
      packageKey: normalizedPackageKey,
      paymentMethod: CreditTopupPaymentMethod.PINGPONG_MANUAL,
      transferNote,
      pingpongTxId: normalizedTxId,
      note: note?.trim() ? note.trim() : null,
      billImageUrl: null,
      status: CreditTopupStatus.PENDING,
      admin: null,
      adminNote: null,
      reviewedAt: null,
    });

    try {
      const saved = await this.topupsRepo.save(entity);
      return this.mapUserTopup(saved);
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new BadRequestException('Transaction ID already exists');
      }
      throw err;
    }
  }

  async listUserTopups(userId: string) {
    const topups = await this.topupsRepo.find({
      where: { user: { id: userId } as any },
      order: { createdAt: 'DESC' },
    });
    return topups.map((t) => this.mapUserTopup(t));
  }

  async listAdminTopups(status?: CreditTopupStatus) {
    return this.listAdminTopupsPaged({ status });
  }

  async listAdminTopupsPaged(params: { status?: CreditTopupStatus; q?: string; page?: number; limit?: number }) {
    const status = params.status;
    const page = Math.max(1, Number(params.page ?? 1) || 1);
    const limit = Math.min(200, Math.max(1, Number(params.limit ?? 50) || 50));
    const q = (params.q ?? '').trim();

    const qb = this.topupsRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.user', 'user')
      .leftJoinAndSelect('t.admin', 'admin')
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      qb.andWhere('t.status = :status', { status });
    }

    if (q) {
      qb.andWhere(
        [
          'LOWER(user.email) LIKE :q',
          'CAST(t.user_id AS text) LIKE :q',
          'CAST(t.id AS text) LIKE :q',
          'LOWER(COALESCE(t.pingpong_tx_id, \'\')) LIKE :q',
          'LOWER(COALESCE(t.transfer_note, \'\')) LIKE :q',
        ].join(' OR '),
        { q: `%${q.toLowerCase()}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();

    const data = items.map((t) => ({
      id: t.id,
      user: { id: t.user?.id, email: (t.user as any)?.email },
      amount: Number(t.amount),
      amountUsd: Number(t.amount),
      amount_usd: Number(t.amount),
      creditAmount: Number((t as any).creditAmount ?? t.amount),
      credits: Number((t as any).creditAmount ?? t.amount),
      packageKey: (t as any).packageKey ?? null,
      paymentMethod: t.paymentMethod,
      payment_method: t.paymentMethod,
      transferNote: t.transferNote,
      pingpongTxId: (t as any).pingpongTxId ?? null,
      pingpong_tx_id: (t as any).pingpongTxId ?? null,
      note: t.note ?? null,
      status: t.status,
      adminId: t.admin?.id ?? null,
      adminNote: t.adminNote ?? null,
      admin_note: t.adminNote ?? null,
      createdAt: t.createdAt,
      created_at: t.createdAt,
      reviewedAt: t.reviewedAt ?? null,
      confirmedAt: t.reviewedAt ?? null,
      confirmed_at: t.reviewedAt ?? null,
      billImageUrl: t.billImageUrl ? this.billEndpointUrl(t.id) : null,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async getTopupForBillAccess(params: { requesterId: string; requesterRole?: string; topupId: string }) {
    const topup = await this.topupsRepo.findOne({ where: { id: params.topupId }, relations: ['user'] });
    if (!topup) throw new NotFoundException('Top-up not found');

    const isAdmin = params.requesterRole === 'admin';
    if (!isAdmin && topup.user?.id !== params.requesterId) {
      throw new NotFoundException('Top-up not found');
    }

    return topup;
  }

  async approveTopup(params: { topupId: string; adminId: string }) {
    const { topupId, adminId } = params;

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CreditTopup);
      // IMPORTANT (Postgres): `FOR UPDATE` cannot be applied to the nullable side
      // of an OUTER JOIN. TypeORM's `findOne({ relations, lock })` uses LEFT JOINs,
      // which can produce: "FOR UPDATE cannot be applied to the nullable side of an outer join".
      // Fix: lock only the top-up row (OF t), and join user without locking it.
      const topup = await repo
        .createQueryBuilder('t')
        .innerJoinAndSelect('t.user', 'user')
        .where('t.id = :id', { id: topupId })
        .setLock('pessimistic_write', undefined, ['t'])
        .getOne();
      if (!topup) throw new NotFoundException('Top-up not found');
      if (topup.status !== CreditTopupStatus.PENDING) {
        throw new BadRequestException('Only pending top-ups can be approved');
      }

      const createdAtMs = topup.createdAt?.getTime?.() ?? new Date(topup.createdAt as any).getTime();
      if (Date.now() - createdAtMs > TOPUP_REVIEW_TTL_MS) {
        throw new BadRequestException('Top-up request is expired (24h). Please ask user to re-submit.');
      }

      topup.status = CreditTopupStatus.APPROVED;
      topup.admin = { id: adminId } as any;
      topup.reviewedAt = new Date();
      topup.adminNote = null;
      await repo.save(topup);

      // Ledger-backed credit update in the same transaction
      await this.balanceService.applyChange(
        topup.user.id,
        Number((topup as any).creditAmount ?? topup.amount),
        'credit',
        'topup_manual',
        `topup:${topup.id}`,
        adminId,
        manager as any,
      );

      const auditRepo = manager.getRepository(AdminAudit);
      await auditRepo.save(
        auditRepo.create({
          admin: { id: adminId } as any,
          action: 'credit_topup_approved',
          targetId: topup.id,
          payload: {
            userId: topup.user.id,
            amount: Number(topup.amount),
            creditAmount: Number((topup as any).creditAmount ?? topup.amount),
            packageKey: (topup as any).packageKey ?? null,
            paymentMethod: topup.paymentMethod,
            transferNote: topup.transferNote,
          },
        }),
      );

      return { ok: true };
    });
  }

  async rejectTopup(params: { topupId: string; adminId: string; adminNote: string }) {
    const { topupId, adminId, adminNote } = params;
    const note = adminNote?.trim();
    if (!note) throw new BadRequestException('admin_note is required');

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CreditTopup);
      const topup = await repo
        .createQueryBuilder('t')
        .innerJoinAndSelect('t.user', 'user')
        .where('t.id = :id', { id: topupId })
        .setLock('pessimistic_write', undefined, ['t'])
        .getOne();
      if (!topup) throw new NotFoundException('Top-up not found');
      if (topup.status !== CreditTopupStatus.PENDING) {
        throw new BadRequestException('Only pending top-ups can be rejected');
      }

      // We only enforce the 24h TTL for approvals (to prevent crediting from stale bills).
      // Rejecting after 24h is safe and lets admins close out old pending requests.

      topup.status = CreditTopupStatus.REJECTED;
      topup.admin = { id: adminId } as any;
      topup.reviewedAt = new Date();
      topup.adminNote = note;
      await repo.save(topup);

      const auditRepo = manager.getRepository(AdminAudit);
      await auditRepo.save(
        auditRepo.create({
          admin: { id: adminId } as any,
          action: 'credit_topup_rejected',
          targetId: topup.id,
          payload: {
            userId: topup.user.id,
            amount: Number(topup.amount),
            creditAmount: Number((topup as any).creditAmount ?? topup.amount),
            packageKey: (topup as any).packageKey ?? null,
            paymentMethod: topup.paymentMethod,
            transferNote: topup.transferNote,
            adminNote: note,
          },
        }),
      );

      return { ok: true };
    });
  }

  private billEndpointUrl(topupId: string) {
    // Single endpoint works for both user+admin (auth required)
    return `/api/credits/topups/${topupId}/bill`;
  }

  private mapUserTopup(t: CreditTopup) {
    const amountUsd = Number(t.amount);
    const credits = Number((t as any).creditAmount ?? t.amount);
    return {
      id: t.id,
      amount: Number(t.amount),
      amountUsd,
      amount_usd: amountUsd,
      creditAmount: Number((t as any).creditAmount ?? t.amount),
      packageKey: (t as any).packageKey ?? null,
      method: t.paymentMethod,
      paymentMethod: t.paymentMethod,
      payment_method: t.paymentMethod,
      status: t.status,
      transferNote: t.transferNote,
      pingpongTxId: (t as any).pingpongTxId ?? null,
      pingpong_tx_id: (t as any).pingpongTxId ?? null,
      note: t.note ?? null,
      createdAt: t.createdAt,
      created_at: t.createdAt,
      reviewedAt: t.reviewedAt ?? null,
      confirmedAt: t.reviewedAt ?? null,
      confirmed_at: t.reviewedAt ?? null,
      adminNote: t.adminNote ?? null,
      admin_note: t.adminNote ?? null,
      credits,
      billImageUrl: t.billImageUrl ? this.billEndpointUrl(t.id) : null,
    };
  }
}
