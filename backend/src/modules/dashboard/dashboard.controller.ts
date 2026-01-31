import { Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';

import { UsersService } from '../users/users.service.js';
import { DeviceService } from '../devices/device.service.js';
import { LoginAudit } from '../auth/login-audit.entity.js';
import { Order, OrderStatus, OrderType } from '../orders/order.entity.js';
import { BalanceService } from '../../shared/balance/balance.service.js';
import { BalanceTransaction } from '../../shared/balance/balance-transaction.entity.js';
import { AccessAuthGuard } from '../auth/access-auth.guard.js';
import { RegistrationRequest } from '../admin/registration-request.entity.js';

@Controller()
@UseGuards(AccessAuthGuard)
export class DashboardController {
  private mapOrderStatusToTrackingStatus(orderStatus: OrderStatus): 'pending' | 'in_transit' | 'delivered' | 'cancelled' {
    switch (orderStatus) {
      case OrderStatus.PENDING:
        return 'pending';
      case OrderStatus.PROCESSING:
        return 'in_transit';
      case OrderStatus.COMPLETED:
        return 'delivered';
      case OrderStatus.FAILED:
      default:
        return 'cancelled';
    }
  }

  private mapOrderStatusToEmptyShipping(orderStatus: OrderStatus): 'created' | 'picked_up' | 'shipping' | 'completed' {
    // The system currently doesn't track a full shipping lifecycle for empty package orders.
    // This mapping preserves the existing UI contract with a best-effort translation.
    switch (orderStatus) {
      case OrderStatus.PROCESSING:
        return 'shipping';
      case OrderStatus.COMPLETED:
        return 'completed';
      case OrderStatus.PENDING:
      case OrderStatus.FAILED:
      default:
        return 'created';
    }
  }

  constructor(
    private readonly usersService: UsersService,
    private readonly deviceService: DeviceService,
    @InjectRepository(LoginAudit)
    private readonly loginAuditRepo: Repository<LoginAudit>,
    @InjectRepository(RegistrationRequest)
    private readonly registrationRepo: Repository<RegistrationRequest>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    private readonly balanceService: BalanceService,
    @InjectRepository(BalanceTransaction)
    private readonly txRepo: Repository<BalanceTransaction>,
  ) {}

  @Get('dashboard/summary')
  async getSummary(@Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('User context missing');

    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const [devices, registration] = await Promise.all([
      this.deviceService.listDevicesForUser(userId),
      this.registrationRepo.findOne({ where: { user: { id: userId } as any }, order: { createdAt: 'DESC' } }),
    ]);

    const [activeTrackings, emptyOrders, balance] = await Promise.all([
      this.ordersRepo
        .createQueryBuilder('o')
        .where('o.user_id = :userId', { userId })
        .andWhere('o.order_type = :type', { type: OrderType.ACTIVE_TRACKING })
        .andWhere('o.archived = false')
        .andWhere('o.order_status IN (:...statuses)', { statuses: [OrderStatus.PENDING, OrderStatus.PROCESSING] })
        .getCount(),
      this.ordersRepo
        .createQueryBuilder('o')
        .where('o.user_id = :userId', { userId })
        .andWhere('o.order_type = :type', { type: OrderType.EMPTY_PACKAGE })
        .andWhere('o.archived = false')
        .andWhere('o.order_status IN (:...statuses)', { statuses: [OrderStatus.PENDING, OrderStatus.PROCESSING] })
        .getCount(),
      this.balanceService.getBalance(userId),
    ]);

    return {
      activeTrackings,
      emptyOrders,
      balance,
      // keep a few account details useful to the UI if needed
      email: user.email,
      status: user.status,
      registrationStatus: registration?.state ?? null,
      trustedDevices: devices.length,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  @Get('dashboard/activity')
  async getActivity(@Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('User context missing');

    // Query recent orders for this user (active tracking and empty package)
    const orders = await this.ordersRepo
      .createQueryBuilder('o')
      .where('o.user_id = :userId', { userId })
      .andWhere('o.order_type IN (:...types)', { types: [OrderType.ACTIVE_TRACKING, OrderType.EMPTY_PACKAGE] })
      .orderBy('o.updated_at', 'DESC')
      .limit(50)
      .getMany();

    const combined = orders.map((o) => ({
      id: o.id,
      orderType: o.orderType,
      ref: o.trackingCode ?? o.id,
      status: o.orderStatus,
      amount: o.totalCost,
      updatedAt: o.updatedAt,
    }));

    return combined.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
  }

  @Get('trackings')
  async getTrackings(@Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('User context missing');

    const orders = await this.ordersRepo
      .createQueryBuilder('o')
      .where('o.user_id = :userId', { userId })
      .andWhere('o.order_type = :type', { type: OrderType.ACTIVE_TRACKING })
      .andWhere('o.archived = false')
      .orderBy('o.updated_at', 'DESC')
      .limit(200)
      .getMany();

    return orders.map((o) => ({
      id: o.id,
      tracking: o.trackingCode ?? '',
      status: this.mapOrderStatusToTrackingStatus(o.orderStatus),
      price: o.totalCost,
      updatedAt: o.updatedAt.toISOString(),
    }));
  }

  @Get('empty-orders')
  async getEmptyOrders(@Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('User context missing');

    const orders = await this.ordersRepo
      .createQueryBuilder('o')
      .where('o.user_id = :userId', { userId })
      .andWhere('o.order_type = :type', { type: OrderType.EMPTY_PACKAGE })
      .andWhere('o.archived = false')
      .orderBy('o.updated_at', 'DESC')
      .limit(200)
      .getMany();

    return orders.map((o) => ({
      id: o.id,
      tracking: o.trackingCode ?? '',
      price: o.totalCost,
      shipping: this.mapOrderStatusToEmptyShipping(o.orderStatus),
      labelLink: o.resultUrl ?? o.labelUrl ?? null,
      updatedAt: o.updatedAt.toISOString(),
    }));
  }

  @Get('balance')
  async getBalance(@Req() req: Request & { user?: any }) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('User context missing');
    const balance = await this.balanceService.getBalance(userId);
    const transactions = await this.txRepo
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.order', 'order')
      .where('tx.user_id = :userId', { userId })
      .orderBy('tx.created_at', 'DESC')
      .limit(50)
      .getMany();

    return {
      balance,
      transactions: transactions.map((t) => ({ id: t.id, description: t.reason ?? t.reference ?? '', amount: t.amount, date: t.createdAt.toISOString() })),
    };
  }
}
