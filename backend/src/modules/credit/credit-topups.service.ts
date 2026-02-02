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
import { TopupBillStorageService } from './topup-bill-storage.service.js';

export type UploadedBillImage = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const TOPUP_REVIEW_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CreditTopupsService {
  constructor(
    @InjectRepository(CreditTopup) private readonly topupsRepo: Repository<CreditTopup>,
    private readonly dataSource: DataSource,
    private readonly balanceService: BalanceService,
    private readonly storage: TopupBillStorageService,
    private readonly pricing: PricingService,
  ) {}

  async createPingPongManualTopup(params: {
    userId: string;
    amount: number;
    transferNote: string;
    note?: string | null;
    billImage: UploadedBillImage;
  }) {
    const { userId, amount, transferNote, note, billImage } = params;

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    const normalizedTransferNote = transferNote.trim();
    if (!normalizedTransferNote) {
      throw new BadRequestException('transfer_note is required');
    }

    const expectedPrefix = `TOPUP_${userId}`;
    if (!normalizedTransferNote.startsWith(expectedPrefix)) {
      throw new BadRequestException(`Transfer note must start with ${expectedPrefix}`);
    }

    if (!billImage) {
      throw new BadRequestException('bill_image is required');
    }

    const allowedMime = ['image/png', 'image/jpeg'];
    if (!allowedMime.includes(billImage.mimetype)) {
      throw new BadRequestException('Bill image must be a PNG or JPG');
    }

    if (billImage.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Bill image must be <= 5MB');
    }

    const topupId = randomUUID();
    const billPath = await this.storage.saveBillImage({ userId, topupId, file: billImage });

    const entity = this.topupsRepo.create({
      id: topupId,
      user: { id: userId } as any,
      amount: Number(amount.toFixed(2)),
      creditAmount: Number(amount.toFixed(2)),
      packageKey: null,
      paymentMethod: CreditTopupPaymentMethod.PINGPONG_MANUAL,
      transferNote: normalizedTransferNote,
      note: note?.trim() ? note.trim() : null,
      billImageUrl: billPath,
      status: CreditTopupStatus.PENDING,
      admin: null,
      adminNote: null,
      reviewedAt: null,
    });

    try {
      const saved = await this.topupsRepo.save(entity);
      return this.mapUserTopup(saved);
    } catch (err: any) {
      // Postgres unique violation
      if (err?.code === '23505') {
        throw new BadRequestException('transfer_note already exists');
      }
      throw err;
    }
  }

  async createPingPongPackageTopup(params: {
    userId: string;
    packageKey: string;
    transferNote: string;
    note?: string | null;
    billImage: UploadedBillImage;
  }) {
    const { userId, packageKey, transferNote, note, billImage } = params;

    const normalizedTransferNote = transferNote.trim();
    if (!normalizedTransferNote) {
      throw new BadRequestException('transfer_note is required');
    }

    const expectedPrefix = `TOPUP_${userId}`;
    if (!normalizedTransferNote.startsWith(expectedPrefix)) {
      throw new BadRequestException(`Transfer note must start with ${expectedPrefix}`);
    }

    if (!billImage) {
      throw new BadRequestException('bill_image is required');
    }

    const allowedMime = ['image/png', 'image/jpeg'];
    if (!allowedMime.includes(billImage.mimetype)) {
      throw new BadRequestException('Bill image must be a PNG or JPG');
    }

    if (billImage.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Bill image must be <= 5MB');
    }

    const { topupPackages } = await this.pricing.getAll();
    const pkg = topupPackages[String(packageKey || '').trim().toLowerCase()];
    if (!pkg) {
      throw new BadRequestException('Invalid package_key');
    }

    if (!Number.isFinite(pkg.price) || pkg.price <= 0) {
      throw new BadRequestException('Invalid package pricing (price)');
    }
    if (!Number.isFinite(pkg.credits) || pkg.credits <= 0) {
      throw new BadRequestException('Invalid package pricing (credits)');
    }

    const topupId = randomUUID();
    const billPath = await this.storage.saveBillImage({ userId, topupId, file: billImage });

    const entity = this.topupsRepo.create({
      id: topupId,
      user: { id: userId } as any,
      // Amount paid (money)
      amount: Number(Number(pkg.price).toFixed(2)),
      // Credits granted (can be larger than amount due to discount)
      creditAmount: Number(Number(pkg.credits).toFixed(2)),
      packageKey: String(packageKey || '').trim().toLowerCase(),
      paymentMethod: CreditTopupPaymentMethod.PINGPONG_MANUAL,
      transferNote: normalizedTransferNote,
      note: note?.trim() ? note.trim() : null,
      billImageUrl: billPath,
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
        throw new BadRequestException('transfer_note already exists');
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
    const qb = this.topupsRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.user', 'user')
      .leftJoinAndSelect('t.admin', 'admin')
      .orderBy('t.created_at', 'DESC');

    if (status) {
      qb.andWhere('t.status = :status', { status });
    }

    const items = await qb.getMany();
    return items.map((t) => ({
      id: t.id,
      user: { id: t.user?.id, email: (t.user as any)?.email },
      amount: Number(t.amount),
      creditAmount: Number((t as any).creditAmount ?? t.amount),
      packageKey: (t as any).packageKey ?? null,
      paymentMethod: t.paymentMethod,
      transferNote: t.transferNote,
      note: t.note ?? null,
      status: t.status,
      adminId: t.admin?.id ?? null,
      adminNote: t.adminNote ?? null,
      createdAt: t.createdAt,
      reviewedAt: t.reviewedAt ?? null,
      billImageUrl: this.billEndpointUrl(t.id),
    }));
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
        throw new BadRequestException('Bill is expired (24h). Please ask user to re-submit.');
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
    return {
      id: t.id,
      amount: Number(t.amount),
      creditAmount: Number((t as any).creditAmount ?? t.amount),
      packageKey: (t as any).packageKey ?? null,
      method: t.paymentMethod,
      status: t.status,
      transferNote: t.transferNote,
      note: t.note ?? null,
      createdAt: t.createdAt,
      reviewedAt: t.reviewedAt ?? null,
      adminNote: t.adminNote ?? null,
      billImageUrl: this.billEndpointUrl(t.id),
    };
  }
}
