import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, DataSource, DeepPartial } from 'typeorm';
import { randomUUID } from 'crypto';

import { Order, OrderStatus, OrderType, PaymentStatus } from './order.entity.js';
import { ListOrdersDto } from './dto/list-orders.dto.js';
import { ScanLabelDto } from './dto/scan-label.dto.js';
import { BalanceService } from '../../shared/balance/balance.service.js';
import { CreditService } from '../credit/credit.service.js';
import { getServiceKey } from '../../shared/config/pricing.config.js';
import { ScanQueueService, ScanJobPayload } from './scan-queue.service.js';
import { BalanceTransaction } from '../../shared/balance/balance-transaction.entity.js';
import { User } from '../users/user.entity.js';
import { SERVICE_CREDIT_COST, getServiceCost } from '../../shared/config/pricing.config.js';

export type OrderListItem = {
  id: string;
  orderType: OrderType;
  designSubtype?: string | null;
  trackingCode?: string | null;
  labelUrl?: string | null;
  labelImageUrl?: string | null;
  resultUrl?: string | null;
  totalCost: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  user?: { id: string; email?: string | null } | null;
};

export type OrderListResponse = {
  data: OrderListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    private readonly balanceService: BalanceService,
    private readonly creditService: CreditService,
    private readonly scanQueue: ScanQueueService,
    private readonly dataSource: DataSource,
  ) {}

  private enforceDesignRules(order: Order) {
    if (order.orderType === OrderType.DESIGN) {
      if (order.trackingCode) {
        // tracking code should not be present for design orders; sanitize but do not hard-fail legacy data
        order.trackingCode = null;
      }
      if (!order.designSubtype) {
        // keep compatibility but flag missing subtype
        // eslint-disable-next-line no-console
        console.warn(`Design order ${order.id} missing designSubtype`);
      }
    }
  }

  private applyFilters(qb: SelectQueryBuilder<Order>, filters: ListOrdersDto) {
    if (filters.userId) {
      qb.andWhere('o.user_id = :userId', { userId: filters.userId });
    }
    if (filters.orderType) {
      qb.andWhere('o.orderType = :orderType', { orderType: filters.orderType });
    }
    if (filters.designSubtype) {
      qb.andWhere('o.designSubtype = :designSubtype', { designSubtype: filters.designSubtype });
    }
    if (filters.orderStatus) {
      qb.andWhere('o.orderStatus = :orderStatus', { orderStatus: filters.orderStatus });
    }
    if (filters.paymentStatus) {
      qb.andWhere('o.paymentStatus = :paymentStatus', { paymentStatus: filters.paymentStatus });
    }
    if (filters.search) {
      const search = filters.search.trim();
      qb.andWhere('(o.id::text ILIKE :search OR o.trackingCode ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (filters.startDate) {
      qb.andWhere('o.createdAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      qb.andWhere('o.createdAt <= :endDate', { endDate: filters.endDate });
    }
  }

  async listOrders(filters: ListOrdersDto, options?: { includeUserEmail?: boolean }): Promise<OrderListResponse> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const qb = this.ordersRepo.createQueryBuilder('o');

    if (options?.includeUserEmail) {
      qb.leftJoinAndSelect('o.user', 'user');
    }

    this.applyFilters(qb, filters);
    qb.orderBy('o.createdAt', 'DESC');

    const [data, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();

    const mapped: OrderListItem[] = data.map((order) => ({
      id: order.id,
      orderType: order.orderType,
      designSubtype: order.designSubtype ?? null,
      trackingCode: order.trackingCode ?? null,
      labelUrl: order.labelUrl ?? null,
      labelImageUrl: order.labelImageUrl ?? null,
      resultUrl: order.resultUrl ?? null,
      totalCost: order.totalCost,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      user: options?.includeUserEmail && order.user ? { id: order.user.id, email: order.user.email ?? null } : undefined,
    }));

    return {
      data: mapped,
      meta: { page, limit, total },
    };
  }

  async getOrderById(orderId: string, scope?: { userId?: string }): Promise<Order> {
    const qb = this.ordersRepo.createQueryBuilder('o').where('o.id = :orderId', { orderId });
    if (scope?.userId) {
      qb.andWhere('o.user_id = :scopeUserId', { scopeUserId: scope.userId });
    }
    const order = await qb.getOne();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private detectCarrier(input: { trackingCode?: string | null }): string | null {
    if (input.trackingCode) {
      const code = input.trackingCode.replace(/\s+/g, '').toUpperCase();
      // This product currently supports USPS only.
      if (/^(94|93|92|95)[0-9]{20}$/i.test(code) || /^[A-Z]{2}[0-9]{9}US$/i.test(code)) return 'USPS';
    }
    return null;
  }

  private resolveServiceKey(order: Pick<Order, 'orderType' | 'designSubtype'>): string {
    if (order.orderType === OrderType.ACTIVE_TRACKING) return 'scan_label';
    if (order.orderType === OrderType.EMPTY_PACKAGE) return 'empty_package';
    if (order.orderType === OrderType.DESIGN) {
      const key = getServiceKey(order as any);
      if (!key) throw new BadRequestException('Unable to determine service type for this order');
      return key;
    }
    throw new BadRequestException('Unable to determine service type for this order');
  }

  async createScanLabelOrder(userId: string, dto: ScanLabelDto, opts?: { skipDebit?: boolean }) {
    const trackingCode = dto.trackingCode?.trim();
    if (!trackingCode) {
      throw new BadRequestException('trackingCode is required');
    }

    const carrier = this.detectCarrier({ trackingCode });
    if (!carrier) {
      throw new BadRequestException('Unable to detect carrier from input');
    }

    // Wrap order creation + optional debit in a single transaction to keep balances correct.
    // If balance is insufficient, create the order as UNPAID and do not enqueue processing.
    const order = await this.dataSource.transaction(async (manager) => {
      const expectedCost = await this.creditService.getCostForService('scan_label');
      const draft = manager.create(Order, {
        user: { id: userId } as any,
        orderType: OrderType.ACTIVE_TRACKING,
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        totalCost: expectedCost,
        trackingCode,
        labelUrl: null,
        carrier,
      });
      const saved = await manager.save(draft);

      if (!opts?.skipDebit) {
        const debit = await this.creditService.tryConsume(userId, 'scan_label', saved.id, manager as any);
        if (debit.ok) {
          saved.paymentStatus = PaymentStatus.PAID;
          saved.orderStatus = OrderStatus.PROCESSING;
          await manager.save(saved);
        }
      }
      return saved;
    });

    if (!opts?.skipDebit && order.paymentStatus === PaymentStatus.PAID) {
      const job: ScanJobPayload = {
        jobId: randomUUID(),
        orderId: order.id,
        userId,
        carrier,
        trackingCode,
        labelUrl: null,
        attempts: 0,
      };
      await this.scanQueue.enqueue(job);
    }

    return order;
  }

  async importTrackingBulk(userId: string, trackingCodes: string[]) {
    const normalized = Array.from(
      new Set(
        (trackingCodes ?? [])
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );

    if (normalized.length === 0) {
      throw new BadRequestException('No tracking codes provided');
    }

    const results: { trackingCode: string; ok: boolean; orderId?: string; paymentStatus?: PaymentStatus; error?: string }[] = [];
    let exhausted = false;
    for (const trackingCode of normalized) {
      try {
        const order = await this.createScanLabelOrder(userId, { trackingCode } as ScanLabelDto, { skipDebit: exhausted });
        results.push({ trackingCode, ok: true, orderId: order.id, paymentStatus: order.paymentStatus });
        if (!exhausted && order.paymentStatus === PaymentStatus.UNPAID) exhausted = true;
      } catch (err: any) {
        const msg = err?.response?.message ?? err?.message ?? 'Failed';
        results.push({ trackingCode, ok: false, error: Array.isArray(msg) ? msg.join(', ') : String(msg) });
      }
    }

    return {
      total: normalized.length,
      created: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  async updateOrderStatus(orderId: string, orderStatus: OrderStatus): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    // If moving to processing or completed, enforce duplicate tracking checks for active_tracking orders
    if ((orderStatus === OrderStatus.PROCESSING || orderStatus === OrderStatus.COMPLETED) && order.orderType === OrderType.ACTIVE_TRACKING) {
      await this.ensureNoDuplicateTracking(order);
    }
    // For DESIGN orders, do not allow completing without a resultUrl
    if (order.orderType === OrderType.DESIGN && orderStatus === OrderStatus.COMPLETED && !order.resultUrl) {
      throw new BadRequestException('Cannot mark design order as completed without a resultUrl');
    }

    order.orderStatus = orderStatus;
    this.enforceDesignRules(order);
    return this.ordersRepo.save(order);
  }

  async updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    order.paymentStatus = paymentStatus;
    this.enforceDesignRules(order);
    return this.ordersRepo.save(order);
  }

  async updateResultUrl(orderId: string, resultUrl: string): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    order.resultUrl = resultUrl;
    this.enforceDesignRules(order);
    return this.ordersRepo.save(order);
  }

  async updateAdminNote(orderId: string, adminNote: string | null): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    order.adminNote = adminNote;
    this.enforceDesignRules(order);
    return this.ordersRepo.save(order);
  }

  /**
   * Admin action: mark a pending order as processing when admin starts work on it.
   */
  async startProcessing(orderId: string): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId }, relations: ['user'] });
    if (!order) throw new NotFoundException('Order not found');

    // Only allow starting when PENDING or ensure idempotent behavior for PROCESSING
    if (![OrderStatus.PENDING, OrderStatus.PROCESSING].includes(order.orderStatus)) {
      throw new BadRequestException('Only orders in pending or processing state can be started');
    }

    // For active tracking orders, ensure tracking code uniqueness before starting processing.
    if (order.orderType === OrderType.ACTIVE_TRACKING) {
      await this.ensureNoDuplicateTracking(order);
    }

    const serviceKey = this.resolveServiceKey(order);

    // Perform debit + transition in a single transaction and ensure idempotency
    const updated = await this.dataSource.transaction(async (manager) => {
      // reload order with lock to avoid races
      const txOrder = await manager.findOne(Order, { where: { id: order.id } });
      if (!txOrder) throw new NotFoundException('Order not found');

      // If already completed/failed, don't proceed
      if (![OrderStatus.PENDING, OrderStatus.PROCESSING].includes(txOrder.orderStatus)) {
        throw new BadRequestException('Order is not in a startable state');
      }

      const expectedCost = await this.creditService.getCostForService(serviceKey as string);

      // Check if a debit transaction already exists for this order
      const existingTx = await manager
        .createQueryBuilder(BalanceTransaction, 'bt')
        .where('bt.order_id = :orderId', { orderId: txOrder.id })
        .andWhere('bt.amount < 0')
        .getOne();

      // If already marked paid (manually or previously), skip charging again.
      if (txOrder.paymentStatus === PaymentStatus.PAID || existingTx) {
        txOrder.paymentStatus = PaymentStatus.PAID;
      } else {
        // If there is no debit yet, perform debit
        const uid = txOrder.user?.id ?? order.user?.id;
        if (!uid) throw new NotFoundException('User not found');
        // Use CreditService.consume to debit canonical pricing
        await this.creditService.consume(uid, serviceKey as string, txOrder.id, manager as any);
        txOrder.paymentStatus = PaymentStatus.PAID;
      }

      // Always persist expected credit cost for display.
      txOrder.totalCost = expectedCost;

      // Update order status to PROCESSING if not already
      txOrder.orderStatus = OrderStatus.PROCESSING;
      // Enforce design rules (sanitization)
      this.enforceDesignRules(txOrder);
      await manager.save(txOrder);
      return txOrder;
    });

    return updated;
  }

  /**
   * Attempt to auto-pay a specific order (typically right after import).
   * Does not throw on insufficient balance.
   */
  async autoPayOrderIfPossible(userId: string, orderId: string): Promise<{ paid: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager
        .createQueryBuilder(Order, 'o')
        .where('o.id = :orderId', { orderId })
        .andWhere('o.user_id = :userId', { userId })
        .setLock('pessimistic_write')
        .getOne();

      if (!order) throw new NotFoundException('Order not found');
      if (order.paymentStatus === PaymentStatus.PAID) return { paid: true };

      // Keep expected credit cost populated even when unpaid.
      try {
        const expectedCost = await this.creditService.getCostForService(this.resolveServiceKey(order));
        order.totalCost = expectedCost;
        await manager.save(order);
      } catch {
        // ignore
      }

      const existingTx = await manager
        .createQueryBuilder(BalanceTransaction, 'bt')
        .where('bt.order_id = :orderId', { orderId: order.id })
        .andWhere('bt.amount < 0')
        .getOne();
      if (existingTx) {
        order.paymentStatus = PaymentStatus.PAID;
        await manager.save(order);
        return { paid: true };
      }

      const serviceKey = this.resolveServiceKey(order);
      const debit = await this.creditService.tryConsume(userId, serviceKey, order.id, manager as any);
      if (!debit.ok) return { paid: false };

      order.paymentStatus = PaymentStatus.PAID;
      await manager.save(order);
      return { paid: true };
    });
  }

  /**
   * Pay selected unpaid orders, in the given order.
   * Stops when the user runs out of balance.
   */
  async payOrders(userId: string, orderIds: string[]): Promise<{ paidOrderIds: string[]; unpaidOrderIds: string[] }> {
    const unique = Array.from(new Set((orderIds ?? []).filter(Boolean)));
    if (unique.length === 0) {
      return { paidOrderIds: [], unpaidOrderIds: [] };
    }

    const toEnqueue: Array<{ orderId: string; carrier: string; trackingCode: string }> = [];
    const paidOrderIds: string[] = [];
    const unpaidOrderIds: string[] = [];

    await this.dataSource.transaction(async (manager) => {
      for (const orderId of unique) {
        const order = await manager
          .createQueryBuilder(Order, 'o')
          .where('o.id = :orderId', { orderId })
          .andWhere('o.user_id = :userId', { userId })
          .setLock('pessimistic_write')
          .getOne();

        if (!order) {
          continue;
        }

        // Keep expected credit cost populated for UI.
        try {
          const expectedCost = await this.creditService.getCostForService(this.resolveServiceKey(order));
          order.totalCost = expectedCost;
          await manager.save(order);
        } catch {
          // ignore
        }

        if (order.paymentStatus === PaymentStatus.PAID) {
          paidOrderIds.push(order.id);
          continue;
        }

        const existingTx = await manager
          .createQueryBuilder(BalanceTransaction, 'bt')
          .where('bt.order_id = :orderId', { orderId: order.id })
          .andWhere('bt.amount < 0')
          .getOne();
        if (existingTx) {
          order.paymentStatus = PaymentStatus.PAID;
          await manager.save(order);
          paidOrderIds.push(order.id);
          continue;
        }

        const serviceKey = this.resolveServiceKey(order);
        const debit = await this.creditService.tryConsume(userId, serviceKey, order.id, manager as any);
        if (!debit.ok) {
          unpaidOrderIds.push(order.id);
          // stop processing remaining orders (top-to-bottom)
          break;
        }

        order.paymentStatus = PaymentStatus.PAID;
        // For scan orders, once paid we can begin processing.
        if (order.orderType === OrderType.ACTIVE_TRACKING && order.trackingCode && order.carrier) {
          order.orderStatus = OrderStatus.PROCESSING;
          toEnqueue.push({ orderId: order.id, carrier: order.carrier, trackingCode: order.trackingCode });
        }
        await manager.save(order);
        paidOrderIds.push(order.id);
      }

      const remaining = unique.filter((id) => !paidOrderIds.includes(id) && !unpaidOrderIds.includes(id));
      unpaidOrderIds.push(...remaining);
    });

    for (const j of toEnqueue) {
      await this.scanQueue.enqueue({
        jobId: randomUUID(),
        orderId: j.orderId,
        userId,
        carrier: j.carrier,
        trackingCode: j.trackingCode,
        labelUrl: null,
        attempts: 0,
      });
    }

    return { paidOrderIds, unpaidOrderIds };
  }

  /**
   * Bulk-start processing for multiple orders.
   * Only orders in pending state will be transitioned; others will be ignored.
   */
  async bulkStartProcessing(orderIds: string[]): Promise<Order[]> {
    const results: Order[] = [];
    for (const id of orderIds) {
      try {
        const r = await this.startProcessing(id);
        results.push(r);
      } catch (err) {
        // ignore individual failures so caller can attempt others
      }
    }
    return results;
  }

  /**
   * Ensure no other order (other than the provided one) uses the same tracking code.
   * - For ACTIVE_TRACKING: throw BadRequest on duplicates.
   * - For EMPTY_PACKAGE: allow duplicates but append a warning to adminNote.
   * - For SCAN_LABEL orders: skip uniqueness checks.
   */
  private async ensureNoDuplicateTracking(order: Order) {
    const code = order.trackingCode ?? null;
    if (!code) return;

    // Find any other order with the same tracking code (case-insensitive)
    const dup = await this.ordersRepo
      .createQueryBuilder('o')
      .where('o.trackingCode IS NOT NULL')
      .andWhere('o.trackingCode ILIKE :code', { code })
      .andWhere('o.id != :id', { id: order.id })
      .getOne();

    if (!dup) return;

    if (order.orderType === OrderType.ACTIVE_TRACKING) {
      throw new BadRequestException('Tracking code already in use by another order');
    }

    if (order.orderType === OrderType.EMPTY_PACKAGE) {
      // Allow duplicates but record a visible warning on the order for admins.
      const warning = 'Warning: duplicate tracking code detected';
      order.adminNote = order.adminNote ? `${order.adminNote}\n${warning}` : warning;
      // do not throw; caller will save the order after mutation
      return;
    }
    // For other types (e.g., scan_label), do nothing
  }

  /**
   * Bulk mark orders as failed with an admin note, and optionally refund.
   * Only orders that exist will be attempted; errors on individual orders are collected and re-thrown as aggregate.
   */
  async bulkMarkFailed(orderIds: string[], adminNote: string, refund = false) {
    const errors: { id: string; error: string }[] = [];
    const results: Order[] = [];
    for (const id of orderIds) {
      try {
        const order = await this.getOrderById(id);
        // mark admin note first
        order.adminNote = adminNote;
        await this.ordersRepo.save(order);

        // use markScanFailure to apply failure + optional refund
        await this.markScanFailure(id, 'ADMIN_MARK_FAILED', adminNote, { refund, userId: order.user?.id });
        const updated = await this.getOrderById(id);
        results.push(updated);
      } catch (err) {
        errors.push({ id, error: (err as Error).message });
      }
    }
    if (errors.length > 0) {
      const msg = `Failed for ${errors.length} order(s): ${errors.map((e) => `${e.id}:${e.error}`).join('; ')}`;
      throw new BadRequestException(msg);
    }
    return results;
  }

  /**
   * Bulk archive orders (set archived=true) only when orderStatus is completed or failed.
   */
  async bulkArchive(orderIds: string[]) {
    const qb = this.ordersRepo.createQueryBuilder().update(Order).set({ archived: true }).where('id IN (:...ids)', { ids: orderIds }).andWhere("order_status IN ('completed','failed')");
    const res = await qb.execute();
    // return list of affected orders
    const affected = await this.ordersRepo.createQueryBuilder('o').where('o.id IN (:...ids)', { ids: orderIds }).getMany();
    return affected;
  }

  async markScanSuccess(orderId: string, payload: { trackingCode?: string | null; trackingUrl?: string | null; activatedAt: Date; firstCheckpointAt?: Date | null }) {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    order.orderStatus = OrderStatus.COMPLETED;
    order.trackingCode = payload.trackingCode ?? order.trackingCode;
    order.trackingUrl = payload.trackingUrl ?? order.trackingUrl;
    order.trackingActivatedAt = payload.activatedAt;
    order.firstCheckpointAt = payload.firstCheckpointAt ?? payload.activatedAt;
    order.errorCode = null;
    order.errorReason = null;
    return this.ordersRepo.save(order);
  }

  async markScanFailure(orderId: string, errorCode: string, errorReason: string, opts?: { refund?: boolean; userId?: string }) {
    const order = await this.ordersRepo.findOne({ where: { id: orderId }, relations: ['user'] });
    if (!order) throw new NotFoundException('Order not found');
    order.orderStatus = OrderStatus.FAILED;
    order.errorCode = errorCode;
    order.errorReason = errorReason;
    const saved = await this.ordersRepo.save(order);
    if (opts?.refund && opts.userId) {
      await this.balanceService.creditForOrder(opts.userId, saved, this.balanceService.getScanCost(), 'scan-refund');
    }
    return saved;
  }

  /**
   * Create a lightweight order from an imported Label without performing any balance operations.
   * If an order already exists for this label, return the existing order to avoid duplicates.
   */
  async createOrderFromLabel(label: { id: string; user: { id: string }; serviceType?: string; trackingNumber?: string | null; carrier?: string | null; labelFileUrl?: string | null } & any): Promise<Order> {
    // Check for existing order linked to this label
    const existing = await this.ordersRepo.findOne({ where: { label: { id: label.id } } as any });
    if (existing) return existing;

    // Map label serviceType -> orderType
    let orderType: OrderType = OrderType.ACTIVE_TRACKING;
    const svc = (label.serviceType ?? '').toString().toLowerCase();
    if (svc === 'empty' || svc === 'empty_package') orderType = OrderType.EMPTY_PACKAGE;
    if (svc === 'design') orderType = OrderType.DESIGN;

    const draftInput: DeepPartial<Order> = {
      user: { id: label.user.id } as any,
      label: { id: label.id } as any,
      orderType,
      // Imported orders should start in 'pending' so admins pick them up for processing
      orderStatus: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
      totalCost: 0,
      trackingCode: (orderType === OrderType.ACTIVE_TRACKING || orderType === OrderType.EMPTY_PACKAGE) ? (label.trackingNumber ?? null) : null,
      carrier: (orderType === OrderType.ACTIVE_TRACKING || orderType === OrderType.EMPTY_PACKAGE) ? (label.carrier ?? null) : null,
      labelUrl: label.labelFileUrl ?? null,
      labelImageUrl: label.labelFileUrl ?? null,
    };

    const draft = this.ordersRepo.create(draftInput);

    // Store expected credit cost for display (even before payment).
    try {
      const serviceKey = this.resolveServiceKey({ orderType, designSubtype: null } as any);
      draft.totalCost = await this.creditService.getCostForService(serviceKey);
    } catch {
      // ignore unknown service types; keep default.
    }

    const saved = (await this.ordersRepo.save(draft)) as unknown as Order;
    return saved;
  }
}
